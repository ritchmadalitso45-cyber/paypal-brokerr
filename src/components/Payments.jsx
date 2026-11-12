import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { api } from '../lib/client'

function Money({ value, currency }) {
  return <span className="money">{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))} <small>{currency}</small></span>
}
function Status({ resource }) {
  if (resource.loading) return <p role="status" className="empty">Loading records…</p>
  if (resource.error) return <p role="alert" className="error">{resource.error} <button className="btn" onClick={resource.reload}>Retry</button></p>
  return null
}
function Card({ title, children, extra }) {
  return <section className="card"><div className="card-head"><h2 className="card-title">{title}</h2>{extra}</div><div className="card-body">{children}</div></section>
}
function Pager({ offset, setOffset, size, count }) {
  return <div className="pager"><button className="btn" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - size))}>Previous</button><span>Page {Math.floor(offset / size) + 1}</span><button className="btn" disabled={count < size} onClick={() => setOffset(offset + size)}>Next</button></div>
}
function DateTime({ value }) { return <time>{value ? new Date(value.endsWith('Z') ? value : `${value}Z`).toLocaleString() : '—'}</time> }

export function Dashboard({ revision, admin }) {
  const summary = useResource('/dashboard', revision, true)
  const integrations = useResource('/integrations', revision)
  return <><Card title="Receivables overview"><Status resource={summary} />{summary.data && <><div className="stat-grid">{Object.entries(summary.data.outstanding_by_currency).map(([currency, value]) => <div key={currency} className="stat"><span>Outstanding invoices</span><strong><Money value={value} currency={currency} /></strong><span>Overdue: <Money value={summary.data.overdue_by_currency[currency] || 0} currency={currency} /></span></div>)}{!Object.keys(summary.data.outstanding_by_currency).length && <p>No outstanding invoices in the synchronized records.</p>}<div className="stat"><span>Invoices</span><strong>{summary.data.invoice_count}</strong></div><div className="stat"><span>Transactions</span><strong>{summary.data.transaction_count}</strong></div><div className="stat"><span>Screening alerts</span><strong>{summary.data.alert_count}</strong></div></div><p className="muted">Updated <DateTime value={summary.data.as_of} /> · refreshes every 30 seconds. This is a local reporting view, not your PayPal wallet balance.</p></>}</Card><Card title="Connected tools"><Status resource={integrations} />{integrations.data && <div className="stat-grid">{['paypal', 'openai', 'elastic', 'zapier', 'slack', 'crm'].map(name => <div className="stat" key={name}><strong>{name === 'paypal' ? 'PayPal' : name}</strong><span>{(name === 'paypal' ? integrations.data.paypal.configured : integrations.data[name]) ? 'Configured' : 'Not configured'}</span></div>)}</div>}<p className="muted">Configuration does not confirm provider connectivity. {admin ? 'Use Sync PayPal to fetch current records.' : 'Ask your administrator to synchronize payment records.'}</p></Card></>
}

