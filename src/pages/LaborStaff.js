import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const blankStaff = { name: '', role: '', hourly_rate: '', active: true }
const blankLog = { staff_id: '', staff_name: '', log_date: new Date().toISOString().split('T')[0], hours_worked: '8', overtime_hours: '0' }

export default function LaborStaff() {
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [logs, setLogs] = useState([])
  const [staffForm, setStaffForm] = useState(blankStaff)
  const [logForm, setLogForm] = useState(blankLog)
  const [tab, setTab] = useState('log')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadStaff(); loadLogs() }, [])

  const loadStaff = async () => {
    const { data } = await supabase.from('staff').select('*').eq('user_id', user.id).order('name')
    setStaff(data || [])
  }

  const loadLogs = async () => {
    const { data } = await supabase.from('labor_log').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(30)
    setLogs(data || [])
  }

  const saveStaff = async (e) => {
    e.preventDefault(); setSaving(true)
    await supabase.from('staff').insert({ ...staffForm, user_id: user.id, hourly_rate: parseFloat(staffForm.hourly_rate) || 0 })
    setStaffForm(blankStaff); setSaving(false); loadStaff()
  }

  const saveLog = async (e) => {
    e.preventDefault(); setSaving(true)
    const member = staff.find(s => s.id === logForm.staff_id)
    await supabase.from('labor_log').insert({
      ...logForm, user_id: user.id,
      staff_name: member?.name || logForm.staff_name,
      hours_worked: parseFloat(logForm.hours_worked) || 0,
      overtime_hours: parseFloat(logForm.overtime_hours) || 0
    })
    setLogForm(blankLog); setSaving(false); loadLogs()
  }

  const delStaff = async (id) => {
    if (!window.confirm('Remove this staff member?')) return
    await supabase.from('staff').delete().eq('id', id); loadStaff()
  }

  // Stats
  const totalHours = logs.reduce((a, l) => a + (l.hours_worked || 0), 0)
  const totalOT = logs.reduce((a, l) => a + (l.overtime_hours || 0), 0)
  const totalLaborCost = logs.reduce((a, l) => {
    const member = staff.find(s => s.name === l.staff_name)
    const rate = member?.hourly_rate || 0
    return a + (l.hours_worked * rate) + (l.overtime_hours * rate * 1.5)
  }, 0)

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>👩‍🍳 Labor & Staff</div>
        <div style={s.badge}>WORKFORCE</div>
      </div>

      <div style={s.grid4}>
        <KPI label="ACTIVE STAFF" value={staff.filter(s => s.active).length} color="#7DBFAD" />
        <KPI label="TOTAL HOURS (30D)" value={totalHours.toFixed(0)} color="#F0C040" />
        <KPI label="OVERTIME HOURS" value={totalOT.toFixed(0)} color={totalOT > 20 ? '#F08070' : '#90D0A0'} />
        <KPI label="EST. LABOR COST (30D)" value={`UGX ${fmt(totalLaborCost)}`} color="#C8862A" />
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === 'log' ? s.tabActive : {}) }} onClick={() => setTab('log')}>Log Hours</button>
        <button style={{ ...s.tab, ...(tab === 'staff' ? s.tabActive : {}) }} onClick={() => setTab('staff')}>Manage Staff</button>
      </div>

      {tab === 'log' && (
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.cardTitle}>+ LOG HOURS WORKED</div>
            <form onSubmit={saveLog}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>STAFF MEMBER</label>
                <select style={s.input} value={logForm.staff_id} onChange={e => setLogForm({ ...logForm, staff_id: e.target.value })} required>
                  <option value="">Select staff member...</option>
                  {staff.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                </select>
              </div>
              <F label="DATE" type="date" value={logForm.log_date} onChange={v => setLogForm({ ...logForm, log_date: v })} />
              <F label="HOURS WORKED" type="number" value={logForm.hours_worked} onChange={v => setLogForm({ ...logForm, hours_worked: v })} />
              <F label="OVERTIME HOURS" type="number" value={logForm.overtime_hours} onChange={v => setLogForm({ ...logForm, overtime_hours: v })} />
              {staff.length === 0 && <div style={s.warn}>Add staff members first using the "Manage Staff" tab.</div>}
              <button type="submit" style={s.btn} disabled={saving || staff.length === 0}>{saving ? 'Saving...' : '+ Log Hours'}</button>
            </form>
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>RECENT HOURS LOG</div>
            {logs.length === 0 ? <div style={s.empty}>No hours logged yet.</div> : (
              <table style={s.table}>
                <thead><tr>{['Date', 'Staff', 'Hours', 'OT', 'Est. Cost'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.map(l => {
                    const member = staff.find(s => s.name === l.staff_name)
                    const rate = member?.hourly_rate || 0
                    const cost = (l.hours_worked * rate) + (l.overtime_hours * rate * 1.5)
                    return (
                      <tr key={l.id}>
                        <td style={s.td}>{l.log_date}</td>
                        <td style={s.td}>{l.staff_name}</td>
                        <td style={s.td}>{l.hours_worked}h</td>
                        <td style={{ ...s.td, color: l.overtime_hours > 0 ? '#F0B070' : 'inherit' }}>{l.overtime_hours}h</td>
                        <td style={s.td}>UGX {fmt(cost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.cardTitle}>+ ADD STAFF MEMBER</div>
            <form onSubmit={saveStaff}>
              <F label="FULL NAME" value={staffForm.name} onChange={v => setStaffForm({ ...staffForm, name: v })} required />
              <F label="ROLE / POSITION" value={staffForm.role} onChange={v => setStaffForm({ ...staffForm, role: v })} placeholder="e.g. Head Baker" />
              <F label="HOURLY RATE (UGX)" type="number" value={staffForm.hourly_rate} onChange={v => setStaffForm({ ...staffForm, hourly_rate: v })} placeholder="e.g. 12500" />
              <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving...' : '+ Add Staff Member'}</button>
            </form>
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>STAFF ROSTER ({staff.length})</div>
            {staff.length === 0 ? <div style={s.empty}>No staff added yet.</div> : staff.map(m => (
              <div key={m.id} style={s.staffRow}>
                <div>
                  <div style={{ color: '#FDF6EC', fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ color: 'rgba(253,246,236,0.5)', fontSize: 11 }}>{m.role} · UGX {fmt(m.hourly_rate)}/hr</div>
                </div>
                <button style={s.delBtn} onClick={() => delStaff(m.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const KPI = ({ label, value, color }) => (
  <div style={s.kpi}>
    <div style={s.kpiLabel}>{label}</div>
    <div style={{ ...s.kpiValue, color: color || '#FDF6EC' }}>{value}</div>
  </div>
)

const F = ({ label, type = 'text', value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  badge: { fontSize: 10, background: 'rgba(200,134,42,0.2)', color: '#C8862A', padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Mono', monospace" },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  kpi: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: '16px 18px' },
  kpiLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  kpiValue: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900 },
  tabs: { display: 'flex', gap: 4, background: 'rgba(26,14,8,0.5)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid rgba(200,134,42,0.2)', width: 'fit-content' },
  tab: { padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, background: 'transparent', color: 'rgba(253,246,236,0.45)' },
  tabActive: { background: '#C8862A', color: '#1A0E08' },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 16 },
  label: { display: 'block', fontSize: 10, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '11px', background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  warn: { background: 'rgba(224,140,58,0.12)', border: '1px solid rgba(224,140,58,0.3)', color: '#F0B070', borderRadius: 8, padding: '10px 12px', fontSize: 12, marginBottom: 12 },
  staffRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, borderBottom: '1px solid rgba(200,134,42,0.2)' },
  td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(253,246,236,0.8)', fontFamily: "'DM Mono', monospace" },
  delBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' },
  empty: { color: 'rgba(253,246,236,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 24, fontSize: 13 },
}
