import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Calendar from './Calendar'

const TIME_SLOTS = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM']
const DURATIONS = [15, 30, 45, 60]

export default function BookingModal({ advisor, profile, onClose }) {
  const [date, setDate] = useState(null)
  const [time, setTime] = useState(null)
  const [duration, setDuration] = useState(30)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!date || !time) { setError('Please pick a date and a time slot.'); return }
    setLoading(true)
    const { error } = await supabase.from('bookings').insert({
      retail_id: profile.id,
      retail_name: profile.name,
      ps_id: advisor.id,
      ps_name: advisor.name,
      booking_date: date,
      booking_time: time,
      duration_minutes: duration,
      preferred_time: `${date} · ${time}`,
      note: note.trim(),
      status: 'pending',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50, overflowY: 'auto' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ padding: 20, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Book with {advisor.name}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>
          One-on-one session. The call happens right here in InvestCircle — no other app needed.
        </p>

        <Calendar selectedDate={date} onSelectDate={setDate} />

        <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '16px 0 8px' }}>Time slot</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
          {TIME_SLOTS.map((t) => (
            <button key={t} type="button" onClick={() => setTime(t)} className={time === t ? 'btn-gold' : 'btn-ghost'} style={{ padding: '8px', borderRadius: 8, fontSize: 13 }}>
              {t}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Session length</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDuration(d)} className={duration === d ? 'btn-gold' : 'btn-ghost'} style={{ padding: '8px', borderRadius: 8, fontSize: 13 }}>
              {d}m
            </button>
          ))}
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would you like to discuss?" rows={3} style={{ marginBottom: 12 }} />
        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-gold" style={{ flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700 }}>
            {loading ? 'Sending...' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
