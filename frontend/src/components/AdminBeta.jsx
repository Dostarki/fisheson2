import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, Upload, X } from 'lucide-react';

const short = a => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

export const AdminBeta = ({ api, token, enabled, onChange }) => {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('');
  const fileRef = useRef(null);
  const load = useCallback(async () => {
    try { setList(await api('/beta', { token })); } catch (e) { setMsg({ type: 'err', text: e.message }); }
  }, [api, token]);
  useEffect(() => { load(); }, [load]);
  const apply = (data, text) => { setList(data); setMsg({ type: 'ok', text }); onChange?.(data.count); };
  const importCsv = async (file) => {
    if (!file) return;
    if (list?.count && !window.confirm(`Importing replaces the current list of ${list.count} wallet(s). Continue?`)) { fileRef.current.value = ''; return; }
    setBusy(true); setMsg(null);
    try {
      const body = new FormData(); body.append('file', file);
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/beta/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Import failed');
      apply(data, `Imported ${data.imported} wallet(s) from ${file.name}. The previous list was replaced.`);
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const remove = async (address) => {
    setBusy(true);
    try { apply(await api(`/beta/${address}`, { method: 'DELETE', token }), `${short(address)} removed from the beta list.`); }
    catch (e) { setMsg({ type: 'err', text: e.message }); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!window.confirm('Remove every wallet from the beta list?')) return;
    setBusy(true);
    try { apply(await api('/beta', { method: 'DELETE', token }), 'Beta list cleared.'); }
    catch (e) { setMsg({ type: 'err', text: e.message }); } finally { setBusy(false); }
  };
  const shown = (list?.wallets || []).filter(w => !filter || w.address.toLowerCase().includes(filter.toLowerCase()));
  return <div className="admin-card" data-testid="admin-beta-card">
    <div className="admin-card-head"><h2>Beta wallets</h2><i className={`admin-badge ${enabled ? '' : 'warn'}`} data-testid="admin-beta-status">{enabled ? `beta list active · ${list?.count ?? '…'} wallets` : `beta list off · ${list?.count ?? '…'} wallets saved`}</i></div>
    <p className="admin-hint">Upload a .csv — every 0x… address found in the file (any column) becomes an allowed wallet. Importing replaces the whole list. Listed wallets also skip the entry fee while the list is active.</p>
    <div className="admin-actions" style={{ marginTop: 10 }}>
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={e => importCsv(e.target.files?.[0])} data-testid="admin-beta-file-input"/>
      <button type="button" className="admin-btn" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="admin-beta-import-button">{busy ? <Loader2 size={14} className="spin"/> : <Upload size={14}/>} Import CSV</button>
      <button type="button" className="admin-btn ghost" disabled={busy || !list?.count} onClick={clear} data-testid="admin-beta-clear-button"><Trash2 size={14}/> Clear list</button>
      <input className="admin-filter" placeholder="Search address…" value={filter} onChange={e => setFilter(e.target.value)} data-testid="admin-beta-search-input"/>
    </div>
    {msg && <div className={`admin-msg ${msg.type}`} style={{ marginTop: 12 }} data-testid="admin-beta-message">{msg.text}</div>}
    {!!shown.length && <div className="admin-scroll"><table className="admin-table" data-testid="admin-beta-table"><thead><tr><th>Wallet</th><th>Added</th><th>Source</th><th/></tr></thead><tbody>
      {shown.map(w => <tr key={w.address} data-testid={`admin-beta-row-${w.address.toLowerCase()}`}><td className="mono">{w.address}</td><td>{new Date(w.addedAt).toLocaleString()}</td><td>{w.source}</td><td><button type="button" className="admin-icon-btn" aria-label={`Remove ${w.address}`} disabled={busy} onClick={() => remove(w.address)} data-testid={`admin-beta-remove-${w.address.toLowerCase()}`}><X size={13}/></button></td></tr>)}
    </tbody></table></div>}
    {list && !list.count && <p className="admin-hint" data-testid="admin-beta-empty">No wallets yet. {enabled ? 'Nobody can sign in while the beta list is active and empty.' : 'Import a CSV to prepare the list.'}</p>}
  </div>;
};
