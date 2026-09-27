import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import BookingModal from './BookingModal'

export default function AdvisorProfileModal({ advisor, profile, isFollowing, onToggleFollow, onClose }) {
  const [followerCount, setFollowerCount] = useState(0)
  const [recentPosts, setRecentPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBooking, setShowBooking] = useState(false)

  useEffect(() => {
    async function load() {
      const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('target_id', advisor.id)
      setFollowerCount(count || 0)
      const { data: posts } = await supabase.from('posts').select('*').eq('author_id', advisor.id).order('created_at', { ascending: false }).limit(3)
      setRecentPosts(posts || [])
      setLoading(false)
    }
    load()
  }, [advisor.id])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60, overflowY: 'auto' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ padding: 22, width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="serif" style={{ fontSize: 22 }}>{advisor.name}</div>
          <span className="badge badge-gold">{advisor.reg_type}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 14 }}>{advisor.specialization}</p>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>{followerCount}</div><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>Followers</div></div>
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>₹{advisor.session_price}</div><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>1:1 session</div></div>
        </div>

        {advisor.categories?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {advisor.categories.map((c) => <span key={c} className="badge">{c}</span>)}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>SEBI Registration No.</p>
          <p style={{ fontSize: 14 }}>{advisor.sebi_reg_no}</p>
        </div>

        {advisor.bio && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>About</p>
            <p style={{ fontSize: 14, lineHeight: 1.55 }}>{advisor.bio}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={onToggleFollow} className={isFollowing ? 'btn-ghost' : 'btn-gold'} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          {profile.role !== 'ps' && (
            <button onClick={() => setShowBooking(true)} className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              Book session
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Recent posts</p>
        {loading && <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>Loading...</p>}
        {!loading && recentPosts.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>No posts yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {recentPosts.map((p) => (
            <div key={p.id} style={{ padding: '10px 12px', background: 'var(--ring-soft)', borderRadius: 8 }}>
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>{p.content}</p>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="btn-ghost" style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13 }}>Close</button>
      </div>

      {showBooking && <BookingModal advisor={advisor} profile={profile} onClose={() => setShowBooking(false)} />}
    </div>
  )
}
