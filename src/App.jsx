import { useState } from 'react'
import './App.css'
import './integration.css'
import { useAuth } from './hooks/useAuth'
import { useResource } from './hooks/useResource'
import { api } from './lib/client'
import { Dashboard, Transactions, Invoices, Alerts, Workflows, Operations, Assistant, CreateInvoice, ProviderRecords } from './components/Payments'

function AuthForm({ identity }) {
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try { if (signup) await identity.signUp(values); else await identity.signIn(values.email, values.password) }
    catch (error) { setMessage(error.code?.startsWith('auth/') ? error.code.replace('auth/', '').replaceAll('-', ' ') : 'Unable to sign in. Please try again.') }
    finally { setBusy(false) }
  }
  return <div className="auth-root"><aside className="auth-panel"><div className="auth-panel-logo-name">PayPal Broker</div><h1>Payment operations,<br />without the busywork</h1><p>Invoices, transaction screening and connected workflows in one place.</p><p>Account access is granted by your business administrator.</p></aside><div className="auth-form-area"><section className="auth-card"><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p>Sign in to your payment workspace.</p>{message && <p role="alert" className="auth-error">{message}</p>}<form onSubmit={submit}>
    {signup && <div className="auth-row"><label>First name<input className="auth-input" name="firstName" required maxLength={80} autoComplete="given-name" /></label><label>Last name<input className="auth-input" name="lastName" required maxLength={80} autoComplete="family-name" /></label></div>}
    <label>Email<input className="auth-input" name="email" type="email" required autoComplete="email" /></label><label>Password<input className="auth-input" name="password" type="password" minLength={signup ? 8 : 1} required autoComplete={signup ? 'new-password' : 'current-password'} /></label><button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button></form>
    <button className="text-button" onClick={() => { setSignup(!signup); setMessage('') }}>{signup ? 'Already have an account? Sign in' : 'Create an account'}</button>
    {!signup && <button className="text-button" onClick={async () => { const email = window.prompt('Enter your account email'); if (email) { try { await identity.resetPassword(email) } catch { /* Avoid account enumeration. */ } setMessage('If an account exists, a password reset email will arrive shortly.') } }}>Forgot password?</button>}
    {signup && <p className="muted">Verify your email after signup. Your administrator must grant merchant access.</p>}</section></div></div>
}

function Workspace({ identity }) {
  const [tab, setTab] = useState('Dashboard')
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [syncJob, setSyncJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const admin = identity.user.role === 'admin'
  const refresh = () => setRevision(value => value + 1)
  const job = useResource(syncJob ? `/jobs/${syncJob}` : '/integrations', revision, Boolean(syncJob))
  const tabs = ['Dashboard', 'Transactions', 'Invoices', 'Alerts', 'Assistant', 'Subscriptions & disputes', ...(admin ? ['Approvals', 'Workflows', 'Create invoice'] : [])]
  async function sync() {
    setBusy(true); setNotice('')
    try {
      const end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
      const result = await api('/sync', { method: 'POST', body: { start, end }, key: crypto.randomUUID() })
      setSyncJob(result.job_id); setNotice('Synchronization queued. Refresh records when it succeeds.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  const props = { revision, refresh, admin, onReview: () => setTab('Approvals') }
  return <><header className="topbar"><div className="topbar-logo-name">PayPal<span>Broker</span></div><div className="account">{identity.user.name} <span className="badge">{identity.user.role}</span><button className="btn" onClick={() => identity.signOut()}>Sign out</button></div></header><nav className="workspace-nav" aria-label="Workspace">{tabs.map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <main className="page"><div className="workspace-heading"><div><p className="eyebrow">YOUR PAYMENT WORKSPACE</p><h1>{tab}</h1><p className="muted">Connected merchant records, with amounts separated by currency.</p></div><div className="actions"><button className="btn" onClick={refresh}>Refresh records</button>{admin && <button className="btn btn-primary" disabled={busy} onClick={sync}>{busy ? 'Queuing…' : 'Sync PayPal'}</button>}</div></div>{notice && <p role="status" className="notice">{notice}</p>}{syncJob && <div className="notice" role="status">Sync job: {job.data?.status || job.error || 'checking…'} {job.data?.error && `(${job.data.error})`}<button className="text-button" onClick={() => setSyncJob(null)}>Dismiss</button></div>}
    {tab === 'Dashboard' && <Dashboard {...props} />}{tab === 'Transactions' && <Transactions {...props} />}{tab === 'Invoices' && <Invoices {...props} />}{tab === 'Alerts' && <Alerts {...props} />}{tab === 'Assistant' && <Assistant {...props} />}{tab === 'Approvals' && admin && <Operations {...props} />}{tab === 'Workflows' && admin && <Workflows {...props} />}{tab === 'Create invoice' && admin && <CreateInvoice {...props} />}{tab === 'Subscriptions & disputes' && <ProviderRecords {...props} />}</main><footer className="workspace-footer">PayPal Broker · Review payment actions before approval. Screening alerts are not proof of fraud.</footer></>
}

export default function App() {
  const identity = useAuth()
  const [message, setMessage] = useState('')
  if (identity.loading) return <main className="auth-form-area" role="status">Opening your workspace…</main>
  if (!identity.user) return <AuthForm identity={identity} />
  if (!identity.user.role) return <main className="access-state"><h1>Account access</h1><p role="alert">{identity.error}</p><p>Your account ID: <code>{identity.user.uid}</code></p><p>Verify your email and ask your administrator to grant merchant access.</p><div className="actions"><button className="btn" onClick={async () => { try { await identity.verifyEmail(); setMessage('Verification email sent.') } catch { setMessage('Unable to send verification. Please try again later.') } }}>Send verification email</button><button className="btn" onClick={async () => { try { await identity.refresh(); setMessage('Session refreshed.') } catch { setMessage('Please sign in again.') } }}>Check access again</button><button className="btn" onClick={() => identity.signOut()}>Sign out</button></div><p role="status">{message}</p></main>
  return <Workspace key={identity.user.uid} identity={identity} />
}
