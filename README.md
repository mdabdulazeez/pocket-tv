# Pocket TV

A minimalist, IPTV streaming project that plays free, publicly available live TV channels from around the world. Built with React and powered by a smart multi-engine playback system.

## Features

- **8,000+ live channels** from the [iptv-org](https://github.com/iptv-org/iptv) public directory
- **Country & category filtering** — browse channels by country or genre (News, Sports, Kids, etc.)
- **Smart playback engine** — automatically selects the best player for each stream (HLS.js, mpegts.js, or FFmpeg transcoding)
- **Audio track switching** — switch between languages on multi-audio streams in real-time
- **Auto-skip broken channels** — detects non-working streams and skips to the next one
- **Broken channel memory** — remembers non-working channels per country so they're hidden on reload
- **Server-side FFmpeg transcoding** — plays MPEG-2 and H.265 streams that browsers can't decode natively
- **Search** — find channels by name instantly


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| HLS Playback | HLS.js |
| MPEG-TS Playback | mpegts.js |
| Transcoding | FFmpeg (via @ffmpeg-installer/ffmpeg) |
| Proxy | Custom Vite plugin middleware |
| Mobile | Capacitor (Android) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

### Installation

```bash
git clone <repo-url>
cd pocket-tv
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Proxy Endpoints

The Vite dev server includes a custom middleware plugin (`vite.config.js`) that provides four proxy endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/m3u8?url=<url>` | Fetches HLS manifests, rewrites internal URLs to route through proxy |
| `/proxy?url=<url>` | Raw pass-through proxy for .ts segments and direct streams |
| `/transcode?url=<url>&audio=<N>` | FFmpeg transcodes video to H.264+AAC MPEG-TS, selects audio track N |
| `/probe?url=<url>` | Detects audio tracks in a stream using FFmpeg |
| `/check?url=<url>` | Quick reachability check, returns `{ ok: true/false }` |

All proxy requests include VLC-style headers (`User-Agent`, `Referer`, `Origin`) for maximum stream compatibility.

### Playback Engine

Every channel goes through a smart, type-aware playback strategy:

```
1. Detect stream type from URL
   ├── .m3u8 → HLS.js (12s timeout)
   ├── Raw TS (IP:port) → mpegts.js (8s timeout)
   └── .mp4/.webm → Direct <video> (6s timeout)

2. Black-screen detection (3s / 6s checks)
   └── No video frames decoded? → FFmpeg transcoding

3. FFmpeg fallback (30s timeout)
   └── Transcodes MPEG-2/H.265 → H.264+AAC
   └── Streams via mpegts.js

4. All failed → "Stream unavailable" + auto-skip
```

### Audio Track Switching

- **HLS streams**: Tracks detected from HLS manifest via HLS.js
- **All streams**: Background FFmpeg probe detects available audio tracks
- **Switching**: HLS uses native track switching; FFmpeg restarts transcode with selected track via `-map 0:a:N?`

### FFmpeg Configuration

```
Input:  VLC headers, 2M analyzeduration/probesize, reconnect enabled
Video:  libx264, ultrafast preset, zerolatency, max 720p scaling
Audio:  AAC, 128k bitrate, 44100 Hz, stereo
Output: MPEG-TS piped to stdout
```

### APK Limitations

- Most HLS channels work directly (Capacitor WebView is CORS-lenient)
- Channels requiring FFmpeg transcoding (MPEG-2/H.265) won't play (no server-side transcoding)
- Audio track switching works for HLS streams via HLS.js

## Project Structure

```
tv/
├── src/
│   ├── App.jsx          # Main app — channels, player, UI
│   └── main.jsx         # React entry point
├── public/              # Static assets
├── android/             # Capacitor Android project
├── vite.config.js       # Vite config + proxy plugin + FFmpeg transcoder
├── capacitor.config.json
├── package.json
└── index.html
```

## Known Limitations

| Issue | Reason |
|-------|--------|
| DRM-protected channels don't play | Requires Widevine/FairPlay license server |
| Token-based URLs expire | URLs are temporary by design |
| Geo-blocked channels fail | Server rejects connections from outside the region |
| RTMP streams unsupported | Browser can't play RTMP without Flash |
| FFmpeg takes 3-5s to start | Inherent transcoding startup latency |
| Audio switch on FFmpeg restarts stream | Must restart transcode to change audio track |

## License

This project is for personal/educational use. Channel streams are sourced from [iptv-org](https://github.com/iptv-org/iptv), a community-maintained collection of publicly available IPTV channels.
