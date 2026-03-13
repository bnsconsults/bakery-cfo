import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function SalesForecast() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('daily_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(60)
    setEntries(data || [])
    setLoading(false)
  }

  if (loading) return <div style={s.loading}>Loading...</div>

  // Stats
  const last30 = entries.slice(0, 30)
  const prev30 = entries.slice(30, 60)
  const totalRev = last30.reduce((a, e) => a + (e.revenue || 0), 0)
  const prevRev = prev30.reduce((a, e) => a + (e.revenue || 0), 0)
  const avgDaily = last30.length > 0 ? totalRev / last30.length : 0
  const growth = prevRev > 0 ? (((totalRev - prevRev) / prevRev) * 100).toFixed(1) : 0
  const forecast7 = avgDaily * 7
  const forecast30 = avgDaily * 30

  // Best day
  const best = last30.reduce((a, e) => e.revenue > (a?.revenue || 0) ? e : a, null)
  const worst = last30.filter(e => e.revenue > 0).reduce((a, e) => e.revenue < (a?.revenue || Infinity) ? e : a, null)

  // Channel breakdown from sales_log
  const [salesLogs, setSalesLogs] = useState([])
  useEffect(() => {
    supabase.from('sales_log').select('*').eq('user_id', user.id).then(({ data }) => setSalesLogs(data || []))
  }, [])

  const byChannel = {}
  salesLogs.forEach(l => {
    byChannel[l.channel] = (byChannel[l.channel] || 0) + l.units_sold
  })
  const channels = Object.entries(byChannel).sort((a, b) => b[1] - a[1])
  const totalUnits = channels.reduce((a, c) => a + c[1], 0)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📈 Sales & Forecast</div>
        <div style={s.badge}>SALES INTELLIGENCE</div>
      </div>

      <div style={s.grid4}>
        <KPI label="30-DAY REVENUE" value={`UGX ${fmt(totalRev)}`} color="#F0C040" />
        <KPI label="DAILY AVERAGE" value={`UGX ${fmt(avgDaily)}`} color="#7DBFAD" />
        <KPI label="GROWTH VS PREV 30D" value={`${growth > 0 ? '+' : ''}${growth}%`} color={parseFloat(growth) >= 0 ? '#90D0A0' : '#F08070'} />
        <KPI label="7-DAY FORECAST" value={`UGX ${fmt(forecast7)}`} color="#C8862A" sub="Based on daily average" />
      </div>

      <div style={s.grid2}>
        {/* Forecast card */}
        <div style={s.card}>
          <div style={s.cardTitle}>REVENUE FORECAST</div>
          <ForecastRow label="Next 7 Days" value={forecast7} color="#F0C040" />
          <ForecastRow label="Next 14 Days" value={avgDaily * 14} color="#C8862A" />
          <ForecastRow label="Next 30 Days" value={forecast30} color="#7DBFAD" />
          <ForecastRow label="Next 90 Days" value={avgDaily * 90} color="#90D0A0" />
          <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(253,246,236,0.35)', fontStyle: 'italic' }}>
            * Forecast based on your {last30.length}-day average of UGX {fmt(avgDaily)}/day
          </div>
        </div>

        {/* Best/Worst */}
        <div style={s.card}>
          <div style={s.cardTitle}>PERFORMANCE HIGHLIGHTS</div>
          {best && <>
            <div style={s.highlight}>
              <div style={s.highlightLabel}>🏆 BEST DAY (LAST 30 DAYS)</div>
              <div style={s.highlightVal}>{best.entry_date}</div>
              <div style={{ ...s.highlightSub, color: '#90D0A0' }}>UGX {fmt(best.revenue)}</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(200,134,42,0.15)', margin: '12px 0' }} />
          </>}
          {worst && <>
            <div style={s.highlight}>
              <div style={s.highlightLabel}>📉 LOWEST DAY (LAST 30 DAYS)</div>
              <div style={s.highlightVal}>{worst.entry_date}</div>
              <div style={{ ...s.highlightSub, color: '#F08070' }}>UGX {fmt(worst.revenue)}</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(200,134,42,0.15)', margin: '12px 0' }} />
          </>}
          <div style={s.highlight}>
            <div style={s.highlightLabel}>📅 DAYS TRACKED</div>
            <div style={s.highlightVal}>{entries.length} days total</div>
          </div>
        </div>
      </div>

      {/* Channel breakdown */}
      <div style={s.card}>
        <div style={s.cardTitle}>SALES BY CHANNEL</div>
        {channels.length === 0 ? (
          <div style={s.empty}>No sales channel data yet. Log entries in Waste Tracker to see channel breakdown.</div>
        ) : channels.map(([channel, units]) => (
          <div key={channel} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: '#FDF6EC', textTransform: 'capitalize' }}>{channel}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", color: '#C8862A' }}>{units} units ({totalUnits > 0 ? ((units / totalUnits) * 100).toFixed(0) : 0}%)</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 7 }}>
              <div style={{ height: 7, borderRadius: 99, width: `${totalUnits > 0 ? (units / totalUnits) * 100 : 0}%`, background: '#C8862A' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue table */}
      <div style={s.card}>
        <div style={s.cardTitle}>DAILY REVENUE — LAST 30 DAYS</div>
        {last30.length === 0 ? <div style={s.empty}>No entries yet. Log daily entries to see data here.</div> : (
          <table style={s.table}>
            <thead><tr>{['Date', 'Revenue', 'vs Average', 'Net Profit'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {last30.map(e => {
                const net = e.revenue - e.ingredient_cost - e.labor_cost - e.waste_value
                const vsAvg = avgDaily > 0 ? (((e.revenue - avgDaily) / avgDaily) * 100).toFixed(0) : 0
                return (
                  <tr key={e.id}>
                    <td style={s.td}>{e.entry_date}</td>
                    <td style={s.td}>UGX {fmt(e.revenue)}</td>
                    <td style={{ ...s.td, color: parseFloat(vsAvg) >= 0 ? '#90D0A0' : '#F08070' }}>{vsAvg > 0 ? '+' : ''}{vsAvg}%</td>
                    <td style={{ ...s.td, color: net > 0 ? '#90D0A0' : '#F08070' }}>UGX {fmt(net)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const KPI = ({ label, value, color, sub }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiValue, color: color || '#FDF6EC' }}>{value}</div>
    {sub && <div style={s.kpiSub}>{sub}</div>}
  </div>
)

const ForecastRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
    <span style={{ color: 'rgba(253,246,236,0.6)' }}>{label}</span>
    <span style={{ fontFamily: "'DM Mono', monospace", color, fontWeight: 600 }}>UGX {fmt(value)}</span>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  loading: { color: 'rgba(253,246,236,0.4)', textAlign: 'center', padding: 60 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: '16px 18px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  kpiValue: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900 },
  kpiSub: { fontSize: 10, color: 'rgba(253,246,236,0.4)', marginTop: 3 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  highlight: { marginBottom: 4 },
  highlightLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 4 },
  highlightVal: { fontSize: 14, color: '#FDF6EC', fontWeight: 600 },
  highlightSub: { fontSize: 13, fontFamily: "'DM Mono', monospace", marginTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
