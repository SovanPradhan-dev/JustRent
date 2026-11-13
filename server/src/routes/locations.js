import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { saveDriverLocation } from '../services/locationService.js';
import { DriverLocation, DriverVehicleAssignment, Vehicle, Booking } from '../models/index.js';

const router = Router();

router.post('/update', authenticate, allowRoles('driver'), async (req, res, next) => {
  try {
    const record = await saveDriverLocation(req.user, req.body, req.app.get('io'));
    return res.status(201).json({ location: record });
  } catch (error) { return next(error); }
});

router.get('/vehicles/:id/location', authenticate, async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select('fleetId latestLocation lastLocationAt trackingStatus registrationNumber model currentDriverId');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    const isFleetOwner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(vehicle.fleetId) === String(req.user.fleetId);
    const isAssignedDriver = req.user.role === 'driver' && String(vehicle.currentDriverId) === String(req.user.id);
    let booking;
    if (req.user.role === 'passenger') {
      booking = await Booking.findOne({
        passengerId: req.user.id, vehicleId: vehicle.id,
        status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] }
      }).select('_id status driverId');
    }
    if (!isFleetOwner && !isAssignedDriver && !booking) return res.status(403).json({ message: 'You are not authorized to view this vehicle location.' });
    const latest = await DriverLocation.findOne({ vehicleId: vehicle.id }).sort({ timestamp: -1 }).select('-fleetId');
    return res.json({ vehicle, location: latest });
  } catch (error) { return next(error); }
});

router.get('/vehicles/:id/location-history', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, fleetId: req.user.fleetId }).select('_id');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to || to - from > 31 * 86400000) {
      return res.status(400).json({ message: 'Provide a valid date range no longer than 31 days.' });
    }
    const locations = await DriverLocation.find({ vehicleId: vehicle.id, timestamp: { $gte: from, $lte: to } })
      .sort({ timestamp: 1 }).limit(10000).select('driverId bookingId latitude longitude speed heading accuracy timestamp');
    return res.json({ locations, count: locations.length });
  } catch (error) { return next(error); }
});

router.get('/fleets/me/vehicles/locations', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ fleetId: req.user.fleetId }).populate('currentDriverId', 'name phone online').lean();
    const driverIds = vehicles.map((vehicle) => vehicle.currentDriverId?._id).filter(Boolean);
    const assignments = await DriverVehicleAssignment.find({ fleetId: req.user.fleetId, active: true, driverId: { $in: driverIds } }).select('driverId vehicleId').lean();
    const assignmentByDriver = new Map(assignments.map((item) => [String(item.driverId), String(item.vehicleId)]));
    const vehicleIds = vehicles.map((vehicle) => vehicle._id);
    const activeBookings = await Booking.find({ fleetId: req.user.fleetId, vehicleId: { $in: vehicleIds }, status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] } })
      .select('_id vehicleId driverId status pickup destination pickupAt').lean();
    const bookingsByVehicle = new Map(activeBookings.map((item) => [String(item.vehicleId), item]));
    const results = vehicles.map((vehicle) => {
      const currentBooking = bookingsByVehicle.get(String(vehicle._id));
      const locationAge = vehicle.lastLocationAt ? Date.now() - new Date(vehicle.lastLocationAt).getTime() : Infinity;
      return {
        ...vehicle,
        trackingStatus: locationAge > 120000 && vehicle.trackingStatus !== 'offline' ? 'stale' : vehicle.trackingStatus,
        assignedDriver: vehicle.currentDriverId && assignmentByDriver.get(String(vehicle.currentDriverId._id)) === String(vehicle._id) ? vehicle.currentDriverId : null,
        activeBooking: currentBooking || null
      };
    });
    return res.json({ vehicles: results });
  } catch (error) { return next(error); }
});

router.get('/trips/:id/route', authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).select('passengerId fleetId driverId vehicleId status');
    if (!booking) return res.status(404).json({ message: 'Trip not found.' });
    const owner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(booking.fleetId) === String(req.user.fleetId);
    const passenger = String(booking.passengerId) === String(req.user.id);
    const driver = String(booking.driverId) === String(req.user.id);
    if (!owner && !passenger && !driver) return res.status(403).json({ message: 'You are not authorized to view this trip.' });
    if (booking.status === 'completed' && !owner) return res.status(403).json({ message: 'Trip location sharing has ended.' });
    const locations = await DriverLocation.find({ bookingId: booking.id }).sort({ timestamp: 1 }).limit(10000)
      .select('latitude longitude speed heading timestamp');
    return res.json({ locations });
  } catch (error) { return next(error); }
});

export default router;
