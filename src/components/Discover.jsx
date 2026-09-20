import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import BookingModal from './BookingModal'

export default function Discover({ profile }) {
  const [advisors, setAdvisors] = useState([])
  const [following, setFollowing] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [bookingAdvisor, setBookingAdvisor] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: profs } = await supabase.from('profiles').select('*').eq('role', 'ps').neq('id', profile.id)
      setAdvisors(profs || [])

      const { data: follows } = await supabase
        .from('follows')
        .select('target_id')
        .eq('follower_id', profile.id)
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

  return (
    <div className="fade-in">
      {profile.role === 'ps' && (
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 14 }}>
          Follow other advisors to see their posts in your feed. Booking is disabled between advisors.
        </p>
      )}
      {loading && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>}
      {!loading && advisors.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>
          No other advisors have joined yet.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {advisors.map((a) => {
          const isFollowing = following.has(a.id)
          return (
            <div key={a.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>{a.specialization}</div>
                </div>
                <span className="badge badge-gold">{a.reg_type}</span>
              </div>
              {a.bio && <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 12 }}>{a.bio}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleFollow(a.id)}
                  className={isFollowing ? 'btn-ghost' : 'btn-gold'}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                {profile.role !== 'ps' && (
                  <button
                    onClick={() => setBookingAdvisor(a)}
                    className="btn-ghost"
                    style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                  >
                    Book session
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {bookingAdvisor && (
        <BookingModal advisor={bookingAdvisor} profile={profile} onClose={() => setBookingAdvisor(null)} />
      )}
    </div>
  )
}
