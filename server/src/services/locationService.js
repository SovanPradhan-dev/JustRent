import Booking from '../models/Booking.js';
import DriverLocation from '../models/DriverLocation.js';
import DriverVehicleAssignment from '../models/DriverVehicleAssignment.js';
import Vehicle from '../models/Vehicle.js';

const activeTripStates = ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'];

export async function saveDriverLocation(driver, input, io) {
  const { vehicleId, latitude, longitude, speed, heading, accuracy } = input;
  const coordinates = [Number(longitude), Number(latitude)];
  if (!vehicleId || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
      coordinates[0] < -180 || coordinates[0] > 180 || coordinates[1] < -90 || coordinates[1] > 90) {
    const error = new Error('A valid vehicle ID, latitude and longitude are required.');
    error.status = 400;
    throw error;
  }
  for (const [field, value, min, max] of [
    ['speed', speed, 0, 400], ['heading', heading, 0, 360], ['accuracy', accuracy, 0, 10000]
  ]) {
    if (value !== undefined && value !== null && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)) {
      const error = new Error(`${field} is outside the accepted range.`);
      error.status = 400;
      throw error;
    }
  }
  const assignment = await DriverVehicleAssignment.findOne({ driverId: driver.id, vehicleId, active: true });
  if (!assignment) {
    const error = new Error('No active vehicle assignment authorizes this location update.');
    error.status = 403;
    throw error;
  }
  const now = new Date();
  const activeBooking = await Booking.findOne({
    driverId: driver.id,
    vehicleId,
    status: { $in: activeTripStates }
  }).sort({ updatedAt: -1 });
  if (!driver.online && !activeBooking) {
    const error = new Error('Turn on location sharing before sending location updates.');
    error.status = 409;
    throw error;
  }

  const record = await DriverLocation.create({
    driverId: driver.id,
    vehicleId,
    fleetId: assignment.fleetId,
    bookingId: activeBooking?._id,
    latitude: coordinates[1],
    longitude: coordinates[0],
    location: { type: 'Point', coordinates },
    speed: speed == null ? undefined : Number(speed),
    heading: heading == null ? undefined : Number(heading),
    accuracy: accuracy == null ? undefined : Number(accuracy),
    timestamp: now
  });
  await Vehicle.updateOne({ _id: vehicleId, fleetId: assignment.fleetId }, {
    $set: {
      latestLocation: { type: 'Point', coordinates }, lastLocationAt: now,
      trackingStatus: activeBooking?.status === 'in_progress' ? 'on_trip' :
        activeBooking?.status === 'driver_arriving' ? 'to_pickup' : 'online'
    }
  });

  const update = {
    vehicleId: String(vehicleId),
    driverId: String(driver.id),
    latitude: coordinates[1],
    longitude: coordinates[0],
    speed: record.speed,
    heading: record.heading,
    accuracy: record.accuracy,
    timestamp: now.toISOString(),
    bookingId: activeBooking ? String(activeBooking.id) : undefined,
    bookingStatus: activeBooking?.status
  };
  io.to(`fleet:${assignment.fleetId}`).emit('fleet:vehicle:location', update);
  if (activeBooking) {
    io.to(`booking:${activeBooking.id}`).emit('trip:location:update', update);
    io.to(`booking:${activeBooking.id}`).emit('fleet:vehicle:location', update);
  }
  return record;
}

export { activeTripStates };
