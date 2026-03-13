import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blank = { product_name: '', sale_date: new Date().toISOString().split('T')[0], units_sold: '', units_wasted: '', channel: 'walk-in' }

export default function WasteTracker() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('sales_log').select('*').eq('user_id', user.id).order('sale_date', { ascending: false }).limit(30)
    setLogs(data || [])
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('sales_log').insert({ ...form, user_id: user.id, units_sold: parseInt(form.units_sold) || 0, units_wasted: parseInt(form.units_wasted) || 0 })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
    setForm(blank); load()
  }

  const del = async (id) => {
    await supabase.from('sales_log').delete().eq('id', id)
    load()
  }

  // Stats
  const totalSold = logs.reduce((a, l) => a + (l.units_sold || 0), 0)
  const totalWasted = logs.reduce((a, l) => a + (l.units_wasted || 0), 0)
  const wasteRate = (totalSold + totalWasted) > 0 ? ((totalWasted / (totalSold + totalWasted)) * 100).toFixed(1) : 0

  // Top wasted products
  const byProduct = {}
  logs.forEach(l => {
    if (!byProduct[l.product_name]) byProduct[l.product_name] = { sold: 0, wasted: 0 }
    byProduct[l.product_name].sold += l.units_sold || 0
    byProduct[l.product_name].wasted += l.units_wasted || 0
  })
  const products = Object.entries(byProduct).sort((a, b) => b[1].wasted - a[1].wasted)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📉 Waste Tracker</div>
        <div style={s.badge}>WASTE & SHRINKAGE</div>
      </div>

      {/* KPIs */}
      <div style={s.grid4}>
        <KPI label="TOTAL UNITS SOLD" value={totalSold} color="#90D0A0" />
        <KPI label="TOTAL UNITS WASTED" value={totalWasted} color="#F08070" />
        <KPI label="WASTE RATE" value={`${wasteRate}%`} color={parseFloat(wasteRate) > 10 ? '#F08070' : '#90D0A0'} sub="Target: below 10%" />
        <KPI label="PRODUCTS TRACKED" value={products.length} />
      </div>

      {parseFloat(wasteRate) > 10 && (
        <div style={s.alert}>⚠️ Your waste rate is above 10%. Review production quantities for your top wasted products.</div>
      )}

      <div style={s.grid2}>
        {/* Form */}
        <div style={s.card}>
          <div style={s.cardTitle}>+ LOG SALES & WASTE</div>
          <form onSubmit={save}>
            <F label="PRODUCT NAME" value={form.product_name} onChange={v => setForm({ ...form, product_name: v })} required placeholder="e.g. Croissant" />
            <F label="DATE" type="date" value={form.sale_date} onChange={v => setForm({ ...form, sale_date: v })} />
            <F label="UNITS SOLD" type="number" value={form.units_sold} onChange={v => setForm({ ...form, units_sold: v })} placeholder="0" />
            <F label="UNITS WASTED" type="number" value={form.units_wasted} onChange={v => setForm({ ...form, units_wasted: v })} placeholder="0" />
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>SALES CHANNEL</label>
              <select style={s.input} value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                {['walk-in', 'pre-order', 'delivery', 'wholesale', 'event'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : saved ? '✅ Saved!' : '+ Log Entry'}</button>
          </form>
        </div>

        {/* Product breakdown */}
        <div style={s.card}>
          <div style={s.cardTitle}>WASTE BY PRODUCT</div>
          {products.length === 0 && <div style={s.empty}>No data yet. Log your first entry.</div>}
          {products.map(([name, data]) => {
            const rate = (data.sold + data.wasted) > 0 ? ((data.wasted / (data.sold + data.wasted)) * 100).toFixed(0) : 0
            return (
              <div key={name} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#FDF6EC' }}>{name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: parseFloat(rate) > 10 ? '#F08070' : '#90D0A0' }}>
                    {data.wasted} wasted / {data.sold} sold ({rate}%)
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 6 }}>
                  <div style={{ height: 6, borderRadius: 99, width: `${Math.min(100, rate)}%`, background: parseFloat(rate) > 10 ? '#D64F3B' : '#5A9E6F' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Log table */}
      <div style={s.card}>
        <div style={s.cardTitle}>RECENT ENTRIES</div>
        {logs.length === 0 ? <div style={s.empty}>No entries yet.</div> : (
          <table style={s.table}>
            <thead><tr>{['Date', 'Product', 'Sold', 'Wasted', 'Waste %', 'Channel', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {logs.map(l => {
                const rate = (l.units_sold + l.units_wasted) > 0 ? ((l.units_wasted / (l.units_sold + l.units_wasted)) * 100).toFixed(0) : 0
                return (
                  <tr key={l.id}>
                    <td style={s.td}>{l.sale_date}</td>
                    <td style={s.td}>{l.product_name}</td>
                    <td style={{ ...s.td, color: '#90D0A0' }}>{l.units_sold}</td>
                    <td style={{ ...s.td, color: '#F08070' }}>{l.units_wasted}</td>
                    <td style={{ ...s.td, color: parseFloat(rate) > 10 ? '#F08070' : '#90D0A0' }}>{rate}%</td>
                    <td style={s.td}>{l.channel}</td>
                    <td style={s.td}><button style={s.delBtn} onClick={() => del(l.id)}>✕</button></td>
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

const F = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
  </div>
)

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: '16px 18px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  kpiValue: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900 },
  kpiSub: { fontSize: 10, color: 'rgba(253,246,236,0.4)', marginTop: 3 },
  alert: { background: 'rgba(214,79,59,0.12)', border: '1px solid rgba(214,79,59,0.3)', color: '#F08070', borderRadius: 10, padding: '12px 16px', fontSize: 13, marginBottom: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '11px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
