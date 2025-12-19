/**
 * Nonce Manager - Prevents race conditions in transaction sending
 * Tracks pending nonces per address to prevent duplicate transactions
 */

interface NonceState {
  currentNonce: number;
  pendingNonce: number | null;
  locked: boolean;
}

const nonceStates = new Map<string, NonceState>();

/**
 * Get the next nonce for an address, reserving it immediately
 */
export async function getNextNonce(
  address: string,
  fetchCurrentNonce: (addr: string) => Promise<number>
): Promise<number> {
  const state = nonceStates.get(address) || {
    currentNonce: -1,
    pendingNonce: null,
    locked: false,
  };

  // If locked, throw error to prevent duplicate sends
  if (state.locked) {
    throw new Error('Transaction already in progress. Please wait...');
  }

  // Lock nonce immediately
  state.locked = true;
  nonceStates.set(address, state);

  try {
    // Fetch current nonce from network
    const networkNonce = await fetchCurrentNonce(address);
    
    // Use the higher of network nonce or our tracked nonce
    const baseNonce = Math.max(networkNonce, state.currentNonce);
    state.currentNonce = baseNonce;
    
    // Reserve next nonce
    const nextNonce = baseNonce + 1;
    state.pendingNonce = nextNonce;
    
    nonceStates.set(address, state);
    return nextNonce;
  } catch (error) {
    // Unlock on error
    state.locked = false;
    state.pendingNonce = null;
    nonceStates.set(address, state);
    throw error;
  }
}

/**
 * Release the nonce lock after transaction completes (success or failure)
 */
export function releaseNonce(address: string, success: boolean): void {
  const state = nonceStates.get(address);
  if (!state) return;

  if (success && state.pendingNonce !== null) {
    // Update current nonce to the one we just used
    state.currentNonce = state.pendingNonce;
  }

  state.locked = false;
  state.pendingNonce = null;
  nonceStates.set(address, state);
}

/**
 * Clear nonce state for an address (on logout/wallet change)
 */
export function clearNonceState(address: string): void {
  nonceStates.delete(address);
}

/**
 * Check if nonce is currently locked for an address
 */
export function isNonceLocked(address: string): boolean {
  const state = nonceStates.get(address);
  return state?.locked || false;
}

/**
 * Clear ALL nonce states (for full logout)
 */
export function clearAllNonceStates(): void {
  nonceStates.clear();
}

