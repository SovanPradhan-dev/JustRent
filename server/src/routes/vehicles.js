import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { Booking, DriverVehicleAssignment, Fleet, User, Vehicle } from '../models/index.js';
import { calculateFare } from '../services/pricingService.js';
import { publicBookingsEnabled } from '../services/platformSettings.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { category, passengers } = req.query;
    const query = { active: true, verificationStatus: 'approved' };
    if (category) query.category = category;
    if (passengers && Number.isInteger(Number(passengers))) query.seatingCapacity = { $gte: Number(passengers) };
    const vehicles = await Vehicle.find(query).populate('fleetId', 'name verificationStatus').sort({ createdAt: -1 }).limit(100);
    return res.json({ vehicles });
  } catch (error) { return next(error); }
});

router.get('/search', allowRoles('passenger'), async (req, res, next) => {
  try {
    if (!(await publicBookingsEnabled())) return res.status(423).json({ message: 'Public booking is not active in this service area yet. Local compliance approval and platform activation are both required.' });
    const origin = [Number(req.query.pickupLng), Number(req.query.pickupLat)];
    const destination = [Number(req.query.destinationLng), Number(req.query.destinationLat)];
    const passengers = Number(req.query.passengers);
    if (![...origin, ...destination].every(Number.isFinite) || origin[0] < -180 || origin[0] > 180 || destination[0] < -180 || destination[0] > 180 || origin[1] < -90 || origin[1] > 90 || destination[1] < -90 || destination[1] > 90 || !Number.isInteger(passengers) || passengers < 1) {
      return res.status(400).json({ message: 'Valid pickup and destination coordinates and passenger count are required.' });
    }
    const filter = { active: true, verificationStatus: 'approved', seatingCapacity: { $gte: passengers } };
    if (req.query.category) filter.category = req.query.category;
    const candidates = await Vehicle.find(filter).populate({ path: 'fleetId', match: { verificationStatus: 'approved' }, select: 'name verificationStatus' }).limit(200);
    const vehicles = [];
    for (const vehicle of candidates) {
      if (!vehicle.fleetId) continue;
      const assignment = await DriverVehicleAssignment.findOne({ vehicleId: vehicle.id, fleetId: vehicle.fleetId.id, active: true }).populate('driverId', 'name online');
      if (!assignment?.driverId?.online) continue;
      const activeTrip = await Booking.exists({ driverId: assignment.driverId.id, status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] } });
      if (activeTrip) continue;
      const fare = await calculateFare(vehicle.category, origin, destination, Number(req.query.estimatedMinutes || 0));
      vehicles.push({ vehicle, fleet: vehicle.fleetId, driver: assignment.driverId, fare });
    }
    return res.json({ vehicles });
  } catch (error) { return next(error); }
});

router.get('/manage', allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ fleetId: req.user.fleetId }).sort({ createdAt: -1 });
    return res.json({ vehicles });
  } catch (error) { return next(error); }
});

router.post('/', allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const fleet = await Fleet.findById(req.user.fleetId);
    if (!fleet) return res.status(409).json({ message: 'Owner fleet setup is incomplete.' });
    const vehicle = await Vehicle.create({ ...req.body, fleetId: fleet.id });
    return res.status(201).json({ vehicle });
  } catch (error) { return next(error); }
});

router.patch('/:id', allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const allowed = ['registrationNumber', 'make', 'model', 'category', 'seatingCapacity', 'airConditioned', 'amenities', 'imageUrl', 'active'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const vehicle = await Vehicle.findOneAndUpdate({ _id: req.params.id, fleetId: req.user.fleetId }, changes, { new: true, runValidators: true });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    return res.json({ vehicle });
  } catch (error) { return next(error); }
});

router.delete('/:id', allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOneAndUpdate({ _id: req.params.id, fleetId: req.user.fleetId }, { active: false, trackingStatus: 'offline' }, { new: true });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    await DriverVehicleAssignment.updateMany({ vehicleId: vehicle.id, active: true }, { $set: { active: false, unassignedAt: new Date() } });
    return res.json({ vehicle });
  } catch (error) { return next(error); }
});

router.post('/:id/assignment', allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, fleetId: req.user.fleetId, active: true });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found in your fleet.' });
    const driver = await User.findOne({ email: String(req.body.driverEmail || '').toLowerCase().trim(), role: 'driver', status: 'active' });
    if (!driver) return res.status(404).json({ message: 'No active driver account was found for that email.' });
    if (driver.fleetId && String(driver.fleetId) !== String(req.user.fleetId)) return res.status(409).json({ message: 'This driver is already associated with another fleet.' });
    const existing = await DriverVehicleAssignment.findOne({ driverId: driver.id, active: true });
    if (existing && String(existing.vehicleId) !== String(vehicle.id)) return res.status(409).json({ message: 'This driver is already assigned to another vehicle.' });
    await DriverVehicleAssignment.updateMany({ vehicleId: vehicle.id, active: true }, { $set: { active: false, unassignedAt: new Date() } });
    await DriverVehicleAssignment.create({ fleetId: req.user.fleetId, driverId: driver.id, vehicleId: vehicle.id });
    vehicle.currentDriverId = driver.id;
    await vehicle.save();
    driver.fleetId = req.user.fleetId;
    await driver.save();
    return res.status(201).json({ vehicle, driver: { id: driver.id, name: driver.name, email: driver.email } });
  } catch (error) { return next(error); }
});

export default router;
