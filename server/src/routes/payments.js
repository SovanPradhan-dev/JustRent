import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { Booking, Payment } from '../models/index.js';
import { PaymentGatewayError, razorpayRequest, verifyCheckoutSignature, verifyWebhookSignature } from '../services/paymentService.js';

const router = Router();
const payableStatuses = ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress', 'completed'];

router.post('/orders', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.body.bookingId, passengerId: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (!payableStatuses.includes(booking.status)) return res.status(409).json({ message: 'Payment is available after the fleet confirms the booking.' });
    const existing = await Payment.findOne({ bookingId: booking.id, passengerId: req.user.id, status: { $in: ['created', 'authorized', 'captured'] } }).sort({ createdAt: -1 });
    if (existing?.status === 'captured') return res.status(409).json({ message: 'This booking has already been paid.' });
    if (existing?.status === 'authorized') return res.status(409).json({ message: 'The payment is authorized and awaiting provider confirmation.' });
    if (existing?.status === 'created') {
      const { RAZORPAY_KEY_ID } = process.env;
      if (!RAZORPAY_KEY_ID) throw new PaymentGatewayError('Online payments are not configured.', 503);
      return res.json({ keyId: RAZORPAY_KEY_ID, orderId: existing.providerOrderId, amount: Math.round(existing.amount * 100), currency: existing.currency });
    }

    const amount = Number(booking.fare?.total);
    if (!Number.isFinite(amount) || amount <= 0 || booking.fare?.currency !== 'INR') return res.status(409).json({ message: 'This booking does not have a payable INR fare.' });
    const amountPaise = Math.round(amount * 100);
    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: { amount: amountPaise, currency: 'INR', receipt: String(booking.id).slice(-40), notes: { bookingId: String(booking.id) } }
    });
    if (!order.id || order.amount !== amountPaise || order.currency !== 'INR') throw new PaymentGatewayError('The payment provider returned an invalid order.');
    await Payment.create({
      bookingId: booking.id, passengerId: req.user.id, providerOrderId: order.id,
      amount, currency: 'INR', status: 'created'
    });
    return res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: amountPaise, currency: 'INR' });
  } catch (error) { return next(error); }
});

router.post('/verify', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) return res.status(400).json({ message: 'Payment signature is invalid.' });
    const payment = await Payment.findOne({ providerOrderId: orderId, passengerId: req.user.id });
    if (!payment) return res.status(404).json({ message: 'Payment order not found for this account.' });
    if (payment.status === 'captured') return res.json({ status: payment.status });

    const providerPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    const expectedPaise = Math.round(payment.amount * 100);
    if (providerPayment.order_id !== orderId || providerPayment.amount !== expectedPaise || providerPayment.currency !== payment.currency ||
        !['authorized', 'captured'].includes(providerPayment.status)) {
      return res.status(409).json({ message: 'The provider has not confirmed this payment for the expected booking amount.' });
    }
    payment.providerPaymentId = paymentId;
    payment.status = providerPayment.status === 'captured' ? 'captured' : 'authorized';
    await payment.save();
    return res.json({ status: payment.status });
  } catch (error) { return next(error); }
});

router.get('/mine', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    const payments = await Payment.find({ passengerId: req.user.id }).select('bookingId amount currency status createdAt').sort({ createdAt: -1 }).limit(100);
    return res.json({ payments });
  } catch (error) { return next(error); }
});

export async function handlePaymentWebhook(req, res, next) {
  try {
    if (!verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) return res.status(400).json({ message: 'Webhook signature is invalid.' });
    const event = JSON.parse(req.body.toString('utf8'));
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const orderId = paymentEntity?.order_id || orderEntity?.id;
    if (!orderId) return res.status(200).json({ received: true });

    const payment = await Payment.findOne({ providerOrderId: orderId });
    if (!payment) return res.status(200).json({ received: true });
    const amount = paymentEntity?.amount ?? orderEntity?.amount;
    const currency = paymentEntity?.currency ?? orderEntity?.currency;
    if (Number(amount) !== Math.round(payment.amount * 100) || currency !== payment.currency) {
      throw new PaymentGatewayError('Payment webhook amount does not match the stored order.', 400);
    }
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      payment.status = 'captured';
      if (paymentEntity?.id) payment.providerPaymentId = paymentEntity.id;
      await payment.save();
    } else if (event.event === 'payment.authorized' && payment.status !== 'captured') {
      payment.status = 'authorized';
      if (paymentEntity?.id) payment.providerPaymentId = paymentEntity.id;
      await payment.save();
    } else if (event.event === 'payment.failed' && payment.status !== 'captured') {
      payment.status = 'failed';
      if (paymentEntity?.id) payment.providerPaymentId = paymentEntity.id;
      await payment.save();
    }
    return res.json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ message: 'Webhook payload is invalid.' });
    return next(error);
  }
}

export default router;
