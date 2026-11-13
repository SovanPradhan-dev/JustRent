import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  active: { type: Boolean, default: true, index: true },
  assignedAt: { type: Date, default: Date.now },
  unassignedAt: Date
}, { timestamps: true });

assignmentSchema.index({ driverId: 1 }, { unique: true, partialFilterExpression: { active: true } });
assignmentSchema.index({ vehicleId: 1 }, { unique: true, partialFilterExpression: { active: true } });

export default mongoose.model('DriverVehicleAssignment', assignmentSchema);
