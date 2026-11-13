import mongoose from 'mongoose';

const pricingConfigurationSchema = new mongoose.Schema({
  category: { type: String, enum: ['sedan', 'suv', 'muv', 'tempo_traveller', 'bus', 'other'], required: true, index: true },
  serviceAreaId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceArea' },
  currency: { type: String, default: 'INR', uppercase: true },
  baseFare: { type: Number, min: 0, required: true },
  perKilometre: { type: Number, min: 0, required: true },
  perMinute: { type: Number, min: 0, default: 0 },
  minimumFare: { type: Number, min: 0, required: true },
  waitingPerMinute: { type: Number, min: 0, default: 0 },
  platformFee: { type: Number, min: 0, default: 0 },
  taxRate: { type: Number, min: 0, max: 1, default: 0 },
  discount: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

pricingConfigurationSchema.index({ category: 1, serviceAreaId: 1, active: 1 });
export default mongoose.model('PricingConfiguration', pricingConfigurationSchema);
