import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { scoreBand, resolvedPct, isRanked } from '../lib/format'

export default function CompanyPage({ id, onBack }) {
  const [company, setCompany] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('company_rankings').select('*').eq('company_id', id).single().then(({ data, error }) => {
      if (error) setError(error.message)
      else setCompany(data)
    })
    supabase
      .from('public_complaints')
      .select('*')
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setComplaints(data || []))
  }, [id])

  if (error) return <div className="banner warn">{error}</div>
  if (!company) return <p className="muted">Loading…</p>

  const ranked = isRanked(company)
  const band = scoreBand(ranked ? company.score : null)

  return (
    <section>
      <button className="link" onClick={onBack}>← Back to rankings</button>
      <h2>{company.company_name}</h2>
      <p className="muted">{company.category_name}</p>
      <div className="stats">
        <div><strong>{ranked ? `#${company.rank_in_category}` : '–'}</strong><span>rank</span></div>
        <div><strong className={`pill ${band.tone}`}>{ranked ? company.score : 'n/a'}</strong><span>score</span></div>
        <div><strong>{company.total_complaints}</strong><span>complaints</span></div>
        <div><strong>{resolvedPct(company.resolved_count, company.total_complaints)}</strong><span>resolved</span></div>
      </div>

      <h3>Recent complaints</h3>
      {complaints.length === 0 && <p className="muted">No complaints yet.</p>}
      {complaints.map((c) => (
        <article key={c.id} className="card">
          <div className="row between">
            <strong>{c.title}</strong>
            <span className="muted small">{new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <p className="muted small">
            {c.issue_type} · severity {c.severity}/5 · {c.resolved ? 'resolved' : 'unresolved'}
          </p>
          {/* React escapes text, so user content cannot inject HTML/scripts. */}
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
        </article>
      ))}
    </section>
  )
}
