import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizeError, verifyAuthenticatedRequest } from '../_lib/firebaseAdmin';
import { configureR2Cors, r2Config } from '../_lib/r2';

export default async function setupR2(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    await verifyAuthenticatedRequest(request.headers.authorization, true);
    const configured = String(process.env.R2_CORS_ORIGINS || 'https://bullertrading.vercel.app').
    split(',').
    map((value) => value.trim()).
    filter(Boolean);
    await configureR2Cors(configured);
    const config = r2Config();
    return response.status(200).json({
      ok: true,
      bucket: config.bucket,
      publicUrl: config.publicUrl,
      allowedOrigins: configured
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}