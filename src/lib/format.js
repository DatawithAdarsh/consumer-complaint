export const ISSUE_TYPES = [
  'Claim rejected or delayed',
  'Refund not received',
  'Wrong or damaged product',
  'Delivery delay',
  'Billing or hidden charges',
  'Poor customer support',
  'Misleading advertising or fraud',
  'Other',
]

export const MIN_COMPLAINTS_FOR_RANK = 3

// Mirrors the score formula in supabase/schema.sql so it can be unit-tested.
export function computeScore({ total, resolved, sumSeverity }) {
  const resolution = (resolved + 2.5) / (total + 5)
  const severity = (sumSeverity + 15) / (total + 5)
  return Math.round(100 * resolution * (1 - (severity - 1) / 8) * 10) / 10
}

export function scoreBand(score) {
  if (score == null) return { label: 'No data', tone: 'neutral' }
  if (score >= 60) return { label: 'Good', tone: 'good' }
  if (score >= 40) return { label: 'Mixed', tone: 'mid' }
  return { label: 'Poor', tone: 'bad' }
}

export function resolvedPct(resolved, total) {
  if (!total) return '–'
  return `${Math.round((resolved / total) * 100)}%`
}

export function isRanked(row) {
  return row.total_complaints >= MIN_COMPLAINTS_FOR_RANK && row.rank_in_category != null
}
