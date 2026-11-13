import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { Booking, DriverLocation, DriverVehicleAssignment, Vehicle } from '../models/index.js';

const router = Router();

router.get('/me/vehicles/locations', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ fleetId: req.user.fleetId }).populate('currentDriverId', 'name phone online').lean();
    const ids = vehicles.map((vehicle) => vehicle._id);
    const [assignments, activeBookings] = await Promise.all([
      DriverVehicleAssignment.find({ fleetId: req.user.fleetId, active: true, vehicleId: { $in: ids } }).select('driverId vehicleId').lean(),
      Booking.find({ fleetId: req.user.fleetId, vehicleId: { $in: ids }, status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] } })
        .select('_id vehicleId driverId status pickup destination pickupAt').lean()
    ]);
    const assignmentByVehicle = new Map(assignments.map((entry) => [String(entry.vehicleId), String(entry.driverId)]));
    const bookingByVehicle = new Map(activeBookings.map((entry) => [String(entry.vehicleId), entry]));
    const results = await Promise.all(vehicles.map(async (vehicle) => {
      const location = await DriverLocation.findOne({ vehicleId: vehicle._id }).sort({ timestamp: -1 }).select('latitude longitude speed heading accuracy timestamp').lean();
      const age = location ? Date.now() - new Date(location.timestamp).getTime() : Infinity;
      return {
        ...vehicle,
        trackingStatus: age > 120000 && vehicle.trackingStatus !== 'offline' ? 'stale' : vehicle.trackingStatus,
        assignedDriver: String(vehicle.currentDriverId?._id || '') === assignmentByVehicle.get(String(vehicle._id)) ? vehicle.currentDriverId : null,
        latestLocation: location ? { type: 'Point', coordinates: [location.longitude, location.latitude] } : vehicle.latestLocation,
        location,
        activeBooking: bookingByVehicle.get(String(vehicle._id)) || null
      };
    }));
    return res.json({ vehicles: results });
  } catch (error) { return next(error); }
});

export default router;
