import mongoose from 'mongoose';

export const Notification = mongoose.model('Notification', new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 1000 },
  resourceType: String,
  resourceId: mongoose.Schema.Types.ObjectId,
  readAt: Date
}, { timestamps: true }));

export const SupportTicket = mongoose.model('SupportTicket', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  subject: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true }));

export const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, maxlength: 120, index: true },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: String
}, { timestamps: true }));
