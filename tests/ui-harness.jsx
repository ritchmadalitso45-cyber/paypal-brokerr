import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/App.css'
import '../src/integration.css'
import { Dashboard, Invoices, Operations, Workflows, CreateInvoice, Transactions } from '../src/components/Payments'
export default function Harness() {
  const [screen, setScreen] = useState('dashboard'), [revision, setRevision] = useState(0)
  const props = { admin: true, revision, refresh: () => setRevision(value => value + 1), onReview: () => setScreen('approvals') }
  return <main className="page"><nav>{['dashboard', 'invoices', 'approvals', 'workflows', 'create', 'transactions'].map(name => <button key={name} onClick={() => setScreen(name)}>{name}</button>)}</nav>{screen === 'dashboard' && <Dashboard {...props} />}{screen === 'invoices' && <Invoices {...props} />}{screen === 'approvals' && <Operations {...props} />}{screen === 'workflows' && <Workflows {...props} />}{screen === 'create' && <CreateInvoice {...props} />}{screen === 'transactions' && <Transactions {...props} />}</main>
}
createRoot(document.getElementById('root')).render(<Harness />)
