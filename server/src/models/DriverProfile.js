import mongoose from 'mongoose';

const driverProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dateOfBirth: Date,
  licenseNumber: { type: String, trim: true },
  licenseExpiresAt: Date,
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  emergencyContact: { name: String, phone: String },
  averageRating: { type: Number, min: 0, max: 5, default: 0 },
  completedTrips: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

export default mongoose.model('DriverProfile', driverProfileSchema);
