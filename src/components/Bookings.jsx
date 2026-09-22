import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Calendar, { toISODate } from './Calendar'
import CallRoom from './CallRoom'
import { getWindowStatus, formatCountdown } from '../timeUtils'

export default function Bookings({ profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()))
  const [view, setView] = useState('calendar')
  const [activeCall, setActiveCall] = useState(null)
  const [, setTick] = useState(0) // forces periodic re-render so buttons update live
  const completingRef = useRef(new Set())

  const field = profile.role === 'ps' ? 'ps_id' : 'retail_id'

  async function load() {
    const { data } = await supabase.from('bookings').select('*').eq(field, profile.id).order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('bookings-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load()).subscribe()
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-mark bookings completed once their time window has passed
  useEffect(() => {
    bookings.forEach((b) => {
      if (b.status !== 'confirmed' || !b.booking_date || !b.booking_time) return
      if (completingRef.current.has(b.id)) return
      const windowStatus = getWindowStatus(b.booking_date, b.booking_time, b.duration_minutes)
      if (windowStatus === 'ended') {
        completingRef.current.add(b.id)
        supabase.from('bookings').update({ status: 'completed' }).eq('id', b.id).then(() => load())
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings])

  async function setStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
  }

  const markedDates = useMemo(() => {
    const set = new Set()
    bookings.forEach((b) => { if (b.booking_date) set.add(b.booking_date) })
    return set
  }, [bookings])

  const bookingsOnSelectedDay = useMemo(() => bookings.filter((b) => b.booking_date === selectedDate), [bookings, selectedDate])
  const bookingsWithoutDate = useMemo(() => bookings.filter((b) => !b.booking_date), [bookings])
  const sortedHistory = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.booking_date || b.created_at) - new Date(a.booking_date || a.created_at)),
    [bookings]
  )

  if (loading) return <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView('calendar')} className={view === 'calendar' ? 'btn-gold' : 'btn-ghost'} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Calendar</button>
        <button onClick={() => setView('history')} className={view === 'history' ? 'btn-gold' : 'btn-ghost'} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Full history</button>
      </div>

      {view === 'calendar' ? (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} markedDates={markedDates} disablePast={false} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {bookingsOnSelectedDay.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 20 }}>No bookings on this day.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: bookingsWithoutDate.length ? 24 : 0 }}>
            {bookingsOnSelectedDay.map((b) => <BookingCard key={b.id} b={b} profile={profile} setStatus={setStatus} onJoinCall={() => setActiveCall(b)} />)}
          </div>
          {bookingsWithoutDate.length > 0 && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>Older requests (no date on file)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bookingsWithoutDate.map((b) => <BookingCard key={b.id} b={b} profile={profile} setStatus={setStatus} onJoinCall={() => setActiveCall(b)} />)}
              </div>
            </>
          )}
          {bookings.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No bookings yet.</p>}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedHistory.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No booking history yet.</p>}
          {sortedHistory.map((b) => <BookingCard key={b.id} b={b} profile={profile} setStatus={setStatus} onJoinCall={() => setActiveCall(b)} showDate />)}
        </div>
      )}

      {activeCall && (
        <CallRoom roomId={`booking-${activeCall.id}`} profile={profile} title={`Session with ${profile.role === 'ps' ? activeCall.retail_name : activeCall.ps_name}`} onLeave={() => setActiveCall(null)} />
      )}
    </div>
  )
}

function BookingCard({ b, profile, setStatus, onJoinCall, showDate }) {
  const otherName = profile.role === 'ps' ? b.retail_name : b.ps_name
  const hasSchedule = b.booking_date && b.booking_time
  const windowStatus = hasSchedule ? getWindowStatus(b.booking_date, b.booking_time, b.duration_minutes) : 'unknown'
  const countdown = hasSchedule ? formatCountdown(b.booking_date, b.booking_time) : ''

  const statusBadgeClass = b.status === 'confirmed' ? 'badge-gold' : b.status === 'completed' ? '' : ''

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{otherName}</span>
        <span className={`badge ${statusBadgeClass}`}>{b.status}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>
        {showDate && b.booking_date ? `${b.booking_date} · ` : ''}
        {b.booking_time ? b.booking_time : b.preferred_time}
        {b.duration_minutes ? ` · ${b.duration_minutes} min` : ''}
      </p>
      {b.note && <p style={{ fontSize: 14, marginBottom: 8 }}>{b.note}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {profile.role === 'ps' && b.status === 'pending' && (
          <>
            <button onClick={() => setStatus(b.id, 'confirmed')} className="btn-gold" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Confirm</button>
            <button onClick={() => setStatus(b.id, 'declined')} className="btn-ghost" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Decline</button>
          </>
        )}

        {b.status === 'confirmed' && windowStatus === 'live' && (
          <button onClick={onJoinCall} className="btn-gold" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>📹 Join call</button>
        )}

        {b.status === 'confirmed' && windowStatus === 'upcoming' && (
          <button disabled className="btn-ghost" style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, opacity: 0.6, cursor: 'not-allowed' }}>
            📹 {countdown || 'Not started yet'}
          </button>
        )}

        {b.status === 'completed' && <span className="badge">Session completed</span>}
      </div>
    </div>
  )
}
