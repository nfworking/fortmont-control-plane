import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { AgentService } from '../bindings/fortmont-agent-gui'
import './index.css'

type Status = {
  isRunning: boolean; isConnected: boolean; isEnrolled: boolean; serverUrl: string; deviceId: string
  name: string; description: string; version: string; statePath: string; hostname: string; localIp: string
  publicIp: string; platform: string; architecture: string; metricsIntervalSeconds: number
  lastHeartbeat: string; lastMetricsSent: string; errorMsg: string
}
type Metrics = {
  cpuUsage: number; cpuCores: number; memTotalMb: number; memUsedMb: number; memUsage: number
  diskTotalGb: number; diskUsedGb: number; diskUsage: number; storagePath: string
}
type Log = { id: number; timestamp: string; level: string; message: string }

const emptyStatus: Status = { isRunning: false, isConnected: false, isEnrolled: false, serverUrl: 'http://localhost:3000', deviceId: '', name: 'sample-agent', description: '', version: '0.1.0', statePath: 'Loading…', hostname: 'Loading…', localIp: '—', publicIp: '—', platform: '—', architecture: '—', metricsIntervalSeconds: 15, lastHeartbeat: 'Never', lastMetricsSent: 'Never', errorMsg: '' }
const emptyMetrics: Metrics = { cpuUsage: 0, cpuCores: 0, memTotalMb: 0, memUsedMb: 0, memUsage: 0, diskTotalGb: 0, diskUsedGb: 0, diskUsage: 0, storagePath: '—' }
const clamp = (value: number) => Math.min(100, Math.max(0, value || 0))
const bytes = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`

function Gauge({ value, label, detail, tone = 'purple' }: { value: number; label: string; detail: string; tone?: string }) {
  const percent = clamp(value)
  return <article className={`glass metric-card ${tone}`}>
    <div className="metric-heading"><span>{label}</span><span className="pulse" /></div>
    <div className="gauge" style={{ '--value': `${percent * 3.6}deg` } as CSSProperties}>
      <div className="gauge-inner"><strong>{percent.toFixed(1)}<small>%</small></strong><span>{detail}</span></div>
    </div>
  </article>
}

function App() {
  const [status, setStatus] = useState<Status>(emptyStatus)
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics)
  const [logs, setLogs] = useState<Log[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [form, setForm] = useState({ serverUrl: '', joinToken: '', deviceId: '', name: '', description: '' })
  const logsRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const [nextStatus, nextMetrics] = await Promise.all([AgentService.GetStatus(), AgentService.GetMetrics()])
    setStatus(nextStatus); setMetrics(nextMetrics)
    setForm(current => current.serverUrl ? current : { ...current, serverUrl: nextStatus.serverUrl, deviceId: nextStatus.deviceId, name: nextStatus.name, description: nextStatus.description })
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
    AgentService.GetLogs().then(setLogs).catch(console.error)
    const timer = window.setInterval(() => refresh().catch(console.error), 3000)
    const unsubscribe = Events.On('agent-log', (event: { data: Log }) => setLogs(current => [...current.slice(-199), event.data]))
    return () => { window.clearInterval(timer); unsubscribe() }
  }, [refresh])

  useEffect(() => { logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' }) }, [logs])

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    try { setNotice(await action()); await refresh() } catch (err) { setNotice(String(err)) } finally { setBusy(false) }
  }
  const submitEnroll = async (event: FormEvent) => {
    event.preventDefault()
    await run(() => AgentService.Enroll(form.serverUrl, form.joinToken, form.deviceId, form.name, form.description))
    setShowEnroll(false)
  }
  const stateLabel = status.isConnected ? 'Connected' : status.isRunning ? 'Reconnecting' : status.isEnrolled ? 'Disconnected' : 'Enrollment required'
  const stateClass = status.isConnected ? 'connected' : status.isRunning ? 'reconnecting' : status.isEnrolled ? 'offline' : 'enrolling'
  const diskFree = Math.max(0, metrics.diskTotalGb - metrics.diskUsedGb)
  const info = useMemo(() => [
    ['Hostname', status.hostname], ['Local IP', status.localIp || 'Unavailable'], ['Public IP', status.publicIp || 'Detected by server'],
    ['Platform', `${status.platform} / ${status.architecture}`], ['Agent version', status.version], ['State path', status.statePath],
  ], [status])

  return <main className="app-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <div className="brand"><div className="brand-mark">F</div><div><h1>Fortmont <span>Cloud Control</span></h1><p>Native agent operations console</p></div></div>
      <div className={`status-pill ${stateClass}`}><i />{stateLabel}</div>
    </header>

    {notice && <button className="notice" onClick={() => setNotice('')} aria-label="Dismiss notification">{notice}<span>×</span></button>}

    <section className="hero glass">
      <div><p className="eyebrow">AGENT CONNECTION</p><h2>{status.name || 'Fortmont Agent'}</h2><p className="muted">{status.deviceId ? `Device ${status.deviceId}` : 'Enroll this device to start reporting securely.'}</p></div>
      <div className="connection-details"><span>CONTROL PLANE</span><strong>{status.serverUrl}</strong><small>Heartbeat {status.lastHeartbeat} · Metrics {status.lastMetricsSent}</small></div>
      <div className="control-buttons">
        <button className="button primary" disabled={busy || !status.isEnrolled} onClick={() => run(AgentService.StartAgent)}>{status.isRunning ? 'Running' : 'Start agent'}</button>
        <button className="button" disabled={busy || !status.isRunning} onClick={() => run(AgentService.StopAgent)}>Stop</button>
        <button className="icon-button" disabled={busy || !status.isEnrolled} title="Restart agent" onClick={() => run(AgentService.RestartAgent)}>↻</button>
      </div>
    </section>

    <section className="metrics-grid">
      <Gauge value={metrics.cpuUsage} label="CPU LOAD" detail={`${metrics.cpuCores || '—'} cores`} />
      <article className="glass memory-card"><div className="metric-heading"><span>MEMORY</span><b>{metrics.memUsage.toFixed(1)}%</b></div><div className="bar"><i style={{ width: `${clamp(metrics.memUsage)}%` }} /></div><div className="split-stat"><div><strong>{bytes(metrics.memUsedMb)}</strong><span>Used</span></div><div><strong>{bytes(Math.max(0, metrics.memTotalMb - metrics.memUsedMb))}</strong><span>Free</span></div><div><strong>{bytes(metrics.memTotalMb)}</strong><span>Total</span></div></div></article>
      <Gauge value={metrics.diskUsage} label="PRIMARY STORAGE" detail={metrics.storagePath} tone="cyan" />
      <article className="glass storage-card"><div className="metric-heading"><span>DISK CAPACITY</span><b>{metrics.diskUsedGb.toFixed(1)} GB used</b></div><div className="bar cyan-bar"><i style={{ width: `${clamp(metrics.diskUsage)}%` }} /></div><div className="storage-number"><strong>{diskFree.toFixed(1)} <small>GB</small></strong><span>available of {metrics.diskTotalGb.toFixed(1)} GB</span></div></article>
    </section>

    <section className="content-grid">
      <article className="glass panel log-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE STREAM</p><h3>System event console</h3></div><button className="text-button" onClick={() => run(AgentService.ClearLogs)}>Clear logs</button></div><div className="console" ref={logsRef}>{logs.length ? logs.map(log => <div className="log-line" key={log.id}><time>{log.timestamp}</time><span className={log.level}>{log.level}</span><p>{log.message}</p></div>) : <div className="console-empty">Waiting for agent events…</div>}</div></article>
      <aside className="side-stack">
        <article className="glass panel"><div className="panel-heading"><div><p className="eyebrow">DEVICE DETAILS</p><h3>System diagnostics</h3></div></div><dl className="info-list">{info.map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>)}</dl></article>
        <article className="glass panel enrollment"><div><p className="eyebrow">SECURE ENROLLMENT</p><h3>{status.isEnrolled ? 'Agent credentials active' : 'Connect this device'}</h3><p className="muted">Credentials are encrypted locally before they are stored.</p></div><button className="button primary" onClick={() => setShowEnroll(true)}>{status.isEnrolled ? 'Update enrollment' : 'Enroll agent'}</button><button className="text-button danger" disabled={busy || !status.isEnrolled} onClick={() => { if (window.confirm('Remove the encrypted local agent state?')) run(AgentService.ResetState) }}>Reset encrypted state</button></article>
      </aside>
    </section>

    {showEnroll && <div className="modal-backdrop" role="presentation"><form className="modal glass" onSubmit={submitEnroll}><button type="button" className="modal-close" onClick={() => setShowEnroll(false)}>×</button><p className="eyebrow">ENROLLMENT WIZARD</p><h2>Connect to Fortmont</h2><p className="muted">Paste the one-time join token from your Fortmont dashboard.</p><label>Server URL<input required value={form.serverUrl} onChange={e => setForm({ ...form, serverUrl: e.target.value })} placeholder="https://control.example.com" /></label><label>Join token<input required type="password" value={form.joinToken} onChange={e => setForm({ ...form, joinToken: e.target.value })} placeholder="Paste secure token" /></label><div className="form-row"><label>Device ID<input value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })} placeholder="Generated if blank" /></label><label>Agent name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label></div><label>Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional device description" /></label><button className="button primary modal-submit" disabled={busy}>{busy ? 'Connecting…' : 'Enroll and connect'}</button></form></div>}
  </main>
}

export default App
