import crypto from 'crypto';

/**
 * Generates a referral code from a wallet address.
 * @param walletAddress The user's wallet address (e.g., 0.0.12345)
 * @returns A short, unique referral code
 */
export function generateReferralCodeFromWallet(walletAddress: string): string {
    const hash = crypto.createHash('sha256').update(walletAddress).digest('hex');
    // Generate a readable code: "FORE-" prefix + 8 hex chars
    return `FORE-${hash.slice(0, 8).toUpperCase()}`;
}
