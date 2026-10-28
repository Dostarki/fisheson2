import { useAccount, useBalance } from 'wagmi';
import { ArrowRight, Loader2, ShieldCheck, Ticket } from 'lucide-react';
import { GameDialog } from './GameDialog';
import { Button } from './ui/button';
import { robinhood } from '../lib/wallet';

const fmtEth = v => v == null ? '—' : v >= 0.01 ? v.toFixed(4) : v.toFixed(6);

export const EntryGate = ({ feeUsd, ethUsd, onPay, paying, pending, onLogout }) => {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address, chainId: robinhood.id, query: { enabled: !!address, refetchInterval: 15000 } });
  const balanceEth = bal ? Number(bal.value) / 1e18 : null;
  const feeEth = ethUsd ? feeUsd / ethUsd : null;
  const low = balanceEth != null && feeEth != null && balanceEth < feeEth;
  return <GameDialog open onClose={() => {}} id="entry-gate" title="Entry ticket." subtitle="Frosthaven charges a one-time entry fee per wallet, paid in ETH on Robinhood Chain." className="wallet-dialog username-dialog">
    <div className="wallet-emblem"><Ticket size={30} strokeWidth={1.5}/></div>
    <div className="entry-price" data-testid="entry-fee-amount"><strong>${Number(feeUsd).toFixed(2)}</strong><span>{feeEth ? `≈ ${fmtEth(feeEth)} ETH` : 'ETH amount shown in your wallet'}</span></div>
    <Button className="pixel-button" data-testid="entry-pay-button" disabled={paying || pending} onClick={onPay}>{paying || pending ? <Loader2 className="spin"/> : <Ticket/>}{pending ? 'Confirming payment…' : paying ? 'Waiting for wallet…' : 'Pay entry & play'}<ArrowRight/></Button>
    {low && <p role="alert" className="form-error" data-testid="entry-low-balance">Your wallet holds {fmtEth(balanceEth)} ETH on Robinhood Chain — not enough for the fee plus gas.</p>}
    <button className="text-button" data-testid="entry-logout-button" onClick={onLogout}>Sign out</button>
    <p className="wallet-note" data-testid="entry-note"><ShieldCheck size={16}/>Paid once · unlocks this wallet forever · ETH goes to the game treasury</p>
  </GameDialog>;
};
