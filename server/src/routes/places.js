import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { searchPlaces } from '../services/geocodingService.js';

const router = Router();

router.get('/search', rateLimit({ windowMs: 60 * 1000, limit: 20 }), async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3 || query.length > 120) return res.status(400).json({ message: 'Enter a location between 3 and 120 characters.' });
    return res.json({ places: await searchPlaces(query) });
  } catch (error) { return next(error); }
});

export default router;
