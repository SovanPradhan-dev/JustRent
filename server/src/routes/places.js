import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();
let nextAllowedAt = 0;
let queue = Promise.resolve();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

router.get('/search', rateLimit({ windowMs: 60 * 1000, limit: 20 }), async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3 || query.length > 120) return res.status(400).json({ message: 'Enter a location between 3 and 120 characters.' });
    const lookup = queue.then(async () => {
      const wait = Math.max(0, nextAllowedAt - Date.now());
      if (wait) await delay(wait);
      nextAllowedAt = Date.now() + 1100;
      const endpoint = process.env.GEOCODER_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
      const url = new URL(endpoint);
      url.search = new URLSearchParams({ q: `${query}, Kolkata, West Bengal, India`, format: 'jsonv2', limit: '5', countrycodes: 'in' }).toString();
      const response = await fetch(url, {
        headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'VehicleConnect/1.0', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        const error = new Error(`Location search provider returned ${response.status}.`);
        error.status = 502;
        throw error;
      }
      return (await response.json()).map((place) => ({
        label: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon)
      })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
    });
    queue = lookup.then(() => undefined, () => undefined);
    return res.json({ places: await lookup });
  } catch (error) { return next(error); }
});

export default router;
