import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { scoreBand, resolvedPct, isRanked } from '../lib/format'

export default function Rankings({ onOpenCompany }) {
  const [categories, setCategories] = useState([])
  const [slug, setSlug] = useState(null)
  const [sort, setSort] = useState('score')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('categories')
      .select('slug,name')
      .order('name')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setCategories(data)
        if (data.length) setSlug(data[0].slug)
      })
  }, [])

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    let q = supabase.from('company_rankings').select('*').eq('category_slug', slug)
    q =
      sort === 'score'
        ? q.order('rank_in_category', { ascending: true, nullsFirst: false }).order('total_complaints', { ascending: false })
        : q.order('total_complaints', { ascending: false })
    q.then(({ data, error }) => {
      setLoading(false)
      if (error) return setError(error.message)
      setError('')
      setRows(data)
    })
  }, [slug, sort])

  return (
    <section>
      <div className="tabs" role="tablist">
        {categories.map((c) => (
          <button key={c.slug} role="tab" aria-selected={slug === c.slug} className={slug === c.slug ? 'active' : ''} onClick={() => setSlug(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="row between">
        <h2>Ranking</h2>
        <label className="muted">
          Sort by{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">Trust score (best first)</option>
            <option value="volume">Most complaints</option>
          </select>
        </label>
      </div>

      {error && <div className="banner warn">{error}</div>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Score</th>
              <th>Complaints</th>
              <th>Last 90 days</th>
              <th>Resolved</th>
              <th>Avg severity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ranked = isRanked(r)
              const band = scoreBand(ranked ? r.score : null)
              return (
                <tr key={r.company_id}>
                  <td>{ranked ? r.rank_in_category : '–'}</td>
                  <td>
                    <button className="link" onClick={() => onOpenCompany(r.company_id)}>
                      {r.company_name}
                    </button>
                  </td>
                  <td>
                    <span className={`pill ${band.tone}`}>{ranked ? `${r.score} · ${band.label}` : 'Not enough data'}</span>
                  </td>
                  <td>{r.total_complaints}</td>
                  <td>{r.recent_complaints}</td>
                  <td>{resolvedPct(r.resolved_count, r.total_complaints)}</td>
                  <td>{r.total_complaints ? r.avg_severity : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
