import { ArrowUpRight, ArrowRight, Plus, Minus, Focus, Volume2, VolumeX, Play, BookOpen, Store, Users, ChevronRight, SlidersHorizontal, Trophy, Gift, Coins, Backpack, Sunrise, Sun, Sunset, Moon, CloudSnow, CloudRain, LogOut, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useEnvironment } from '../hooks/useEnvironment';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { fmtUsd, fmtTokens } from '../hooks/useEconomy';

export const fmtCompactUsd = v => v == null ? '—' : `$${v.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;

export const MarketCapBadge = ({ config, className = '' }) => {
  const live = config?.marketCapUsd != null;
  return <a className={`mcap-badge ${live ? '' : 'mcap-pending'} ${className}`} data-testid="market-cap-badge" href={config?.launchpadUrl || '#'} target="_blank" rel="noreferrer" title={live ? `${config.symbol} · ${config.totalSupply?.toLocaleString('en-US', { maximumFractionDigits: 0 })} supply · ${fmtUsd(config.tokenUsd, 6)}` : 'Market cap unavailable'}>
    <TrendingUp size={13}/><small>{config?.symbol || 'TOKEN'} MCAP</small><strong data-testid="market-cap-value">{live ? fmtCompactUsd(config.marketCapUsd) : '…'}</strong><span className={`online-dot ${live ? '' : 'offline'}`}/>
  </a>;
};

export const Header = ({ config }) => <header className="site-header">
  <div className="brand" data-testid="frostfish-brand"><div className="brand-mark brand-fish-emblem" aria-hidden="true"><svg className="brand-fish-pixel" viewBox="0 0 48 48" shapeRendering="crispEdges"><path className="brand-fish-tail" d="M5 16h8v5h5v15h-5v5H5v-5h4V21H5z"/><path className="brand-fish-body" d="M17 17h5v-4h13v4h5v4h4v11h-4v5h-5v4H22v-4h-5v-4h-4V21h4z"/><path className="brand-fish-fin" d="M22 29h10v4h-5v6h-5z"/><rect className="brand-fish-eye" x="36" y="23" width="3" height="3"/></svg><span className="brand-star">✦</span></div><div className="brand-copy"><strong className="brand-wordmark">FISHESRH</strong><span className="brand-tagline">A LITTLE WORLD OF YOUR OWN</span></div></div>
  <MarketCapBadge config={config} className="header-mcap"/>
  <ConnectButton.Custom>{({ account, chain, openChainModal, openConnectModal, openAccountModal, mounted }) => {
    const ready = mounted;
    const connected = ready && !!account && !!chain;
    const label = !ready ? 'Connect Wallet' : !connected ? 'Connect Wallet' : chain.unsupported ? 'Wrong network' : account.displayName;
    const handleClick = () => {
      if (!ready) return;
      if (!connected) openConnectModal();
      else if (chain.unsupported) openChainModal();
      else openAccountModal();
    };
    return <button className="network-badge" data-testid="network-wallet-button" aria-label={connected ? `Wallet ${account.displayName}` : 'Connect Wallet'} onClick={handleClick} disabled={!ready}>
      <span className={`online-dot ${connected ? '' : 'offline'}`} /><span>{label}</span><ChevronRight size={13}/>
    </button>;
  }}</ConnectButton.Custom>
</header>;

export const Welcome = ({ onPlay }) => <section className="welcome-copy">
    <div className="welcome-eyebrow" data-testid="welcome-eyebrow"><span className="tiny-star">✦</span> LESS RUSH. MORE RIVER.</div>
    <h1 data-testid="welcome-title">Small island.<br/><span>Big catch.</span></h1>
    <p data-testid="welcome-description">Hire fishermen. Watch your village grow.</p>
    <Button className="pixel-button play-button" data-testid="play-button" onClick={onPlay}><Play size={21} fill="currentColor"/><span>PLAY</span><ArrowRight size={23}/></Button>
    <div className="play-note" data-testid="play-note"><span className="online-dot"/> Wallet sign-in <span>·</span> Hire fishermen with real tokens</div>
  </section>;

const PHASE_ICON = { morning: Sunrise, noon: Sun, evening: Sunset, night: Moon };
export const EnvChip = () => {
  const { phase, weather } = useEnvironment();
  const Icon = PHASE_ICON[phase], Weather = weather === 'rain' ? CloudRain : CloudSnow;
  return <div className={`hud-env env-${phase}`} data-testid="day-weather-chip"><span data-testid="day-phase"><Icon size={14}/> {phase.toUpperCase()}</span><i/><span data-testid="weather-state"><Weather size={14}/> {weather.toUpperCase()}</span></div>;
};

const Stat = ({ className, icon: Icon, label, value, testid, extra }) => <div className={`stat-chip ${className}`} data-testid={`${testid}-stat`}>
  <span className="chip-icon"><Icon size={20}/></span><div><small>{label}</small><strong data-testid={`${testid}-value`}>{value}</strong></div>{extra}
</div>;

export const TopHUD = ({ game, config, wallet, online, onLeaderboard, onInventory }) => {
  const symbol = config?.symbol || 'TOKEN';
  const tokens = config?.tokenUsd ? game.claimable_usd / config.tokenUsd : null;
  return <>
  <div className="hud-top-left">
    <button className="game-btn btn-violet" data-testid="leaderboard-button" onClick={onLeaderboard}><span className="btn-icon"><Trophy size={20}/></span><span className="btn-label">LEADERBOARD<small>{game.name}</small></span></button>
  </div>
  <div className="hud-top-right">
    <div className="hud-stats">
      <Stat className="chip-workers" icon={Users} label="ACTIVE WORKERS" testid="active-workers" value={`${game.active_workers}/${game.workers.length}`}/>
      <button className="stat-chip chip-rewards stat-button" data-testid="rewards-stat" onClick={onInventory} title="Open inventory to claim">
        <span className="chip-icon"><Gift size={20}/></span><div><small>CLAIMABLE</small><strong data-testid="rewards-value">{fmtUsd(game.claimable_usd, 4)}</strong></div><em data-testid="hourly-yield-total">+{fmtUsd(game.hourly_usd, 4)}/h</em>
      </button>
      <Stat className="chip-token" icon={Coins} label={`${symbol} WALLET`} testid="token" value={fmtTokens(wallet.balance)} extra={<em data-testid="token-usd-value">{wallet.balance != null && config?.tokenUsd ? `≈ ${fmtUsd(wallet.balance * config.tokenUsd)}` : tokens != null ? `≈ ${fmtTokens(tokens)} claimable` : '…'}</em>}/>
    </div>
    <div className="hud-sub"><MarketCapBadge config={config} className="hud-mcap"/><EnvChip/>{!online&&<span className="hud-offline" data-testid="offline-indicator">Reconnecting…</span>}</div>
  </div>
</>;
};

export const BottomBar = ({ onMarket, onInventory, owned }) => <div className="hud-bottom">
  <button className="game-btn btn-gold" data-testid="market-button" onClick={onMarket}><span className="btn-icon"><Store size={24}/></span><span className="btn-label">MARKET<small>Hire fishermen</small></span></button>
  <button className="game-btn btn-teal" data-testid="inventory-button" onClick={onInventory}><span className="btn-icon"><Backpack size={24}/></span><span className="btn-label">INVENTORY<small>Your workers</small></span><span className="btn-count" data-testid="inventory-count">{owned}</span></button>
</div>;

export const Footer = ({ active, sound, onSound, zoom, setZoom, onResetCamera, onGuide, onGraphics, onLogout }) => <footer className="world-footer">
  {!active&&<div className="world-location" data-testid="world-location"><span className="compass-symbol">✥</span><span>FROSTHAVEN <i>/</i> <b>REGION 01</b></span><span className="footer-coordinates">64° 08′ N &nbsp; 21° 56′ W</span></div>}
  <div className="world-controls">
    <div className="zoom-controls"><button title="Zoom out" aria-label="Zoom out" data-testid="zoom-out-button" onClick={()=>setZoom(Math.max(.4,zoom-.15))} disabled={zoom<=.4}><Minus size={16}/></button><button title="Reset view" aria-label="Reset view" data-testid="reset-camera-button" onClick={onResetCamera}><Focus size={17}/></button><button title="Zoom in" aria-label="Zoom in" data-testid="zoom-in-button" onClick={()=>setZoom(Math.min(1.6,zoom+.15))} disabled={zoom>=1.6}><Plus size={16}/></button></div>
    <button className={`sound-button ${sound?'sound-on':''}`} data-testid="sound-toggle-button" onClick={onSound} title={sound?'Mute ambience':'Enable ambience'} aria-label={sound?'Mute ambience':'Enable ambience'}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}<span>SOUND {sound?'ON':'OFF'}</span><i/><i/><i/></button>
    <button className="footer-icon footer-guide" title="Field guide" aria-label="Field guide" data-testid="footer-guide-button" onClick={onGuide}><BookOpen size={16}/></button>
    {active && <button className="footer-icon footer-logout" title="Sign out" aria-label="Sign out" data-testid="logout-button" onClick={onLogout}><LogOut size={16}/></button>}
    <button className="footer-icon graphics-control" title="Graphics & settings" aria-label="Graphics & settings" data-testid="graphics-settings-button" onClick={onGraphics}><SlidersHorizontal size={17}/></button>
  </div>
</footer>;
