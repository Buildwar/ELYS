import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const TAG_LENGTH = 16; // Standard 128-bit authentication tag

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'elys_secure_master_credential_key_2026';
  // Derive a deterministic 32-byte (256-bit) key using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Output format: "enc:gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `enc:gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[CRYPTO] Error encrypting credential secret:', err);
    throw new Error('No se pudo cifrar el secreto de la credencial');
  }
}

/**
 * Decrypts an encrypted credential secret.
 * Transparently supports unencrypted plain text for backwards compatibility.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';

  // Check if payload follows our AES-256-GCM format
  if (!encryptedPayload.startsWith('enc:gcm:')) {
    // Legacy / unencrypted fallback
    return encryptedPayload;
  }

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 5) {
      return encryptedPayload;
    }

    const ivHex = parts[2];
    const tagHex = parts[3];
    const ciphertextHex = parts[4];

    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[CRYPTO] Error decrypting credential secret (authentication tag mismatch or invalid key)');
    return '••••••••••••';
  }
}
