import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

// Country list with codes and flags
const COUNTRIES = [
  { code: 'all', name: 'All Channels (Global)' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'ae', name: 'UAE', flag: '🇦🇪' },
  { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'pk', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'bd', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'br', name: 'Brazil', flag: '🇧🇷' },
  { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
  { code: 'cn', name: 'China', flag: '🇨🇳' },
  { code: 'ru', name: 'Russia', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkey', flag: '🇹🇷' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'ph', name: 'Philippines', flag: '🇵🇭' },
  { code: 'ng', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'za', name: 'South Africa', flag: '🇿🇦' },
  { code: 'eg', name: 'Egypt', flag: '🇪🇬' },
  { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Poland', flag: '🇵🇱' },
  { code: 'ar', name: 'Argentina', flag: '🇦🇷' },
  { code: 'th', name: 'Thailand', flag: '🇹🇭' },
  { code: 'vn', name: 'Vietnam', flag: '🇻🇳' },
]

// Icons as SVG components
const Icons = {
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  pause: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  prev: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </svg>
  ),
  next: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  tv: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
    </svg>
  ),
  globe: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  signal: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4"/>
    </svg>
  ),
  noSignal: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16M2 2l20 20"/>
    </svg>
  ),
  audio: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  )
}

// Get country URL
const getCountryUrl = (code) => {
  if (code === 'all') return 'https://iptv-org.github.io/iptv/index.m3u'
  return `https://iptv-org.github.io/iptv/countries/${code}.m3u`
}

// Dev: Vite proxy (same origin). Production: Cloudflare Worker proxy if VITE_PROXY_URL set; else direct (e.g. APK).
const isDev = import.meta.env.DEV
const proxyBase = import.meta.env.VITE_PROXY_URL || ''
const proxyM3u8 = (url) => isDev ? `/m3u8?url=${encodeURIComponent(url)}` : (proxyBase ? `${proxyBase}/m3u8?url=${encodeURIComponent(url)}` : url)
const proxyRaw = (url) => isDev ? `/proxy?url=${encodeURIComponent(url)}` : (proxyBase ? `${proxyBase}/proxy?url=${encodeURIComponent(url)}` : url)
const proxyTranscode = (url, audioTrack = 0) => isDev ? `/transcode?url=${encodeURIComponent(url)}&audio=${audioTrack}` : url

// Detect stream type from URL
function detectStreamType(url) {
  const lower = url.toLowerCase()
  // m3u8 / HLS playlists
  if (lower.includes('.m3u8') || lower.includes('.m3u') || lower.includes('/playlist') || lower.includes('/master')) {
    return 'hls'
  }
  // Direct MP4
  if (lower.includes('.mp4') || lower.includes('.mkv') || lower.includes('.webm')) {
    return 'direct'
  }
  // Raw MPEG-TS streams: IP:port, /play/, .ts endpoints, numbered ports
  if (lower.match(/:\d{4,5}$/) || lower.includes('/play/') || lower.match(/:\d{4,5}\//) || lower.endsWith('.ts')) {
    return 'mpegts'
  }
  // Default: try HLS first
  return 'hls'
}

// Parse M3U playlist with language support + filter out known broken
function parseM3U(content) {
  const lines = content.split('\n')
  const channels = []
  let currentChannel = null
  let skipNext = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('#EXTINF:')) {
      const titleMatch = line.match(/,(.+)$/)
      const name = titleMatch ? titleMatch[1].trim() : 'Unknown Channel'
      
      // Clean up tags from channel names but don't skip them
      const cleanName = name.replace(/\s*\[(Geo-blocked|Not 24\/7|Offline)\]\s*/gi, '').trim() || name

      skipNext = false
      const logoMatch = line.match(/tvg-logo="([^"]*)"/)
      const groupMatch = line.match(/group-title="([^"]*)"/)
      const languageMatch = line.match(/tvg-language="([^"]*)"/)
      
      currentChannel = {
        id: channels.length,
        name: cleanName,
        logo: logoMatch ? logoMatch[1] : null,
        group: groupMatch ? groupMatch[1]?.split(';')[0] : 'General',
        language: languageMatch ? languageMatch[1].split(';')[0] : '',
        url: null
      }
    } else if (line && !line.startsWith('#') && currentChannel && !skipNext) {
      // Only add HTTPS or known-working HTTP streams
      currentChannel.url = line
      channels.push(currentChannel)
      currentChannel = null
    } else if (line && !line.startsWith('#')) {
      skipNext = false
      currentChannel = null
    }
  }

  return channels
}

