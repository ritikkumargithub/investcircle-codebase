import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Notes({ profile }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    const { data } = await supabase.from('notes').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function handleAdd() {
    if (!newNote.trim()) return
    setAdding(true)
    const { error } = await supabase.from('notes').insert({ user_id: profile.id, content: newNote.trim() })
    setAdding(false)
    if (!error) setNewNote('')
  }

  async function toggleDone(note) {
    await supabase.from('notes').update({ is_done: !note.is_done }).eq('id', note.id)
  }

  async function handleDelete(id) {
    await supabase.from('notes').delete().eq('id', id)
  }

  const pending = notes.filter((n) => !n.is_done)
  const done = notes.filter((n) => n.is_done)

  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={profile.role === 'ps' ? 'e.g. Follow up with client about SIP renewal' : 'e.g. Ask advisor about ELSS funds'}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <button onClick={handleAdd} disabled={adding} className="btn-gold" style={{ padding: '0 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Add
          </button>
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0' }}>Loading...</p>}
      {!loading && notes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No notes yet. Add your first one above.</p>
      )}

      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: done.length ? 20 : 0 }}>
          {pending.map((n) => <NoteRow key={n.id} note={n} onToggle={() => toggleDone(n)} onDelete={() => handleDelete(n.id)} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Completed</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {done.map((n) => <NoteRow key={n.id} note={n} onToggle={() => toggleDone(n)} onDelete={() => handleDelete(n.id)} />)}
          </div>
        </>
      )}
    </div>
  )
}

function NoteRow({ note, onToggle, onDelete }) {
  return (
    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={onToggle}
        style={{
          width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${note.is_done ? 'var(--gold)' : 'var(--ring)'}`,
          background: note.is_done ? 'var(--gold)' : 'transparent', flexShrink: 0, cursor: 'pointer', color: '#241A05', fontSize: 12, lineHeight: '18px',
        }}
      >
        {note.is_done ? '✓' : ''}
      </button>
      <span style={{ flex: 1, fontSize: 14, color: note.is_done ? 'var(--text-soft)' : 'var(--text)', textDecoration: note.is_done ? 'line-through' : 'none' }}>
        {note.content}
      </span>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
    </div>
  )
}
