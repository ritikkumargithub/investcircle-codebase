import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const TOPUP_PRESETS = [100, 500, 1000, 2000]

const TYPE_LABELS = {
  signup_bonus: 'Welcome bonus',
  topup: 'Wallet top-up',
  booking_payment: 'Booking payment',
  booking_earning: 'Booking earning',
  booking_refund: 'Booking refund',
  session_payment: 'Session payment',
  session_earning: 'Session earning',
  session_refund: 'Session refund',
}

function fmtDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function Wallet({ profile, onUpdate }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTopUp, setShowTopUp] = useState(false)

  async function load() {
    const { data } = await supabase.from('wallet_transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(100)
    setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('wallet-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  return (
    <div className="fade-in">
      <div className="card" style={{ padding: 24, marginBottom: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Wallet balance</p>
        <div className="serif" style={{ fontSize: 40, color: 'var(--gold-bright)', marginBottom: 16 }}>₹{profile.wallet_balance}</div>
        <button onClick={() => setShowTopUp(true)} className="btn-gold" style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
          + Top up wallet
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 10 }}>Dummy payment — no real money is charged.</p>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 10 }}>Transaction history</p>
      {loading && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0' }}>Loading...</p>}
      {!loading && transactions.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '20px 0', fontSize: 14 }}>No transactions yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {transactions.map((t) => (
          <div key={t.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{TYPE_LABELS[t.type] || t.type}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t.description}</div>
              <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{fmtDate(t.created_at)}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.amount >= 0 ? 'var(--gold-bright)' : '#e08585' }}>
              {t.amount >= 0 ? '+' : ''}₹{t.amount}
            </div>
          </div>
        ))}
      </div>

      {showTopUp && <TopUpModal profile={profile} onClose={() => setShowTopUp(false)} onUpdate={onUpdate} />}
    </div>
  )
}

function TopUpModal({ profile, onClose, onUpdate }) {
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleTopUp(amount) {
    if (!amount || amount <= 0) { setError('Enter a valid amount.'); return }
    setLoading(true)
    setError('')
    const newBalance = profile.wallet_balance + amount
    const { data, error: updateError } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', profile.id).select().maybeSingle()
    if (updateError) { setLoading(false); setError(updateError.message); return }
    await supabase.from('wallet_transactions').insert({
      user_id: profile.id, type: 'topup', amount, description: 'Wallet top-up (dummy payment)',
    })
    setLoading(false)
    if (onUpdate && data) onUpdate(data) // reflect instantly; realtime sub will also confirm it
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card fade-in" style={{ padding: 20, width: '100%', maxWidth: 360 }}>
        <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Top up wallet</h3>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 16 }}>This is a dummy payment for testing — no real card or UPI is charged.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
          {TOPUP_PRESETS.map((amt) => (
            <button key={amt} type="button" disabled={loading} onClick={() => handleTopUp(amt)} className="btn-ghost" style={{ padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              ₹{amt}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Or custom amount</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="number" min="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Amount" />
          <button disabled={loading} onClick={() => handleTopUp(Number(customAmount))} className="btn-gold" style={{ padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Add
          </button>
        </div>

        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

        <button onClick={onClose} className="btn-ghost" style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13 }}>Close</button>
      </div>
    </div>
  )
}
