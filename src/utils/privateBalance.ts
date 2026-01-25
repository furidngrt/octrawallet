/**
 * Client-side encryption utilities for Octra private balance
 * Matches the encryption scheme used in octra_pre_client/cli.py
 */

/**
 * Derive encryption key from private key (matches Python's derive_encryption_key)
 * key = SHA256(salt + privkey_bytes)[:32]
 */
async function deriveEncryptionKey(privkeyBase64: string): Promise<CryptoKey> {
    // Decode base64 private key
    const privkeyBytes = Uint8Array.from(atob(privkeyBase64), c => c.charCodeAt(0));

    // Salt used in CLI: "octra_encrypted_balance_v2"
    const salt = new TextEncoder().encode("octra_encrypted_balance_v2");

    // Combine salt + privkey
    const combined = new Uint8Array(salt.length + privkeyBytes.length);
    combined.set(salt);
    combined.set(privkeyBytes, salt.length);

    // SHA256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const keyBytes = new Uint8Array(hashBuffer).slice(0, 32);

    // Import as AES-GCM key
    return crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt balance value (matches Python's encrypt_client_balance)
 * Format: "v2|" + base64(nonce + ciphertext)
 */
export async function encryptClientBalance(balance: number, privkeyBase64: string): Promise<string> {
    const key = await deriveEncryptionKey(privkeyBase64);

    // Generate random 12-byte nonce
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the balance as string
    const plaintext = new TextEncoder().encode(String(balance));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        plaintext
    );

    // Combine nonce + ciphertext
    const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
    combined.set(nonce);
    combined.set(new Uint8Array(ciphertext), nonce.length);

    // Return as "v2|" + base64
    return "v2|" + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt balance value (matches Python's decrypt_client_balance)
 */
export async function decryptClientBalance(encryptedData: string, privkeyBase64: string): Promise<number> {
    if (!encryptedData || encryptedData === "0") {
        return 0;
    }

    if (!encryptedData.startsWith("v2|")) {
        // Legacy format not supported in browser
        console.warn("Legacy v1 encryption format not supported");
        return 0;
    }

    try {
        const key = await deriveEncryptionKey(privkeyBase64);

        // Decode base64
        const raw = Uint8Array.from(atob(encryptedData.slice(3)), c => c.charCodeAt(0));

        if (raw.length < 28) {
            return 0;
        }

        const nonce = raw.slice(0, 12);
        const ciphertext = raw.slice(12);

        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            ciphertext
        );

        return parseInt(new TextDecoder().decode(plaintext), 10);
    } catch (err) {
        console.error("Failed to decrypt balance:", err);
        return 0;
    }
}
