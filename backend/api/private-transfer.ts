import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, success, error, ErrorCodes, validateAddress } from './types';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

/**
 * POST /api/private-transfer - Create a private (encrypted) transfer
 * Body: { from, to, amount, from_private_key, to_public_key }
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Handle CORS preflight
    if (handleCors(req, res)) return;

    if (req.method !== 'POST') {
        return error(res, ErrorCodes.METHOD_NOT_ALLOWED, 'Method not allowed', 405);
    }

    try {
        const { from, to, amount, from_private_key, to_public_key } = req.body || {};

        if (!from || !to || !amount || !from_private_key || !to_public_key) {
            return error(res, ErrorCodes.MISSING_PARAMETER, 'Missing required parameters: from, to, amount, from_private_key, to_public_key', 400);
        }

        if (!validateAddress(from) || !validateAddress(to)) {
            return error(res, ErrorCodes.INVALID_ADDRESS, 'Invalid address format', 400);
        }

        const response = await fetch(`${OCTRA_RPC_URL}/private_transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                amount: String(amount),
                from_private_key,
                to_public_key,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson;
            try {
                errorJson = JSON.parse(errorText);
            } catch {
                errorJson = { error: errorText };
            }
            return error(
                res,
                ErrorCodes.RPC_ERROR,
                errorJson.error || `RPC error: ${response.status}`,
                response.status >= 400 && response.status < 600 ? response.status : 502
            );
        }

        const data = await response.json();
        success(res, data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        error(res, ErrorCodes.INTERNAL_ERROR, `Failed to create private transfer: ${message}`, 500);
    }
}
