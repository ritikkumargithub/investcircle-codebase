import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function PeopleList({ title, people, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ padding: 20, width: '100%', maxWidth: 360, maxHeight: '70vh', overflowY: 'auto' }}>
        <h3 className="serif" style={{ fontSize: 17, marginBottom: 12 }}>{title}</h3>
        {people.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>Nobody here yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {people.map((p) => (
            <div key={p.id} style={{ fontSize: 14 }}>
              {p.name}{p.specialization && <span style={{ color: 'var(--text-soft)', fontSize: 12 }}> · {p.specialization}</span>}
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: '100%', padding: '8px', borderRadius: 8, marginTop: 16, fontSize: 13 }}>Close</button>
      </div>
    </div>
  )
}

export default function ProfileTab({ profile, onUpdate }) {
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [listOpen, setListOpen] = useState(null)
  const [listPeople, setListPeople] = useState([])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [specialization, setSpecialization] = useState(profile.specialization || '')
  const [regType, setRegType] = useState(profile.reg_type || 'RIA')
  const [sebiRegNo, setSebiRegNo] = useState(profile.sebi_reg_no || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadCounts() }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCounts() {
    const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('target_id', profile.id)
    const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id)
    setFollowerCount(followers || 0)
    setFollowingCount(following || 0)
  }

  async function openList(type) {
    setListOpen(type)
    if (type === 'followers') {
      const { data: rows } = await supabase.from('follows').select('follower_id').eq('target_id', profile.id)
      const ids = (rows || []).map((r) => r.follower_id)
      if (ids.length === 0) { setListPeople([]); return }
      const { data: people } = await supabase.from('profiles').select('id, name, specialization').in('id', ids)
      setListPeople(people || [])
    } else {
      const { data: rows } = await supabase.from('follows').select('target_id').eq('follower_id', profile.id)
      const ids = (rows || []).map((r) => r.target_id)
      if (ids.length === 0) { setListPeople([]); return }
      const { data: people } = await supabase.from('profiles').select('id, name, specialization').in('id', ids)
      setListPeople(people || [])
    }
  }

  async function handleLogout() { await supabase.auth.signOut() }

  async function handleSave() {
    if (!name.trim()) { setError('Name cannot be empty.'); return }
    setSaving(true)
    setError('')
    const updates = {
      name: name.trim(),
      ...(profile.role === 'ps' ? { specialization: specialization.trim() || 'General advisory', reg_type: regType, sebi_reg_no: sebiRegNo.trim() || 'Not provided', bio: bio.trim() } : {}),
    }
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', profile.id).select().maybeSingle()
    setSaving(false)
    if (error) { setError(error.message); return }
    onUpdate(data)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="fade-in card" style={{ padding: 20 }}>
        <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Edit profile</h3>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Name</p>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 14 }} />
        {profile.role === 'ps' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Specialization</p>
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} style={{ marginBottom: 14 }} />
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Registration type</p>
            <select value={regType} onChange={(e) => setRegType(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="RIA">SEBI Registered Investment Adviser (RIA)</option>
              <option value="RA">SEBI Research Analyst (RA)</option>
            </select>
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>SEBI Registration No.</p>
            <input value={sebiRegNo} onChange={(e) => setSebiRegNo(e.target.value)} style={{ marginBottom: 14 }} />
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Bio</p>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ marginBottom: 4 }} />
          </>
        )}
        {error && <p className="error-text" style={{ margin: '12px 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => { setEditing(false); setError('') }} className="btn-ghost" style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-gold" style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="serif" style={{ fontSize: 20 }}>{profile.name}</div>
          <span className={`badge ${profile.role === 'ps' ? 'badge-gold' : ''}`}>{profile.role === 'ps' ? profile.reg_type : 'Investor'}</span>
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <button onClick={() => openList('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{followerCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Followers</div>
          </button>
          <button onClick={() => openList('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{followingCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Following</div>
          </button>
        </div>

        {profile.role === 'ps' ? (
          <>
            <p style={{ fontSize: 14, marginBottom: 4 }}><span style={{ color: 'var(--text-soft)' }}>Specialization:</span> {profile.specialization}</p>
            <p style={{ fontSize: 14, marginBottom: 4 }}><span style={{ color: 'var(--text-soft)' }}>SEBI Reg No:</span> {profile.sebi_reg_no}</p>
            {profile.bio && <p style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 8 }}>{profile.bio}</p>}
          </>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--text-soft)' }}>Following advisors and booking sessions.</p>
        )}
      </div>

      <button onClick={() => setEditing(true)} className="btn-gold" style={{ width: '100%', padding: '12px', borderRadius: 8, marginTop: 16, fontSize: 14, fontWeight: 700 }}>Edit profile</button>
      <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', padding: '12px', borderRadius: 8, marginTop: 10, fontSize: 14, fontWeight: 600 }}>Log out</button>

      {listOpen && <PeopleList title={listOpen === 'followers' ? 'Followers' : 'Following'} people={listPeople} onClose={() => setListOpen(null)} />}
    </div>
  )
}
