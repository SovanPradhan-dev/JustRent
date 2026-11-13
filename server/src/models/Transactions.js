import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
  providerOrderId: { type: String, unique: true, sparse: true },
  providerPaymentId: { type: String, unique: true, sparse: true },
  amount: { type: Number, min: 0, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created', index: true },
  receiptUrl: String
}, { timestamps: true });

paymentSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'created' } }
);
paymentSchema.index({ bookingId: 1, createdAt: -1 });
export const Payment = mongoose.model('Payment', paymentSchema);

export const Refund = mongoose.model('Refund', new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  amount: { type: Number, min: 0, required: true },
  reason: { type: String, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending', index: true },
  providerRefundId: { type: String, unique: true, sparse: true }
}, { timestamps: true }));

export const Review = mongoose.model('Review', new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 2000 }
}, { timestamps: true }));
