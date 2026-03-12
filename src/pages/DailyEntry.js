import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

export default function DailyEntry({ onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    revenue: '',
    ingredient_cost: '',
    labor_cost: '',
    waste_value: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [recentEntries, setRecentEntries] = useState([])

  useEffect(() => { loadRecent() }, [])

  const loadRecent = async () => {
    const { data } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(7)
    if (data) setRecentEntries(data)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)

    // Upsert: if entry for this date exists, update it
    const { error } = await supabase
      .from('daily_entries')
      .upsert({
        user_id: user.id,
        entry_date: form.entry_date,
        revenue: parseFloat(form.revenue) || 0,
        ingredient_cost: parseFloat(form.ingredient_cost) || 0,
        labor_cost: parseFloat(form.labor_cost) || 0,
        waste_value: parseFloat(form.waste_value) || 0,
        notes: form.notes
      }, { onConflict: 'user_id,entry_date' })

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      loadRecent()
      if (onSaved) onSaved()
    }
  }

  const f = (n) => n ? `UGX ${Number(n).toLocaleString()}` : '—'

  // Live calculations from form
  const rev = parseFloat(form.revenue) || 0
  const cogs = parseFloat(form.ingredient_cost) || 0
  const labor = parseFloat(form.labor_cost) || 0
  const waste = parseFloat(form.waste_value) || 0
  const gross = rev - cogs
  const net = gross - labor - waste
  const grossPct = rev > 0 ? ((gross / rev) * 100).toFixed(1) : '—'
  const netPct = rev > 0 ? ((net / rev) * 100).toFixed(1) : '—'
  const laborPct = rev > 0 ? ((labor / rev) * 100).toFixed(1) : '—'
  const laborAlert = rev > 0 && (labor / rev) > 0.35

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📝 Log Today's Numbers</div>
        <div style={s.badge}>DAILY ENTRY</div>
      </div>

      <div style={s.grid2}>
        {/* Form */}
        <div style={s.card}>
          <div style={s.cardTitle}>ENTER TODAY'S FIGURES</div>
          <form onSubmit={save}>
            <Field label="DATE" type="date" value={form.entry_date}
              onChange={v => setForm({ ...form, entry_date: v })} />
            <Field label="TOTAL REVENUE (UGX)" type="number" placeholder="e.g. 2300000"
              value={form.revenue} onChange={v => setForm({ ...form, revenue: v })} />
            <Field label="INGREDIENT / COGS COST (UGX)" type="number" placeholder="e.g. 880000"
              value={form.ingredient_cost} onChange={v => setForm({ ...form, ingredient_cost: v })} />
            <Field label="LABOR COST (UGX)" type="number" placeholder="e.g. 420000"
              value={form.labor_cost} onChange={v => setForm({ ...form, labor_cost: v })} />
            <Field label="WASTE VALUE (UGX)" type="number" placeholder="e.g. 187000"
              value={form.waste_value} onChange={v => setForm({ ...form, waste_value: v })} />
            <Field label="NOTES (OPTIONAL)" type="text" placeholder="Any issues, events, or observations..."
              value={form.notes} onChange={v => setForm({ ...form, notes: v })} />

            <button type="submit" style={s.btn} disabled={saving}>
              {saving ? 'Saving...' : saved ? '✅ Saved!' : '+ Save Entry'}
            </button>
          </form>
        </div>

        {/* Live Preview */}
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>LIVE PREVIEW</div>
            <StatRow label="Revenue" val={f(rev)} />
            <StatRow label="Gross Profit" val={`${f(gross)} (${grossPct}%)`} color={gross > 0 ? '#90D0A0' : '#F08070'} />
            <StatRow label="Labor %" val={`${laborPct}%`} color={laborAlert ? '#F08070' : '#90D0A0'} />
            {laborAlert && (
              <div style={s.alertWarn}>⚠️ Labor is above 35% — review shift costs</div>
            )}
            <StatRow label="Waste" val={f(waste)} color="#F0B070" />
            <div style={{ borderTop: '1px solid rgba(200,134,42,0.2)', margin: '12px 0' }} />
            <StatRow label="Net Cash Today" val={f(net)} color={net > 0 ? '#F0C040' : '#F08070'} bold />
            <StatRow label="Net Margin" val={`${netPct}%`} color={net > 0 ? '#90D0A0' : '#F08070'} />
          </div>

          <div style={{ ...s.card, marginTop: 16 }}>
            <div style={s.cardTitle}>LAST 7 DAYS</div>
            {recentEntries.length === 0 && (
              <div style={s.empty}>No entries yet. Log your first day above.</div>
            )}
            {recentEntries.map(e => {
              const net = e.revenue - e.ingredient_cost - e.labor_cost - e.waste_value
              return (
                <div key={e.id} style={s.entryRow}>
                  <span style={s.entryDate}>{e.entry_date}</span>
                  <span style={s.entryRev}>UGX {Number(e.revenue).toLocaleString()}</span>
                  <span style={{ ...s.entryNet, color: net > 0 ? '#90D0A0' : '#F08070' }}>
                    {net > 0 ? '+' : ''}{Number(net).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      <input
        style={s.input} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function StatRow({ label, val, color, bold }) {
  return (
    <div style={s.statRow}>
      <span style={s.statKey}>{label}</span>
      <span style={{ ...s.statVal, color: color || '#FDF6EC', fontWeight: bold ? 700 : 500 }}>{val}</span>
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '11px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 },
  statKey: { color: 'rgba(253,246,236,0.6)' },
  statVal: { fontFamily: "'DM Mono', monospace", fontWeight: 500 },
  alertWarn: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070', borderRadius: 8, padding: '8px 12px', fontSize: 12, margin: '8px 0' },
  entryRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 },
  entryDate: { color: 'rgba(253,246,236,0.5)', fontFamily: "'DM Mono', monospace" },
  entryRev: { color: '#FDF6EC', fontFamily: "'DM Mono', monospace" },
  entryNet: { fontFamily: "'DM Mono', monospace", fontWeight: 600 },
  empty: { fontSize: 13, color: 'rgba(253,246,236,0.35)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' },
}
