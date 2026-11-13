import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { Booking, DriverLocation, DriverVehicleAssignment, Fleet, Trip, User, Vehicle } from '../models/index.js';
import { calculateFare } from '../services/pricingService.js';
import { canTransitionBooking } from '../services/bookingRules.js';
import { platformSetting, publicBookingsEnabled } from '../services/platformSettings.js';

const router = Router();
const activeStatuses = ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'];
const toPoint = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const point = value.map(Number);
  return point.every(Number.isFinite) && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90 ? point : null;
};
const broadcast = (io, booking, event) => {
  const update = { bookingId: String(booking.id), status: booking.status, vehicleId: booking.vehicleId && String(booking.vehicleId), driverId: booking.driverId && String(booking.driverId) };
  io.to(`fleet:${booking.fleetId}`).emit(event, update);
  io.to(`booking:${booking.id}`).emit(event, update);
};

router.post('/', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    if (!(await publicBookingsEnabled())) return res.status(423).json({ message: 'Public booking is not active in this service area yet. Local compliance approval and platform activation are both required.' });
    const { vehicleId, pickup, destination, pickupAt, passengerCount, type = 'instant' } = req.body;
    if (!['instant', 'request'].includes(type)) return res.status(400).json({ message: 'Booking type must be instant or request.' });
    if (req.body.negotiatedPricing && (process.env.NEGOTIATED_PRICING_ENABLED !== 'true' || !(await platformSetting('negotiatedPricingEnabled')))) return res.status(403).json({ message: 'Negotiated pricing is not enabled for this service area.' });
    const pickupCoordinates = toPoint(pickup?.coordinates);
    const destinationCoordinates = toPoint(destination?.coordinates);
    const departure = new Date(pickupAt);
    if (!vehicleId || !pickup?.label || !destination?.label || !pickupCoordinates || !destinationCoordinates || Number.isNaN(departure.getTime()) || departure < new Date() || !Number.isInteger(Number(passengerCount)) || Number(passengerCount) < 1) {
      return res.status(400).json({ message: 'Provide valid journey locations, a future pickup time and passenger count.' });
    }
    const vehicle = await Vehicle.findOne({ _id: vehicleId, active: true, verificationStatus: 'approved' }).populate('fleetId');
    if (!vehicle || !vehicle.fleetId || vehicle.fleetId.verificationStatus !== 'approved') return res.status(404).json({ message: 'This vehicle is not available for booking.' });
    if (vehicle.seatingCapacity < Number(passengerCount)) return res.status(400).json({ message: 'This vehicle does not have enough seats for your passengers.' });
    const fare = await calculateFare(vehicle.category, pickupCoordinates, destinationCoordinates, Number(req.body.estimatedMinutes || 0));
    const pickupCode = String(randomInt(100000, 1000000));
    const booking = await Booking.create({
      passengerId: req.user.id, fleetId: vehicle.fleetId.id, vehicleId: vehicle.id,
      type, status: 'pending',
      pickup: { label: pickup.label, location: { type: 'Point', coordinates: pickupCoordinates } },
      destination: { label: destination.label, location: { type: 'Point', coordinates: destinationCoordinates } },
      pickupAt: departure, passengerCount: Number(passengerCount), fare,
      pickupOtpHash: await bcrypt.hash(pickupCode, 10),
      negotiatedPricing: Boolean(req.body.negotiatedPricing)
    });
    req.app.get('io').to(`fleet:${vehicle.fleetId.id}`).emit('booking:new', { bookingId: booking.id, vehicleId: vehicle.id, pickupAt: booking.pickupAt });
    return res.status(201).json({ booking, pickupCode });
  } catch (error) { return next(error); }
});

router.get('/mine', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    const bookings = await Booking.find({ passengerId: req.user.id }).populate('vehicleId', 'registrationNumber make model category').populate('driverId', 'name phone').sort({ createdAt: -1 }).limit(50);
    return res.json({ bookings });
  } catch (error) { return next(error); }
});

