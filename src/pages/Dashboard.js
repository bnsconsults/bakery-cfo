import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    // Load last 30 days of entries
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [entriesRes, profileRes] = await Promise.all([
      supabase.from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('entry_date', { ascending: false }),
      supabase.from('bakery_profile')
        .select('*')
        .eq('user_id', user.id)
        .single()
    ])

    setEntries(entriesRes.data || [])
    setProfile(profileRes.data)
    setLoading(false)
  }

  if (loading) return <div style={s.loading}>Loading your dashboard...</div>

  const bakeryName = profile?.bakery_name || 'My Bakery'

  // Aggregate stats
  const totalRevenue = entries.reduce((a, e) => a + (e.revenue || 0), 0)
  const totalCogs = entries.reduce((a, e) => a + (e.ingredient_cost || 0), 0)
  const totalLabor = entries.reduce((a, e) => a + (e.labor_cost || 0), 0)
  const totalWaste = entries.reduce((a, e) => a + (e.waste_value || 0), 0)
  const totalNet = totalRevenue - totalCogs - totalLabor - totalWaste
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue * 100).toFixed(1) : 0
  const netMargin = totalRevenue > 0 ? (totalNet / totalRevenue * 100).toFixed(1) : 0
  const laborPct = totalRevenue > 0 ? (totalLabor / totalRevenue * 100).toFixed(1) : 0

  // Today's entry
  const today = new Date().toISOString().split('T')[0]
  const todayEntry = entries.find(e => e.entry_date === today)
  const todayNet = todayEntry
    ? todayEntry.revenue - todayEntry.ingredient_cost - todayEntry.labor_cost - todayEntry.waste_value
    : null

  // Last 7 days for chart
  const last7 = entries.slice(0, 7).reverse()

  return (
    <div>
      {/* Welcome */}
      <div style={s.welcome}>
        <div>
          <div style={s.greeting}>Good {getTimeOfDay()}, {bakeryName} 🧁</div>
          <div style={s.subtitle}>Here's your 30-day performance summary</div>
        </div>
        <div style={s.dateBadge}>{new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Alerts */}
      {entries.length === 0 && (
        <div style={{ ...s.alert, ...s.alertInfo }}>
          ℹ️ <strong>Welcome!</strong> No entries yet. Go to "Log Today" to start tracking your bakery's performance.
        </div>
      )}
      {parseFloat(laborPct) > 35 && (
        <div style={{ ...s.alert, ...s.alertWarn }}>
          ⚠️ <strong>Labor Alert</strong> — Labor is {laborPct}% of revenue this month. Target is below 35%.
        </div>
      )}
      {!todayEntry && entries.length > 0 && (
        <div style={{ ...s.alert, ...s.alertWarn }}>
          📝 <strong>Today's entry is missing.</strong> Go to "Log Today" to record today's figures.
        </div>
      )}

      {/* KPI Cards */}
      <div style={s.grid4}>
        <KPICard label="30-DAY REVENUE" value={`UGX ${fmt(totalRevenue)}`} sub={`${entries.length} days logged`} color="#F0C040" />
        <KPICard label="NET PROFIT (30D)" value={`UGX ${fmt(totalNet)}`} sub={`${netMargin}% net margin`} color={totalNet > 0 ? '#90D0A0' : '#F08070'} />
        <KPICard label="GROSS MARGIN" value={`${grossMargin}%`} sub="After ingredient cost" color="#7DBFAD" />
        <KPICard label="LABOR % OF SALES" value={`${laborPct}%`} sub="Target: below 35%" color={parseFloat(laborPct) > 35 ? '#F08070' : '#90D0A0'} />
        <KPICard label="TOTAL INGREDIENT COST" value={`UGX ${fmt(totalCogs)}`} sub={`${totalRevenue > 0 ? (totalCogs / totalRevenue * 100).toFixed(0) : 0}% of revenue`} />
        <KPICard label="TOTAL LABOR COST" value={`UGX ${fmt(totalLabor)}`} sub="Across all staff" />
        <KPICard label="TOTAL WASTE LOSS" value={`UGX ${fmt(totalWaste)}`} sub="Your silent profit killer" color="#E8A598" />
        <KPICard label="TODAY'S NET" value={todayEntry ? `UGX ${fmt(todayNet)}` : 'Not logged'} sub={todayEntry ? `Revenue: UGX ${fmt(todayEntry.revenue)}` : 'Go to Log Today →'} color={todayNet > 0 ? '#F0C040' : '#F08070'} />
      </div>

      {/* Chart + Breakdown */}
      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>DAILY REVENUE — LAST 7 DAYS</div>
          {last7.length > 0 ? (
            <MiniBarChart data={last7} />
          ) : (
            <div style={s.empty}>Log daily entries to see your revenue trend here.</div>
          )}
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>MONTHLY COST BREAKDOWN</div>
          {totalRevenue > 0 ? <>
            <CostBar label="Ingredients" amount={totalCogs} total={totalRevenue} color="#C8862A" />
            <CostBar label="Labor" amount={totalLabor} total={totalRevenue} color="#7DBFAD" />
            <CostBar label="Waste" amount={totalWaste} total={totalRevenue} color="#E8A598" />
            <CostBar label="Net Profit" amount={totalNet} total={totalRevenue} color="#90D0A0" />
          </> : <div style={s.empty}>Add daily entries to see your cost breakdown.</div>}
        </div>
      </div>

      {/* Recent Entries Table */}
      {entries.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>RECENT DAILY ENTRIES</div>
          <table style={s.table}>
            <thead>
              <tr>
                {['Date', 'Revenue', 'COGS', 'Labor %', 'Waste', 'Net Profit', 'Margin'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 10).map(e => {
                const net = e.revenue - e.ingredient_cost - e.labor_cost - e.waste_value
                const margin = e.revenue > 0 ? (net / e.revenue * 100).toFixed(0) : 0
                const lp = e.revenue > 0 ? (e.labor_cost / e.revenue * 100).toFixed(0) : 0
                return (
                  <tr key={e.id}>
                    <td style={s.td}>{e.entry_date}</td>
                    <td style={s.td}>UGX {fmt(e.revenue)}</td>
                    <td style={s.td}>UGX {fmt(e.ingredient_cost)}</td>
                    <td style={{ ...s.td, color: parseFloat(lp) > 35 ? '#F08070' : '#90D0A0' }}>{lp}%</td>
                    <td style={{ ...s.td, color: '#E8A598' }}>UGX {fmt(e.waste_value)}</td>
                    <td style={{ ...s.td, color: net > 0 ? '#90D0A0' : '#F08070', fontWeight: 600 }}>UGX {fmt(net)}</td>
                    <td style={{ ...s.td, color: parseFloat(margin) > 20 ? '#90D0A0' : '#F0B070' }}>{margin}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, color }) {
  return (
    <div style={s.kpi}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color: color || '#FDF6EC' }}>{value}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
    </div>
  )
}

function CostBar({ label, amount, total, color }) {
  const pct = total > 0 ? Math.max(0, (amount / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'rgba(253,246,236,0.7)' }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color }}>UGX {fmt(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 7 }}>
        <div style={{ height: 7, borderRadius: 99, width: `${Math.min(100, pct)}%`, background: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function MiniBarChart({ data }) {
  const max = Math.max(...data.map(e => e.revenue || 0))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, paddingTop: 16 }}>
      {data.map((e, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#C8862A', fontFamily: "'DM Mono', monospace" }}>
            {(e.revenue / 1000000).toFixed(1)}M
          </div>
          <div style={{ width: '100%', background: '#C8862A', opacity: i === data.length - 1 ? 1 : 0.55, borderRadius: '3px 3px 0 0', height: `${max > 0 ? (e.revenue / max) * 80 : 4}px`, minHeight: 4 }} />
          <div style={{ fontSize: 8, color: 'rgba(253,246,236,0.4)', fontFamily: "'DM Mono', monospace" }}>
            {e.entry_date?.slice(5)}
          </div>
        </div>
      ))}
    </div>
  )
}

const fmt = (n) => Number(n || 0).toLocaleString()
const getTimeOfDay = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const s = {
  loading: { color: 'rgba(253,246,236,0.5)', textAlign: 'center', padding: 60, fontSize: 14 },
  welcome: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  greeting: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#FDF6EC' },
  subtitle: { fontSize: 13, color: 'rgba(253,246,236,0.5)', marginTop: 2 },
  dateBadge: { fontSize: 11, color: '#C8862A', fontFamily: "'DM Mono', monospace" },
  alert: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  alertWarn: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070' },
  alertInfo: { background: 'rgba(125,191,173,0.12)', border: '1px solid rgba(125,191,173,0.3)', color: '#7DBFAD' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: '16px 18px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  kpiValue: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900 },
  kpiSub: { fontSize: 10, color: 'rgba(253,246,236,0.45)', marginTop: 4 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.85)', fontFamily: "'DM Mono', monospace" },
  empty: { fontSize: 13, color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24 },
}
