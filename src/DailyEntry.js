import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthContext'

const STEPS = ['Revenue', 'Labor', 'Waste', 'Ingredients', 'Summary']

export default function DailyEntry({ onSaved }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [staff, setStaff] = useState([])
  const [products, setProducts] = useState([])
  const [ingredients, setIngredients] = useState([])

  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [revenue, setRevenue] = useState('')
  const [revenueBreakdown, setRevenueBreakdown] = useState({ walkin: '', preorder: '', delivery: '', wholesale: '' })
  const [laborEntries, setLaborEntries] = useState([]) // [{staff_id, staff_name, hourly_rate, hours, overtime}]
  const [wasteEntries, setWasteEntries] = useState([]) // [{product_name, qty, unit_value, total}]
  const [ingredientUsage, setIngredientUsage] = useState([]) // [{id, name, used, unit}]
  const [notes, setNotes] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [staffRes, prodRes, ingRes] = await Promise.all([
      supabase.from('staff').select('*').eq('user_id', user.id).eq('active', true),
      supabase.from('products').select('*').eq('user_id', user.id),
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name')
    ])
    setStaff(staffRes.data || [])
    setProducts(prodRes.data || [])
    setIngredients(ingRes.data || [])
  }

  // Calculations
  const totalRevenue = revenue ? parseFloat(revenue) :
    Object.values(revenueBreakdown).reduce((a, v) => a + (parseFloat(v) || 0), 0)

  const totalLabor = laborEntries.reduce((a, e) => {
    const rate = parseFloat(e.hourly_rate) || 0
    const hrs = parseFloat(e.hours) || 0
    const ot = parseFloat(e.overtime) || 0
    return a + (hrs * rate) + (ot * rate * 1.5)
  }, 0)

  const totalWaste = wasteEntries.reduce((a, e) => a + (parseFloat(e.total) || 0), 0)

  const totalIngredientCost = ingredientUsage.reduce((a, i) => {
    const ing = ingredients.find(x => x.id === i.id)
    return a + ((parseFloat(i.used) || 0) * (ing?.cost_per_unit || 0))
  }, 0)

  const grossProfit = totalRevenue - totalIngredientCost
  const netProfit = grossProfit - totalLabor - totalWaste
  const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0
  const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0
  const laborPct = totalRevenue > 0 ? ((totalLabor / totalRevenue) * 100).toFixed(1) : 0

  const addLaborEntry = (member) => {
    if (laborEntries.find(e => e.staff_id === member.id)) return
    setLaborEntries([...laborEntries, { staff_id: member.id, staff_name: member.name, hourly_rate: member.hourly_rate, hours: '8', overtime: '0' }])
  }

  const updateLabor = (staffId, field, value) => {
    setLaborEntries(laborEntries.map(e => e.staff_id === staffId ? { ...e, [field]: value } : e))
  }

  const removeLabor = (staffId) => {
    setLaborEntries(laborEntries.filter(e => e.staff_id !== staffId))
  }

  const addWasteEntry = () => {
    setWasteEntries([...wasteEntries, { product_name: '', qty: '', unit_value: '', total: 0 }])
  }

  const updateWaste = (idx, field, value) => {
    const updated = [...wasteEntries]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'qty' || field === 'unit_value') {
      updated[idx].total = (parseFloat(updated[idx].qty) || 0) * (parseFloat(updated[idx].unit_value) || 0)
    }
    // Auto-fill unit value from products
    if (field === 'product_name') {
      const prod = products.find(p => p.name === value)
      if (prod) {
        updated[idx].unit_value = prod.ingredient_cost || prod.sell_price * 0.4
        updated[idx].total = (parseFloat(updated[idx].qty) || 0) * (parseFloat(updated[idx].unit_value) || 0)
      }
    }
    setWasteEntries(updated)
  }

  const removeWaste = (idx) => setWasteEntries(wasteEntries.filter((_, i) => i !== idx))

  const toggleIngredient = (ing) => {
    const exists = ingredientUsage.find(i => i.id === ing.id)
    if (exists) {
      setIngredientUsage(ingredientUsage.filter(i => i.id !== ing.id))
    } else {
      setIngredientUsage([...ingredientUsage, { id: ing.id, name: ing.name, used: '', unit: ing.unit, cost_per_unit: ing.cost_per_unit }])
    }
  }

  const updateIngUsage = (id, value) => {
    setIngredientUsage(ingredientUsage.map(i => i.id === id ? { ...i, used: value } : i))
  }

  const save = async () => {
    setSaving(true)
    try {
      // Save daily entry
      const { error } = await supabase.from('daily_entries').upsert({
        user_id: user.id,
        entry_date: entryDate,
        revenue: totalRevenue,
        ingredient_cost: totalIngredientCost,
        labor_cost: totalLabor,
        waste_value: totalWaste,
        notes
      }, { onConflict: 'user_id,entry_date' })

      if (error) throw error

      // Save labor logs
      for (const e of laborEntries) {
        await supabase.from('labor_log').insert({
          user_id: user.id,
          staff_id: e.staff_id,
          staff_name: e.staff_name,
          log_date: entryDate,
          hours_worked: parseFloat(e.hours) || 0,
          overtime_hours: parseFloat(e.overtime) || 0
        })
      }

      // Save waste/sales logs
      for (const w of wasteEntries) {
        if (w.product_name) {
          await supabase.from('sales_log').insert({
            user_id: user.id,
            product_name: w.product_name,
            sale_date: entryDate,
            units_sold: 0,
            units_wasted: parseFloat(w.qty) || 0,
            channel: 'walk-in'
          })
        }
      }

      // Update ingredient stock
      for (const usage of ingredientUsage) {
        if (parseFloat(usage.used) > 0) {
          const ing = ingredients.find(i => i.id === usage.id)
          if (ing) {
            await supabase.from('ingredients').update({
              stock: Math.max(0, ing.stock - parseFloat(usage.used))
            }).eq('id', usage.id)
          }
        }
      }

      setSaved(true)
      setTimeout(() => { setSaved(false); setStep(0) }, 2500)
      if (onSaved) onSaved()
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>📝 Log Today's Numbers</div>
        <div style={s.datePicker}>
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={s.dateInput} />
        </div>
      </div>

      {/* Step indicator */}
      <div style={s.stepper}>
        {STEPS.map((label, i) => (
          <div key={i} style={s.stepWrap} onClick={() => i < step || step === STEPS.length - 1 ? setStep(i) : null}>
            <div style={{ ...s.stepCircle, ...(i === step ? s.stepActive : i < step ? s.stepDone : {}) }}>
              {i < step ? '✓' : i + 1}
            </div>
            <div style={{ ...s.stepLabel, color: i === step ? '#F0C040' : i < step ? '#90D0A0' : 'rgba(253,246,236,0.3)' }}>{label}</div>
          </div>
        ))}
        <div style={s.stepLine} />
      </div>

      {/* STEP 0 — REVENUE */}
      {step === 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>💰 HOW MUCH DID YOU MAKE TODAY?</div>
          <div style={s.hint}>Enter total revenue, or break it down by channel for better insights.</div>

          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>TOTAL REVENUE (UGX)</label>
            <input style={{ ...s.input, fontSize: 22, fontWeight: 700, color: '#F0C040' }}
              type="number" placeholder="e.g. 2,300,000"
              value={revenue} onChange={e => setRevenue(e.target.value)} />
            <div style={s.hint2}>Or break down by channel:</div>
          </div>

          <div style={s.grid2}>
            {[['walkin', '🚶 Walk-in'], ['preorder', '📱 Pre-order'], ['delivery', '🛵 Delivery'], ['wholesale', '📦 Wholesale']].map(([key, label]) => (
              <div key={key}>
                <label style={s.label}>{label}</label>
                <input style={s.input} type="number" placeholder="0"
                  value={revenueBreakdown[key]}
                  onChange={e => {
                    const updated = { ...revenueBreakdown, [key]: e.target.value }
                    setRevenueBreakdown(updated)
                    const total = Object.values(updated).reduce((a, v) => a + (parseFloat(v) || 0), 0)
                    if (total > 0) setRevenue(total.toString())
                  }} />
              </div>
            ))}
          </div>

          {totalRevenue > 0 && (
            <div style={s.previewBox}>
              <span style={s.previewLabel}>TOTAL REVENUE</span>
              <span style={{ ...s.previewVal, color: '#F0C040' }}>UGX {fmt(totalRevenue)}</span>
            </div>
          )}

          <button style={s.nextBtn} onClick={() => setStep(1)} disabled={totalRevenue <= 0}>
            Next: Log Labor →
          </button>
        </div>
      )}

      {/* STEP 1 — LABOR */}
      {step === 1 && (
        <div style={s.card}>
          <div style={s.cardTitle}>👩‍🍳 WHO WORKED TODAY?</div>
          <div style={s.hint}>Tap a staff member to add them. Hours and costs are calculated automatically.</div>

          {staff.length === 0 && (
            <div style={s.warnBox}>No staff added yet. Go to Labor & Staff to add your team first.</div>
          )}

          {/* Staff selector */}
          <div style={s.staffGrid}>
            {staff.map(m => {
              const added = laborEntries.find(e => e.staff_id === m.id)
              return (
                <div key={m.id} style={{ ...s.staffChip, ...(added ? s.staffChipActive : {}) }}
                  onClick={() => addLaborEntry(m)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{m.role} · UGX {fmt(m.hourly_rate)}/hr</div>
                  {added && <div style={s.addedBadge}>✓ Added</div>}
                </div>
              )
            })}
          </div>

          {/* Labor entries */}
          {laborEntries.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={s.label}>ADJUST HOURS WORKED</div>
              {laborEntries.map(e => {
                const cost = (parseFloat(e.hours) || 0) * e.hourly_rate + (parseFloat(e.overtime) || 0) * e.hourly_rate * 1.5
                return (
                  <div key={e.staff_id} style={s.laborRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#FDF6EC', marginBottom: 8 }}>{e.staff_name}</div>
                      <div style={s.laborInputs}>
                        <div>
                          <label style={s.label}>REGULAR HRS</label>
                          <input style={{ ...s.input, width: 90 }} type="number" value={e.hours}
                            onChange={ev => updateLabor(e.staff_id, 'hours', ev.target.value)} />
                        </div>
                        <div>
                          <label style={s.label}>OVERTIME HRS</label>
                          <input style={{ ...s.input, width: 90 }} type="number" value={e.overtime}
                            onChange={ev => updateLabor(e.staff_id, 'overtime', ev.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#90D0A0' }}>
                            = UGX {fmt(cost)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button style={s.removeBtn} onClick={() => removeLabor(e.staff_id)}>✕</button>
                  </div>
                )
              })}
              <div style={s.previewBox}>
                <span style={s.previewLabel}>TOTAL LABOR COST</span>
                <span style={{ ...s.previewVal, color: parseFloat(laborPct) > 35 ? '#F08070' : '#90D0A0' }}>
                  UGX {fmt(totalLabor)} ({laborPct}% of revenue)
                </span>
              </div>
              {parseFloat(laborPct) > 35 && (
                <div style={s.alertBox}>⚠️ Labor is above 35% of revenue. Consider reviewing shift allocations.</div>
              )}
            </div>
          )}

          <div style={s.btnRow}>
            <button style={s.backBtn} onClick={() => setStep(0)}>← Back</button>
            <button style={s.nextBtn} onClick={() => setStep(2)}>Next: Log Waste →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — WASTE */}
      {step === 2 && (
        <div style={s.card}>
          <div style={s.cardTitle}>📉 WHAT WAS THROWN AWAY TODAY?</div>
          <div style={s.hint}>Record unsold or spoiled items. If your product is set up, the cost is calculated automatically.</div>

          {wasteEntries.map((w, idx) => (
            <div key={idx} style={s.wasteRow}>
              <div style={{ flex: 2 }}>
                <label style={s.label}>PRODUCT</label>
                <input style={s.input} list={`products-${idx}`} placeholder="e.g. Croissant"
                  value={w.product_name}
                  onChange={e => updateWaste(idx, 'product_name', e.target.value)} />
                <datalist id={`products-${idx}`}>
                  {products.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>QTY WASTED</label>
                <input style={s.input} type="number" placeholder="0"
                  value={w.qty} onChange={e => updateWaste(idx, 'qty', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>COST EACH (UGX)</label>
                <input style={s.input} type="number" placeholder="auto"
                  value={w.unit_value} onChange={e => updateWaste(idx, 'unit_value', e.target.value)} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                <label style={s.label}>TOTAL LOSS</label>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#F08070', padding: '9px 0' }}>
                  UGX {fmt(w.total)}
                </div>
              </div>
              <button style={{ ...s.removeBtn, alignSelf: 'flex-end', marginBottom: 4 }} onClick={() => removeWaste(idx)}>✕</button>
            </div>
          ))}

          <button style={s.addRowBtn} onClick={addWasteEntry}>+ Add Waste Item</button>

          {totalWaste > 0 && (
            <div style={s.previewBox}>
              <span style={s.previewLabel}>TOTAL WASTE VALUE</span>
              <span style={{ ...s.previewVal, color: '#F08070' }}>UGX {fmt(totalWaste)}</span>
            </div>
          )}

          {wasteEntries.length === 0 && (
            <div style={s.zeroWaste}>🎉 No waste today? Great! Click Next to continue.</div>
          )}

          <div style={s.btnRow}>
            <button style={s.backBtn} onClick={() => setStep(1)}>← Back</button>
            <button style={s.nextBtn} onClick={() => setStep(3)}>Next: Ingredients →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — INGREDIENTS */}
      {step === 3 && (
        <div style={s.card}>
          <div style={s.cardTitle}>🥖 WHAT INGREDIENTS DID YOU USE TODAY?</div>
          <div style={s.hint}>Tick what you used and enter quantities. Your inventory will be updated automatically.</div>

          {ingredients.length === 0 && (
            <div style={s.warnBox}>No ingredients set up yet. Go to Inventory to add your ingredients first.</div>
          )}

          <div style={s.ingGrid}>
            {ingredients.map(ing => {
              const used = ingredientUsage.find(i => i.id === ing.id)
              return (
                <div key={ing.id} style={{ ...s.ingCard, ...(used ? s.ingCardActive : {}) }}
                  onClick={() => !used && toggleIngredient(ing)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#FDF6EC' }}>{ing.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.5)', marginTop: 2 }}>
                        Stock: {ing.stock} {ing.unit} · UGX {fmt(ing.cost_per_unit)}/{ing.unit}
                      </div>
                    </div>
                    {used && (
                      <button style={s.removeBtn} onClick={e => { e.stopPropagation(); toggleIngredient(ing) }}>✕</button>
                    )}
                  </div>
                  {used && (
                    <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      <label style={s.label}>HOW MUCH USED ({ing.unit})?</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input style={{ ...s.input, width: 100 }} type="number" placeholder="0"
                          value={used.used} onChange={e => updateIngUsage(ing.id, e.target.value)} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#90D0A0' }}>
                          = UGX {fmt((parseFloat(used.used) || 0) * ing.cost_per_unit)}
                        </span>
                      </div>
                    </div>
                  )}
                  {!used && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#C8862A' }}>+ Tap to add</div>
                  )}
                </div>
              )
            })}
          </div>

          {totalIngredientCost > 0 && (
            <div style={s.previewBox}>
              <span style={s.previewLabel}>TOTAL INGREDIENT COST</span>
              <span style={{ ...s.previewVal, color: '#C8862A' }}>UGX {fmt(totalIngredientCost)}</span>
            </div>
          )}

          <div style={s.btnRow}>
            <button style={s.backBtn} onClick={() => setStep(2)}>← Back</button>
            <button style={s.nextBtn} onClick={() => setStep(4)}>Review Summary →</button>
          </div>
        </div>
      )}

      {/* STEP 4 — SUMMARY */}
      {step === 4 && (
        <div style={s.card}>
          <div style={s.cardTitle}>📊 TODAY'S SUMMARY — {entryDate}</div>
          <div style={s.hint}>Review your numbers before saving. Everything looks right? Hit Save!</div>

          {saved ? (
            <div style={s.savedBox}>
              ✅ Entry saved successfully! Your dashboard has been updated.
            </div>
          ) : (
            <>
              <div style={s.summaryGrid}>
                <SummaryRow label="💰 Total Revenue" value={`UGX ${fmt(totalRevenue)}`} color="#F0C040" big />
                <div style={s.summaryDivider} />
                <SummaryRow label="🥖 Ingredient Cost" value={`UGX ${fmt(totalIngredientCost)}`} color="#C8862A" />
                <SummaryRow label="👩‍🍳 Labor Cost" value={`UGX ${fmt(totalLabor)}`} color="#7DBFAD"
                  sub={`${laborPct}% of revenue${parseFloat(laborPct) > 35 ? ' ⚠️' : ''}`} />
                <SummaryRow label="📉 Waste Loss" value={`UGX ${fmt(totalWaste)}`} color="#F08070" />
                <div style={s.summaryDivider} />
                <SummaryRow label="📈 Gross Profit" value={`UGX ${fmt(grossProfit)}`}
                  color={grossProfit > 0 ? '#90D0A0' : '#F08070'} sub={`${grossMargin}% margin`} />
                <SummaryRow label="💵 NET PROFIT" value={`UGX ${fmt(netProfit)}`}
                  color={netProfit > 0 ? '#F0C040' : '#F08070'} sub={`${netMargin}% net margin`} big />
              </div>

              {/* Staff logged */}
              {laborEntries.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.label}>STAFF LOGGED ({laborEntries.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {laborEntries.map(e => (
                      <div key={e.staff_id} style={s.tag}>{e.staff_name} · {e.hours}h</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waste logged */}
              {wasteEntries.filter(w => w.product_name).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.label}>WASTE LOGGED</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {wasteEntries.filter(w => w.product_name).map((w, i) => (
                      <div key={i} style={{ ...s.tag, background: 'rgba(214,79,59,0.15)', color: '#F08070', borderColor: 'rgba(214,79,59,0.3)' }}>
                        {w.qty}x {w.product_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={s.label}>NOTES (OPTIONAL)</label>
                <textarea style={{ ...s.input, height: 70, resize: 'none' }}
                  placeholder="Any observations, issues, or events today..."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div style={s.btnRow}>
                <button style={s.backBtn} onClick={() => setStep(3)}>← Back</button>
                <button style={{ ...s.nextBtn, background: '#5A9E6F', fontSize: 16, padding: '14px 32px' }}
                  onClick={save} disabled={saving}>
                  {saving ? 'Saving...' : '✅ Save Today\'s Entry'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const SummaryRow = ({ label, value, color, sub, big }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: big ? '10px 0' : '7px 0' }}>
    <div>
      <div style={{ fontSize: big ? 14 : 13, color: 'rgba(253,246,236,0.8)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(253,246,236,0.4)', marginTop: 2 }}>{sub}</div>}
    </div>
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: big ? 18 : 14, fontWeight: big ? 700 : 500, color }}>{value}</div>
  </div>
)

const fmt = (n) => Number(Math.round(n) || 0).toLocaleString()

const s = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#FDF6EC' },
  dateInput: { background: 'rgba(61,43,31,0.8)', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, color: '#F0C040', padding: '7px 12px', fontFamily: "'DM Mono', monospace", fontSize: 13 },
  stepper: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, position: 'relative', padding: '0 10px' },
  stepLine: { position: 'absolute', top: 16, left: '10%', right: '10%', height: 1, background: 'rgba(200,134,42,0.2)', zIndex: 0 },
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1, cursor: 'pointer' },
  stepCircle: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(61,43,31,0.8)', border: '2px solid rgba(200,134,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'rgba(253,246,236,0.4)', fontFamily: "'DM Mono', monospace" },
  stepActive: { background: '#C8862A', border: '2px solid #F0C040', color: '#1A0E08', fontWeight: 700 },
  stepDone: { background: 'rgba(90,158,111,0.3)', border: '2px solid #5A9E6F', color: '#90D0A0' },
  stepLabel: { fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: 1 },
  card: { background: 'rgba(61,43,31,0.6)', border: '1px solid rgba(200,134,42,0.18)', borderRadius: 12, padding: 24 },
  cardTitle: { fontSize: 11, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 6 },
  hint: { fontSize: 13, color: 'rgba(253,246,236,0.5)', marginBottom: 20, lineHeight: 1.5 },
  hint2: { fontSize: 11, color: 'rgba(253,246,236,0.35)', marginTop: 8, marginBottom: 12 },
  label: { display: 'block', fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(200,134,42,0.25)', borderRadius: 7, color: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", fontSize: 13, boxSizing: 'border-box' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  previewBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(26,14,8,0.5)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 8, padding: '12px 16px', marginTop: 16 },
  previewLabel: { fontSize: 9, color: '#C8862A', fontFamily: "'DM Mono', monospace", letterSpacing: 1.5 },
  previewVal: { fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700 },
  nextBtn: { background: '#C8862A', color: '#1A0E08', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  backBtn: { background: 'transparent', color: 'rgba(253,246,236,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 20px', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  staffGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  staffChip: { background: 'rgba(26,14,8,0.5)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' },
  staffChipActive: { background: 'rgba(200,134,42,0.15)', border: '1px solid rgba(200,134,42,0.5)' },
  addedBadge: { display: 'inline-block', marginTop: 6, fontSize: 10, color: '#90D0A0', background: 'rgba(90,158,111,0.15)', padding: '2px 8px', borderRadius: 20 },
  laborRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  laborInputs: { display: 'flex', gap: 16, alignItems: 'flex-end' },
  wasteRow: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  addRowBtn: { background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: "'DM Sans', sans-serif" },
  zeroWaste: { textAlign: 'center', color: '#90D0A0', fontSize: 14, padding: '24px 0' },
  warnBox: { background: 'rgba(200,134,42,0.1)', border: '1px solid rgba(200,134,42,0.3)', color: '#F0B070', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 },
  alertBox: { background: 'rgba(214,79,59,0.1)', border: '1px solid rgba(214,79,59,0.3)', color: '#F08070', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginTop: 12 },
  ingGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  ingCard: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.15)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' },
  ingCardActive: { background: 'rgba(200,134,42,0.12)', border: '1px solid rgba(200,134,42,0.4)', cursor: 'default' },
  removeBtn: { background: 'rgba(214,79,59,0.1)', color: '#F08070', border: '1px solid rgba(214,79,59,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 },
  summaryGrid: { background: 'rgba(26,14,8,0.4)', border: '1px solid rgba(200,134,42,0.2)', borderRadius: 12, padding: '16px 20px' },
  summaryDivider: { height: 1, background: 'rgba(200,134,42,0.15)', margin: '8px 0' },
  tag: { background: 'rgba(200,134,42,0.15)', color: '#C8862A', border: '1px solid rgba(200,134,42,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontFamily: "'DM Mono', monospace" },
  savedBox: { background: 'rgba(90,158,111,0.15)', border: '1px solid rgba(90,158,111,0.4)', color: '#90D0A0', borderRadius: 10, padding: '20px', textAlign: 'center', fontSize: 15 },
  datePicker: {},
}
