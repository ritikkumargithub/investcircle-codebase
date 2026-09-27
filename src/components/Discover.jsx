import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import BookingModal from './BookingModal'
import AdvisorProfileModal from './AdvisorProfileModal'
import { ADVISOR_CATEGORIES } from '../categories'

export default function Discover({ profile }) {
  const [advisors, setAdvisors] = useState([])
  const [following, setFollowing] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [bookingAdvisor, setBookingAdvisor] = useState(null)
  const [viewingAdvisor, setViewingAdvisor] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    async function load() {
      const { data: profs } = await supabase.from('profiles').select('*').eq('role', 'ps').neq('id', profile.id)
      setAdvisors(profs || [])
      const { data: follows } = await supabase.from('follows').select('target_id').eq('follower_id', profile.id)
      setFollowing(new Set((follows || []).map((f) => f.target_id)))
      setLoading(false)
    }
    load()
  }, [profile.id])

  async function toggleFollow(advisorId) {
    if (following.has(advisorId)) {
      await supabase.from('follows').delete().eq('follower_id', profile.id).eq('target_id', advisorId)
      setFollowing((prev) => { const next = new Set(prev); next.delete(advisorId); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, target_id: advisorId })
      setFollowing((prev) => new Set(prev).add(advisorId))
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return advisors.filter((a) => {
      const matchesQuery = !q
        || a.name.toLowerCase().includes(q)
        || (a.specialization || '').toLowerCase().includes(q)
        || (a.categories || []).some((c) => c.toLowerCase().includes(q))
      const matchesCategory = category === 'All' || (a.categories || []).includes(category)
      return matchesQuery && matchesCategory
    })
  }, [advisors, query, category])

  return (
    <div className="fade-in">
      {profile.role === 'ps' && (
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14 }}>
          Follow other advisors to see their posts in your feed. Booking is disabled between advisors.
        </p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or keyword (e.g. mutual funds, IPO, insurance)"
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }} className="scrollbar-thin">
        {['All', ...ADVISOR_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={category === c ? 'btn-gold' : 'btn-ghost'}
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>No advisors match your search.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((a) => {
          const isFollowing = following.has(a.id)
          return (
            <div key={a.id} className="card" style={{ padding: 16 }}>
              <div onClick={() => setViewingAdvisor(a)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>{a.specialization}</div>
                  </div>
                  <span className="badge badge-gold">{a.reg_type}</span>
                </div>
                {a.categories?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    {a.categories.slice(0, 3).map((c) => <span key={c} className="badge">{c}</span>)}
                  </div>
                )}
                {a.bio && <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 8 }}>{a.bio}</p>}
                {profile.role !== 'ps' && (
                  <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>1:1 session: <strong style={{ color: 'var(--gold-bright)' }}>₹{a.session_price}</strong></p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => toggleFollow(a.id)} className={isFollowing ? 'btn-ghost' : 'btn-gold'} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                {profile.role !== 'ps' && (
                  <button onClick={() => setBookingAdvisor(a)} className="btn-ghost" style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                    Book session
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {bookingAdvisor && <BookingModal advisor={bookingAdvisor} profile={profile} onClose={() => setBookingAdvisor(null)} />}
      {viewingAdvisor && (
        <AdvisorProfileModal
          advisor={viewingAdvisor}
          profile={profile}
          isFollowing={following.has(viewingAdvisor.id)}
          onToggleFollow={() => toggleFollow(viewingAdvisor.id)}
          onClose={() => setViewingAdvisor(null)}
        />
      )}
    </div>
  )
}
