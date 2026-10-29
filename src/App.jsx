import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
/* eslint-disable react/prop-types */

/* ── Inline SVG icons (no emoji) ──────────────────────────────────── */
const Icon = {
  Bell: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Send: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Mail: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Download: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Plus: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  FileText: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  ArrowUpRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  BarChart2: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  CreditCard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  Link: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Search: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  SortAsc: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12l7-7 7 7"/>
    </svg>
  ),
  SortDesc: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  ),
  Bot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  User: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

/* ── Mock data ────────────────────────────────────────────────────── */
const TRANSACTIONS = [
  { id:'TXN-8821', client:'Acme Corp',       type:'Invoice',      amount: 4200,  status:'completed', date:'Oct 28',  geo:'US', method:'PayPal' },
  { id:'TXN-8820', client:'Blue Sky Ltd',    type:'Subscription', amount:  299,  status:'completed', date:'Oct 28',  geo:'GB', method:'Card'   },
  { id:'TXN-8819', client:'Vertex Studios',  type:'Invoice',      amount: 1850,  status:'pending',   date:'Oct 27',  geo:'CA', method:'PayPal' },
  { id:'TXN-8818', client:'NovaTech GmbH',   type:'Refund',       amount: -340,  status:'refunded',  date:'Oct 27',  geo:'DE', method:'PayPal' },
  { id:'TXN-8817', client:'Pixel Dynamics',  type:'Invoice',      amount: 6750,  status:'overdue',   date:'Oct 15',  geo:'AU', method:'Invoice'},
  { id:'TXN-8816', client:'CloudBase Inc',   type:'Payment',      amount:  980,  status:'completed', date:'Oct 26',  geo:'US', method:'Card'   },
  { id:'TXN-8815', client:'Bright Future',   type:'Invoice',      amount: 2200,  status:'overdue',   date:'Oct 10',  geo:'US', method:'Invoice'},
  { id:'TXN-8814', client:'FutureCast',      type:'Payment',      amount: 5500,  status:'flagged',   date:'Oct 25',  geo:'NG', method:'PayPal' },
  { id:'TXN-8813', client:'Swift Creatives', type:'Subscription', amount:  149,  status:'completed', date:'Oct 24',  geo:'US', method:'Card'   },
  { id:'TXN-8812', client:'Omni Digital',    type:'Invoice',      amount: 3300,  status:'completed', date:'Oct 24',  geo:'GB', method:'Invoice'},
]

const INVOICES = [
  { id:'INV-2241', client:'Pixel Dynamics',  amount:6750, days:13, initials:'PD', color:'#7c3aed' },
  { id:'INV-2235', client:'Bright Future',   amount:2200, days:18, initials:'BF', color:'#e5484d' },
  { id:'INV-2228', client:'Summit Partners', amount:3400, days:6,  initials:'SP', color:'#009cde' },
  { id:'INV-2220', client:'Alpha Retail',    amount:1120, days:3,  initials:'AR', color:'#1db171' },
]

const FRAUD_ALERTS = [
  { id:1, level:'high',   title:'Velocity anomaly — FutureCast',     desc:'5 transactions in 10 min totalling $27,500 originating from Lagos, NG. Possible structuring activity.',   time:'2 min ago' },
  { id:2, level:'medium', title:'Unusual geography — NovaTech GmbH', desc:'Refund initiated from Germany. No prior transactions recorded from this region on this account.',          time:'18 min ago' },
  { id:3, level:'medium', title:'Refund rate spike',                  desc:'8 refunds processed in the last 2 hours — 340% above 7-day rolling average.',                             time:'1 hr ago'  },
  { id:4, level:'low',    title:'New device login',                   desc:'Account accessed from an unrecognised browser on Windows 11 (Chrome 130). IP: 185.220.x.x.',             time:'3 hr ago'  },
]

const WORKFLOWS = [
  { id:1, name:'Log to Google Sheets',  desc:'Append every completed payment to your reconciliation sheet.', trigger:'On payment success',  on:true  },
  { id:2, name:'Slack overdue alert',   desc:'Post to #payments channel when invoice is 7+ days overdue.',   trigger:'On invoice overdue',   on:true  },
  { id:3, name:'CRM follow-up task',    desc:'Create a task in your CRM when a payment fails.',              trigger:'On payment failure',   on:false },
  { id:4, name:'Daily email digest',    desc:'Morning summary of transactions, overdue invoices, and alerts.',trigger:'Daily at 08:00',       on:true  },
]

