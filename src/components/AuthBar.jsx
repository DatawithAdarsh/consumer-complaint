import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthBar({ session }) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendLink(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    setMsg(error ? error.message : 'Check your email for the sign-in link.')
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setMsg(error.message)
  }

  if (session) {
    return (
      <div className="auth">
        <span className="muted">{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    )
  }

  return (
    <div className="auth">
      <form onSubmit={sendLink}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <button disabled={busy}>Email me a link</button>
      </form>
      <button onClick={google} type="button">Google</button>
      {msg && <span className="muted small">{msg}</span>}
    </div>
  )
}
