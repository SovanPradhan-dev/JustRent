import mongoose from 'mongoose';

const bookingOfferSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, min: 0, required: true },
  currency: { type: String, default: 'INR' },
  message: { type: String, maxlength: 500 },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'superseded'], default: 'pending', index: true },
  expiresAt: { type: Date, index: true }
}, { timestamps: true });

bookingOfferSchema.index({ bookingId: 1, createdAt: -1 });
export default mongoose.model('BookingOffer', bookingOfferSchema);
