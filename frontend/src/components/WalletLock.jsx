import { useSwitchChain } from 'wagmi';
import { Network, Wallet, LogOut, Loader2 } from 'lucide-react';
import { robinhood } from '../lib/wallet';

export const WalletLock = ({ reason, onConnect, onLogout }) => {
  const { switchChain, isPending } = useSwitchChain();
  const wrong = reason === 'wrong-network';
  return <div className="wallet-lock" role="alertdialog" aria-modal="true" data-testid="wallet-lock">
    <div className="wallet-lock-card">
      {wrong ? <Network size={30}/> : <Wallet size={30}/>}
      <strong data-testid="wallet-lock-title">{wrong ? 'Wrong network' : 'Wallet disconnected'}</strong>
      <p data-testid="wallet-lock-description">{wrong ? `The island is locked. Switch your wallet to Robinhood Chain (chain ${robinhood.id}) to keep playing.` : 'Reconnect the wallet you signed in with to keep playing.'}</p>
      {wrong
        ? <button className="wallet-lock-primary" data-testid="wallet-lock-switch-network-button" disabled={isPending} onClick={() => switchChain({ chainId: robinhood.id })}>{isPending && <Loader2 size={16} className="spin"/>}Switch network</button>
        : <button className="wallet-lock-primary" data-testid="wallet-lock-connect-button" onClick={onConnect}>Reconnect wallet</button>}
      <button className="wallet-lock-secondary" data-testid="wallet-lock-logout-button" onClick={onLogout}><LogOut size={14}/> Sign out</button>
    </div>
  </div>;
};
