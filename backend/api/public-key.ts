import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, success, error, ErrorCodes, validateAddress } from './types';

const OCTRA_RPC_URL = process.env.OCTRA_RPC_URL || 'https://octra.network';

/**
 * GET /api/public-key - Get public key for an address
 * Query params:
 *   - addr: wallet address (required)
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Handle CORS preflight
    if (handleCors(req, res)) return;

    if (req.method !== 'GET') {
        return error(res, ErrorCodes.METHOD_NOT_ALLOWED, 'Method not allowed', 405);
    }

    try {
        const addr = req.query.addr as string;

        if (!addr) {
            return error(res, ErrorCodes.MISSING_PARAMETER, 'Missing addr parameter', 400);
        }

        if (!validateAddress(addr)) {
            return error(res, ErrorCodes.INVALID_ADDRESS, 'Invalid address format', 400);
        }

        const response = await fetch(`${OCTRA_RPC_URL}/public_key/${addr}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return error(
                res,
                ErrorCodes.RPC_ERROR,
                `RPC error: ${response.status} ${errorText}`,
                response.status >= 400 && response.status < 600 ? response.status : 502
            );
        }

        const data = await response.json();
        success(res, data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        error(res, ErrorCodes.INTERNAL_ERROR, `Failed to fetch public key: ${message}`, 500);
    }
}
