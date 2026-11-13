import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyCheckoutSignature, verifyWebhookSignature } from './paymentService.js';

test('checkout signatures are verified against the provider order and payment identifiers', () => {
  process.env.RAZORPAY_KEY_ID = 'test-key';
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  const orderId = 'order_test';
  const paymentId = 'pay_test';
  const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(verifyCheckoutSignature(orderId, paymentId, signature), true);
  assert.equal(verifyCheckoutSignature(orderId, 'pay_other', signature), false);
  assert.equal(verifyCheckoutSignature(orderId, paymentId, 'invalid'), false);
});

test('webhook signatures are verified over the exact raw request body', () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-test-secret';
  const body = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body, signature), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature), false);
  assert.equal(verifyWebhookSignature(body, 'invalid'), false);
});
