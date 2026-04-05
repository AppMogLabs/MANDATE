import type { PrivyClientConfig } from '@privy-io/react-auth';
import { megaethTestnet } from './wagmi-config';

/**
 * Privy configuration for MANDATE.
 * Social login only — no wallet connect, no MetaMask, blockchain is invisible.
 */
export const privyConfig: PrivyClientConfig = {
  // Appearance
  appearance: {
    theme: 'dark',
    accentColor: '#7CD8D5', // MegaETH teal
    logo: undefined, // TODO: add MANDATE logo
  },

  // Login methods — social only, no wallet options
  loginMethods: ['google', 'email', 'discord'],

  // Embedded wallet configuration
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },

  // Default chain
  defaultChain: megaethTestnet,
  supportedChains: [megaethTestnet],
};
