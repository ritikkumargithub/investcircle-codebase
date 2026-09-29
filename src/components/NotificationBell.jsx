import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function fmtTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const TYPE_ICONS = {
  booking_request: '📅', booking_confirmed: '✅', booking_declined: '↩️', booking_completed: '🏁',
  session_registration: '👥', new_follower: '⭐', new_post: '📝', session_reminder: '⏰', booking_reminder: '⏰', referral_bonus: '🎁',
}

export default function NotificationBell({ profile }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(40)
    setNotifications(data || [])
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', fontSize: 18, padding: 4, color: 'var(--text)' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, background: '#c0463f', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="card fade-in" style={{ position: 'absolute', top: 36, right: 0, width: 320, maxHeight: 420, overflowY: 'auto', zIndex: 50, padding: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, padding: '4px 6px 8px' }}>Notifications</p>
            {notifications.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-soft)', padding: '10px 6px' }}>Nothing yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {notifications.map((n) => (
                <div key={n.id} style={{ padding: '8px 8px', borderRadius: 8, background: n.is_read ? 'transparent' : 'var(--ring-soft)', fontSize: 13 }}>
                  <span style={{ marginRight: 6 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                  {n.message}
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{fmtTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
