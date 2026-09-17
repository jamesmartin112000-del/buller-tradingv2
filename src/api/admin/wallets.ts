import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';

interface WalletInput {
  id?: unknown;
  network?: unknown;
  address?: unknown;
}

export default async function adminWalletsHandler(
request: VercelRequest,
response: VercelResponse)
{
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    response.setHeader('Allow', 'POST, DELETE');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    await verifyAuthenticatedRequest(request.headers.authorization, true);
    const body = (request.body || {}) as WalletInput;
    const id = String(body.id || '').trim();
    if (!id) throw new HttpError(400, 'Wallet id is required.');

    const walletRef = adminDb.collection('wallet_addresses').doc(id);
    if (request.method === 'DELETE') {
      await walletRef.delete();
      return response.status(200).json({ ok: true });
    }

    const network = String(body.network || '').trim();
    const address = String(body.address || '').trim();
    if (!network || !address) {
      throw new HttpError(400, 'Network and wallet address are required.');
    }
    if (network.length > 80 || address.length > 256) {
      throw new HttpError(400, 'Wallet details are too long.');
    }

    const existing = await walletRef.get();
    const wallet = {
      id,
      network,
      address,
      createdAt: Number(existing.data()?.createdAt) || Date.now()
    };
    await walletRef.set(wallet, { merge: false });
    return response.status(existing.exists ? 200 : 201).json({ ok: true, wallet });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}