import { useState } from 'react'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Calendar({ selectedDate, onSelectDate, markedDates, disablePast = true }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const initial = selectedDate ? new Date(selectedDate) : today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function goPrevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) } else setViewMonth((m) => m - 1)
  }
  function goNextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) } else setViewMonth((m) => m + 1)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrevMonth} className="btn-ghost" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 14, padding: 0 }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{MONTH_LABELS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={goNextMonth} className="btn-ghost" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 14, padding: 0 }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-soft)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />
          const dateObj = new Date(viewYear, viewMonth, day)
          const iso = toISODate(dateObj)
          const isPast = disablePast && dateObj < today
          const isSelected = selectedDate === iso
          const isToday = toISODate(today) === iso
          const isMarked = markedDates && markedDates.has(iso)

          return (
            <button
              key={idx}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(iso)}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: isToday && !isSelected ? '1px solid var(--gold)' : '1px solid transparent',
                background: isSelected ? 'var(--gold)' : isMarked ? 'var(--ring)' : 'transparent',
                color: isPast ? 'var(--ring)' : isSelected ? '#241A05' : 'var(--text)',
                fontWeight: isSelected ? 700 : 400,
                fontSize: 13,
                cursor: isPast ? 'not-allowed' : 'pointer',
                position: 'relative',
              }}
            >
              {day}
              {isMarked && !isSelected && (
                <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { toISODate }
