import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import Feed from './components/Feed'
import Discover from './components/Discover'
import Bookings from './components/Bookings'
import Sessions from './components/Sessions'
import Wallet from './components/Wallet'
import ProfileTab from './components/ProfileTab'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [tab, setTab] = useState('feed')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setProfile(undefined)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    async function loadProfile() {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (cancelled) return
      if (error) { console.error(error); setProfile(null); return }
      setProfile(data || null)
    }
    loadProfile()
    return () => { cancelled = true }
  }, [session])

  // Keep wallet balance / profile fields live, even when changed by another party's action
  // (e.g. an advisor declining a booking triggers a refund on the investor's own row).
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel(`profile-sync-${session.user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, (payload) => {
        setProfile(payload.new)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  if (session === undefined) return <CenteredMessage>Loading...</CenteredMessage>
  if (!session) return <div className="app-shell"><Auth /></div>
  if (profile === undefined) return <CenteredMessage>Loading your profile...</CenteredMessage>
  if (profile === null) return <div className="app-shell"><Onboarding userId={session.user.id} onDone={setProfile} /></div>

  const tabDefs = [
    { id: 'feed', label: 'Feed' },
    { id: 'discover', label: 'Discover' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'bookings', label: profile.role === 'ps' ? 'Requests' : 'My Bookings' },
    ...(profile.role !== 'ps' ? [{ id: 'wallet', label: 'Wallet' }] : []),
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <div className="app-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="serif" style={{ fontSize: 24, color: 'var(--gold-bright)' }}>
          InvestCircle<span style={{ color: 'var(--gold)' }}>.</span>
        </div>
        <span className={`badge ${profile.role === 'ps' ? 'badge-gold' : ''}`}>
          {profile.role === 'ps' ? `${profile.reg_type} Advisor` : 'Investor'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 18, marginBottom: 24, borderBottom: '1px solid var(--ring)', overflowX: 'auto' }}>
        {tabDefs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'feed' && <Feed profile={profile} />}
      {tab === 'discover' && <Discover profile={profile} />}
      {tab === 'sessions' && <Sessions profile={profile} />}
      {tab === 'bookings' && <Bookings profile={profile} />}
      {tab === 'wallet' && profile.role !== 'ps' && <Wallet profile={profile} />}
      {tab === 'profile' && <ProfileTab profile={profile} onUpdate={setProfile} />}
    </div>
  )
}

function CenteredMessage({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-soft)' }}>{children}</p>
    </div>
  )
}