export function Transactions({ revision }) {
  const [offset, setOffset] = useState(0), [currency, setCurrency] = useState(''), [status, setStatus] = useState('')
  const path = `/transactions?offset=${offset}&limit=50&currency=${encodeURIComponent(currency)}&status=${encodeURIComponent(status)}`
  const resource = useResource(path, revision), items = resource.data?.items || []
  function download() {
    const escape = value => `"${String(value ?? '').replace(/^[=+@\t\r-]/, "'$&").replaceAll('"', '""')}"`
    const columns = ['id', 'status', 'currency', 'amount', 'country', 'event_code', 'occurred_at']
    const csv = [columns.join(','), ...items.map(row => columns.map(key => escape(row[key])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a')
    link.href = url; link.download = 'paypal-broker-transactions-page.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <Card title="Transactions" extra={<button className="btn" onClick={download} disabled={!items.length}>Export this page as CSV</button>}><div className="filters"><label>Currency<input value={currency} maxLength={3} placeholder="All currencies" onChange={e => { setCurrency(e.target.value.toUpperCase()); setOffset(0) }} /></label><label>Provider status<input value={status} placeholder="All statuses" onChange={e => { setStatus(e.target.value); setOffset(0) }} /></label></div><Status resource={resource} />{resource.data && <><div className="table-wrap"><table><thead><tr><th>ID</th><th>Amount</th><th>Status</th><th>Country</th><th>Event code</th><th>Date</th></tr></thead><tbody>{items.map(row => <tr key={row.id}><td>{row.id}</td><td><Money value={row.amount} currency={row.currency} /></td><td>{row.status}</td><td>{row.country || '—'}</td><td>{row.event_code}</td><td><DateTime value={row.occurred_at} /></td></tr>)}</tbody></table></div>{!items.length && <p className="empty">No matching transactions. Synchronize PayPal to retrieve records.</p>}<Pager offset={offset} setOffset={setOffset} size={50} count={items.length} /></>}<p className="muted">Account movements can include refunds and transfers; they are not automatically classified as revenue or payouts.</p></Card>
}

export function Invoices({ revision, admin, refresh, onReview }) {
  const [offset, setOffset] = useState(0), [overdue, setOverdue] = useState(false)
  const [selected, setSelected] = useState(null), [note, setNote] = useState(''), [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const resource = useResource(`/invoices?offset=${offset}&limit=50&overdue=${overdue}`, revision)
  async function reminder(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try { await api(`/invoices/${selected.id}/reminders`, { method: 'POST', key: requestKey, body: { note } }); setSelected(null); setMessage('Reminder drafted. Review and approve it in Approvals.'); refresh() }
    catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function send(row) {
    setBusy(true); setMessage('')
    try { await api(`/invoices/${row.id}/send`, { method: 'POST', key: `send-${row.id}` }); setMessage('Send proposal created. Review it in Approvals.'); refresh() }
    catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <Card title="Invoices"><label className="checkbox"><input type="checkbox" checked={overdue} onChange={e => { setOverdue(e.target.checked); setOffset(0) }} />Overdue only</label><Status resource={resource} />{message && <p role="status" className="notice">{message} {admin && <button className="text-button" onClick={onReview}>Open Approvals</button>}</p>}{selected && <form className="editor" onSubmit={reminder}><h3>Draft reminder for {selected.id}</h3><p>{selected.customer} · <Money value={selected.outstanding} currency={selected.currency} /></p><label>Reminder message<textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label><div className="actions"><button className="btn btn-primary" disabled={busy}>Create proposal</button><button type="button" className="btn" disabled={busy} onClick={() => setSelected(null)}>Cancel</button></div></form>}{resource.data && <><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Outstanding</th><th>Status</th><th>Due date</th>{admin && <th>Action</th>}</tr></thead><tbody>{resource.data.items.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.customer || '—'}</td><td><Money value={row.outstanding} currency={row.currency} /></td><td>{row.status}</td><td>{row.due_date || '—'}</td>{admin && <td>{Number(row.outstanding) > 0 && <button className="btn" disabled={busy} onClick={() => { setSelected(row); setNote(`A friendly reminder that invoice ${row.id} remains outstanding. Please contact us if you need assistance.`); setRequestKey(crypto.randomUUID()) }}>Draft reminder</button>}{row.status === 'DRAFT' && <button className="btn" disabled={busy} onClick={() => send(row)}>Propose send</button>}</td>}</tr>)}</tbody></table></div>{!resource.data.items.length && <p className="empty">No matching invoices.</p>}<Pager offset={offset} setOffset={setOffset} size={50} count={resource.data.items.length} /></>}</Card>
}

export function CreateInvoice({ refresh, onReview }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [key, setKey] = useState(() => crypto.randomUUID())
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form)); setBusy(true); setMessage('')
    try {
      await api('/invoices', { method: 'POST', key, body: { customer_email: values.email, currency: values.currency, due_date: values.due, items: [{ name: values.name, quantity: Number(values.quantity), unit_amount: values.amount }] } })
      setMessage('Draft invoice proposal created. Approve it before sending.'); setKey(crypto.randomUUID()); form.reset(); refresh()
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <Card title="Create an invoice proposal"><form className="editor" onSubmit={submit}><div className="form-grid"><label>Customer email<input type="email" name="email" required maxLength={254} /></label><label>Currency<select name="currency">{['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'CHF', 'NZD', 'HKD', 'SGD'].map(currency => <option key={currency}>{currency}</option>)}</select></label><label>Due date<input type="date" name="due" required /></label><label>Item or service<input name="name" maxLength={127} required /></label><label>Quantity<input type="number" name="quantity" min="1" max="10000" defaultValue="1" required /></label><label>Unit amount<input type="number" name="amount" min="0.01" max="1000000" step="0.01" required /></label></div><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create proposal'}</button></form><p className="muted">Approval creates a PayPal draft. Sending it requires a separate reviewed action.</p>{message && <p role="status" className="notice">{message} <button className="text-button" onClick={onReview}>Review proposals</button></p>}</Card>
}

function OperationDetails({ operation }) {
  const payload = operation.payload
  return <><p><strong>{operation.kind.replaceAll('_', ' ')}</strong> · {operation.resource_id} · {operation.status}</p><p className="muted">Reference {operation.id} · Expires <DateTime value={operation.expires_at} /></p>
    {operation.kind === 'reminder' && <><h3>{payload.subject}</h3><p className="message-text">{payload.note}</p></>}
    {operation.kind === 'create_invoice' && <><p>Recipient: {payload.primary_recipients?.[0]?.billing_info?.email_address}</p><p>Due: {payload.detail?.payment_term?.due_date}</p><ul>{payload.items?.map((item, index) => <li key={index}>{item.name} · {item.quantity} × <Money value={item.unit_amount.value} currency={item.unit_amount.currency_code} /></li>)}</ul></>}
    {operation.kind === 'send_invoice' && <p>Send this invoice to the recipient recorded in PayPal.</p>}
    {operation.kind === 'subscription' && <p>{payload.action}: {payload.reason}</p>}
    {operation.result?.id && <p>PayPal record: {operation.result.id}</p>}</>
}

export function Operations({ revision, refresh }) {
  const [offset, setOffset] = useState(0), [status, setStatus] = useState('proposed')
  const [busy, setBusy] = useState(null), [message, setMessage] = useState(''), [selected, setSelected] = useState(null)
  const resource = useResource(`/operations?limit=50&offset=${offset}${status ? `&status=${status}` : ''}`, revision)
  async function approve(row) {
    if (!window.confirm('Approve the action exactly as displayed? This may notify a customer or change a subscription.')) return
    setBusy(row.id); setMessage('')
    try { const result = await api(`/operations/${row.id}/approve`, { method: 'POST' }); setSelected(result); setMessage(`Operation ${result.id}: ${result.status}.`); refresh() }
    catch (error) { setMessage(`${error.message} Inspect this operation before attempting another action.`); try { setSelected(await api(`/operations/${row.id}`)) } catch { /* Keep existing review details if disconnected. */ } }
    finally { setBusy(null) }
  }
  async function reconcile(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setBusy(selected.id)
    try { setSelected(await api(`/operations/${selected.id}/reconcile`, { method: 'POST', body: values })); setMessage('Verified outcome recorded.'); refresh() }
    catch (error) { setMessage(error.message) } finally { setBusy(null) }
  }
  return <Card title="Review and approve"><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}>{['proposed', 'succeeded', 'unknown', 'executing', 'not_applied', ''].map(value => <option key={value} value={value}>{value || 'All statuses'}</option>)}</select></label><Status resource={resource} />{message && <p role="status" className="notice">{message}</p>}{selected && <section className="editor"><OperationDetails operation={selected} />{selected.status === 'proposed' && <button className="btn btn-primary" disabled={Boolean(busy) || new Date(`${selected.expires_at}Z`) < new Date()} onClick={() => approve(selected)}>Approve this action</button>}{['unknown', 'executing'].includes(selected.status) && <form onSubmit={reconcile}><p>Verify the outcome in PayPal first. Reconciliation is allowed after 20 minutes from proposal creation.</p><label>Verified outcome<select name="outcome"><option value="confirmed_succeeded">Confirmed applied</option><option value="confirmed_not_applied">Confirmed not applied</option></select></label><label>Evidence<textarea name="evidence" required minLength={20} maxLength={1000} /></label><button className="btn" disabled={Boolean(busy)}>Record verified outcome</button></form>}</section>}{resource.data && <><ul className="record-list">{resource.data.items.map(row => <li key={row.id}><div><strong>{row.kind.replaceAll('_', ' ')}</strong><p>{row.resource_id} · {row.status} · <DateTime value={row.created_at} /></p></div><button className="btn" onClick={() => setSelected(row)}>Review details</button></li>)}</ul>{!resource.data.items.length && <p className="empty">No operations in this state.</p>}<Pager offset={offset} setOffset={setOffset} size={50} count={resource.data.items.length} /></>}</Card>
}

export function Alerts({ revision }) {
  const [offset, setOffset] = useState(0), resource = useResource(`/alerts?limit=50&offset=${offset}`, revision)
  return <Card title="Screening alerts"><p className="muted">Signals for review, not confirmed fraud. Review the referenced transaction in Transactions or PayPal.</p><Status resource={resource} />{resource.data && <><ul className="record-list">{resource.data.items.map(row => <li key={row.id}><div><strong>{row.transaction_id}</strong><p>{row.reason}</p><small>{row.severity} · <DateTime value={row.created_at} /></small></div></li>)}</ul>{!resource.data.items.length && <p className="empty">No screening alerts recorded.</p>}<Pager offset={offset} setOffset={setOffset} size={50} count={resource.data.items.length} /></>}</Card>
}

export function Workflows({ revision, refresh }) {
  const resource = useResource('/workflows', revision), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function create(event) {
    event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true)
    try { if (resource.data?.items.some(row => row.enabled && row.event === body.event && row.destination === body.destination)) throw new Error('This workflow is already enabled.'); await api('/workflows', { method: 'POST', body }); setMessage('Workflow enabled.'); refresh() }
    catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function disable(row) { setBusy(true); try { await api(`/workflows/${row.id}`, { method: 'DELETE' }); setMessage('Workflow disabled. Already queued deliveries may still complete.'); refresh() } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  return <Card title="Connected workflows"><Status resource={resource} /><p className="muted">Your operator configures destination connections securely on the server.</p><form className="filters" onSubmit={create}><label>Event<select name="event">{['invoice.overdue', 'payment.succeeded', 'payment.failed', 'alert.created'].map(value => <option key={value}>{value}</option>)}</select></label><label>Destination<select name="destination">{['zapier', 'slack', 'crm'].map(value => <option key={value}>{value}</option>)}</select></label><button className="btn btn-primary" disabled={busy}>Enable workflow</button></form>{message && <p role="status" className="notice">{message}</p>}<ul className="record-list">{resource.data?.items.map(row => <li key={row.id}><div><strong>{row.event} → {row.destination}</strong><p>{row.enabled ? 'Enabled' : 'Disabled'}</p></div>{row.enabled && <button className="btn" disabled={busy} onClick={() => disable(row)}>Disable</button>}</li>)}</ul></Card>
}

export function Assistant({ admin, refresh, onReview }) {
  const [messages, setMessages] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function send(event) {
    event.preventDefault(); const form = event.currentTarget, message = new FormData(form).get('message'); setBusy(true); setError('')
    try { const result = await api('/agent/chat', { method: 'POST', body: { message } }); setMessages(previous => [...previous, { question: message, ...result }]); form.reset(); refresh() }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <Card title="Payment assistant"><p>Ask about overdue invoices, recent transactions or screening alerts. {admin ? 'Reminder requests create proposals for review.' : 'Your account has read-only access.'}</p><div aria-live="polite" className="conversation">{messages.map((row, index) => <div key={index}><p className="question">{row.question}</p><p className="message-text">{row.answer}</p>{row.proposals.map(proposal => <p key={proposal.operation_id}>Reminder proposal: {proposal.operation_id} <button className="btn" onClick={onReview}>Review in Approvals</button></p>)}</div>)}</div>{error && <p role="alert" className="error">{error}</p>}<form onSubmit={send} className="editor"><label>Your question<textarea name="message" maxLength={2000} required placeholder="Who owes me money?" /></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Checking your records…' : 'Ask assistant'}</button></form><p className="muted">Questions are independent. The assistant can read bounded records and draft reminders; it cannot approve or send them.</p></Card>
}

export function ProviderRecords({ admin, onReview, refresh }) {
  const [subscription, setSubscription] = useState(null), [disputes, setDisputes] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  async function lookup(event) { event.preventDefault(); const id = new FormData(event.currentTarget).get('id'); setBusy(true); setSubscription(null); try { setSubscription(await api(`/subscriptions/${encodeURIComponent(id)}`)); setMessage('') } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  async function action(event) { event.preventDefault(); setBusy(true); try { await api(`/subscriptions/${subscription.id}/actions`, { method: 'POST', key: crypto.randomUUID(), body: Object.fromEntries(new FormData(event.currentTarget)) }); setMessage('Subscription action proposed. Review before approval.'); refresh() } catch (error) { setMessage(error.message) } finally { setBusy(false) } }
  return <><Card title="Subscription lookup"><form className="filters" onSubmit={lookup}><label>PayPal subscription ID<input name="id" pattern="[A-Za-z0-9-]{1,128}" required placeholder="I-…" /></label><button className="btn" disabled={busy}>Look up</button></form>{subscription && <div className="editor"><h3>{subscription.id}</h3><p>Status: {subscription.status}</p><p>Next billing: {subscription.billing_info?.next_billing_time || 'Not provided'}</p>{admin && <form onSubmit={action}><label>Action<select name="action"><option>suspend</option><option>activate</option><option>cancel</option></select></label><label>Reason<input name="reason" required maxLength={128} /></label><button className="btn" disabled={busy}>Propose action</button></form>}</div>}<p className="muted">Known IDs only; this service does not discover all subscriptions.</p></Card><Card title="Disputes"><button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { setDisputes(await api('/disputes')); setMessage('') } catch (error) { setMessage(error.message) } finally { setBusy(false) } }}>Load current disputes</button>{disputes && <ul className="record-list">{(disputes.items || []).map(row => <li key={row.dispute_id}><div><strong>{row.dispute_id}</strong><p>{row.status} · {row.reason}</p></div></li>)}</ul>}<p className="muted">Displays the first provider page. Resolve or submit evidence in PayPal.</p></Card>{message && <p role="status" className="notice">{message} {admin && <button className="text-button" onClick={onReview}>Open Approvals</button>}</p>}</>
}
