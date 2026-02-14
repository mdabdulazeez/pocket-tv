import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'
import https from 'https'
import { spawn } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Get FFmpeg path from npm package
let ffmpegPath
try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
} catch (e) {
  console.warn('FFmpeg not found, transcoding will be unavailable')
}

// Track active FFmpeg processes so we can clean up
const activeTranscodes = new Map()

function streamProxyPlugin() {
  return {
    name: 'stream-proxy',
    configureServer(server) {

      // Fetch a URL server-side (like VLC does)
      function fetchUrl(targetUrl, res, isM3u8 = false) {
        if (!targetUrl) {
          res.writeHead(400)
          res.end('Missing url')
          return
        }

        const client = targetUrl.startsWith('https') ? https : http
        let origin = ''
        try { const u = new URL(targetUrl); origin = u.origin } catch(e) {}
        
        const opts = {
          headers: {
            'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
            'Accept': '*/*',
            'Referer': origin + '/',
            'Origin': origin,
            'Connection': 'keep-alive',
          },
          timeout: 8000,
        }

        const request = client.get(targetUrl, opts, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            fetchUrl(response.headers.location, res, isM3u8)
            return
          }

          if (response.statusCode !== 200) {
            res.writeHead(response.statusCode || 502)
            res.end('Stream error')
            return
          }

          if (!isM3u8) {
            res.setHeader('Access-Control-Allow-Origin', '*')
            if (response.headers['content-type']) {
              res.setHeader('Content-Type', response.headers['content-type'])
            }
            response.pipe(res)
          } else {
            let body = ''
            response.on('data', (chunk) => { body += chunk })
            response.on('end', () => {
              const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)

              const rewritten = body.split('\n').map(line => {
                const t = line.trim()
                if (t && !t.startsWith('#')) {
                  let fullUrl = t
                  if (!t.startsWith('http')) {
                    fullUrl = baseUrl + t
                  }
                  if (fullUrl.includes('.m3u8') || fullUrl.includes('.m3u')) {
                    return `/m3u8?url=${encodeURIComponent(fullUrl)}`
                  } else {
                    return `/proxy?url=${encodeURIComponent(fullUrl)}`
                  }
                }
                return line
              }).join('\n')

              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
              res.end(rewritten)
            })
          }
        })

        request.on('error', (err) => {
          console.error('Proxy error:', err.message)
          if (!res.headersSent) { res.writeHead(502); res.end('Proxy error') }
        })

        request.on('timeout', () => {
          request.destroy()
          if (!res.headersSent) { res.writeHead(504); res.end('Proxy timeout') }
        })
      }

      // Probe endpoint: detect audio tracks in a stream using FFmpeg
      function handleProbe(targetUrl, res) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')

        if (!ffmpegPath || !targetUrl) {
          res.end(JSON.stringify({ tracks: [] }))
          return
        }

        let origin = ''
        try { const u = new URL(targetUrl); origin = u.origin } catch(e) {}

        const ffmpeg = spawn(ffmpegPath, [
          '-hide_banner',
          '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
          '-headers', 'Referer: ' + origin + '/\r\n',
          '-analyzeduration', '2000000',
          '-probesize', '2000000',
          '-i', targetUrl,
          '-t', '0',
          '-f', 'null',
          '-'
        ])

        let stderr = ''
        let done = false
        const finish = (tracks) => {
          if (done) return
          done = true
          try { ffmpeg.kill('SIGKILL') } catch(e) {}
          res.end(JSON.stringify({ tracks }))
        }

        ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })

        ffmpeg.on('close', () => {
          if (done) return
          // Parse audio streams: "Stream #0:1(eng): Audio: aac ..."
          const tracks = []
          const lines = stderr.split('\n')
          for (const line of lines) {
            const m = line.match(/Stream\s+#0:(\d+)(?:\((\w+)\))?.*?:\s*Audio:\s*(\w+)/)
            if (m) {
              const lang = m[2] || ''
              tracks.push({
                id: tracks.length,
                name: lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : `Track ${tracks.length + 1}`,
                lang: lang,
                codec: m[3] || ''
              })
            }
          }
          finish(tracks)
        })

        ffmpeg.on('error', () => finish([]))
        // Hard timeout: 6 seconds
        setTimeout(() => finish([]), 6000)
      }

      // Transcode endpoint: FFmpeg converts any codec to H.264+AAC MPEG-TS
      function handleTranscode(targetUrl, res, audioTrackIndex) {
        if (!ffmpegPath) {
          res.writeHead(500)
          res.end('FFmpeg not available')
          return
        }

        if (!targetUrl) {
          res.writeHead(400)
          res.end('Missing url')
          return
        }

        const trackIdx = parseInt(audioTrackIndex) || 0
        console.log(`[transcode] Starting: ${targetUrl} (audio track: ${trackIdx})`)

        // Kill any existing transcode for this URL
        if (activeTranscodes.has(targetUrl)) {
          try { activeTranscodes.get(targetUrl).kill('SIGKILL') } catch(e) {}
          activeTranscodes.delete(targetUrl)
        }

        const ffmpeg = spawn(ffmpegPath, [
          '-hide_banner',
          '-loglevel', 'warning',
          // Mimick VLC user-agent for input
          '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
          '-headers', 'Referer: ' + (() => { try { return new URL(targetUrl).origin + '/' } catch(e) { return '' } })() + '\r\n',
          // Fast probe for quicker startup
          '-analyzeduration', '2000000',
          '-probesize', '2000000',
          // Timeout for connection
          '-timeout', '10000000',
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          // Input
          '-i', targetUrl,
          // Map: first video stream + selected audio track
          '-map', '0:v:0?',
          '-map', `0:a:${trackIdx}?`,
          // Video: scale down to 720p max, transcode to H.264
          '-vf', 'scale=-2:min(720\\,ih)',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-pix_fmt', 'yuv420p',
          '-g', '50',
          '-b:v', '2000k',
          '-maxrate', '2500k',
          '-bufsize', '5000k',
          // Audio: transcode to AAC
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',
          // Output: MPEG-TS to stdout
          '-f', 'mpegts',
          '-flush_packets', '1',
          'pipe:1'
        ])

        activeTranscodes.set(targetUrl, ffmpeg)

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'video/mp2t')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('Transfer-Encoding', 'chunked')

        ffmpeg.stdout.pipe(res)

        ffmpeg.stderr.on('data', (data) => {
          const msg = data.toString().trim()
          if (msg) console.error(`[transcode] FFmpeg: ${msg}`)
        })

        ffmpeg.on('error', (err) => {
          console.error(`[transcode] Spawn error: ${err.message}`)
          activeTranscodes.delete(targetUrl)
          if (!res.headersSent) { res.writeHead(500); res.end('Transcode error') }
        })

        ffmpeg.on('close', (code) => {
          console.log(`[transcode] FFmpeg exited with code ${code}`)
          activeTranscodes.delete(targetUrl)
          if (!res.writableEnded) res.end()
        })

        // Clean up when client disconnects
        res.on('close', () => {
          console.log(`[transcode] Client disconnected, killing FFmpeg`)
          activeTranscodes.delete(targetUrl)
          try { ffmpeg.kill('SIGKILL') } catch(e) {}
        })
      }

      // Quick check if a stream URL is reachable (fast — 2s timeout)
      function handleCheck(targetUrl, res) {
        if (!targetUrl) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(200)
          res.end(JSON.stringify({ ok: false }))
          return
        }
        const client = targetUrl.startsWith('https') ? https : http
        let origin = ''
        try { const u = new URL(targetUrl); origin = u.origin } catch(e) {}
        let done = false
        const finish = (ok, status) => {
          if (done) return
          done = true
          try { request.destroy() } catch(e) {}
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok, status }))
        }
        
        const request = client.get(targetUrl, {
          headers: {
            'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
            'Accept': '*/*',
            'Referer': origin + '/',
          },
          timeout: 2000,
        }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400) {
            // Redirect — consider it alive
            finish(true, response.statusCode)
          } else if (response.statusCode === 200) {
            response.once('data', () => finish(true, 200))
            // If no data in 1.5s, still consider alive (some streams are slow to start)
            setTimeout(() => finish(true, 200), 1500)
          } else {
            finish(false, response.statusCode)
          }
        })
        request.on('error', () => finish(false, 0))
        request.on('timeout', () => { request.destroy(); finish(false, 0) })
        // Hard deadline
        setTimeout(() => finish(false, 0), 2500)
      }

      // Register middleware
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost')

        if (url.pathname === '/m3u8') {
          fetchUrl(url.searchParams.get('url'), res, true)
        } else if (url.pathname === '/proxy') {
          fetchUrl(url.searchParams.get('url'), res, false)
        } else if (url.pathname === '/transcode') {
          handleTranscode(url.searchParams.get('url'), res, url.searchParams.get('audio'))
        } else if (url.pathname === '/probe') {
          handleProbe(url.searchParams.get('url'), res)
        } else if (url.pathname === '/check') {
          handleCheck(url.searchParams.get('url'), res)
        } else {
          next()
        }
      })

      // Clean up all FFmpeg processes on server shutdown
      server.httpServer?.on('close', () => {
        for (const [url, proc] of activeTranscodes) {
          try { proc.kill('SIGKILL') } catch(e) {}
        }
        activeTranscodes.clear()
      })
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), streamProxyPlugin()],
  server: {
    host: true,
    port: 3000
  }
})
