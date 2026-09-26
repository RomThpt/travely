import { createRoot } from 'react-dom/client';
import { DAppKitProvider, createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { App } from './App';
import './style.css';

const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient: () => new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' }),
  autoConnect: true,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

createRoot(document.getElementById('root')!).render(
  <DAppKitProvider dAppKit={dAppKit}>
    <App />
  </DAppKitProvider>,
);
