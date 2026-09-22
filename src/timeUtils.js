// Parses "10:00 AM" style strings into { h, min } in 24h form.
function parseTime12h(timeStr) {
  if (!timeStr) return null
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, min }
}

export function getStartDateTime(dateStr, timeStr) {
  const t = parseTime12h(timeStr)
  if (!dateStr || !t) return null
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(t.h, t.min, 0, 0)
  return d
}

export function getEndDateTime(dateStr, timeStr, durationMinutes) {
  const start = getStartDateTime(dateStr, timeStr)
  if (!start) return null
  return new Date(start.getTime() + (durationMinutes || 30) * 60000)
}

// 'upcoming' -> too early to join, 'live' -> join window is open, 'ended' -> past the duration
const JOIN_GRACE_MINUTES = 5

export function getWindowStatus(dateStr, timeStr, durationMinutes) {
  const start = getStartDateTime(dateStr, timeStr)
  const end = getEndDateTime(dateStr, timeStr, durationMinutes)
  if (!start || !end) return 'unknown'
  const now = new Date()
  const joinFrom = new Date(start.getTime() - JOIN_GRACE_MINUTES * 60000)
  if (now < joinFrom) return 'upcoming'
  if (now <= end) return 'live'
  return 'ended'
}

export function formatCountdown(dateStr, timeStr) {
  const start = getStartDateTime(dateStr, timeStr)
  if (!start) return ''
  const now = new Date()
  const diffMs = start - now
  if (diffMs <= 0) return ''
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `Starts in ${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) return `Starts in ${hours}h ${remMins}m`
  const days = Math.floor(hours / 24)
  return `Starts in ${days}d`
}
