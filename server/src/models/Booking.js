import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['instant', 'request'], default: 'instant' },
  status: { type: String, enum: ['pending', 'confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress', 'completed', 'cancelled', 'no_show', 'disputed', 'rejected', 'expired'], default: 'pending', index: true },
  pickup: { label: { type: String, required: true }, location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } } },
  destination: { label: { type: String, required: true }, location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } } },
  pickupAt: { type: Date, required: true },
  passengerCount: { type: Number, required: true, min: 1, max: 100 },
  fare: {
    currency: { type: String, default: 'INR' },
    baseFare: Number,
    distanceFare: Number,
    timeFare: Number,
    waiting: Number,
    tolls: Number,
    parking: Number,
    taxes: Number,
    platformFee: Number,
    discount: Number,
    total: { type: Number, min: 0 }
  },
  pickupOtpHash: { type: String, select: false },
  negotiatedPricing: { type: Boolean, default: false },
  cancelledAt: Date
}, {
  timestamps: true,
  toJSON: { transform(_doc, ret) { delete ret.pickupOtpHash; return ret; } },
  toObject: { transform(_doc, ret) { delete ret.pickupOtpHash; return ret; } }
});

bookingSchema.index({ 'pickup.location': '2dsphere' });
bookingSchema.index({ 'destination.location': '2dsphere' });

export default mongoose.model('Booking', bookingSchema);
