import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { toast } from 'sonner';
import { useGame } from './hooks/useGame';
import { useEconomy, useTokenWallet, fmtTokens, fmtUsd } from './hooks/useEconomy';
import { useAmbience } from './hooks/useAmbience';
import { Header, Welcome, TopHUD, BottomBar, Footer } from './components/GameChrome';
import { PlayGate } from './components/PlayGate';
import { WalletLock } from './components/WalletLock';
import { UsernameGate } from './components/UsernameGate';
import { EntryGate } from './components/EntryGate';
import { useEntryFee } from './hooks/useEntryFee';
import { MarketDialog, InventoryDialog, LeaderboardDialog, GuideDialog } from './components/InfoDialogs';
import { Toaster } from './components/ui/sonner';
import { SunsetSky } from './components/SunsetSky';
import { WeatherOverlay } from './components/WeatherOverlay';
import { GraphicsDialog } from './components/GraphicsDialog';
import { useGraphics } from './hooks/useGraphics';
import { useBoot } from './hooks/useBoot';
import { BootScreen } from './components/BootScreen';
import { CREW_BY_ID } from './lib/gameData';
import { robinhood } from './lib/wallet';
import './App.css';
import './sunset.css';
import './mobile.css';
import './hud.css';
import './auth.css';
import './economy.css';
const World=lazy(()=>import('./game/World').then(module=>({default:module.World})));
const PENDING_KEY='frostfish-pending-purchase';
const rejected=e=>e?.code===4001||e?.name==='UserRejectedRequestError'||/reject|denied|cancel/i.test(e?.shortMessage||e?.message||'');

