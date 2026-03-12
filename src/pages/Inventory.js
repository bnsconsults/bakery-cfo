import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blank = { name: '', stock: '', unit: 'kg', reorder_level: '', cost_per_unit: '', expiry_date: '', supplier: '' }

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('ingredients').select('*').eq('user_id', user.id).order('name')
    setItems(data || [])
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, user_id: user.id, stock: parseFloat(form.stock) || 0, reorder_level: parseFloat(form.reorder_level) || 0, cost_per_unit: parseFloat(form.cost_per_unit) || 0 }

    if (editId) {
      await supabase.from('ingredients').update(payload).eq('id', editId)
    } else {
      await supabase.from('ingredients').insert(payload)
    }
    setForm(blank); setEditId(null); setSaving(false); load()
  }

  const del = async (id) => {
    if (!window.confirm('Delete this ingredient?')) return
    await supabase.from('ingredients').delete().eq('id', id)
    load()
  }

  const edit = (item) => {
    setForm({ name: item.name, stock: item.stock, unit: item.unit, reorder_level: item.reorder_level, cost_per_unit: item.cost_per_unit, expiry_date: item.expiry_date || '', supplier: item.supplier || '' })
    setEditId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const lowStock = items.filter(i => i.stock <= i.reorder_level)
  const expiringSoon = items.filter(i => {
    if (!i.expiry_date) return false
    const days = Math.round((new Date(i.expiry_date) - new Date()) / 86400000)
    return days < 14
  })

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>🥖 Inventory Management</div>
        <div style={s.badge}>LIVE STOCK</div>
      </div>

      {/* Alerts */}
      {lowStock.length > 0 && (
        <div style={{ ...s.alert, ...s.alertWarn }}>
          ⚠️ <strong>{lowStock.length} items below reorder level:</strong> {lowStock.map(i => i.name).join(', ')}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ ...s.alert, ...s.alertDanger }}>
          🕐 <strong>{expiringSoon.length} items expiring within 14 days:</strong> {expiringSoon.map(i => i.name).join(', ')}
        </div>
      )}

      <div style={s.grid2}>
        {/* Form */}
        <div style={s.card}>
          <div style={s.cardTitle}>{editId ? '✏️ EDIT INGREDIENT' : '+ ADD INGREDIENT'}</div>
          <form onSubmit={save}>
            <div style={s.formGrid}>
              <F label="NAME" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
              <F label="STOCK QTY" type="number" value={form.stock} onChange={v => setForm({ ...form, stock: v })} required />
              <div>
                <label style={s.label}>UNIT</label>
                <select style={s.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {['kg', 'g', 'L', 'ml', 'doz', 'pcs', 'bags'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <F label="REORDER LEVEL" type="number" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} />
              <F label="COST/UNIT (UGX)" type="number" value={form.cost_per_unit} onChange={v => setForm({ ...form, cost_per_unit: v })} />
              <F label="EXPIRY DATE" type="date" value={form.expiry_date} onChange={v => setForm({ ...form, expiry_date: v })} />
              <F label="SUPPLIER" value={form.supplier} onChange={v => setForm({ ...form, supplier: v })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : '+ Add Ingredient'}</button>
              {editId && <button type="button" style={s.btnSec} onClick={() => { setForm(blank); setEditId(null) }}>Cancel</button>}
            </div>
          </form>
        </div>

        {/* Stats */}
        <div style={s.card}>
          <div style={s.cardTitle}>INVENTORY SUMMARY</div>
          <StatRow label="Total Ingredients" val={items.length} />
          <StatRow label="Low Stock Items" val={lowStock.length} color={lowStock.length > 0 ? '#F08070' : '#90D0A0'} />
          <StatRow label="Expiring Soon" val={expiringSoon.length} color={expiringSoon.length > 0 ? '#F0B070' : '#90D0A0'} />
          <StatRow label="Total Inventory Value" val={`UGX ${items.reduce((a, i) => a + (i.stock * i.cost_per_unit), 0).toLocaleString()}`} />
        </div>
      </div>

      {/* Table */}
      <div style={s.card}>
        <div style={s.cardTitle}>ALL INGREDIENTS ({items.length})</div>
        {items.length === 0 ? (
          <div style={s.empty}>No ingredients yet. Add your first ingredient above.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{['Ingredient', 'Stock', 'Reorder', 'Status', 'Cost/Unit', 'Expiry', 'Supplier', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map(i => {
                const low = i.stock <= i.reorder_level
                const pct = Math.min(100, (i.stock / Math.max(i.reorder_level * 3, 1)) * 100)
                const daysLeft = i.expiry_date ? Math.round((new Date(i.expiry_date) - new Date()) / 86400000) : null
                return (
                  <tr key={i.id}>
                    <td style={s.td}><strong style={{ color: '#FDF6EC' }}>{i.name}</strong></td>
                    <td style={s.td}>
                      <div>{i.stock} {i.unit}</div>
                      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 4, width: 70, marginTop: 4 }}>
                        <div style={{ height: 4, borderRadius: 99, width: `${pct}%`, background: low ? '#D64F3B' : pct < 60 ? '#E08C3A' : '#5A9E6F' }} />
                      </div>
                    </td>
                    <td style={s.td}>{i.reorder_level} {i.unit}</td>
                    <td style={s.td}>{low ? <Pill c="red">⚠ Low</Pill> : <Pill c="green">✓ OK</Pill>}</td>
                    <td style={s.td}>UGX {Number(i.cost_per_unit).toLocaleString()}/{i.unit}</td>
                    <td style={{ ...s.td, color: daysLeft !== null && daysLeft < 14 ? '#F08070' : 'inherit' }}>
                      {i.expiry_date || '—'}{daysLeft !== null && daysLeft < 14 ? ` (${daysLeft}d)` : ''}
                    </td>
                    <td style={{ ...s.td, opacity: 0.6 }}>{i.supplier || '—'}</td>
                    <td style={s.td}>
                      <button style={s.editBtn} onClick={() => edit(i)}>Edit</button>
                      <button style={s.delBtn} onClick={() => del(i.id)}>✕</button>
                    </td>
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

const Pill = ({ c, children }) => {
  const cols = { red: ['rgba(214,79,59,0.15)', '#F08070', 'rgba(214,79,59,0.3)'], green: ['rgba(90,158,111,0.15)', '#90D0A0', 'rgba(90,158,111,0.3)'] }
  const [bg, col, border] = cols[c]
  return <span style={{ background: bg, color: col, border: `1px solid ${border}`, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{children}</span>
}

const F = ({ label, type = 'text', value, onChange, required }) => (
  <div>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} required={required} />
  </div>
)

const StatRow = ({ label, val, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
    <span style={{ color: 'rgba(253,246,236,0.6)' }}>{label}</span>
    <span style={{ fontFamily: "'DM Mono', monospace", color: color || '#FDF6EC' }}>{val}</span>
  </div>
)

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  alert: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  alertWarn: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070' },
  alertDanger: { background: 'rgba(214,79,59,0.12)', border: '1px solid rgba(214,79,59,0.3)', color: '#F08070' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 5, marginTop: 10 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { padding: '10px 20px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnSec: { padding: '10px 16px', background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)' },
  editBtn: { background: 'rgba(200,134,42,0.2)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginRight: 6 },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
