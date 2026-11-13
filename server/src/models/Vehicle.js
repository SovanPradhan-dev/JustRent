import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  registrationNumber: { type: String, required: true, uppercase: true, trim: true },
  make: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['sedan', 'suv', 'muv', 'tempo_traveller', 'bus', 'other'], index: true },
  seatingCapacity: { type: Number, required: true, min: 1, max: 100 },
  airConditioned: { type: Boolean, default: true },
  amenities: [{ type: String, trim: true }],
  imageUrl: { type: String, trim: true },
  active: { type: Boolean, default: true, index: true },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  trackingStatus: { type: String, enum: ['offline', 'online', 'to_pickup', 'on_trip', 'idle', 'stale'], default: 'offline', index: true },
  latestLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }
  },
  lastLocationAt: { type: Date },
  currentDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

vehicleSchema.index({ fleetId: 1, registrationNumber: 1 }, { unique: true });
vehicleSchema.index({ latestLocation: '2dsphere' });

export default mongoose.model('Vehicle', vehicleSchema);
