import { useState } from 'react'
import { useAuth } from '../components/AuthContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bakeryName, setBakeryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else {
      const { error } = await signUp(email, password, bakeryName)
      if (error) setError(error.message)
      else setSuccess('Account created! Check your email to confirm, then log in.')
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>🧁</div>
        <div style={styles.brand}>Bakery CFO</div>
        <div style={styles.brandSub}>COMMAND CENTER</div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Log In</button>
          <button style={{ ...styles.tab, ...(mode === 'signup' ? styles.tabActive : {}) }} onClick={() => { setMode('signup'); setError(''); setSuccess('') }}>Sign Up</button>
        </div>

        <form onSubmit={handle} style={styles.form}>
          {mode === 'signup' && (
            <div style={styles.field}>
              <label style={styles.label}>BAKERY NAME</label>
              <input style={styles.input} type="text" placeholder="e.g. Amara's Bakehouse" value={bakeryName} onChange={e => setBakeryName(e.target.value)} required />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <input style={styles.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>PASSWORD</label>
            <input style={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div style={styles.error}>⚠️ {error}</div>}
          {success && <div style={styles.success}>✅ {success}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In to Dashboard' : 'Create My Bakery Account'}
          </button>
        </form>

        <div style={styles.footer}>
          {mode === 'login'
            ? <span>New here? <button style={styles.link} onClick={() => setMode('signup')}>Create a free account →</button></span>
            : <span>Already have an account? <button style={styles.link} onClick={() => setMode('login')}>Log in →</button></span>
          }
        </div>

        <div style={styles.tagline}>
          The complete financial & operations system<br />built for bakery owners in Uganda 🇺🇬
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1A0E08 0%, #3D2B1F 50%, #1A0E08 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    padding: 20,
  },
  card: {
    background: 'rgba(61,43,31,0.85)',
    border: '1px solid rgba(200,134,42,0.35)',
    borderRadius: 20,
    padding: '44px 40px',
    width: '100%',
    maxWidth: 420,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
  },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  brand: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28, fontWeight: 900,
    color: '#F0C040', textAlign: 'center', letterSpacing: 1,
  },
  brandSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10, color: '#C8862A', textAlign: 'center',
    letterSpacing: 3, marginBottom: 32,
  },
  tabs: {
    display: 'flex', gap: 4,
    background: 'rgba(26,14,8,0.6)',
    borderRadius: 10, padding: 4,
    marginBottom: 28,
    border: '1px solid rgba(200,134,42,0.2)',
  },
  tab: {
    flex: 1, padding: '9px 0', borderRadius: 7,
    border: 'none', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13, fontWeight: 600,
    background: 'transparent', color: 'rgba(253,246,236,0.45)',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#C8862A', color: '#1A0E08',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 0 },
  field: { marginBottom: 16 },
  label: {
    display: 'block', fontSize: 10,
    color: '#C8862A', fontFamily: "'DM Mono', monospace",
    letterSpacing: 1.5, marginBottom: 6,
  },
  input: {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(200,134,42,0.3)',
    borderRadius: 8, color: '#FDF6EC',
    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  },
  error: {
    background: 'rgba(214,79,59,0.12)',
    border: '1px solid rgba(214,79,59,0.3)',
    color: '#F08070', borderRadius: 8,
    padding: '10px 14px', fontSize: 13,
    marginBottom: 16,
  },
  success: {
    background: 'rgba(90,158,111,0.12)',
    border: '1px solid rgba(90,158,111,0.3)',
    color: '#90D0A0', borderRadius: 8,
    padding: '10px 14px', fontSize: 13,
    marginBottom: 16,
  },
  btn: {
    width: '100%', padding: '13px',
    background: '#C8862A', color: '#1A0E08',
    border: 'none', borderRadius: 10,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14, fontWeight: 700,
    cursor: 'pointer', marginTop: 4,
    transition: 'opacity 0.15s',
  },
  footer: {
    textAlign: 'center', fontSize: 13,
    color: 'rgba(253,246,236,0.5)', marginTop: 24,
  },
  link: {
    background: 'none', border: 'none',
    color: '#C8862A', cursor: 'pointer',
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    textDecoration: 'underline',
  },
  tagline: {
    textAlign: 'center', fontSize: 11,
    color: 'rgba(253,246,236,0.3)',
    marginTop: 28, lineHeight: 1.7,
    fontFamily: "'DM Mono', monospace",
  },
}
