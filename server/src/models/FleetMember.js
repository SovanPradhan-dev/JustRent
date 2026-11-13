import mongoose from 'mongoose';

const fleetMemberSchema = new mongoose.Schema({
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'manager', 'dispatcher'], required: true },
  status: { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

fleetMemberSchema.index({ fleetId: 1, userId: 1 }, { unique: true });
export default mongoose.model('FleetMember', fleetMemberSchema);
