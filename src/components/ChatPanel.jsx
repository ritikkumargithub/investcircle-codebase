import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ChatPanel({ booking, profile, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('chat_messages').select('*').eq('booking_id', booking.id).order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`chat-${booking.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `booking_id=eq.${booking.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    await supabase.from('chat_messages').insert({ booking_id: booking.id, sender_id: profile.id, sender_name: profile.name, content })
  }

  const otherName = profile.role === 'ps' ? booking.retail_name : booking.ps_name

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 420, height: '70vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ring)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="serif" style={{ fontSize: 16 }}>Chat with {otherName}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <p style={{ fontSize: 13, color: 'var(--text-soft)', textAlign: 'center' }}>Loading...</p>}
          {!loading && messages.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-soft)', textAlign: 'center' }}>No messages yet. Say hello.</p>}
          {messages.map((m) => {
            const mine = m.sender_id === profile.id
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                <div style={{
                  background: mine ? 'var(--gold)' : 'var(--ring-soft)', color: mine ? '#241A05' : 'var(--text)',
                  padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.4,
                }}>
                  {m.content}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--ring)', display: 'flex', gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }} />
          <button onClick={handleSend} className="btn-gold" style={{ padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Send</button>
        </div>
      </div>
    </div>
  )
}
