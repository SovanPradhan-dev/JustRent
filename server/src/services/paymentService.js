import { createHmac, timingSafeEqual } from 'node:crypto';

export class PaymentGatewayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.status = status;
  }
}

function credentials() {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: secret } = process.env;
  if (!keyId || !secret) throw new PaymentGatewayError('Online payments are not configured.', 503);
  return { keyId, secret };
}

export async function razorpayRequest(path, { method = 'GET', body } = {}) {
  const { keyId, secret } = credentials();
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,
        ...(body && { 'Content-Type': 'application/json' })
      },
      ...(body && { body: JSON.stringify(body) })
    });
  } catch {
    throw new PaymentGatewayError('The payment provider could not be reached.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new PaymentGatewayError('The payment provider could not process this request.');
  return result;
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { secret } = credentials();
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new PaymentGatewayError('Payment webhook verification is not configured.', 503);
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
