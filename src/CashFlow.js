import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function CashFlow() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('daily_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }

  if (loading) return <div style={s.loading}>Loading...</div>

  // Running totals
  let running = 0
  const withRunning = entries.map(e => {
    const net = (e.revenue || 0) - (e.ingredient_cost || 0) - (e.labor_cost || 0) - (e.waste_value || 0)
    running += net
    return { ...e, net, running }
  })

  const latest = withRunning[withRunning.length - 1]
  const totalRevenue = entries.reduce((a, e) => a + (e.revenue || 0), 0)
  const totalCosts = entries.reduce((a, e) => a + (e.ingredient_cost || 0) + (e.labor_cost || 0) + (e.waste_value || 0), 0)
  const totalNet = totalRevenue - totalCosts

  // Monthly breakdown
  const monthly = {}
  entries.forEach(e => {
    const month = e.entry_date?.slice(0, 7)
    if (!monthly[month]) monthly[month] = { revenue: 0, costs: 0, net: 0, days: 0 }
    monthly[month].revenue += e.revenue || 0
    monthly[month].costs += (e.ingredient_cost || 0) + (e.labor_cost || 0) + (e.waste_value || 0)
    monthly[month].net += (e.revenue || 0) - (e.ingredient_cost || 0) - (e.labor_cost || 0) - (e.waste_value || 0)
    monthly[month].days++
  })
  const months = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0]))

  // Avg monthly
  const avgMonthlyNet = months.length > 0 ? months.reduce((a, [, m]) => a + m.net, 0) / months.length : 0

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>💳 Cash Flow & Finance</div>
        <div style={s.badge}>FINANCIAL OVERVIEW</div>
      </div>

      <div style={s.grid4}>
        <KPI label="TOTAL REVENUE (ALL TIME)" value={`UGX ${fmt(totalRevenue)}`} color="#F0C040" />
        <KPI label="TOTAL COSTS (ALL TIME)" value={`UGX ${fmt(totalCosts)}`} color="#F08070" />
        <KPI label="NET PROFIT (ALL TIME)" value={`UGX ${fmt(totalNet)}`} color={totalNet > 0 ? '#90D0A0' : '#F08070'} />
        <KPI label="AVG MONTHLY PROFIT" value={`UGX ${fmt(avgMonthlyNet)}`} color="#C8862A" />
      </div>

      {/* Running balance */}
      <div style={s.card}>
        <div style={s.cardTitle}>RUNNING CASH POSITION</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 }}>CURRENT BALANCE</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: latest?.running > 0 ? '#90D0A0' : '#F08070' }}>
              UGX {fmt(latest?.running || 0)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(253,246,236,0.4)', marginTop: 4 }}>Cumulative net profit across {entries.length} days</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <MiniLineChart data={withRunning.slice(-30)} />
          </div>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div style={s.card}>
        <div style={s.cardTitle}>MONTHLY BREAKDOWN</div>
        {months.length === 0 ? <div style={s.empty}>No data yet. Start logging daily entries.</div> : (
          <table style={s.table}>
            <thead><tr>{['Month', 'Revenue', 'Total Costs', 'Net Profit', 'Margin', 'Days'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {months.map(([month, m]) => {
                const margin = m.revenue > 0 ? ((m.net / m.revenue) * 100).toFixed(0) : 0
                return (
                  <tr key={month}>
                    <td style={s.td}>{new Date(month + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })}</td>
                    <td style={s.td}>UGX {fmt(m.revenue)}</td>
                    <td style={{ ...s.td, color: '#F08070' }}>UGX {fmt(m.costs)}</td>
                    <td style={{ ...s.td, color: m.net > 0 ? '#90D0A0' : '#F08070', fontWeight: 600 }}>UGX {fmt(m.net)}</td>
                    <td style={{ ...s.td, color: parseFloat(margin) > 20 ? '#90D0A0' : '#F0B070' }}>{margin}%</td>
                    <td style={s.td}>{m.days}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cost structure */}
      <div style={s.card}>
        <div style={s.cardTitle}>COST STRUCTURE (ALL TIME)</div>
        {totalRevenue === 0 ? <div style={s.empty}>No data yet.</div> : <>
          <CostBar label="Ingredient / COGS" amount={entries.reduce((a, e) => a + (e.ingredient_cost || 0), 0)} total={totalRevenue} color="#C8862A" />
          <CostBar label="Labor" amount={entries.reduce((a, e) => a + (e.labor_cost || 0), 0)} total={totalRevenue} color="#7DBFAD" />
          <CostBar label="Waste" amount={entries.reduce((a, e) => a + (e.waste_value || 0), 0)} total={totalRevenue} color="#E8A598" />
          <CostBar label="Net Profit" amount={totalNet} total={totalRevenue} color="#90D0A0" />
        </>}
      </div>
    </div>
  )
}

function MiniLineChart({ data }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map(d => d.running))
  const min = Math.min(...data.map(d => d.running))
  const range = max - min || 1
  const h = 60, w = 100
  const points = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.running - min) / range) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="#C8862A" strokeWidth="1.5" />
    </svg>
  )
}

const CostBar = ({ label, amount, total, color }) => {
  const pct = total > 0 ? Math.max(0, (amount / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'rgba(253,246,236,0.7)' }}>{label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", color }}>UGX {fmt(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 7 }}>
        <div style={{ height: 7, borderRadius: 99, width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

const KPI = ({ label, value, color }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiValue, color: color || '#FDF6EC' }}>{value}</div>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  loading: { color: 'rgba(253,246,236,0.4)', textAlign: 'center', padding: 60 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: '16px 18px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  kpiValue: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
