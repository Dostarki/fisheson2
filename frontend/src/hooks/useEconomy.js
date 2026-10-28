import { useCallback, useEffect, useState } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { robinhood } from '../lib/wallet';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useEconomy() {
  const [config, setConfig] = useState(null);
  const refresh = useCallback(async () => {
    try { const res = await fetch(`${API}/config`); if (res.ok) setConfig(await res.json()); } catch { /* keep last config */ }
  }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 30000); return () => clearInterval(timer); }, [refresh]);
  return { config, refresh };
}

export function useTokenWallet(config) {
  const { address } = useAccount();
  const enabled = !!(address && config?.tokenAddress);
  const { data, refetch } = useReadContract({
    address: config?.tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: robinhood.id,
    query: { enabled, refetchInterval: 15000 },
  });
  const { writeContractAsync } = useWriteContract();
  const decimals = config?.decimals ?? 18;
  const balance = data === undefined ? null : Number(data) / 10 ** decimals;
  const transfer = useCallback((to, amount) => writeContractAsync({
    address: config.tokenAddress, abi: erc20Abi, functionName: 'transfer', args: [to, BigInt(amount)], chainId: robinhood.id,
  }), [writeContractAsync, config?.tokenAddress]);
  return { balance, raw: data ?? null, refetch, transfer };
}

export const fmtUsd = (v, digits = 2) => `$${(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtTokens = (v) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
export const usdToTokens = (usd, config) => config?.tokenUsd ? usd / config.tokenUsd : null;
