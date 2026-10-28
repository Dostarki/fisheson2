import { createConfig, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, rainbowWallet, base, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { defineChain } from 'viem';

const rpcUrl = process.env.REACT_APP_ROBINHOOD_RPC_URL;

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

const appUrl = window.location.origin;
export const walletConfig = createConfig({
  chains: [robinhood],
  connectors: connectorsForWallets(
    [{ groupName: 'Recommended', wallets: [metaMaskWallet, rainbowWallet, base] }, { groupName: 'Other wallets', wallets: [injectedWallet, walletConnectWallet] }],
    { appName: 'Frostfish', projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID, appDescription: 'A cozy fishing village on Robinhood Chain.', appUrl, appIcon: `${appUrl}/frostfish-icon.svg` },
  ),
  transports: { [robinhood.id]: http(rpcUrl) },
});