// TV Static Effect
function TVStatic() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      opacity: 0.15,
      animation: 'static 0.5s steps(10) infinite',
      pointerEvents: 'none'
    }} />
  )
}

// Scanlines
function Scanlines() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
      pointerEvents: 'none',
      opacity: 0.5
    }} />
  )
}

// Loading Overlay
function LoadingOverlay({ message }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      zIndex: 50
    }}>
      <TVStatic />
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{
        marginTop: 16,
        color: 'var(--text-secondary)',
        fontSize: 14,
        letterSpacing: '0.05em'
      }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Video Player — smart per-type strategy, no wasted time
function VideoPlayer({ channel, onBack, onPrevious, onNext, onBroken }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [streamInfo, setStreamInfo] = useState('')
  const [showControls, setShowControls] = useState(true)
  const [autoSkipCountdown, setAutoSkipCountdown] = useState(null)
  const [audioTracks, setAudioTracks] = useState([])
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0)
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const controlsTimeout = useRef(null)
  const mountedRef = useRef(true)

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  const handleInteraction = useCallback(() => {
    setShowControls(true)
    hideControlsAfterDelay()
  }, [hideControlsAfterDelay])

  // Auto-skip on error
  useEffect(() => {
    if (error) {
      onBroken(channel.id)
      setAutoSkipCountdown(2)
      const interval = setInterval(() => {
        setAutoSkipCountdown(prev => {
          if (prev <= 1) { clearInterval(interval); onNext(); return null }
          return prev - 1
        })
      }, 700)
      return () => clearInterval(interval)
    }
  }, [error, channel.id, onBroken, onNext])

  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try { if (playerRef.current.destroy) playerRef.current.destroy() } catch(e) {}
      try { if (playerRef.current.unload) playerRef.current.unload() } catch(e) {}
      playerRef.current = null
    }
  }, [])

  // Reset video element cleanly between attempts
  const resetVideo = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.oncanplay = null
      video.ontimeupdate = null
      video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  // Promise-based player with timeout
  const playWithTimeout = useCallback((setupFn, timeoutMs) => {
    return new Promise((resolve) => {
      if (!mountedRef.current) { resolve(false); return }
      let settled = false
      const done = (ok) => { if (!settled) { settled = true; clearTimeout(t); resolve(ok) } }
      const t = setTimeout(() => done(false), timeoutMs)
      setupFn(() => done(true), () => done(false))
    })
  }, [])

  // Probe stream for audio tracks (background, non-blocking)
  const probeAudioTracks = useCallback(async (url) => {
    if (!isDev) return // Probe only works in dev mode (needs server)
    try {
      const res = await fetch(`/probe?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (mountedRef.current && data.tracks && data.tracks.length > 1) {
        setAudioTracks(prev => {
          // Don't override if HLS.js already detected tracks
          if (prev.length > 1) return prev
          return data.tracks
        })
      }
    } catch (e) {
      console.log('[PocketTV] Probe failed:', e.message)
    }
  }, [])

  // Switch to FFmpeg transcoding (called after audio-only detected or audio track change)
  const switchToFFmpeg = useCallback(async (audioTrackIdx = 0) => {
    const video = videoRef.current
    if (!video || !mountedRef.current) return

    // FFmpeg transcoding only works in dev mode (requires local server)
    if (!isDev) {
      console.log(`[PocketTV] FFmpeg not available in production mode`)
      setIsLoading(false)
      return
    }

    console.log(`[PocketTV] Switching to FFmpeg for "${channel.name}" (audio track: ${audioTrackIdx})`)
    destroyPlayer()
    resetVideo()
    setStreamInfo('FFMPEG')
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 100))
    if (!mountedRef.current) return

    const success = await playWithTimeout((onOk, onFail) => {
      if (!mpegts.isSupported()) { onFail(); return }
      const p = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: proxyTranscode(channel.url, audioTrackIdx) }, {
        enableWorker: false, liveBufferLatencyChasing: true, liveBufferLatencyMaxLatency: 12, liveBufferLatencyMinRemain: 3,
        lazyLoad: false, autoCleanupSourceBuffer: true,
      })
      playerRef.current = p
      p.attachMediaElement(video)
      p.load()
      p.on(mpegts.Events.ERROR, (t) => { if (t === mpegts.ErrorTypes.NETWORK_ERROR) onFail() })
      video.oncanplay = () => { onOk(); video.play().catch(() => {}) }
      video.ontimeupdate = () => { if (video.currentTime > 0) onOk() }
      setTimeout(() => video.play().catch(() => {}), 3000)
    }, 30000) // 30s — FFmpeg transcoding needs time to start

    if (mountedRef.current) {
      setIsLoading(false)
      if (success) {
        video.play().catch(() => {})
      } 
      else {
        setError('Stream unavailable')
      }
    }
  }, [channel, destroyPlayer, resetVideo, playWithTimeout])

  // ============ PLAYBACK ENGINE ============
  const tryPlay = useCallback(async () => {
    const video = videoRef.current
    if (!video || !mountedRef.current) return

    destroyPlayer()
    resetVideo()
    setIsLoading(true)
    setError(null)
    setAudioTracks([])
    setCurrentAudioTrack(0)
    setShowAudioMenu(false)

    const type = detectStreamType(channel.url)
    setStreamInfo(type === 'hls' ? 'HLS' : type === 'mpegts' ? 'MPEGTS' : 'DIRECT')
    console.log(`[PocketTV] Playing "${channel.name}" | ${type} | ${channel.url}`)

    await new Promise(r => setTimeout(r, 50))
    if (!mountedRef.current) return

    let success = false

    // Probe audio tracks immediately in background (for all stream types)
    probeAudioTracks(channel.url)

    // ==================== HLS ====================
    if (type === 'hls') {
      success = await playWithTimeout((onOk, onFail) => {
        if (!Hls.isSupported()) { onFail(); return }
        const hls = new Hls({
          enableWorker: true, lowLatencyMode: true, backBufferLength: 30,
          manifestLoadingTimeOut: 10000, levelLoadingTimeOut: 10000, fragLoadingTimeOut: 10000,
        })
        playerRef.current = hls
        hls.loadSource(proxyM3u8(channel.url))
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {})
          // Set audio tracks immediately from HLS manifest
          if (hls.audioTracks && hls.audioTracks.length > 1) {
            setAudioTracks(hls.audioTracks.map((t, i) => ({
              id: i,
              name: t.name || t.lang || `Track ${i + 1}`,
              lang: t.lang || '',
            })))
            setCurrentAudioTrack(hls.audioTrack)
          }
          onOk()
        })
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          if (hls.audioTracks && hls.audioTracks.length > 1) {
            setAudioTracks(hls.audioTracks.map((t, i) => ({
              id: i,
              name: t.name || t.lang || `Track ${i + 1}`,
              lang: t.lang || '',
            })))
          }
        })
        hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) onFail() })
      }, 12000)

      if (success && mountedRef.current) {
        video.play().catch(() => {})
        setStreamInfo('HLS')
        // Check at 3s if frames are decoding
        setTimeout(() => {
          if (!mountedRef.current || !video) return
          const q = video.getVideoPlaybackQuality?.()
          const framesDecoded = q ? q.totalVideoFrames : (video.videoWidth > 0 ? 1 : 0)
          if (framesDecoded > 0) setIsLoading(false)
        }, 3000)
        // Check at 6s: no decoded frames → FFmpeg
        setTimeout(() => {
          if (!mountedRef.current || !video) return
          const q = video.getVideoPlaybackQuality?.()
          const framesDecoded = q ? q.totalVideoFrames : (video.videoWidth > 0 ? 1 : 0)
          if (framesDecoded === 0) {
            console.log(`[PocketTV] No frames decoded after 6s → switching to FFmpeg`)
            setStreamInfo('FFMPEG')
            switchToFFmpeg()
          } else {
            setIsLoading(false)
          }
        }, 6000)
        return
      }
    }
    // ==================== MPEGTS ====================
    else if (type === 'mpegts') {
      success = await playWithTimeout((onOk, onFail) => {
        if (!mpegts.isSupported()) { onFail(); return }
        const p = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: proxyRaw(channel.url) }, {
          enableWorker: false, liveBufferLatencyChasing: true, liveBufferLatencyMaxLatency: 8, liveBufferLatencyMinRemain: 2,
          lazyLoad: false, autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 30, autoCleanupMinBackwardDuration: 15,
        })
        playerRef.current = p
        p.attachMediaElement(video)
        p.load()
        p.on(mpegts.Events.ERROR, (t) => { if (t === mpegts.ErrorTypes.NETWORK_ERROR) onFail() })
        video.oncanplay = () => { onOk(); video.play().catch(() => {}) }
        video.ontimeupdate = () => { if (video.currentTime > 0) onOk() }
        setTimeout(() => video.play().catch(() => {}), 1000)
      }, 8000)

      if (success && mountedRef.current) {
        video.play().catch(() => {})
        setStreamInfo('MPEGTS')
        setTimeout(() => {
          if (!mountedRef.current || !video) return
          const q = video.getVideoPlaybackQuality?.()
          const framesDecoded = q ? q.totalVideoFrames : (video.videoWidth > 0 ? 1 : 0)
          if (framesDecoded > 0) setIsLoading(false)
        }, 3000)
        setTimeout(() => {
          if (!mountedRef.current || !video) return
          const q = video.getVideoPlaybackQuality?.()
          const framesDecoded = q ? q.totalVideoFrames : (video.videoWidth > 0 ? 1 : 0)
          if (framesDecoded === 0) {
            console.log(`[PocketTV] No frames decoded after 6s → switching to FFmpeg`)
            setStreamInfo('FFMPEG')
            switchToFFmpeg()
          } else {
            setIsLoading(false)
          }
        }, 6000)
        return
      }
    }
    // ==================== DIRECT ====================
    else {
      success = await playWithTimeout((onOk, onFail) => {
        video.src = proxyRaw(channel.url)
        video.oncanplay = () => onOk()
        video.onerror = () => onFail()
      }, 6000)

      if (success && mountedRef.current) {
        setIsLoading(false)
        video.play().catch(() => {})
        setStreamInfo('DIRECT')
        return
      }
    }

    if (!mountedRef.current) return

    // ==================== Primary failed → try FFmpeg ====================
    console.log(`[PocketTV] Primary failed → FFmpeg for "${channel.name}"`)
    destroyPlayer()
    resetVideo()
    setStreamInfo('FFMPEG')
    await new Promise(r => setTimeout(r, 100))

    success = await playWithTimeout((onOk, onFail) => {
      if (!mpegts.isSupported()) { onFail(); return }
      const p = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: proxyTranscode(channel.url) }, {
        enableWorker: false, liveBufferLatencyChasing: true, liveBufferLatencyMaxLatency: 12, liveBufferLatencyMinRemain: 3,
        lazyLoad: false, autoCleanupSourceBuffer: true,
      })
      playerRef.current = p
      p.attachMediaElement(video)
      p.load()
      p.on(mpegts.Events.ERROR, (t) => { if (t === mpegts.ErrorTypes.NETWORK_ERROR) onFail() })
      video.oncanplay = () => { onOk(); video.play().catch(() => {}) }
      video.ontimeupdate = () => { if (video.currentTime > 0) onOk() }
      setTimeout(() => video.play().catch(() => {}), 2000)
    }, 15000)

    if (success && mountedRef.current) {
      setIsLoading(false)
      video.play().catch(() => {})
      return
    }

    // Truly failed
    if (mountedRef.current) {
      setIsLoading(false)
      // setError('Stream unavailable')
    }
  }, [channel, destroyPlayer, resetVideo, playWithTimeout, switchToFFmpeg, probeAudioTracks])

  // Start playback when channel changes
  useEffect(() => {
    mountedRef.current = true
    tryPlay()
    return () => {
      mountedRef.current = false
      destroyPlayer()
      resetVideo()
    }
  }, [channel, tryPlay, destroyPlayer, resetVideo])

  useEffect(() => {
    hideControlsAfterDelay()
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current) }
  }, [hideControlsAfterDelay])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setIsPlaying(true) }
    else { video.pause(); setIsPlaying(false) }
  }

  // Switch audio track
  const switchAudioTrack = useCallback((trackId) => {
    setCurrentAudioTrack(trackId)
    setShowAudioMenu(false)

    // If currently in FFmpeg mode, restart FFmpeg with the new audio track
    if (streamInfo === 'FFMPEG') {
      console.log(`[PocketTV] Restarting FFmpeg with audio track ${trackId}`)
      switchToFFmpeg(trackId)
      return
    }

    const hls = playerRef.current
    if (hls && typeof hls.audioTrack !== 'undefined') {
      // HLS.js player
      hls.audioTrack = trackId
    } else {
      // Native video element audio tracks
      const video = videoRef.current
      if (video && video.audioTracks) {
        for (let i = 0; i < video.audioTracks.length; i++) {
          video.audioTracks[i].enabled = (i === trackId)
        }
      }
    }
  }, [streamInfo, switchToFFmpeg])

  // Detect native audio tracks for non-HLS streams
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const detectNativeTracks = () => {
      if (video.audioTracks && video.audioTracks.length > 1) {
        const tracks = []
        for (let i = 0; i < video.audioTracks.length; i++) {
          const t = video.audioTracks[i]
          tracks.push({
            id: i,
            name: t.label || t.language || `Track ${i + 1}`,
            lang: t.language || '',
          })
        }
        setAudioTracks(tracks)
        // Find currently enabled track
        for (let i = 0; i < video.audioTracks.length; i++) {
          if (video.audioTracks[i].enabled) {
            setCurrentAudioTrack(i)
            break
          }
        }
      }
    }
    video.addEventListener('loadedmetadata', detectNativeTracks)
    return () => video.removeEventListener('loadedmetadata', detectNativeTracks)
  }, [channel])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100 }} onClick={handleInteraction}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        playsInline autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <Scanlines />

      {/* Transcoding indicator */}
      {streamInfo === 'FFMPEG' && isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 10 }}>
          <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Converting video...</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
            FFmpeg is transcoding to H.264
          </p>
        </div>
      )}

      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <TVStatic />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Tuning in...</span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)' }}>
          <TVStatic />
          <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{Icons.noSignal}</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{error}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            {autoSkipCountdown ? `Skipping in ${autoSkipCountdown}...` : 'Finding next...'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{ padding: '12px 24px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Skip {Icons.next}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Back
            </button>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, background: showControls ? 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.9) 100%)' : 'transparent', transition: 'opacity 0.3s', opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
            {Icons.back}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel?.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{channel?.group} {channel?.language && `• ${channel.language}`} {streamInfo && <span style={{ color: streamInfo === 'FFMPEG' ? '#22c55e' : 'var(--accent)', fontSize: 10, textTransform: 'uppercase', marginLeft: 6 }}>{streamInfo}</span>}</p>
          </div>
          {audioTracks.length > 1 && (
            <div style={{ position: 'relative', zIndex: 50 }}>
              <button onClick={(e) => { e.stopPropagation(); setShowAudioMenu(!showAudioMenu) }} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: showAudioMenu ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
                {Icons.audio}
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!isLoading && !error && (
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: '#fff', fontSize: 28, cursor: 'pointer' }}>
              {isPlaying ? '❚❚' : '▶'}
            </button>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button onClick={(e) => { e.stopPropagation(); onPrevious(); }} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icons.prev} Prev
          </button>
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            Next {Icons.next}
          </button>
        </div>
      </div>

      {/* Audio track menu — portaled to document.body so no parent can block clicks */}
      {showAudioMenu && audioTracks.length > 1 && createPortal(
        <div onPointerDown={(e) => { e.stopPropagation(); setShowAudioMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'transparent' }}>
          <div onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 60, right: 16, background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: 8, minWidth: 200, boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Audio Track</div>
            {audioTracks.map(track => (
              <div key={track.id} role="button" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); switchAudioTrack(track.id) }} style={{ width: '100%', padding: '14px 14px', background: currentAudioTrack === track.id ? 'rgba(99,102,241,0.3)' : 'transparent', border: 'none', borderRadius: 10, color: currentAudioTrack === track.id ? '#fff' : 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: currentAudioTrack === track.id ? 600 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', WebkitTapHighlightColor: 'transparent' }}>
                {currentAudioTrack === track.id && <span style={{ color: '#6366f1', fontSize: 16 }}>&#10003;</span>}
                <span>{track.name}</span>
                {track.lang && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{track.lang.toUpperCase()}</span>}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Channel Card
function ChannelCard({ channel, onClick, index }) {
  const [imgError, setImgError] = useState(false)
  
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', animation: 'slideUp 0.4s ease-out backwards', animationDelay: `${Math.min(index * 30, 300)}ms` }}>
      <div style={{ width: 50, height: 50, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {channel.logo && !imgError ? (
          <img src={channel.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
        ) : (
          <div style={{ color: 'var(--accent)' }}>{Icons.tv}</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{channel.name}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{channel.group} {channel.language && `• ${channel.language}`}</p>
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
        {Icons.play}
      </div>
    </button>
  )
}

// Dropdown Select
function Select({ value, onChange, options, icon, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 36px 12px 40px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: 14,
          outline: 'none',
          appearance: 'none',
          cursor: 'pointer'
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.code || opt} value={opt.code || opt}>
            {opt.flag ? `${opt.flag} ${opt.name}` : opt.name || opt}
          </option>
        ))}
      </select>
      <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
        {icon}
      </div>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none' }}>
        {Icons.chevronDown}
      </div>
    </div>
  )
}

// Category Pill
function CategoryPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '10px 18px', background: active ? 'var(--accent)' : 'var(--glass)', border: active ? 'none' : '1px solid var(--border)', borderRadius: 20, color: active ? '#fff' : 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: active ? '0 4px 20px var(--accent-glow)' : 'none' }}>
      {label}
    </button>
  )
}

// Main App
export default function App() {
  const [channels, setChannels] = useState([])
  const [filteredChannels, setFilteredChannels] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentChannel, setCurrentChannel] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState('in')
  const [brokenChannels, setBrokenChannels] = useState(() => {
    try { 
      const stored = JSON.parse(localStorage.getItem('brokenChannels_in') || '[]')
      return new Set(stored)
    } catch { return new Set() }
  })

  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry)
  const brokenKey = `brokenChannels_${selectedCountry}`

  // Load broken channels for current country
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(brokenKey) || '[]')
      setBrokenChannels(new Set(stored))
    } catch { setBrokenChannels(new Set()) }
  }, [brokenKey])

  const markBroken = useCallback((channelId) => {
    setBrokenChannels(prev => {
      const updated = new Set(prev)
      updated.add(channelId)
      localStorage.setItem(brokenKey, JSON.stringify([...updated]))
      return updated
    })
  }, [brokenKey])

  // Fetch channels when country changes
  useEffect(() => {
    let cancelled = false
    async function fetchChannels() {
      setIsLoading(true)
      setChannels([])
      setFilteredChannels([])
      setCategories([])
      setSelectedCategory('All')
      
      try {
        const response = await fetch(getCountryUrl(selectedCountry))
        const text = await response.text()
        const parsed = parseM3U(text)
        
        if (cancelled) return

        // Load ALL channels — no limit
        const channelList = parsed
        setChannels(channelList)

        const uniqueCategories = ['All', ...new Set(channelList.map(c => c.group).filter(Boolean))].sort()
        setCategories(uniqueCategories)

        // No background pre-check — let channels be tried on click
        // Pre-checks have too many false negatives (slow CDNs, redirects)
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchChannels()
    return () => { cancelled = true }
  }, [selectedCountry])

  // Filter channels
  useEffect(() => {
    let result = channels.filter(c => !brokenChannels.has(c.id))

    if (selectedCategory !== 'All') {
      result = result.filter(c => c.group === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(query) || c.group?.toLowerCase().includes(query))
    }

    setFilteredChannels(result)
  }, [channels, selectedCategory, searchQuery, brokenChannels])

  const [visibleCount, setVisibleCount] = useState(60)

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(60) }, [selectedCategory, searchQuery, selectedCountry])

  const playChannel = (channel, index) => { setCurrentChannel(channel); setCurrentIndex(index) }
  const playNext = () => { const i = (currentIndex + 1) % filteredChannels.length; setCurrentChannel(filteredChannels[i]); setCurrentIndex(i) }
  const playPrevious = () => { const i = currentIndex === 0 ? filteredChannels.length - 1 : currentIndex - 1; setCurrentChannel(filteredChannels[i]); setCurrentIndex(i) }

  if (currentChannel) {
    return <VideoPlayer channel={currentChannel} onBack={() => setCurrentChannel(null)} onNext={playNext} onPrevious={playPrevious} onBroken={markBroken} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, #be123c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px var(--accent-glow)' }}>
            <div style={{ color: '#fff' }}>{Icons.tv}</div>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Pocket TV</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {currentCountry?.flag} {filteredChannels.length} channels
              {brokenChannels.size > 0 && (
                <span onClick={() => { setBrokenChannels(new Set()); localStorage.removeItem(brokenKey) }} style={{ color: 'var(--accent)', marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }}>
                  ({brokenChannels.size} hidden)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 15, outline: 'none' }}
          />
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
            {Icons.search}
          </div>
        </div>

        {/* Country Selector */}
        <Select value={selectedCountry} onChange={setSelectedCountry} options={COUNTRIES} icon={Icons.globe} />
      </header>

      {/* Categories */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <CategoryPill key={cat} label={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)} />
          ))}
        </div>
      </div>

      {/* Channel List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {isLoading ? (
          <LoadingOverlay message="Loading channels..." />
        ) : filteredChannels.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: 16 }}>{Icons.signal}</div>
            <p>No channels found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredChannels.slice(0, visibleCount).map((channel, index) => (
              <ChannelCard key={channel.id} channel={channel} index={index} onClick={() => playChannel(channel, index)} />
            ))}
            {filteredChannels.length > visibleCount && (
              <button onClick={() => setVisibleCount(prev => prev + 60)} style={{ padding: '14px', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}>
                Load more ({filteredChannels.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ height: 'env(safe-area-inset-bottom, 0)', background: 'var(--bg-primary)' }} />
    </div>
  )
}
