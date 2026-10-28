import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import AdminPage from "@/pages/AdminPage";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { walletConfig } from './lib/wallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/errorlogin404495959" element={<AdminPage />} />
        <Route path="*" element={
          <WagmiProvider config={walletConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider theme={darkTheme({ accentColor: '#a6e2c2', accentColorForeground: '#142a2c', borderRadius: 'small', fontStack: 'system' })}>
                <App />
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
