import { useCallback, useEffect, useRef, useState } from 'react';
import { useSendTransaction } from 'wagmi';
import { toast } from 'sonner';
import { robinhood } from '../lib/wallet';

const PENDING_KEY = 'frostfish-pending-entry';
const rejected = e => e?.code === 4001 || e?.name === 'UserRejectedRequestError' || /reject|denied|cancel/i.test(e?.shortMessage || e?.message || '');
const fmtEth = v => v >= 0.01 ? v.toFixed(4) : v.toFixed(6);

export function useEntryFee({ active, entryQuote, confirmEntry }) {
  const { sendTransactionAsync } = useSendTransaction();
  const [paying, setPaying] = useState(false);
  const [pending, setPending] = useState(() => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)); } catch { return null; } });
  const savePending = useCallback((value) => { setPending(value); if (value) localStorage.setItem(PENDING_KEY, JSON.stringify(value)); else localStorage.removeItem(PENDING_KEY); }, []);
  const finish = useCallback(async (p) => {
    try {
      await confirmEntry(p.quoteId, p.txHash);
      savePending(null);
      toast.success('Entry ticket confirmed. Welcome to Frosthaven!');
      return true;
    } catch (e) {
      if (e.status && e.status !== 503 && !/pending/i.test(e.message)) savePending(null);
      toast.error(e.message); return false;
    }
  }, [confirmEntry, savePending]);
  const resumed = useRef(false);
  useEffect(() => { if (active && pending && !resumed.current) { resumed.current = true; finish(pending); } }, [active, pending, finish]);
  const pay = useCallback(async () => {
    setPaying(true);
    try {
      const q = await entryQuote();
      toast.message(`Confirm sending ${fmtEth(q.amountEth)} ETH (≈ $${q.feeUsd}) to the treasury in your wallet.`);
      let txHash;
      try { txHash = await sendTransactionAsync({ to: q.treasuryAddress, value: BigInt(q.amountWei), chainId: robinhood.id }); }
      catch (e) { toast.error(rejected(e) ? 'Payment cancelled in your wallet.' : (e.shortMessage || e.message)); return; }
      const next = { quoteId: q.quoteId, txHash };
      savePending(next);
      toast.loading('Payment sent. Waiting for Robinhood Chain to confirm…', { id: 'entry' });
      await finish(next);
      toast.dismiss('entry');
    } catch (e) { toast.dismiss('entry'); toast.error(e.message); }
    finally { setPaying(false); }
  }, [entryQuote, sendTransactionAsync, savePending, finish]);
  return { pay, paying, pending: !!pending && !paying };
}
