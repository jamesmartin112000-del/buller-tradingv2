import { fsDelete, fsGet, fsSet } from '../backend/docStore';
import { DEFAULT_WALLET_ADDRESSES } from '../platformConfig';
import type { ContentBlock, WalletAddress } from '../db/store';

const DELETED_DEFAULTS_ID = 'system.wallet.deletedDefaults';
const defaultIds = new Set(DEFAULT_WALLET_ADDRESSES.map((wallet) => wallet.id));

async function deletedDefaultIds(): Promise<Set<string>> {
  const state = await fsGet<ContentBlock>('content', DELETED_DEFAULTS_ID);
  try {
    const parsed = JSON.parse(state?.value || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

async function saveDeletedDefaultIds(ids: Set<string>) {
  await fsSet<ContentBlock>('content', {
    id: DELETED_DEFAULTS_ID,
    value: JSON.stringify([...ids]),
    updatedAt: Date.now(),
    updatedBy: 'admin'
  }, false);
}

export async function saveWalletAddress(wallet: WalletAddress) {
  await fsSet('wallet_addresses', { ...wallet, updatedAt: Date.now() }, true);
  if (defaultIds.has(wallet.id)) {
    const deleted = await deletedDefaultIds();
    if (deleted.delete(wallet.id)) await saveDeletedDefaultIds(deleted);
  }
  return wallet;
}

export async function deleteWalletAddress(id: string) {
  if (defaultIds.has(id)) {
    const deleted = await deletedDefaultIds();
    deleted.add(id);
    // Record intent before deleting so a refresh can never resurrect the wallet.
    await saveDeletedDefaultIds(deleted);
  }
  await fsDelete('wallet_addresses', id);
}