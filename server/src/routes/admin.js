import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { AuditLog, Booking, DriverProfile, Fleet, PricingConfiguration, PlatformSetting, User, Vehicle } from '../models/index.js';

const router = Router();
router.use(authenticate, allowRoles('admin'));

async function recordAudit(req, action, resourceType, resourceId, metadata = {}) {
  await AuditLog.create({
    actorId: req.user.id, action, resourceType, resourceId,
    metadata, ipAddress: req.ip
  });
}

router.get('/overview', async (req, res, next) => {
  try {
    const [users, fleets, vehicles, drivers, bookings, activeTrips, pendingFleets, pendingVehicles] = await Promise.all([
      User.countDocuments(), Fleet.countDocuments(), Vehicle.countDocuments(), User.countDocuments({ role: 'driver' }),
      Booking.countDocuments(), Booking.countDocuments({ status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] } }),
      Fleet.countDocuments({ verificationStatus: 'pending' }), Vehicle.countDocuments({ verificationStatus: 'pending' })
    ]);
    return res.json({ metrics: { users, fleets, vehicles, drivers, bookings, activeTrips, pendingFleets, pendingVehicles } });
  } catch (error) { return next(error); }
});

router.get('/fleets', async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : undefined;
    const fleets = await Fleet.find(status ? { verificationStatus: status } : {}).populate('ownerId', 'name email phone').sort({ createdAt: -1 }).limit(200);
    return res.json({ fleets });
  } catch (error) { return next(error); }
});

router.patch('/fleets/:id/verification', async (req, res, next) => {
  try {
    if (!['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Verification status must be approved or rejected.' });
    const fleet = await Fleet.findByIdAndUpdate(req.params.id, { verificationStatus: req.body.status }, { new: true, runValidators: true });
    if (!fleet) return res.status(404).json({ message: 'Fleet not found.' });
    await recordAudit(req, 'fleet.verification.updated', 'Fleet', fleet.id, { status: fleet.verificationStatus });
    return res.json({ fleet });
  } catch (error) { return next(error); }
});

router.get('/vehicles', async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : undefined;
    const vehicles = await Vehicle.find(status ? { verificationStatus: status } : {}).populate('fleetId', 'name verificationStatus').sort({ createdAt: -1 }).limit(200);
    return res.json({ vehicles });
  } catch (error) { return next(error); }
});

router.patch('/vehicles/:id/verification', async (req, res, next) => {
  try {
    if (!['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Verification status must be approved or rejected.' });
    if (req.body.status === 'approved') {
      const vehicle = await Vehicle.findById(req.params.id).populate('fleetId', 'verificationStatus');
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
      if (vehicle.fleetId?.verificationStatus !== 'approved') return res.status(409).json({ message: 'Approve the vehicle owner fleet before approving its vehicles.' });
      vehicle.verificationStatus = 'approved';
      await vehicle.save();
      await recordAudit(req, 'vehicle.verification.updated', 'Vehicle', vehicle.id, { status: vehicle.verificationStatus });
      return res.json({ vehicle });
    }
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { verificationStatus: req.body.status }, { new: true, runValidators: true });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    await recordAudit(req, 'vehicle.verification.updated', 'Vehicle', vehicle.id, { status: vehicle.verificationStatus });
    return res.json({ vehicle });
  } catch (error) { return next(error); }
});

router.get('/drivers', async (req, res, next) => {
  try {
    const [drivers, profiles] = await Promise.all([
      User.find({ role: 'driver' }).select('name email phone status online fleetId').sort({ createdAt: -1 }).limit(200),
      DriverProfile.find().select('userId verificationStatus licenseExpiresAt').lean()
    ]);
    const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    return res.json({ drivers: drivers.map((driver) => ({ ...driver.toJSON(), profile: profileByUser.get(String(driver.id)) || null })) });
  } catch (error) { return next(error); }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Account status must be active or suspended.' });
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('name email role status');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    await recordAudit(req, 'user.status.updated', 'User', user.id, { status: user.status });
    return res.json({ user });
  } catch (error) { return next(error); }
});

router.get('/pricing', async (req, res, next) => {
  try {
    const pricing = await PricingConfiguration.find().populate('serviceAreaId', 'name city').sort({ category: 1 });
    return res.json({ pricing });
  } catch (error) { return next(error); }
});

router.put('/pricing/:category', async (req, res, next) => {
  try {
    const category = req.params.category;
    const allowed = ['sedan', 'suv', 'muv', 'tempo_traveller', 'bus', 'other'];
    if (!allowed.includes(category)) return res.status(400).json({ message: 'Unknown vehicle category.' });
    const fields = ['baseFare', 'perKilometre', 'perMinute', 'minimumFare', 'waitingPerMinute', 'platformFee', 'taxRate', 'discount', 'active', 'currency'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.includes(key)));
    const pricing = await PricingConfiguration.findOneAndUpdate({ category, serviceAreaId: { $exists: false } }, { $set: { ...changes, category } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    await recordAudit(req, 'pricing.updated', 'PricingConfiguration', pricing.id, { category });
    return res.json({ pricing });
  } catch (error) { return next(error); }
});

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await PlatformSetting.find({ key: { $in: ['publicBookingEnabled', 'complianceConfirmed', 'negotiatedPricingEnabled'] } }).select('key value');
    const response = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    return res.json({ settings: { publicBookingEnabled: false, complianceConfirmed: false, negotiatedPricingEnabled: false, ...response } });
  } catch (error) { return next(error); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const allowed = ['publicBookingEnabled', 'complianceConfirmed', 'negotiatedPricingEnabled'];
    for (const key of allowed) if (req.body[key] !== undefined && typeof req.body[key] !== 'boolean') return res.status(400).json({ message: `${key} must be a boolean.` });
    const current = Object.fromEntries((await PlatformSetting.find({ key: { $in: allowed } }).select('key value')).map((setting) => [setting.key, setting.value]));
    const complianceConfirmed = req.body.complianceConfirmed ?? current.complianceConfirmed ?? false;
    if (req.body.publicBookingEnabled === true && !complianceConfirmed) return res.status(409).json({ message: 'Confirm applicable local requirements before enabling public bookings.' });
    if (req.body.negotiatedPricingEnabled === true && !complianceConfirmed) return res.status(409).json({ message: 'Negotiated pricing cannot be enabled before legal approval.' });
    for (const key of allowed) if (req.body[key] !== undefined) {
      await PlatformSetting.findOneAndUpdate({ key }, { $set: { value: req.body[key], updatedBy: req.user.id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      await recordAudit(req, 'platform.setting.updated', 'PlatformSetting', req.user.id, { key, value: req.body[key] });
    }
    const settings = Object.fromEntries((await PlatformSetting.find({ key: { $in: allowed } }).select('key value')).map((setting) => [setting.key, setting.value]));
    return res.json({ settings });
  } catch (error) { return next(error); }
});

router.get('/bookings', async (req, res, next) => {
  try {
    const bookings = await Booking.find(req.query.status ? { status: req.query.status } : {}).populate('passengerId', 'name email').populate('fleetId', 'name').sort({ createdAt: -1 }).limit(200);
    return res.json({ bookings });
  } catch (error) { return next(error); }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await AuditLog.find().populate('actorId', 'name email').sort({ createdAt: -1 }).limit(100);
    return res.json({ logs });
  } catch (error) { return next(error); }
});

export default router;