const SUBS = [
  { name:'CloudBase Inc',   cycle:'Monthly',  amount:'$980' },
  { name:'Pixel Suite Pro', cycle:'Annual',   amount:'$149' },
  { name:'Zapier Business', cycle:'Monthly',  amount:'$49'  },
]

const ACTIVITY = [
  { dot:'g', text: <><strong>Payment received</strong> — Acme Corp paid INV-2240 ($4,200)</>,          when:'2 min ago'  },
  { dot:'b', text: <><strong>Reminder sent</strong> — 2nd reminder drafted and sent to Pixel Dynamics</>, when:'15 min ago' },
  { dot:'r', text: <><strong>Fraud alert</strong> — Velocity anomaly flagged for FutureCast</>,         when:'22 min ago' },
  { dot:'b', text: <><strong>Workflow triggered</strong> — Slack alert sent for INV-2235</>,            when:'1 hr ago'   },
  { dot:'g', text: <><strong>Subscription renewed</strong> — Blue Sky Ltd monthly plan ($299)</>,       when:'2 hr ago'   },
]

const CHART = [
  { label:'Mon', v:62 }, { label:'Tue', v:78 }, { label:'Wed', v:55 },
  { label:'Thu', v:91 }, { label:'Fri', v:83 }, { label:'Sat', v:44 },
  { label:'Sun', v:70 },
]
const MINI_CHART = [38,62,48,80,68,90,58,74,82,95]

/* ── AI responses ─────────────────────────────────────────────────── */
const RESPONSES = {
  'who owes':       "You currently have 4 overdue invoices totalling $13,470:\n\n• Pixel Dynamics — $6,750 (13 days)\n• Bright Future — $2,200 (18 days)\n• Summit Partners — $3,400 (6 days)\n• Alpha Retail — $1,120 (3 days)\n\nWould you like me to queue reminders for all of them?",
  'overdue':        "4 overdue invoices, $13,470 total. Bright Future is the most overdue at 18 days — I can send an escalated second reminder. Want me to proceed?",
  'reminder':       "Done. I've queued payment reminders for all 4 overdue clients via PayPal. Bright Future received an escalated (2nd) notice given their 18-day delay.",
  'fraud':          "3 anomalies detected in the last 24 hours:\n\n• High — FutureCast: 5 transactions in 10 min from Lagos ($27,500)\n• Medium — NovaTech: Unusual refund from Germany\n• Medium — Refund rate 340% above 7-day average\n\nWant me to flag these for manual review?",
  'yesterday':      "Yesterday's summary:\n\n• 6 payments received — $11,529\n• 1 refund — $340\n• 2 subscriptions renewed — $448\n• Net: $11,637\n\nTop earner: Acme Corp ($4,200). No failed payments.",
  'balance':        "Your current PayPal balance is $23,841.50. $1,850 in pending payments expected to clear in 24–48 hours.",
  'subscription':   "3 active subscriptions:\n\n• CloudBase Inc — $980/mo\n• Pixel Suite Pro — $149/yr\n• Zapier Business — $49/mo\n\nAll renewals current. Next billing: CloudBase Inc on Nov 1.",
  'summary':        "This week at a glance:\n\n• Revenue: $47,240 (+12% vs last week)\n• Pending: $1,850\n• Overdue: $13,470\n• Refunds: $340\n• Active subs: 3 ($1,178/mo)\n\nYou're running ahead of last week's pace.",
  'default':        "I can help with that. Try asking about overdue invoices, recent transactions, your balance, fraud alerts, or payment summaries.",
}

function getResponse(msg) {
  const q = msg.toLowerCase()
  for (const [k, v] of Object.entries(RESPONSES)) {
    if (k !== 'default' && q.includes(k)) return v
  }
  return RESPONSES.default
}

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