export default function App() {
  const { game, gameRef, signIn, resume, logout, quote, confirmPurchase, claim, busy, online, actionError, clearActionError, leaderboard, sessionAddress, setUsername, entryQuote, confirmEntry } = useGame();
  const { config, refresh: refreshConfig } = useEconomy();
  const wallet = useTokenWallet(config);
  const boot=useBoot(resume);
  const [modal, setModal] = useState(null);
  const [gateError, setGateError] = useState('');
  const [pendingPlay, setPendingPlay] = useState(false);
  const [buying, setBuying] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(()=>{ try { return JSON.parse(localStorage.getItem(PENDING_KEY)); } catch { return null; } });
  const [zoom, setZoom] = useState(1), [cameraReset, setCameraReset] = useState(0);
  const { address, chainId, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { sound, toggle } = useAmbience();
  const active = !!game;
  const needsEntry = active && !!game.entry_required;
  const needsName = active && !needsEntry && !game.username_set;
  const entry = useEntryFee({ active: needsEntry, entryQuote, confirmEntry });
  const graphics=useGraphics();
  const close=useCallback(()=>setModal(null),[]);
  const openMarket=useCallback(()=>setModal('market'),[]);
  const openInventory=useCallback(()=>setModal('inventory'),[]);
  const openLeaderboard=useCallback(()=>setModal('leaderboard'),[]);
  const openGuide=useCallback(()=>setModal('guide'),[]);
  const openGraphics=useCallback(()=>setModal('graphics'),[]);
  const connect=useCallback(()=>{setModal(null);setPendingPlay(true);requestAnimationFrame(()=>openConnectModal?.());},[openConnectModal]);
  const play=useCallback(()=>{setGateError('');if(status==='connected')setModal('play');else connect();},[status,connect]);
  const signOut=useCallback(async()=>{setModal(null);await logout();disconnect();toast.success('Signed out of Frosthaven.');},[logout,disconnect]);
  const prevStatus=useRef(status);
  useEffect(()=>{
    const justConnected=status==='connected'&&prevStatus.current!=='connected';
    prevStatus.current=status;
    if(status==='connected'&&!connectModalOpen&&!active&&(pendingPlay||(justConnected&&!sessionAddress))){setPendingPlay(false);setModal('play');}
  },[pendingPlay,status,connectModalOpen,active,sessionAddress]);
  useEffect(()=>{ if(!connectModalOpen&&status!=='connected')setPendingPlay(false); },[connectModalOpen,status]);
  useEffect(()=>{
    if(active&&status==='connected'&&sessionAddress&&address.toLowerCase()!==sessionAddress){logout();toast.error('Wallet changed. Sign in again with the new wallet.');}
  },[active,status,address,sessionAddress,logout]);
  const savePending=useCallback((value)=>{ setPendingPurchase(value); if(value)localStorage.setItem(PENDING_KEY,JSON.stringify(value)); else localStorage.removeItem(PENDING_KEY); },[]);
  const finishPurchase=useCallback(async(p)=>{
    try{
      const data=await confirmPurchase(p.quoteId,p.txHash);
      savePending(null); wallet.refetch();
      toast.success(`${CREW_BY_ID[data.purchase.character].name} hired for ${fmtUsd(data.purchase.price_usd,0)}! Heading to the water.`);
      return true;
    }catch(e){
      if(e.status&&e.status!==503&&!/pending/i.test(e.message))savePending(null);
      toast.error(e.message); return false;
    }
  },[confirmPurchase,savePending,wallet]);
  const resumedPending=useRef(false);
  useEffect(()=>{ if(active&&pendingPurchase&&!resumedPending.current){resumedPending.current=true;finishPurchase(pendingPurchase);} },[active,pendingPurchase,finishPurchase]);
  const lockReason=!active||status==='reconnecting'||status==='connecting'?null:status!=='connected'?'disconnected':chainId!==robinhood.id?'wrong-network':null;
  const onSignIn=async(w)=>{
    setGateError('');
    const result=await signIn(w);
    if(result.error){setGateError(result.error);return;}
    const state=result.game;
    if(state.entry_required||!state.username_set){setModal(null);return;}
    setModal(state.workers.length?null:'market');
    toast.success(state.workers.length?'Welcome back to Frosthaven.':'Welcome! Hire your first fisherman at the market.');
  };
  const saveName=async(name)=>{
    const err=await setUsername(name);
    if(!err){setModal(game?.workers.length?null:'market');toast.success(`Welcome to Frosthaven, ${name}!`);}
    return err;
  };
  const buy=async(character,afford)=>{
    clearActionError();
    if(!afford){ window.open(config.launchpadUrl,'_blank','noopener'); toast.info(`Not enough ${config.symbol}. Buy some on the launchpad, then come back.`); return; }
    setBuying(character);
    try{
      const q=await quote(character);
      if(wallet.raw!=null&&BigInt(wallet.raw)<BigInt(q.amount)){ window.open(config.launchpadUrl,'_blank','noopener'); toast.info(`You need ${fmtTokens(q.amountTokens)} ${q.symbol}. Buy some on the launchpad first.`); return; }
      toast.message(`Confirm the transfer of ${fmtTokens(q.amountTokens)} ${q.symbol} (${fmtUsd(q.priceUsd,0)}) in your wallet.`);
      let txHash;
      try{ txHash=await wallet.transfer(q.treasuryAddress,q.amount); }
      catch(e){ toast.error(rejected(e)?'Transfer cancelled in your wallet.':(e.shortMessage||e.message)); return; }
      const pending={quoteId:q.quoteId,txHash,character};
      savePending(pending);
      toast.loading('Transfer sent. Waiting for Robinhood Chain to confirm…',{id:'purchase'});
      await finishPurchase(pending);
      toast.dismiss('purchase');
    }catch(e){ toast.dismiss('purchase'); toast.error(e.message); }
    finally{ setBuying(null); refreshConfig(); }
  };
  const onClaim=async()=>{
    const data=await claim();
    if(data){ wallet.refetch(); toast.success(`Claimed ${fmtTokens(data.amountTokens)} ${data.symbol} (${fmtUsd(data.usd,4)}). Tx ${data.txHash.slice(0,10)}…`); }
  };
  const blocked=!!modal||needsName||needsEntry||connectModalOpen||graphics.hidden||!!lockReason;
  const tier=graphics.profile.tier;
  return <main className={`frostfish-app ${active?'is-playing':''}`} data-testid="frostfish-app" data-graphics-tier={tier} data-render-paused={blocked} data-booted={boot.done}>
    {!boot.done&&<BootScreen targetRef={boot.targetRef} fading={boot.fading}/>}
    <SunsetSky/>
    <Suspense fallback={<div className="world-loading" data-testid="world-loading">Preparing Frosthaven<span>···</span></div>}>
      <World gameRef={gameRef} roster={roster(game)} active={active} zoom={zoom} reset={cameraReset} onMarket={openMarket} onSpot={openMarket} profile={graphics.profile} onMeasure={graphics.measure} blocked={blocked} onReady={boot.frameReady}/>
    </Suspense>
    <WeatherOverlay density={tier==='battery'?.45:graphics.profile.mobile?.7:1}/>
    {!active && <Header config={config}/>}
    {!active && <div className="region-caption" data-testid="region-caption"><span className="region-diamond">◇</span><span>THE NORTHERN ISLES</span><span>Somewhere between winter & wonder</span></div>}
    {active ? <><TopHUD game={game} config={config} wallet={wallet} online={online} onLeaderboard={openLeaderboard} onInventory={openInventory}/><BottomBar onMarket={openMarket} onInventory={openInventory} owned={game.workers.length}/></> : <Welcome onPlay={play}/>}
    {actionError && <div role="alert" className="action-error" data-testid="game-action-error">{actionError}<button onClick={clearActionError} data-testid="dismiss-action-error-button" aria-label="Dismiss error">×</button></div>}
    <Footer active={active} sound={sound} onSound={toggle} zoom={zoom} setZoom={setZoom} onResetCamera={()=>{setZoom(1);setCameraReset(v=>v+1);}} onGuide={openGuide} onGraphics={openGraphics} onLogout={signOut}/>
    {modal==='play'&&!active&&<PlayGate open onClose={close} onSignIn={onSignIn} onConnect={connect} busy={busy} error={gateError} betaNft={config?.betaNft}/>}
    {needsEntry&&!lockReason&&<EntryGate feeUsd={game.entry_fee_usd} ethUsd={config?.ethUsd} onPay={entry.pay} paying={entry.paying} pending={entry.pending} onLogout={signOut}/>}
    {needsName&&!lockReason&&<UsernameGate onSubmit={saveName}/>}
    {active&&!needsName&&!needsEntry&&modal==='market'&&<MarketDialog open onClose={close} game={game} config={config} wallet={wallet} onBuy={buy} buying={buying} pending={!!pendingPurchase&&!buying}/>}
    {active&&modal==='inventory'&&<InventoryDialog open onClose={close} game={game} config={config} onMarket={openMarket} onClaim={onClaim} busy={busy}/>}
    {active&&modal==='leaderboard'&&<LeaderboardDialog open onClose={close} load={leaderboard}/>}
    {modal==='guide'&&<GuideDialog open onClose={close} config={config}/>}
    {modal==='graphics'&&<GraphicsDialog open onClose={close} graphics={graphics} onGuide={openGuide}/>}
    {lockReason&&!connectModalOpen&&<WalletLock reason={lockReason} onConnect={()=>openConnectModal?.()} onLogout={signOut}/>}
    <Toaster theme="dark" position="top-center" toastOptions={{className:'frost-toast'}}/>
  </main>;
}

function roster(game){ return (game?.workers||[]).map(w=>`${w.uid}:${w.character}:${w.slot}`).join(','); }
