import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import Calendar, { toISODate } from './Calendar'

export default function Bookings({ profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()))

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

  const markedDates = useMemo(() => {
    const set = new Set()
    bookings.forEach((b) => { if (b.booking_date) set.add(b.booking_date) })
    return set
  }, [bookings])

  const bookingsOnSelectedDay = useMemo(
    () => bookings.filter((b) => b.booking_date === selectedDate),
    [bookings, selectedDate]
  )
  const bookingsWithoutDate = useMemo(() => bookings.filter((b) => !b.booking_date), [bookings])

  if (loading) return <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>

  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} markedDates={markedDates} disablePast={false} />
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>
        {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {bookingsOnSelectedDay.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 20 }}>No bookings on this day.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: bookingsWithoutDate.length ? 24 : 0 }}>
        {bookingsOnSelectedDay.map((b) => (
          <BookingCard key={b.id} b={b} profile={profile} setStatus={setStatus} />
        ))}
      </div>

      {bookingsWithoutDate.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>Older requests (no date on file)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bookingsWithoutDate.map((b) => (
              <BookingCard key={b.id} b={b} profile={profile} setStatus={setStatus} />
            ))}
          </div>
        </>
      )}

      {bookings.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No bookings yet.</p>
      )}
    </div>
  )
}

function BookingCard({ b, profile, setStatus }) {
  const otherName = profile.role === 'ps' ? b.retail_name : b.ps_name
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{otherName}</span>
        <span className={`badge ${b.status === 'confirmed' ? 'badge-gold' : ''}`}>{b.status}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>
        {b.booking_time ? `Time: ${b.booking_time}` : `Preferred: ${b.preferred_time}`}
      </p>
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
}
