import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, maxlength: 20 },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['passenger', 'individual_owner', 'fleet_company', 'driver', 'admin'], required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  fleetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet', index: true },
  online: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.verifyPassword = function verifyPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
