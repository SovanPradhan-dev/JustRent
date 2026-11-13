import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { Booking, DriverVehicleAssignment, User, Vehicle } from '../models/index.js';

const router = Router();

router.patch('/availability', authenticate, allowRoles('driver'), async (req, res, next) => {
  try {
    if (typeof req.body.online !== 'boolean') return res.status(400).json({ message: 'online must be true or false.' });
    const activeTrip = await Booking.findOne({ driverId: req.user.id, status: { $in: ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'] } }).select('status');
    if (!req.body.online && activeTrip) return res.status(409).json({ message: 'You cannot stop location sharing during an active booking.' });
    const assignment = await DriverVehicleAssignment.findOne({ driverId: req.user.id, active: true });
    if (req.body.online && !assignment) return res.status(409).json({ message: 'Ask your fleet owner to assign a vehicle before going online.' });
    const user = await User.findByIdAndUpdate(req.user.id, { online: req.body.online }, { new: true }).select('_id online');
    if (assignment) {
      await Vehicle.updateOne({ _id: assignment.vehicleId, fleetId: assignment.fleetId }, {
        $set: { trackingStatus: activeTrip?.status === 'in_progress' ? 'on_trip' : activeTrip?.status === 'driver_arriving' ? 'to_pickup' : req.body.online ? 'online' : 'offline' }
      });
      req.app.get('io').to(`fleet:${assignment.fleetId}`).emit('fleet:vehicle:status', { vehicleId: String(assignment.vehicleId), trackingStatus: activeTrip?.status === 'in_progress' ? 'on_trip' : activeTrip?.status === 'driver_arriving' ? 'to_pickup' : req.body.online ? 'online' : 'offline' });
    }
    return res.json({ online: user.online, trackingStatus: user.online ? 'online' : 'offline' });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, allowRoles('driver'), async (req, res, next) => {
  try {
    const assignment = await DriverVehicleAssignment.findOne({ driverId: req.user.id, active: true })
      .populate('vehicleId').populate('fleetId', 'name');
    const bookings = await Booking.find({ driverId: req.user.id }).sort({ pickupAt: -1 }).limit(25)
      .populate('passengerId', 'name phone').select('-pickupOtpHash');
    return res.json({ driver: req.user, assignment, bookings });
  } catch (error) { return next(error); }
});

router.get('/', authenticate, allowRoles('individual_owner', 'fleet_company'), async (req, res, next) => {
  try {
    const drivers = await User.find({ fleetId: req.user.fleetId, role: 'driver' }).select('name email phone online status').sort({ name: 1 });
    return res.json({ drivers });
  } catch (error) { return next(error); }
});

export default router;
