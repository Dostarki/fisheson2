import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = 'frostfish-session', ADDRESS_KEY = 'frostfish-wallet-address';
const rejected = e => e?.code === 4001 || e?.name === 'UserRejectedRequestError' || /reject|denied|cancel/i.test(e?.shortMessage || e?.message || '');

export function useGame() {
  const [game, setGame] = useState(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [actionError, setActionError] = useState('');
  const [sessionAddress, setSessionAddress] = useState(localStorage.getItem(ADDRESS_KEY));
  const actionPending = useRef(false);
  const token = useRef(localStorage.getItem(TOKEN_KEY));
  const gameRef = useRef(null);
  const latestRevision = useRef(-1);
  const accept = useCallback((state) => {
    if (state.revision >= latestRevision.current) {
      latestRevision.current = state.revision;
      gameRef.current = { ...state, received: performance.now(), byUid: Object.fromEntries(state.workers.map(w => [w.uid, w])) };
      setGame(state);
    }
  }, []);
  const clear = useCallback(() => {
    token.current = null; latestRevision.current = -1; gameRef.current = null;
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ADDRESS_KEY);
    setSessionAddress(null); setGame(null);
  }, []);
  const request = useCallback(async (path, body) => {
    const res = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token.current ? { Authorization: `Bearer ${token.current}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    if (!res.ok) { const error = new Error(data.detail || 'The island is unreachable. Please try again.'); error.status = res.status; throw error; }
    return data;
  }, []);
  const expire = useCallback((e) => { if (e.status !== 401 || !token.current) return false; clear(); toast.error(e.message); return true; }, [clear]);
  const signIn = useCallback(async ({ address, chainId, signMessageAsync }) => {
    setBusy(true);
    try {
      const challenge = await request('/auth/challenge', { address, chainId });
      let signature;
      try { signature = await signMessageAsync({ message: challenge.message }); }
      catch (e) { throw new Error(rejected(e) ? 'Signature request was rejected. Sign the message to enter the island.' : (e.shortMessage || e.message)); }
      const auth = await request('/auth/verify', { address, chainId, nonce: challenge.nonce, message: challenge.message, signature });
      token.current = auth.token;
      localStorage.setItem(TOKEN_KEY, auth.token); localStorage.setItem(ADDRESS_KEY, auth.address);
      setSessionAddress(auth.address);
      latestRevision.current = -1;
      accept(auth.game); setOnline(true);
      return { game: auth.game };
    } catch (e) { return { error: e.message }; } finally { setBusy(false); }
  }, [request, accept]);
  const resume = useCallback(async () => {
    if (!token.current) return null;
    try { const saved = await request('/game'); accept(saved); setOnline(true); return saved; }
    catch (e) { if (e.status === 401) clear(); return null; }
  }, [request, accept, clear]);
  const logout = useCallback(async () => {
    try { if (token.current) await request('/auth/logout', {}); } catch { /* session is cleared locally regardless */ }
    clear();
  }, [request, clear]);
  const act = useCallback(async (path, body = {}) => {
    if (actionPending.current) return null;
    actionPending.current = true;
    setActionError('');
    setBusy(true);
    try { const data = await request(path, body); if (data.game) accept(data.game); setOnline(true); return data; }
    catch (e) { if (!expire(e)) { setActionError(e.message); toast.error(e.message); } return null; }
    finally { actionPending.current = false; setBusy(false); }
  }, [request, accept, expire]);
  const quote = useCallback((character) => request('/purchase/quote', { character }), [request]);
  const confirmPurchase = useCallback(async (quoteId, txHash) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const data = await request('/purchase/confirm', { quoteId, txHash });
      if (data.status === 'confirmed') { accept(data.game); return data; }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('The transfer is still pending. Reopen the market in a minute to finish the purchase.');
  }, [request, accept]);
  const claim = useCallback(() => act('/claim'), [act]);
  const entryQuote = useCallback(() => request('/entry/quote', {}), [request]);
  const confirmEntry = useCallback(async (quoteId, txHash) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const data = await request('/entry/confirm', { quoteId, txHash });
      if (data.status === 'confirmed') { accept(data.game); return data; }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('The payment is still pending. Reload in a minute to finish unlocking.');
  }, [request, accept]);
  const setUsername = useCallback(async (username) => {
    try { const data = await request('/profile/username', { username }); accept(data.game); return null; }
    catch (e) { if (expire(e)) return null; return e.status === 422 ? 'Use 3–16 letters, numbers or _.' : e.message; }
  }, [request, accept, expire]);
  const hasGame = !!game;
  useEffect(() => {
    if (!hasGame) return;
    let stopped = false, timer, polling = false;
    const poll = async () => {
      if(stopped||polling||document.hidden)return;
      if (actionPending.current) { timer = setTimeout(poll, 500); return; }
      polling=true;
      try { const state = await request('/game'); if (!stopped) { accept(state); setOnline(true); } }
      catch (e) { if (!stopped && !expire(e)) setOnline(false); }
      polling=false;
      if (!stopped) timer = setTimeout(poll, 1800);
    };
    const visible=()=>{if(!document.hidden){clearTimeout(timer);poll();}else clearTimeout(timer);};
    document.addEventListener('visibilitychange',visible);
    timer = setTimeout(poll, 1800);
    return () => { stopped = true; clearTimeout(timer);document.removeEventListener('visibilitychange',visible); };
  }, [hasGame, request, accept, expire]);
  const leaderboard = useCallback(() => request('/leaderboard'), [request]);
  const clearActionError = useCallback(() => setActionError(''), []);
  return { game, gameRef, signIn, resume, logout, act, quote, confirmPurchase, claim, busy, setBusy, online, actionError, clearActionError, leaderboard, sessionAddress, setUsername, entryQuote, confirmEntry };
}
