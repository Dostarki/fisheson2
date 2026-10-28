import { useState } from 'react';
import { ExternalLink, Loader2, Search, Trash2, UserSearch } from 'lucide-react';

const short = a => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

export const AdminNftGate = ({ api, token, gate, onGate, toggle, enabled }) => {
  const [link, setLink] = useState('');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [check, setCheck] = useState(null);
  const read = async () => {
    setBusy(true); setMsg(null); setCheck(null);
    try {
      const data = await api('/nft/resolve', { method: 'POST', token, body: { url: link } });
      onGate(data.nftGate); setLink('');
      setMsg({ type: 'ok', text: `Found ${data.nftGate.name} on ${data.nftGate.chain_label} (${data.nftGate.standard.toUpperCase()}). Turn the toggle on and save to let holders in.` });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove the NFT collection? Holders will no longer get beta access.')) return;
    setBusy(true); setMsg(null);
    try { const s = await api('/nft', { method: 'DELETE', token }); onGate(null, s); setMsg({ type: 'ok', text: 'NFT collection removed.' }); }
    catch (e) { setMsg({ type: 'err', text: e.message }); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setCheck(null); setMsg(null);
    try { setCheck(await api('/nft/check', { method: 'POST', token, body: { address: addr.trim() } })); }
    catch (e) { setMsg({ type: 'err', text: e.message }); } finally { setBusy(false); }
  };
  return <div className="admin-access-row" data-testid="admin-nft-section">
    <div className="admin-nft-col">
      {toggle('nftGateEnabled', 'NFT holders can join the beta', gate ? `Wallets holding any ${gate.name} NFT sign in even if they are not in the CSV list (only while “Beta participants only” is on).` : 'Read an OpenSea collection or item link below first.')}
      {gate && <div className="admin-nft" data-testid="admin-nft-card">
        {gate.image_url ? <img src={gate.image_url} alt="" className="admin-nft-img"/> : <div className="admin-nft-img placeholder"/>}
        <div className="admin-nft-body">
          <strong data-testid="admin-nft-name">{gate.name}</strong>
          <span data-testid="admin-nft-meta">{gate.chain_label} · {gate.standard.toUpperCase()}{gate.token_id ? ` · token #${gate.token_id}` : ''}{gate.total_supply ? ` · ${Number(gate.total_supply).toLocaleString()} items` : ''}</span>
          <span className="mono" data-testid="admin-nft-contract">{gate.contract}</span>
          {gate.warning && <i className="admin-badge warn" data-testid="admin-nft-warning">{gate.warning}</i>}
          <div className="admin-nft-links"><a href={gate.opensea_url} target="_blank" rel="noreferrer" data-testid="admin-nft-opensea-link"><ExternalLink size={12}/> OpenSea</a><button type="button" className="admin-link-btn" onClick={remove} disabled={busy} data-testid="admin-nft-remove-button"><Trash2 size={12}/> Remove</button></div>
        </div>
      </div>}
    </div>
    <div className="admin-nft-col">
      <div className="admin-field admin-fee"><label htmlFor="admin-nft-link">OpenSea link</label>
        <div style={{ display: 'flex', gap: 8 }}><input id="admin-nft-link" style={{ flex: 1, minWidth: 0 }} placeholder="https://opensea.io/collection/…" value={link} onChange={e => setLink(e.target.value)} data-testid="admin-nft-link-input"/><button type="button" className="admin-btn ghost" onClick={read} disabled={busy || !link.trim()} data-testid="admin-nft-read-button">{busy ? <Loader2 size={14} className="spin"/> : <Search size={14}/>} Read</button></div>
        <small>Collection links (opensea.io/collection/…) or item links (opensea.io/item/chain/contract/id). Reading saves the collection right away.</small>
        {gate && <>
          <label htmlFor="admin-nft-check" style={{ marginTop: 10 }}>Check a wallet</label>
          <div style={{ display: 'flex', gap: 8 }}><input id="admin-nft-check" style={{ flex: 1, minWidth: 0 }} placeholder="0x…" value={addr} onChange={e => setAddr(e.target.value)} data-testid="admin-nft-check-input"/><button type="button" className="admin-btn ghost" onClick={verify} disabled={busy || addr.trim().length !== 42} data-testid="admin-nft-check-button"><UserSearch size={14}/> Check</button></div>
          {check && <i className={`admin-badge ${check.holds || check.listed ? '' : 'warn'}`} data-testid="admin-nft-check-result">{short(check.address)} · {check.holds ? `holds ${check.collection}` : `no ${check.collection}`}{check.listed ? ' · on CSV list' : ''}{enabled ? '' : ' · (gate off)'}</i>}
        </>}
        {msg && <div className={`admin-msg ${msg.type}`} data-testid="admin-nft-message">{msg.text}</div>}
      </div>
    </div>
  </div>;
};
