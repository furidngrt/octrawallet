import type { VercelRequest, VercelResponse } from '@vercel/node';

// ===== API Response Types =====

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    timestamp: number;
    requestId?: string;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    timestamp: number;
    requestId?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ===== Balance Response =====
export interface BalanceData {
    address: string;
    balance: string;
    nonce: number;
}

// ===== Transaction Data =====
export interface TransactionData {
    from: string;
    to_: string;
    amount: string;
    nonce: number;
    ou: string;
    timestamp: number;
    signature: string;
    public_key: string;
    priority?: 'normal' | 'express';
}

export interface TransactionResult {
    status: 'accepted' | 'pending' | 'failed';
    tx_hash: string;
}

// ===== Health Check =====
export interface HealthData {
    service: string;
    status: 'ok' | 'degraded' | 'down';
    version: string;
    uptime: number;
    timestamp: number;
    rpcEndpoint: string;
}

// ===== Blockchain Data Types =====
export interface EpochData {
    epoch: number;
    timestamp: number;
    validator: string;
    tx_count: number;
    tree_hash: string;
}

export interface ValidatorData {
    address: string;
    balance: string;
    total_txs: number;
    latest_epoch: number;
    public_key: string;
    score: number;
    uptime: number;
    nonce: number;
}

export interface NetworkStats {
    total_transactions: number;
    total_volume: string;
    total_accounts: number;
    active_validators: number;
    peak_tps: number;
}

export interface StagingPoolData {
    total_pending: number;
    ou_used: number;
    ou_remaining: number;
    transactions: TransactionData[];
}

export interface AccountData {
    address: string;
    balance: string;
    nonce: number;
    total_transactions: number;
}

// ===== Error Codes =====
export const ErrorCodes = {
    // Client errors (4xx)
    BAD_REQUEST: 'BAD_REQUEST',
    INVALID_ADDRESS: 'INVALID_ADDRESS',
    INVALID_TRANSACTION: 'INVALID_TRANSACTION',
    MISSING_PARAMETER: 'MISSING_PARAMETER',
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

    // Server errors (5xx)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    RPC_ERROR: 'RPC_ERROR',
    RPC_TIMEOUT: 'RPC_TIMEOUT',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ===== Helper Functions =====

const ALLOWED_ORIGINS = [
    'https://octra-key.vercel.app',
    'https://octra-wallet.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];

export function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
    const origin = req.headers.origin || '';

    // Allow listed origins or localhost for development
    if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
}

export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }

    return false;
}

let requestCounter = 0;

export function generateRequestId(): string {
    requestCounter++;
    return `req_${Date.now()}_${requestCounter.toString(36)}`;
}

export function success<T>(res: VercelResponse, data: T, statusCode: number = 200): void {
    const response: ApiSuccessResponse<T> = {
        success: true,
        data,
        timestamp: Date.now(),
        requestId: generateRequestId(),
    };

    res.status(statusCode).json(response);
}

export function error(
    res: VercelResponse,
    code: ErrorCode,
    message: string,
    statusCode: number = 400,
    details?: unknown
): void {
    const errorObj: { code: string; message: string; details?: unknown } = {
        code,
        message,
    };

    if (details !== undefined) {
        errorObj.details = details;
    }

    const response: ApiErrorResponse = {
        success: false,
        error: errorObj,
        timestamp: Date.now(),
        requestId: generateRequestId(),
    };

    res.status(statusCode).json(response);
}

// ===== Validation Helpers =====

export function validateAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    if (!trimmed.startsWith('oct')) return false;
    if (trimmed.length < 10 || trimmed.length > 50) return false;
    return true;
}
