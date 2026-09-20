import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function BookingModal({ advisor, profile, onClose }) {
  const [preferredTime, setPreferredTime] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!preferredTime.trim()) {
      setError('Please add a preferred time.')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('bookings').insert({
      retail_id: profile.id,
      retail_name: profile.name,
      ps_id: advisor.id,
      ps_name: advisor.name,
      preferred_time: preferredTime.trim(),
      note: note.trim(),
      status: 'pending',
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card fade-in" style={{ padding: 20, width: '100%', maxWidth: 380 }}>
        <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Book with {advisor.name}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>
          Request a session. The advisor will confirm availability.
        </p>
        <input
          value={preferredTime}
          onChange={(e) => setPreferredTime(e.target.value)}
          placeholder="Preferred date/time (e.g. Mon 5pm)"
          style={{ marginBottom: 12 }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What would you like to discuss?"
          rows={3}
          style={{ marginBottom: 12 }}
        />
        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-gold" style={{ flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700 }}>
            {loading ? 'Sending...' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
