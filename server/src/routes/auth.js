import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Fleet from '../models/Fleet.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const roles = ['passenger', 'individual_owner', 'fleet_company', 'driver'];

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, role, businessName } = req.body;
    if (!name || !email || !password || !roles.includes(role)) return res.status(400).json({ message: 'Name, email, password and a valid account type are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    const user = await User.create({ name, email, password, phone, role });
    if (role === 'individual_owner' || role === 'fleet_company') {
      const fleet = await Fleet.create({ name: businessName || name, ownerId: user.id, businessType: role === 'individual_owner' ? 'individual' : 'company' });
      user.fleetId = fleet.id;
      await user.save();
    }
    return res.status(201).json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, fleetId: user.fleetId } });
  } catch (error) { return next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.verifyPassword(req.body.password || ''))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    if (user.status !== 'active') return res.status(403).json({ message: 'This account has been suspended.' });
    return res.json({ token: createToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, fleetId: user.fleetId } });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

export default router;