/* ── Toast ────────────────────────────────────────────────────────── */
function Toasts({ list }) {
  return (
    <div className="toast-wrap" aria-live="polite">
      {list.map(t => <div key={t.id} className={`toast ${t.type || ''}`}>{t.msg}</div>)}
    </div>
  )
}

/* ── Topbar ───────────────────────────────────────────────────────── */
function Topbar({ tab, setTab }) {
  const NAV = ['Dashboard','Transactions','Invoices','Alerts','Workflows']
  return (
    <header className="topbar">
      <div className="topbar-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#003087"/>
          <path d="M7 8h6a3 3 0 0 1 0 6H9l-2 6" stroke="#009cde" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 14h5a3 3 0 0 1 0 6H11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
        </svg>
        <span className="topbar-logo-name">Pay<span>Pilot</span></span>
      </div>

      <ul className="topbar-nav">
        {NAV.map(n => (
          <li key={n}>
            <a
              href="#"
              className={tab === n ? 'active' : ''}
              onClick={e => { e.preventDefault(); setTab(n) }}
              aria-current={tab === n ? 'page' : undefined}
            >{n}</a>
          </li>
        ))}
      </ul>

      <div className="topbar-right">
        <button className="notif-btn" aria-label="Notifications">
          <Icon.Bell />
          <span className="notif-dot" />
        </button>
        <button className="topbar-btn topbar-btn-primary" style={{display:'flex',alignItems:'center',gap:5}}>
          <Icon.Plus /> New invoice
        </button>
        <button className="user-chip">
          <div className="user-avatar">JB</div>
          John Baker
          <Icon.ChevronDown />
        </button>
      </div>
    </header>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero({ onChat }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <div>
          <p className="hero-eyebrow">PayPal Agent Toolkit · Elastic · AG Grid</p>
          <h1>Payment operations,<br /><b>without the busywork</b></h1>
          <p className="hero-desc">
            Ask questions in plain English, auto-chase overdue invoices, detect fraud
            in real time, and connect your payment stack — all from one place.
          </p>
          <div className="hero-ctas">
            <button className="btn-cta-primary" onClick={onChat}>Ask the AI copilot</button>
            <button className="btn-cta-secondary">View documentation</button>
          </div>
          <div className="hero-stats">
            {[
              { val:'£42k', label:'Avg. overdue invoices per SMB' },
              { val:'12 hrs', label:'Saved per week on admin' },
              { val:'3.4×', label:'Faster collections with reminders' },
            ].map(s => (
              <div key={s.label}>
                <div className="hero-stat-val">{s.val}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live mini-dashboard panel */}
        <div className="hero-panel" aria-hidden="true">
          <p className="hero-panel-title">Live overview — this week</p>
          <div className="hero-kpis">
            <div className="hero-kpi">
              <div className="hero-kpi-label">Revenue</div>
              <div className="hero-kpi-val">$47,240</div>
              <div className="hero-kpi-sub up">+12% vs last week</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">Overdue</div>
              <div className="hero-kpi-val">$13,470</div>
              <div className="hero-kpi-sub down">4 invoices</div>
            </div>
          </div>
          <div className="mini-chart" role="presentation">
            {MINI_CHART.map((h, i) => (
              <div
                key={i}
                className={`mini-chart-bar ${i === MINI_CHART.length - 1 ? 'hi' : ''}`}
                style={{ height:`${h}%` }}
              />
            ))}
          </div>
          <div className="hero-alert">
            <div className="hero-alert-icon"><Icon.AlertTriangle /></div>
            <div className="hero-alert-text">
              Velocity anomaly — FutureCast, $27,500 across 5 transactions in 10 min.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── KPI strip ────────────────────────────────────────────────────── */
function KPIStrip() {
  const cells = [
    { label:'Revenue (MTD)',        val:'$47,240', sub:'+12%',          cls:'up'   },
    { label:'Outstanding invoices', val:'$15,320', sub:'5 open',        cls:'neu'  },
    { label:'Overdue',              val:'$13,470', sub:'4 invoices',    cls:'down' },
    { label:'Active subscriptions', val:'3',       sub:'$1,178/mo',     cls:'neu'  },
    { label:'Fraud alerts',         val:'3',       sub:'Needs review',  cls:'down' },
  ]
  return (
    <div className="kpi-strip" role="region" aria-label="Key metrics">
      <div className="kpi-strip-inner">
        {cells.map(c => (
          <div key={c.label} className="kpi-cell">
            <div className="kpi-cell-label">{c.label}</div>
            <div className="kpi-cell-value">{c.val}</div>
            <div className={`kpi-cell-sub ${c.cls}`}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── AI Chat ──────────────────────────────────────────────────────── */
function AIChat({ chatRef }) {
  const INIT = [{
    id: 0, role:'ai',
    text: "Hi, I'm your payment operations copilot. I can answer questions about your transactions, chase overdue invoices, flag fraud, and automate workflows.\n\nTry: \"Who owes me money?\" or \"Show me yesterday's summary.\"",
    ts: now()
  }]
  const [msgs, setMsgs] = useState(INIT)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)

  const SUGGESTIONS = [
    'Who owes me money?',
    'Send reminders to overdue clients',
    'Any fraud alerts?',
    "Yesterday's summary",
    "What's my balance?",
  ]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs, typing])

  const send = useCallback((text) => {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    const id = Date.now()
    setMsgs(m => [...m, { id, role:'user', text:msg, ts:now() }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMsgs(m => [...m, { id:id+1, role:'ai', text:getResponse(msg), ts:now() }])
    }, 700 + Math.random() * 500)
  }, [input])

  const renderText = (t) =>
    t.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
          p.startsWith('**') ? <strong key={j}>{p.slice(2,-2)}</strong> : p
        )}
        {i < arr.length - 1 && <br />}
      </span>
    ))

  return (
    <div className="card" ref={chatRef}>
      <div className="card-head">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'var(--text2)',display:'flex'}}><Icon.Bot /></span>
          <span className="card-title">AI Copilot</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="live-dot" />
          <span style={{fontSize:11,color:'var(--text3)'}}>Connected to PayPal MCP</span>
        </div>
      </div>

      <div className="chat-suggestions" role="list">
        {SUGGESTIONS.map(s => (
          <button key={s} className="suggestion" role="listitem" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="chat-wrap">
        <div className="chat-msgs" role="log" aria-live="polite">
          {msgs.map(m => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              <div className={`msg-icon ${m.role === 'ai' ? 'ai-icon' : 'user-icon'}`}>
                {m.role === 'ai' ? <Icon.Bot /> : <Icon.User />}
              </div>
              <div className="msg-bubble">
                {renderText(m.text)}
                <div className="msg-time">{m.ts}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="typing-row">
              <div className="msg-icon ai-icon"><Icon.Bot /></div>
              <div className="msg-bubble" style={{background:'var(--surface2)',border:'1px solid var(--border)'}}>
                <div className="typing-dots" aria-label="Typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything about your payments…"
            aria-label="Message"
          />
          <button
            className="chat-send"
            onClick={() => send()}
            disabled={!input.trim()}
            aria-label="Send"
          ><Icon.Send /></button>
        </div>
      </div>
    </div>
  )
}

/* ── Transactions ─────────────────────────────────────────────────── */
function TransactionsCard({ toast }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [sortCol, setSortCol] = useState('id')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const PER = 6

  const filtered = TRANSACTIONS
    .filter(t =>
      (status === 'all' || t.status === status) &&
      (t.client.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase()))
    )
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const pages = Math.ceil(filtered.length / PER)
  const rows = filtered.slice(page * PER, page * PER + PER)

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const STATUS_BADGE = {
    completed: 'badge-green', pending:'badge-yellow',
    overdue:'badge-red', refunded:'badge-purple', flagged:'badge-red'
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null
    return <span style={{marginLeft:3,color:'var(--text3)'}}>{sortDir==='asc' ? <Icon.SortAsc /> : <Icon.SortDesc />}</span>
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Transactions</span>
        <div className="tbl-controls" style={{padding:0,border:'none'}}>
          <input
            className="tbl-search"
            placeholder="Search client or ID"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0) }}
            aria-label="Search transactions"
          />
          <select
            className="tbl-select"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(0) }}
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="refunded">Refunded</option>
            <option value="flagged">Flagged</option>
          </select>
          <button className="btn btn-ghost" onClick={() => toast('Exporting CSV…', 'info')}>
            <Icon.Download /> Export
          </button>
        </div>
      </div>
      <div className="tbl-scroll">
        <table className="tbl" aria-label="Transactions">
          <thead>
            <tr>
              {[['id','ID'],['date','Date'],['client','Client'],['type','Type'],['amount','Amount'],['status','Status'],['geo','Region'],['method','Method']].map(([col,label]) => (
                <th key={col} onClick={() => sort(col)} aria-sort={sortCol===col ? (sortDir==='asc'?'ascending':'descending') : 'none'}>
                  {label}<SortIcon col={col} />
                </th>
              ))}
              <th style={{cursor:'default'}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td><span className="tbl-id">{t.id}</span></td>
                <td><span className="tbl-date">{t.date}</span></td>
                <td><span className="tbl-client">{t.client}</span></td>
                <td><span className="tbl-type">{t.type}</span></td>
                <td>
                  <span className={`tbl-amount ${t.amount < 0 ? 'amt-neg' : t.status === 'overdue' ? 'amt-over' : 'amt-pos'}`}>
                    {t.amount < 0 ? `−$${Math.abs(t.amount).toLocaleString()}` : `$${t.amount.toLocaleString()}`}
                  </span>
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[t.status] || 'badge-gray'}`}>
                    {t.status}
                  </span>
                </td>
                <td><span className="tbl-geo">{t.geo}</span></td>
                <td><span className="tbl-method">{t.method}</span></td>
                <td>
                  <button className="tbl-action-btn" onClick={() => toast(`Viewing ${t.id}`, 'info')}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tbl-footer">
        <span>{page*PER+1}–{Math.min((page+1)*PER, filtered.length)} of {filtered.length} transactions</span>
        <div className="pager" role="navigation" aria-label="Pages">
          <button className="pager-btn" onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}>‹</button>
          {Array.from({length:pages}).map((_,i) => (
            <button key={i} className={`pager-btn ${page===i?'cur':''}`} onClick={() => setPage(i)} aria-current={page===i?'page':undefined}>{i+1}</button>
          ))}
          <button className="pager-btn" onClick={() => setPage(p => Math.min(pages-1,p+1))} disabled={page===pages-1}>›</button>
        </div>
      </div>
    </div>
  )
}

/* ── Overdue Invoices ─────────────────────────────────────────────── */
function OverdueCard({ toast }) {
  const [done, setDone] = useState([])
  const visible = INVOICES.filter(i => !done.includes(i.id))

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Overdue invoices</span>
        <button
          className="btn btn-primary"
          onClick={() => toast('Reminders queued for all 4 clients')}
        >
          <Icon.Mail /> Send all reminders
        </button>
      </div>
      <div className="inv-list">
        {visible.length === 0 && (
          <div style={{padding:'20px 18px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            All invoices are cleared.
          </div>
        )}
        {visible.map(inv => (
          <div key={inv.id} className="inv-row">
            <div className="inv-init" style={{background:inv.color}}>{inv.initials}</div>
            <div className="inv-info">
              <div className="inv-name">{inv.client}</div>
              <div className="inv-meta">{inv.id} · Due {inv.days} days ago</div>
            </div>
            <div className="inv-amount-col">
              <div className="inv-amount">${inv.amount.toLocaleString()}</div>
              <div className="inv-days">{inv.days}d overdue</div>
            </div>
            <button
              className="inv-btn send"
              onClick={() => toast(`Reminder sent to ${inv.client}`, 'info')}
              aria-label={`Send reminder to ${inv.client}`}
              title="Send reminder"
            ><Icon.Mail /></button>
            <button
              className="inv-btn confirm"
              onClick={() => { setDone(d => [...d, inv.id]); toast(`${inv.client} marked as paid`) }}
              aria-label={`Mark ${inv.client} as paid`}
              title="Mark as paid"
            ><Icon.Check /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Fraud Alerts ─────────────────────────────────────────────────── */
function AlertsCard({ toast }) {
  const [dismissed, setDismissed] = useState([])
  const visible = FRAUD_ALERTS.filter(a => !dismissed.includes(a.id))

  return (
    <div className="card">
      <div className="card-head">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'var(--text2)',display:'flex'}}><Icon.Shield /></span>
          <span className="card-title">Fraud & anomaly detection</span>
        </div>
        <span style={{fontSize:11,color:'var(--text3)'}}>Powered by Elastic</span>
      </div>
      <div className="alert-list" role="list">
        {visible.length === 0 && (
          <div style={{padding:'20px 18px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            No active alerts.
          </div>
        )}
        {visible.map(a => (
          <div key={a.id} className="alert-row" role="listitem">
            <div className={`alert-indicator ind-${a.level}`} />
            <div className="alert-body">
              <div className="alert-title">{a.title}</div>
              <div className="alert-desc">{a.desc}</div>
              <div className="alert-footer">
                <span className="alert-time">{a.time}</span>
                <div className="alert-btns">
                  <button className="alert-btn" onClick={() => setDismissed(d => [...d, a.id])}>Dismiss</button>
                  <button className="alert-btn inv" onClick={() => toast(`Investigating: ${a.title}`, 'err')}>Investigate</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Workflows ────────────────────────────────────────────────────── */
function WorkflowsCard({ toast }) {
  const [wfs, setWfs] = useState(WORKFLOWS)

  const toggle = (id) => {
    setWfs(w => w.map(x => x.id === id ? {...x, on:!x.on} : x))
    const wf = wfs.find(w => w.id === id)
    toast(`${wf.on ? 'Paused' : 'Enabled'}: ${wf.name}`, 'info')
  }

  return (
    <div className="card">
      <div className="card-head">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'var(--text2)',display:'flex'}}><Icon.Zap /></span>
          <span className="card-title">Automated workflows</span>
        </div>
        <span style={{fontSize:11,color:'var(--text3)'}}>via Zapier</span>
      </div>
      <div className="card-body">
        <div className="wf-grid">
          {wfs.map(wf => (
            <div key={wf.id} className={`wf-card ${wf.on ? 'enabled' : ''}`}>
              <div className="wf-card-head">
                <span className="wf-name">{wf.name}</span>
                <label className="switch" aria-label={`Toggle ${wf.name}`}>
                  <input type="checkbox" checked={wf.on} onChange={() => toggle(wf.id)} />
                  <span className="switch-track" />
                </label>
              </div>
              <div className="wf-desc">{wf.desc}</div>
              <div className="wf-trigger-tag">{wf.trigger}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Revenue chart ────────────────────────────────────────────────── */
function RevenueCard() {
  const [chartTab, setChartTab] = useState('Week')
  const max = Math.max(...CHART.map(d => d.v))

  return (
    <div className="card">
      <div className="card-head">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'var(--text2)',display:'flex'}}><Icon.BarChart2 /></span>
          <span className="card-title">Revenue</span>
        </div>
        <div className="chart-tabs">
          {['Week','Month','Year'].map(t => (
            <button key={t} className={`chart-tab ${chartTab===t?'active':''}`} onClick={() => setChartTab(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div className="rev-chart" role="img" aria-label={`Revenue chart — ${chartTab}`}>
          {CHART.map((d, i) => (
            <div key={d.label} className="rev-col">
              <div className="rev-col-bar">
                <div
                  className={`rev-bar ${i % 2 ? 'alt' : ''}`}
                  style={{ height:`${(d.v/max)*100}%` }}
                  title={`${d.label}: $${(d.v * 520).toLocaleString()}`}
                />
              </div>
              <div className="rev-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar({ toast }) {
  const ACTIONS = [
    { icon:<Icon.FileText />, label:'Create invoice',  fn:() => toast('Opening invoice builder', 'info') },
    { icon:<Icon.CreditCard />, label:'Send payment',  fn:() => toast('Opening payment form', 'info') },
    { icon:<Icon.Download />, label:'Export report',   fn:() => toast('Generating PDF report', 'info') },
    { icon:<Icon.Shield />, label:'Run fraud scan',    fn:() => toast('Elastic scan initiated', 'info') },
    { icon:<Icon.Link />, label:'Connect app',         fn:() => toast('Opening Zapier integrations', 'info') },
    { icon:<Icon.ArrowUpRight />, label:'View payouts',fn:() => toast('Loading payout history', 'info') },
  ]

  return (
    <aside className="col-side">
      {/* Quick actions */}
      <div className="card">
        <div className="card-head"><span className="card-title">Quick actions</span></div>
        <div className="card-body">
          <div className="qa-grid">
            {ACTIONS.map(a => (
              <button key={a.label} className="qa-item" onClick={a.fn}>
                <div className="qa-item-icon">{a.icon}</div>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="card">
        <div className="card-head">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{color:'var(--text2)',display:'flex'}}><Icon.RefreshCw /></span>
            <span className="card-title">Subscriptions</span>
          </div>
          <span className="badge badge-green">3 active</span>
        </div>
        <div className="sub-list">
          {SUBS.map(s => (
            <div key={s.name} className="sub-row">
              <div className="sub-icon-box"><Icon.CreditCard /></div>
              <div>
                <div className="sub-name">{s.name}</div>
                <div className="sub-cycle">{s.cycle}</div>
              </div>
              <div className="sub-amt">{s.amount}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="card-head"><span className="card-title">Recent activity</span></div>
        <div className="feed" role="feed">
          {ACTIVITY.map((a, i) => (
            <div key={i} className="feed-item">
              <div className="feed-line">
                <div className={`feed-dot ${a.dot}`} />
              </div>
              <div>
                <div className="feed-text">{a.text}</div>
                <div className="feed-when">{a.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

/* ── Tech stack strip ─────────────────────────────────────────────── */
function StackStrip() {
  const tags = ['PayPal Agent Toolkit','OpenAI GPT-4o','Elastic AI Search','AG Grid','Zapier','Postman','APIMatic','Render']
  return (
    <div className="stack-strip">
      <div className="stack-strip-inner">
        <span className="stack-label">Built with</span>
        <div className="stack-tags">
          {tags.map(t => <span key={t} className="stack-tag">{t}</span>)}
        </div>
      </div>
    </div>
  )
}

/* ── Footer ───────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div>
            <div className="footer-brand-name">Pay<span>Pilot</span></div>
            <div className="footer-brand-desc">
              AI-powered payment operations for small businesses.
              Stop chasing invoices. Focus on growing.
            </div>
          </div>
          {[
            { title:'Product', links:['Dashboard','AI Copilot','Fraud Detection','Workflows','Pricing'] },
            { title:'Integrations', links:['PayPal','Elastic','Zapier','AG Grid','Postman'] },
            { title:'Company', links:['About','Blog','Security','Privacy','Contact'] },
          ].map(col => (
            <div key={col.title}>
              <div className="footer-col-title">{col.title}</div>
              <ul className="footer-links">
                {col.links.map(l => <li key={l}><a href="#">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 PayPilot · Built for the PayPal Developer Hackathon</span>
          <span>Deployed on Render</span>
        </div>
      </div>
    </footer>
  )
}

/* ── App ──────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [toasts, setToasts] = useState([])
  const chatRef = useRef(null)

  const toast = useCallback((msg, type = '') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  const goChat = () => {
    setTab('Dashboard')
    setTimeout(() => chatRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80)
  }

  const renderTab = () => {
    const map = {
      Transactions: <div className="page"><TransactionsCard toast={toast} /></div>,
      Invoices:     <div className="page"><OverdueCard toast={toast} /></div>,
      Alerts:       <div className="page"><AlertsCard toast={toast} /></div>,
      Workflows:    <div className="page"><WorkflowsCard toast={toast} /></div>,
    }
    if (map[tab]) return map[tab]

    return (
      <div className="page">
        <div className="page-cols">
          <div className="col-main">
            <AIChat chatRef={chatRef} />
            <TransactionsCard toast={toast} />
            <OverdueCard toast={toast} />
            <AlertsCard toast={toast} />
            <WorkflowsCard toast={toast} />
            <RevenueCard />
          </div>
          <Sidebar toast={toast} />
        </div>
      </div>
    )
  }

  return (
    <>
      <Topbar tab={tab} setTab={setTab} />
      {tab === 'Dashboard' && <><Hero onChat={goChat} /><KPIStrip /></>}
      <main>{renderTab()}</main>
      <StackStrip />
      <Footer />
      <Toasts list={toasts} />
    </>
  )
}
