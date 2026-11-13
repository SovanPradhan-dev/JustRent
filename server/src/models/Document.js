import mongoose from 'mongoose';

const documentKinds = ['owner_identity', 'company_registration', 'vehicle_registration', 'commercial_permit', 'insurance', 'fitness', 'pollution', 'tax', 'driver_license', 'driver_identity', 'other'];
const documentFields = {
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  kind: { type: String, enum: documentKinds, required: true },
  storageKey: { type: String, required: true, select: false },
  originalName: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  expiresAt: { type: Date, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  rejectionReason: { type: String, maxlength: 500 }
};

const options = {
  timestamps: true,
  toJSON: { transform(_doc, ret) { delete ret.storageKey; return ret; } },
  toObject: { transform(_doc, ret) { delete ret.storageKey; return ret; } }
};
export const VehicleDocument = mongoose.model('VehicleDocument', new mongoose.Schema({ ...documentFields, vehicleId: { ...documentFields.vehicleId, required: true } }, options));
export const DriverDocument = mongoose.model('DriverDocument', new mongoose.Schema({ ...documentFields, driverId: { ...documentFields.driverId, required: true } }, options));
export const FleetDocument = mongoose.model('FleetDocument', new mongoose.Schema({ ...documentFields, fleetId: { ...documentFields.fleetId, required: true } }, options));
