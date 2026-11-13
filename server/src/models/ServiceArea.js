import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  region: { type: String, required: true, trim: true },
  countryCode: { type: String, default: 'IN', uppercase: true },
  boundary: { type: { type: String, enum: ['Polygon'], required: true }, coordinates: { type: [[[Number]]], required: true } },
  active: { type: Boolean, default: false, index: true },
  complianceApproved: { type: Boolean, default: false, index: true }
}, { timestamps: true });

serviceAreaSchema.index({ boundary: '2dsphere' });
export default mongoose.model('ServiceArea', serviceAreaSchema);
