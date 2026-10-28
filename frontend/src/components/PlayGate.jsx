import { useEffect, useRef } from 'react';
import { useAccount, useSwitchChain, useDisconnect, useSignMessage } from 'wagmi';
import { ArrowRight, Wallet, ShieldCheck, Loader2, Network, PenLine } from 'lucide-react';
import { GameDialog } from './GameDialog';
import { Button } from './ui/button';
import { robinhood } from '../lib/wallet';

const short = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const PlayGate = ({ open, onClose, onSignIn, onConnect, busy, error, betaNft }) => {
  const { isConnected, address, chainId } = useAccount();
  const { switchChain, isPending, error: switchError } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const wrongNetwork = isConnected && chainId !== robinhood.id;
  const autoSigned = useRef(null);
  useEffect(() => {
    if (!isConnected || wrongNetwork || busy || autoSigned.current === address) return;
    autoSigned.current = address;
    onSignIn({ address, chainId, signMessageAsync });
  }, [isConnected, wrongNetwork, busy, address, chainId, signMessageAsync, onSignIn]);
  return <GameDialog open={open} onClose={onClose} id="play-gate" title="Sign in to play." subtitle="Your island is tied to your wallet on Robinhood Chain." className="wallet-dialog">
    <div className="wallet-emblem"><Wallet size={30} strokeWidth={1.5}/><span className="online-dot"/></div>
    {!isConnected ? <Button className="pixel-button" data-testid="play-gate-connect-button" onClick={onConnect}><Wallet/> Connect wallet <ArrowRight/></Button> : <>
      <p className="connected-address" data-testid="play-gate-address">{short(address)}</p>
      {wrongNetwork
        ? <Button className="pixel-button" data-testid="play-gate-switch-network-button" disabled={isPending} onClick={() => switchChain({ chainId: robinhood.id })}>{isPending ? <Loader2 className="spin"/> : <Network/>}Switch to Robinhood Chain<ArrowRight/></Button>
        : <Button className="pixel-button" data-testid="play-gate-sign-button" disabled={busy} onClick={() => onSignIn({ address, chainId, signMessageAsync })}>{busy ? <Loader2 className="spin"/> : <PenLine/>}{busy ? 'Waiting for signature…' : 'Sign message & play'}<ArrowRight/></Button>}
      <button className="text-button" data-testid="play-gate-disconnect-button" onClick={() => disconnect()}>Use a different wallet</button>
    </>}
    {wrongNetwork && <p role="alert" className="form-error" data-testid="play-gate-wrong-network">Wrong network. The game is locked until you switch to Robinhood Chain (chain {robinhood.id}).</p>}
    {switchError && <p role="alert" className="form-error" data-testid="play-gate-switch-error">{switchError.shortMessage || 'Network switch was declined.'}</p>}
    {error && <p role="alert" className="form-error" data-testid="play-gate-error">{error}</p>}
    {error && betaNft && /closed beta/i.test(error) && <a className="text-button" href={betaNft.url} target="_blank" rel="noreferrer" data-testid="play-gate-nft-link">Get a {betaNft.name} NFT on OpenSea ({betaNft.chain}) to join the beta</a>}
    <p className="wallet-note" data-testid="play-gate-notice"><ShieldCheck size={16}/>You only sign a text message. It is not a transaction: no gas, no funds moved, no approvals.</p>
    <div className="network-note" data-testid="play-gate-network-note"><span className="online-dot"/> Robinhood Chain Mainnet <span>·</span> Chain {robinhood.id}</div>
  </GameDialog>;
};
