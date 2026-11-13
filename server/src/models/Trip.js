import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startLocation: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
  endLocation: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

export default mongoose.model('Trip', tripSchema);
