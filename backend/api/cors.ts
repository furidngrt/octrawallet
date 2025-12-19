import type { VercelResponse } from '@vercel/node';

const ALLOWED_ORIGIN = 'https://octra-key.vercel.app';

export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptionsRequest(res: VercelResponse): boolean {
  setCorsHeaders(res);
  res.status(204).end();
  return true;
}

