import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, success, type HealthData } from './types';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';
const startTime = Date.now();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  const healthData: HealthData = {
    service: 'Octra Wallet API',
    status: 'ok',
    version: '2.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: Date.now(),
    rpcEndpoint: OCTRA_RPC_URL,
  };

  success(res, healthData);
}
