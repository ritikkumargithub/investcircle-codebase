import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email || (mode !== 'forgot' && !password)) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Check your email to confirm your account, then log in.')
        setMode('login')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setInfo('Password reset email sent, if that address has an account.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 380, margin: '0 auto', paddingTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div className="serif" style={{ fontSize: 40, color: 'var(--gold-bright)' }}>
          InvestCircle<span style={{ color: 'var(--gold)' }}>.</span>
        </div>
        <p style={{ color: 'var(--text-soft)', fontSize: 14, marginTop: 6 }}>
          {mode === 'login' && 'Welcome back.'}
          {mode === 'signup' && 'Create your account.'}
          {mode === 'forgot' && 'Reset your password.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 13, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          style={{ marginBottom: 14 }}
        />

        {mode !== 'forgot' && (
          <>
            <label style={{ fontSize: 13, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{ marginBottom: 14 }}
            />
          </>
        )}

        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
        {info && <p style={{ color: 'var(--gold-bright)', fontSize: 13, marginBottom: 12 }}>{info}</p>}

        <button type="submit" className="btn-gold" disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 8, fontSize: 15 }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-soft)' }}>
        {mode === 'login' && (
          <>
            <span>No account? </span>
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError(''); setInfo('') }}>Sign up</a>
            <span> · </span>
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); setError(''); setInfo('') }}>Forgot password?</a>
          </>
        )}
        {mode === 'signup' && (
          <>
            <span>Already have an account? </span>
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); setInfo('') }}>Log in</a>
          </>
        )}
        {mode === 'forgot' && (
          <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); setInfo('') }}>Back to login</a>
        )}
      </div>
    </div>
  )
}
