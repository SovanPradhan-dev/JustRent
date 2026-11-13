import mongoose from 'mongoose';

const fleetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessType: { type: String, enum: ['individual', 'company'], required: true },
  phone: { type: String, trim: true },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  serviceAreas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceArea' }]
}, { timestamps: true });

export default mongoose.model('Fleet', fleetSchema);
