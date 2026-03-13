import { useState } from 'react'
import { AuthProvider, useAuth } from './components/AuthContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import DailyEntry from './pages/DailyEntry'
import Inventory from './pages/Inventory'
import WasteTracker from './pages/WasteTracker'
import SalesForecast from './pages/SalesForecast'
import LaborStaff from './pages/LaborStaff'
import CashFlow from './pages/CashFlow'

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1A0E08; font-family: 'DM Sans', sans-serif; color: #FDF6EC; }
  input, select, button { font-family: 'DM Sans', sans-serif; }
  input:focus, select:focus { outline: none; border-color: #C8862A !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(200,134,42,0.3); border-radius: 99px; }
`

const navItems = [
  { id: 'dashboard',  icon: '📊', label: 'Dashboard',        section: 'OVERVIEW'   },
  { id: 'daily',      icon: '📝', label: 'Log Today',        section: 'OVERVIEW'   },
  { id: 'inventory',  icon: '🥖', label: 'Inventory',        section: 'OPERATIONS' },
  { id: 'waste',      icon: '📉', label: 'Waste Tracker',    section: 'OPERATIONS' },
  { id: 'sales',      icon: '📈', label: 'Sales & Forecast', section: 'OPERATIONS' },
  { id: 'labor',      icon: '👩‍🍳', label: 'Labor & Staff',   section: 'OPERATIONS' },
  { id: 'cashflow',   icon: '💳', label: 'Cash Flow',        section: 'FINANCE'    },
]

function Inner() {
  const { user, loading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'rgba(253,246,236,0.4)', fontSize: 14 }}>
      Loading Bakery CFO...
    </div>
  )

  if (!user) return <AuthPage />

  const sections = [...new Set(navItems.map(n => n.section))]

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'daily':     return <DailyEntry onSaved={() => {}} />
      case 'inventory': return <Inventory />
      case 'waste':     return <WasteTracker />
      case 'sales':     return <SalesForecast />
      case 'labor':     return <LaborStaff />
      case 'cashflow':  return <CashFlow />
      default:          return <Dashboard />
    }
  }

  return (
    <div style={styles.app}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🧁</div>
          <div style={styles.brandName}>Bakery CFO</div>
          <div style={styles.brandSub}>COMMAND CENTER</div>
          <div style={styles.userEmail}>{user.email}</div>
        </div>

        {sections.map(sec => (
          <div key={sec} style={styles.navSection}>
            <div style={styles.navLabel}>{sec}</div>
            {navItems.filter(n => n.section === sec).map(n => (
              <div
                key={n.id}
                style={{ ...styles.navItem, ...(page === n.id ? styles.navActive : {}) }}
                onClick={() => setPage(n.id)}
              >
                <span style={{ width: 20, textAlign: 'center' }}>{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={styles.sidebarFooter}>
          <button onClick={signOut} style={styles.signOutBtn}>Sign Out</button>
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(253,246,236,0.25)' }}>Bakery CFO v1.0 · Uganda 🇺🇬</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topTitle}>{navItems.find(n => n.id === page)?.label || 'Dashboard'}</div>
          <div style={styles.topRight}>
            <div style={styles.liveTag}>🟢 LIVE</div>
            <button style={styles.logBtn} onClick={() => setPage('daily')}>+ Log Today</button>
          </div>
        </div>
        <div style={styles.content}>{renderPage()}</div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <style>{globalCSS}</style>
      <Inner />
    </AuthProvider>
  )
}

const styles = {
  app: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 230, minWidth: 230, background: '#3D2B1F', borderRight: '1px solid rgba(200,134,42,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  brand: { padding: '22px 18px 18px', borderBottom: '1px solid rgba(200,134,42,0.2)' },
  brandName: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: '#F0C040', letterSpacing: 0.5 },
  brandSub: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginTop: 2 },
  userEmail: { fontSize: 10, color: 'rgba(253,246,236,0.35)', marginTop: 8, wordBreak: 'break-all' },
  navSection: { padding: '12px 10px 0' },
  navLabel: { fontSize: 8, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, padding: '0 8px', marginBottom: 3 },
  navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: 'rgba(253,246,236,0.6)', transition: 'all 0.15s', marginBottom: 2, border: '1px solid transparent' },
  navActive: { background: 'rgba(200,134,42,0.22)', color: '#F0C040', borderColor: 'rgba(200,134,42,0.3)' },
  sidebarFooter: { marginTop: 'auto', padding: 14, borderTop: '1px solid rgba(200,134,42,0.2)' },
  signOutBtn: { width: '100%', padding: '8px', background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.25)', borderRadius: 7, cursor: 'pointer', fontSize: 12 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topbar: { background: 'rgba(26,14,8,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(200,134,42,0.2)', padding: '13px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  topTitle: { fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: '#FDF6EC' },
  topRight: { display: 'flex', alignItems: 'center', gap: 12 },
  liveTag: { fontSize: 10, color: '#90D0A0', fontFamily: "'DM Mono', monospace" },
  logBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', padding: '22px 26px' },
}
