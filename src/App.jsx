import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase'
import AuthBar from './components/AuthBar.jsx'
import Rankings from './components/Rankings.jsx'
import ComplaintForm from './components/ComplaintForm.jsx'
import CompanyPage from './components/CompanyPage.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState({ name: 'rankings' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <div className="app">
      <header className="top">
        <h1 onClick={() => setView({ name: 'rankings' })} role="link" tabIndex={0}>
          Complaint Board
        </h1>
        <nav>
          <button className={view.name === 'rankings' ? 'active' : ''} onClick={() => setView({ name: 'rankings' })}>
            Rankings
          </button>
          <button className={view.name === 'submit' ? 'active' : ''} onClick={() => setView({ name: 'submit' })}>
            Report a complaint
          </button>
        </nav>
        <AuthBar session={session} />
      </header>

      {!isConfigured && (
        <div className="banner warn">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL
          and anon key.
        </div>
      )}

      <main>
        {view.name === 'rankings' && <Rankings onOpenCompany={(id) => setView({ name: 'company', id })} />}
        {view.name === 'submit' && (
          <ComplaintForm session={session} onDone={(id) => setView(id ? { name: 'company', id } : { name: 'rankings' })} />
        )}
        {view.name === 'company' && <CompanyPage id={view.id} onBack={() => setView({ name: 'rankings' })} />}
      </main>

      <footer>
        <p>
          Complaints are opinions and experiences shared by individual users and are not verified by us. Rankings are a
          community signal, not a finding of fact. Companies or users who want content removed can email the site owner.
        </p>
        <p>
          Score = 100 × smoothed resolution rate × (1 − smoothed severity penalty). Companies need at least 3 complaints
          to be ranked. Scores do not account for company size.
        </p>
      </footer>
    </div>
  )
}
