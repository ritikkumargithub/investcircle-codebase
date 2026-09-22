import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import Calendar, { toISODate } from './Calendar'
import CallRoom from './CallRoom'

const TIME_SLOTS = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM']

export default function Sessions({ profile }) {
  const [sessions, setSessions] = useState([])
  const [regCounts, setRegCounts] = useState({}) // sessionId -> count
  const [myRegs, setMyRegs] = useState(new Set()) // sessionId set (retail only)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeCall, setActiveCall] = useState(null)

  async function load() {
    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'scheduled')
      .order('session_date', { ascending: true })

    const rows = sessionRows || []
    setSessions(rows)

    if (rows.length > 0) {
      const { data: regs } = await supabase
        .from('session_registrations')
        .select('session_id, retail_id')
        .in('session_id', rows.map((s) => s.id))

      const counts = {}
      ;(regs || []).forEach((r) => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
      setRegCounts(counts)

      if (profile.role !== 'ps') {
        setMyRegs(new Set((regs || []).filter((r) => r.retail_id === profile.id).map((r) => r.session_id)))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_registrations' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function handleRegister(sessionId) {
    await supabase.from('session_registrations').insert({ session_id: sessionId, retail_id: profile.id, retail_name: profile.name })
  }
  async function handleUnregister(sessionId) {
    await supabase.from('session_registrations').delete().eq('session_id', sessionId).eq('retail_id', profile.id)
  }
  async function handleCancelSession(sessionId) {
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', sessionId)
  }

  const mySessions = useMemo(() => sessions.filter((s) => s.ps_id === profile.id), [sessions, profile.id])
  const otherSessions = useMemo(() => sessions.filter((s) => s.ps_id !== profile.id), [sessions, profile.id])

  if (loading) return <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>

  return (
    <div className="fade-in">
      {profile.role === 'ps' && (
        <>
          <button onClick={() => setShowCreate(true)} className="btn-gold" style={{ width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
            + Create a group session
          </button>

          {mySessions.length > 0 && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>Your sessions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {mySessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    s={s}
                    registeredCount={regCounts[s.id] || 0}
                    isOwner
                    onCancel={() => handleCancelSession(s.id)}
                    onJoinCall={() => setActiveCall(s)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>
        {profile.role === 'ps' ? 'Other advisors\u2019 sessions' : 'Upcoming sessions'}
      </p>
      {otherSessions.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No upcoming sessions yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {otherSessions.map((s) => {
          const count = regCounts[s.id] || 0
          const full = count >= s.capacity
          const registered = myRegs.has(s.id)
          return (
            <SessionCard
              key={s.id}
              s={s}
              registeredCount={count}
              isRetailViewer={profile.role !== 'ps'}
              full={full}
              registered={registered}
              onRegister={() => handleRegister(s.id)}
              onUnregister={() => handleUnregister(s.id)}
              onJoinCall={registered ? () => setActiveCall(s) : undefined}
            />
          )
        })}
      </div>

      {showCreate && <CreateSessionModal profile={profile} onClose={() => setShowCreate(false)} />}

      {activeCall && (
        <CallRoom roomId={`session-${activeCall.id}`} profile={profile} title={activeCall.title} onLeave={() => setActiveCall(null)} />
      )}
    </div>
  )
}

function SessionCard({ s, registeredCount, isOwner, isRetailViewer, full, registered, onRegister, onUnregister, onCancel, onJoinCall }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{s.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>Hosted by {s.ps_name}</div>
        </div>
        <span className={`badge ${full ? 'badge-gold' : ''}`}>{registeredCount}/{s.capacity} spots</span>
      </div>
      {s.description && <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 8 }}>{s.description}</p>}
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10 }}>{s.session_date} · {s.session_time}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        {isOwner && (
          <>
            <button onClick={onJoinCall} className="btn-gold" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>📹 Start call</button>
            <button onClick={onCancel} className="btn-ghost" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Cancel session</button>
          </>
        )}
        {isRetailViewer && !registered && (
          <button onClick={onRegister} disabled={full} className="btn-gold" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {full ? 'Full' : 'Register'}
          </button>
        )}
        {isRetailViewer && registered && (
          <>
            <button onClick={onJoinCall} className="btn-gold" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>📹 Join call</button>
            <button onClick={onUnregister} className="btn-ghost" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

function CreateSessionModal({ profile, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [time, setTime] = useState(TIME_SLOTS[0])
  const [capacity, setCapacity] = useState(10)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!title.trim()) { setError('Please add a title.'); return }
    if (!capacity || capacity < 1) { setError('Capacity must be at least 1.'); return }
    setLoading(true)
    const { error } = await supabase.from('sessions').insert({
      ps_id: profile.id,
      ps_name: profile.name,
      title: title.trim(),
      description: description.trim(),
      session_date: date,
      session_time: time,
      capacity: Number(capacity),
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50, overflowY: 'auto' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ padding: 20, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Create a group session</h3>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Q3 Market Outlook)" style={{ marginBottom: 12 }} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will this session cover?" rows={3} style={{ marginBottom: 12 }} />

        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Date</p>
        <Calendar selectedDate={date} onSelectDate={setDate} />

        <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '16px 0 8px' }}>Time</p>
        <select value={time} onChange={(e) => setTime(e.target.value)} style={{ marginBottom: 12 }}>
          {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Capacity (max people who can join)</p>
        <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ marginBottom: 12 }} />

        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="btn-gold" style={{ flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700 }}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
