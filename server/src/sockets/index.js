import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { saveDriverLocation } from '../services/locationService.js';

export function attachSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('_id role fleetId status online');
      if (!user || user.status !== 'active') return next(new Error('Account unavailable.'));
      socket.data.user = user;
      return next();
    } catch {
      return next(new Error('Invalid or expired session.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.on('fleet:tracking:subscribe', async (payload = {}, acknowledge = () => {}) => {
      if (!['individual_owner', 'fleet_company'].includes(user.role) || String(user.fleetId) !== String(payload.fleetId)) {
        acknowledge({ error: 'Not authorized for this fleet.' });
        return;
      }
      await socket.join(`fleet:${user.fleetId}`);
      acknowledge({ ok: true });
    });
    socket.on('fleet:tracking:unsubscribe', async (payload = {}) => {
      if (String(user.fleetId) === String(payload.fleetId)) await socket.leave(`fleet:${user.fleetId}`);
    });
    socket.on('trip:tracking:subscribe', async (payload = {}, acknowledge = () => {}) => {
      const booking = await Booking.findById(payload.bookingId).select('passengerId fleetId driverId status');
      if (!booking) return acknowledge({ error: 'Booking not found.' });
      const permitted = String(booking.passengerId) === String(user.id) ||
        String(booking.driverId) === String(user.id) ||
        (['individual_owner', 'fleet_company'].includes(user.role) && String(booking.fleetId) === String(user.fleetId));
      if (!permitted || ['completed', 'cancelled', 'rejected', 'expired'].includes(booking.status)) {
        return acknowledge({ error: 'Not authorized for live trip tracking.' });
      }
      await socket.join(`booking:${booking.id}`);
      return acknowledge({ ok: true });
    });
    socket.on('driver:location:update', async (payload = {}, acknowledge = () => {}) => {
      if (user.role !== 'driver') return acknowledge({ error: 'Driver account required.' });
      try {
        await saveDriverLocation(user, payload, io);
        return acknowledge({ ok: true });
      } catch (error) {
        return acknowledge({ error: error.message });
      }
    });
  });
}
