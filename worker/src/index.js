/**
 * Cloudflare Worker: CORS proxy for Pocket TV (free hosting).
 * Handles /m3u8 and /proxy so streams work when the app is on GitHub Pages.
 * No FFmpeg — transcoding is not available in Workers.
 */

const VLC_HEADERS = {
  'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
  'Accept': '*/*',
}

function getOrigin(url) {
  try {
    return new URL(url).origin + '/'
  } catch {
    return ''
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors })
    }

    const targetUrl = url.searchParams.get('url')
    if (!targetUrl) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const workerOrigin = url.origin

    // /m3u8 — fetch playlist and rewrite segment URLs to go through this worker
    if (path === '/m3u8') {
      const res = await fetch(targetUrl, {
        headers: {
          ...VLC_HEADERS,
          'Referer': getOrigin(targetUrl),
          'Origin': getOrigin(targetUrl),
        },
      })
      if (!res.ok) {
        return new Response('Upstream error', { status: res.status, headers: cors })
      }
      const contentType = res.headers.get('Content-Type') || 'application/vnd.apple.mpegurl'
      let body = await res.text()
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)

      body = body.split('\n').map(line => {
        const t = line.trim()
        if (t && !t.startsWith('#')) {
          let fullUrl = t
          if (!t.startsWith('http')) fullUrl = baseUrl + t
          if (fullUrl.includes('.m3u8') || fullUrl.includes('.m3u')) {
            return `${workerOrigin}/m3u8?url=${encodeURIComponent(fullUrl)}`
          }
          return `${workerOrigin}/proxy?url=${encodeURIComponent(fullUrl)}`
        }
        return line
      }).join('\n')

      return new Response(body, {
        headers: { ...cors, 'Content-Type': contentType },
      })
    }

    // /proxy — pass-through for segments and direct streams
    if (path === '/proxy') {
      const res = await fetch(targetUrl, {
        headers: {
          ...VLC_HEADERS,
          'Referer': getOrigin(targetUrl),
          'Origin': getOrigin(targetUrl),
        },
      })
      if (!res.ok) {
        return new Response('Upstream error', { status: res.status, headers: cors })
      }
      const contentType = res.headers.get('Content-Type') || 'application/octet-stream'
      const headers = new Headers(cors)
      headers.set('Content-Type', contentType)
      return new Response(res.body, { headers })
    }

    // /check — quick reachability (for compatibility; app may not use in prod)
    if (path === '/check') {
      try {
        const res = await fetch(targetUrl, {
          method: 'HEAD',
          headers: { ...VLC_HEADERS, 'Referer': getOrigin(targetUrl) },
        })
        return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ ok: false, status: 0 }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Not found', { status: 404, headers: cors })
  },
}
