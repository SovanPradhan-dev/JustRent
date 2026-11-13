import mongoose from 'mongoose';

const driverLocationSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true }
  },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  speed: { type: Number, min: 0, max: 400 },
  heading: { type: Number, min: 0, max: 360 },
  accuracy: { type: Number, min: 0, max: 10000 },
  timestamp: { type: Date, required: true, index: true }
}, { timestamps: true });

driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ timestamp: 1 }, { expireAfterSeconds: Number(process.env.LOCATION_RETENTION_DAYS || 90) * 86400 });
driverLocationSchema.index({ vehicleId: 1, timestamp: -1 });
driverLocationSchema.index({ bookingId: 1, timestamp: 1 });

export default mongoose.model('DriverLocation', driverLocationSchema);
