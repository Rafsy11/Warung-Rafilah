import crypto from 'crypto';

export function verifyQrisSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', process.env.QRIS_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison — prevents timing attacks revealing the
  // correct signature byte-by-byte.
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);

  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
