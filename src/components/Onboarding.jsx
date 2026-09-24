import { useState } from 'react'
import { supabase } from '../supabaseClient'

const SIGNUP_BONUS = 100

export default function Onboarding({ userId, onDone }) {
  const [role, setRole] = useState('retail')
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [regType, setRegType] = useState('RIA')
  const [sebiRegNo, setSebiRegNo] = useState('')
  const [bio, setBio] = useState('')
  const [sessionPrice, setSessionPrice] = useState(500)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    setError('')
    const profile = {
      id: userId,
      role,
      name: name.trim(),
      specialization: role === 'ps' ? (specialization.trim() || 'General advisory') : null,
      reg_type: role === 'ps' ? regType : null,
      sebi_reg_no: role === 'ps' ? (sebiRegNo.trim() || 'Not provided') : null,
      bio: role === 'ps' ? bio.trim() : null,
      session_price: role === 'ps' ? Number(sessionPrice) || 0 : 0,
      wallet_balance: role === 'retail' ? SIGNUP_BONUS : 0,
    }
    const { error } = await supabase.from('profiles').insert(profile)
    if (error) { setLoading(false); setError(error.message); return }

    if (role === 'retail') {
      // Best-effort welcome bonus record; a unique index prevents this from ever duplicating.
      await supabase.from('wallet_transactions').insert({
        user_id: userId, type: 'signup_bonus', amount: SIGNUP_BONUS, description: 'Welcome bonus',
      })
    }

    setLoading(false)
    onDone(profile)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '6vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="serif" style={{ fontSize: 32, color: 'var(--gold-bright)' }}>
          InvestCircle<span style={{ color: 'var(--gold)' }}>.</span>
        </div>
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>Let's set up your profile.</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 8 }}>I am a...</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button type="button" className={role === 'retail' ? 'btn-gold' : 'btn-ghost'} onClick={() => setRole('retail')} style={{ flex: 1, padding: '12px', borderRadius: 8, fontSize: 14 }}>
            Investor
          </button>
          <button type="button" className={role === 'ps' ? 'btn-gold' : 'btn-ghost'} onClick={() => setRole('ps')} style={{ flex: 1, padding: '12px', borderRadius: 8, fontSize: 14 }}>
            Advisor
          </button>
        </div>

        {role === 'retail' && (
          <div className="fade-in" style={{ background: 'var(--ring-soft)', border: '1px solid var(--gold)', borderRadius: 10, padding: 12, marginBottom: 18, fontSize: 13, textAlign: 'center' }}>
            🎁 You'll get <strong style={{ color: 'var(--gold-bright)' }}>₹{SIGNUP_BONUS} in wallet coins</strong> free when you sign up
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 6 }}>Name</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={{ marginBottom: 16 }} />

        {role === 'ps' && (
          <div className="fade-in">
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>Advisor details</p>
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Specialization (e.g. Retirement planning, IPOs)" style={{ marginBottom: 12 }} />
            <select value={regType} onChange={(e) => setRegType(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="RIA">SEBI Registered Investment Adviser (RIA)</option>
              <option value="RA">SEBI Research Analyst (RA)</option>
            </select>
            <input value={sebiRegNo} onChange={(e) => setSebiRegNo(e.target.value)} placeholder="SEBI Registration No." style={{ marginBottom: 12 }} />
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" rows={3} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Price for a 1:1 session (₹)</p>
            <input type="number" min="0" value={sessionPrice} onChange={(e) => setSessionPrice(e.target.value)} style={{ marginBottom: 4 }} />
          </div>
        )}

        {error && <p className="error-text" style={{ margin: '12px 0' }}>{error}</p>}

        <button onClick={handleSave} disabled={loading} className="btn-gold" style={{ width: '100%', padding: '12px', borderRadius: 8, fontSize: 15, marginTop: 12 }}>
          {loading ? 'Saving...' : 'Create profile'}
        </button>
      </div>
    </div>
  )
}
