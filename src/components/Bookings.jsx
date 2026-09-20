import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Bookings({ profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  const field = profile.role === 'ps' ? 'ps_id' : 'retail_id'

  async function load() {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq(field, profile.id)
      .order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function setStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
  }

  if (loading) return <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>

  if (bookings.length === 0) {
    return <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>No bookings yet.</p>
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bookings.map((b) => {
        const otherName = profile.role === 'ps' ? b.retail_name : b.ps_name
        return (
          <div key={b.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{otherName}</span>
              <span className={`badge ${b.status === 'confirmed' ? 'badge-gold' : ''}`}>{b.status}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>Preferred: {b.preferred_time}</p>
            {b.note && <p style={{ fontSize: 14, marginBottom: 8 }}>{b.note}</p>}
            {profile.role === 'ps' && b.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setStatus(b.id, 'confirmed')} className="btn-gold" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  Confirm
                </button>
                <button onClick={() => setStatus(b.id, 'declined')} className="btn-ghost" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  Decline
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
