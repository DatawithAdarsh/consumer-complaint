import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))

// The anon key is safe to ship in the browser: Row Level Security in
// supabase/schema.sql is what protects the data.
export const supabase = createClient(
  isConfigured ? url : 'http://localhost:54321',
  isConfigured ? key : 'missing-key'
)
