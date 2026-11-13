import PricingConfiguration from '../models/PricingConfiguration.js';

export function distanceInKilometres(origin, destination) {
  const [longitude1, latitude1] = origin;
  const [longitude2, latitude2] = destination;
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function calculateFare(category, origin, destination, estimatedMinutes = 0) {
  const pricing = await PricingConfiguration.findOne({ category, active: true, serviceAreaId: { $exists: false } }).sort({ updatedAt: -1 });
  if (!pricing) {
    const error = new Error(`Pricing is not configured for the ${category} category.`);
    error.status = 503;
    throw error;
  }
  const distance = distanceInKilometres(origin, destination);
  const baseFare = pricing.baseFare;
  const distanceFare = distance * pricing.perKilometre;
  const timeFare = Math.max(0, estimatedMinutes) * pricing.perMinute;
  const platformFee = pricing.platformFee;
  const discount = pricing.discount;
  const subtotal = Math.max(pricing.minimumFare, baseFare + distanceFare + timeFare);
  const taxes = Math.max(0, subtotal + platformFee - discount) * pricing.taxRate;
  const total = Math.max(0, Math.round((subtotal + platformFee + taxes - discount) * 100) / 100);
  return {
    currency: pricing.currency, baseFare, distanceFare: Math.round(distanceFare * 100) / 100,
    timeFare: Math.round(timeFare * 100) / 100, waiting: 0, tolls: 0, parking: 0,
    taxes: Math.round(taxes * 100) / 100, platformFee, discount, total,
    distanceKilometres: Math.round(distance * 100) / 100
  };
}
