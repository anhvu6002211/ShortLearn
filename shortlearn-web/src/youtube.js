export function parseYouTubeId(value) {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null
    if (!['youtube.com', 'm.youtube.com'].includes(host)) return null
    const shorts = url.pathname.match(/^\/shorts\/([\w-]{11})(?:\/|$)/)
    const id = shorts?.[1] || url.searchParams.get('v')
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch { return null }
}
