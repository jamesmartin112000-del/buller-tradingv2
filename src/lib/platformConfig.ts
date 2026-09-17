import type { WalletAddress } from './db/store';

export { PLANS } from './data/plans';

export const WALLET_ADDRESSES = {
  usdt: {
    label: 'USDT — TRON (TRC20)',
    address: 'TKbDoCYAMxdMN3KMtZWp7AaKnahBhHXEN7',
    network: 'TRC20'
  },
  btc: {
    label: 'Bitcoin (BTC)',
    address: '14Fz2vyPkYqPgZv8ApNhuqVp7CYyQVsEkq',
    network: 'Bitcoin'
  }
} as const;

export const DEFAULT_WALLET_ADDRESSES: WalletAddress[] = [
{
  id: 'default-usdt-trc20',
  network: WALLET_ADDRESSES.usdt.label,
  address: WALLET_ADDRESSES.usdt.address,
  createdAt: 2
},
{
  id: 'default-bitcoin',
  network: WALLET_ADDRESSES.btc.label,
  address: WALLET_ADDRESSES.btc.address,
  createdAt: 1
}];