router.get('/manage', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query = { fleetId: req.user.fleetId };
    if (req.query.status) query.status = req.query.status;
    const [bookings, total] = await Promise.all([
      Booking.find(query).populate('passengerId', 'name phone').populate('vehicleId', 'registrationNumber make model').populate('driverId', 'name phone')
        .sort({ pickupAt: 1 }).skip((page - 1) * limit).limit(limit),
      Booking.countDocuments(query)
    ]);
    return res.json({ bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('passengerId', 'name phone').populate('vehicleId', 'registrationNumber make model category seatingCapacity')
      .populate('driverId', 'name phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const passenger = String(booking.passengerId.id) === String(req.user.id);
    const driver = booking.driverId && String(booking.driverId.id) === String(req.user.id);
    const owner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(booking.fleetId) === String(req.user.fleetId);
    if (!passenger && !driver && !owner) return res.status(403).json({ message: 'You are not authorized to view this booking.' });
    return res.json({ booking });
  } catch (error) { return next(error); }
});

router.patch('/:id/accept', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, fleetId: req.user.fleetId, status: 'pending' });
    if (!booking) return res.status(404).json({ message: 'Pending booking not found in your fleet.' });
    const assignment = await DriverVehicleAssignment.findOne({ fleetId: req.user.fleetId, vehicleId: req.body.vehicleId, driverId: req.body.driverId, active: true }).populate('driverId', 'online');
    if (!assignment?.driverId?.online) return res.status(400).json({ message: 'Choose a driver who is online and sharing availability.' });
    const vehicle = assignment && await Vehicle.findOne({ _id: assignment.vehicleId, fleetId: req.user.fleetId, active: true, verificationStatus: 'approved' });
    if (!assignment || !vehicle || vehicle.seatingCapacity < booking.passengerCount) return res.status(400).json({ message: 'Choose a verified vehicle and its currently assigned driver with enough seats.' });
    const conflict = await Booking.exists({ driverId: assignment.driverId._id, status: { $in: activeStatuses }, pickupAt: { $gte: new Date(Date.now() - 3 * 3600000), $lte: new Date(booking.pickupAt.getTime() + 3 * 3600000) } });
    if (conflict) return res.status(409).json({ message: 'The selected driver has a conflicting active booking.' });
    booking.vehicleId = vehicle.id;
    booking.driverId = assignment.driverId._id;
    booking.status = 'confirmed';
    await booking.save();
    await Trip.create({ bookingId: booking.id, fleetId: booking.fleetId, vehicleId: vehicle.id, driverId: assignment.driverId._id });
    const io = req.app.get('io');
    broadcast(io, booking, 'booking:accepted');
    io.to(`booking:${booking.id}`).emit('booking:confirmation', { bookingId: booking.id, status: booking.status });
    return res.json({ booking });
  } catch (error) { return next(error); }
});

router.patch('/:id/reject', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, fleetId: req.user.fleetId, status: 'pending' });
    if (!booking) return res.status(404).json({ message: 'Pending booking not found in your fleet.' });
    booking.status = 'rejected';
    await booking.save();
    broadcast(req.app.get('io'), booking, 'booking:rejected');
    return res.json({ booking });
  } catch (error) { return next(error); }
});

router.post('/:id/verify-pickup-otp', authenticate, allowRoles('passenger'), async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, passengerId: req.user.id, status: 'arrived' }).select('+pickupOtpHash');
    if (!booking) return res.status(404).json({ message: 'An arrived booking for this passenger was not found.' });
    if (!booking.pickupOtpHash || !(await bcrypt.compare(String(req.body.code || ''), booking.pickupOtpHash))) return res.status(400).json({ message: 'Pickup code is incorrect.' });
    booking.status = 'otp_verified';
    booking.pickupOtpHash = undefined;
    await booking.save();
    broadcast(req.app.get('io'), booking, 'booking:status');
    return res.json({ booking });
  } catch (error) { return next(error); }
});

router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const isDriver = req.user.role === 'driver' && String(booking.driverId) === String(req.user.id);
    const isPassenger = req.user.role === 'passenger' && String(booking.passengerId) === String(req.user.id);
    const isOwner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(booking.fleetId) === String(req.user.fleetId);
    const target = req.body.status;
    const permitted = (isDriver && ['driver_accepted', 'driver_arriving', 'arrived', 'in_progress', 'completed', 'no_show'].includes(target)) ||
      ((isPassenger || isOwner) && target === 'cancelled') || (isDriver && target === 'disputed');
    if (!permitted) return res.status(403).json({ message: 'This role cannot perform the requested trip action.' });
    if (!canTransitionBooking(booking.status, target)) return res.status(409).json({ message: `Invalid booking transition from ${booking.status} to ${target}.` });
    booking.status = target;
    if (target === 'cancelled') booking.cancelledAt = new Date();
    await booking.save();
    if (target === 'in_progress' || target === 'completed') {
      const location = await DriverLocation.findOne({ bookingId: booking.id }).sort({ timestamp: -1 });
      const tripUpdate = target === 'in_progress'
        ? { startedAt: new Date(), ...(location && { startLocation: location.location }) }
        : { completedAt: new Date(), ...(location && { endLocation: location.location }) };
      await Trip.updateOne({ bookingId: booking.id }, { $set: tripUpdate });
      if (target === 'completed') await Vehicle.updateOne({ _id: booking.vehicleId }, { $set: { trackingStatus: 'online' } });
    }
    if (['completed', 'cancelled', 'no_show'].includes(target)) await req.app.get('io').in(`booking:${booking.id}`).socketsLeave(`booking:${booking.id}`);
    broadcast(req.app.get('io'), booking, 'booking:status');
    return res.json({ booking });
  } catch (error) { return next(error); }
});

router.get('/:id/location', authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).select('passengerId fleetId driverId vehicleId status');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const passenger = String(booking.passengerId) === String(req.user.id);
    const owner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(booking.fleetId) === String(req.user.fleetId);
    if (!passenger || !activeStatuses.includes(booking.status)) {
      if (!owner || !activeStatuses.includes(booking.status)) return res.status(403).json({ message: 'Live trip location is not available to this account.' });
    }
    const location = await DriverLocation.findOne({ bookingId: booking.id }).sort({ timestamp: -1 }).select('latitude longitude speed heading accuracy timestamp');
    return res.json({ location });
  } catch (error) { return next(error); }
});

export default router;
