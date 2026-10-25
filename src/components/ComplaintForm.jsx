import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ISSUE_TYPES } from '../lib/format'

export default function ComplaintForm({ session, onDone }) {
  const [categories, setCategories] = useState([])
  const [companies, setCompanies] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState(3)
  const [resolved, setResolved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('categories').select('id,name').order('name').then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setCategoryId(String(data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!categoryId) return
    supabase
      .from('companies')
      .select('id,name')
      .eq('category_id', categoryId)
      .order('name')
      .then(({ data }) => {
        setCompanies(data || [])
        setCompanyId(data?.length ? String(data[0].id) : '')
      })
  }, [categoryId])

  if (!session) {
    return (
      <section className="card">
        <h2>Report a complaint</h2>
        <p>Please sign in (top right) first. We only use your email to stop spam; it is never shown publicly.</p>
      </section>
    )
  }

  async function resolveCompanyId() {
    const name = newCompany.trim()
    if (!name) return Number(companyId)
    const { data, error } = await supabase
      .from('companies')
      .insert({ name, category_id: Number(categoryId) })
      .select('id')
      .single()
    if (!error) return data.id
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('companies').select('id').ilike('name', name).single()
      if (existing) return existing.id
    }
    throw error
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const id = await resolveCompanyId()
      if (!id) throw new Error('Please choose or add a company.')
      const { error } = await supabase.from('complaints').insert({
        company_id: id,
        issue_type: issueType,
        title: title.trim(),
        description: description.trim(),
        severity: Number(severity),
        resolved,
      })
      if (error) throw error
      onDone(id)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Report a complaint</h2>
      <p className="muted">Stick to facts about your own experience. Do not include phone numbers, addresses or policy numbers.</p>

      <label>Category
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label>Company
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={!!newCompany.trim()}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label>Not listed? Add company name
        <input value={newCompany} maxLength={80} onChange={(e) => setNewCompany(e.target.value)} placeholder="Optional" />
      </label>

      <label>Type of issue
        <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
          {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>

      <label>Short title
        <input required minLength={5} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>What happened? ({description.length}/2000)
        <textarea required minLength={20} maxLength={2000} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>Severity: {severity} (1 = minor annoyance, 5 = serious financial or health impact)
        <input type="range" min="1" max="5" value={severity} onChange={(e) => setSeverity(e.target.value)} />
      </label>

      <label className="check">
        <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} />
        The company resolved my issue
      </label>

      {error && <div className="banner warn">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
    </form>
  )
}
