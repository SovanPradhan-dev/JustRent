import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { DriverProfile, DriverVehicleAssignment, Fleet, PricingConfiguration, PlatformSetting, User, Vehicle } from './models/index.js';

if (process.env.NODE_ENV !== 'development') throw new Error('Development seed data may only be created with NODE_ENV=development.');
if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12) throw new Error('Set SEED_PASSWORD to a password of at least 12 characters.');

await connectDatabase();

async function ensureUser(email, details) {
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email, password: process.env.SEED_PASSWORD, ...details });
  return user;
}

try {
  const admin = await ensureUser(process.env.SEED_ADMIN_EMAIL || 'admin@vehicleconnect.local', { name: 'Local Admin', role: 'admin' });
  const owner = await ensureUser(process.env.SEED_OWNER_EMAIL || 'owner@vehicleconnect.local', { name: 'Kolkata Fleet Owner', role: 'fleet_company' });
  const driver = await ensureUser(process.env.SEED_DRIVER_EMAIL || 'driver@vehicleconnect.local', { name: 'Sample Driver', role: 'driver' });
  let fleet = await Fleet.findOne({ ownerId: owner.id });
  if (!fleet) fleet = await Fleet.create({ name: 'Kolkata Sample Fleet', ownerId: owner.id, businessType: 'company', verificationStatus: 'approved' });
  owner.fleetId = fleet.id;
  await owner.save();
  driver.fleetId = fleet.id;
  await driver.save();
  await DriverProfile.findOneAndUpdate({ userId: driver.id }, { $setOnInsert: { verificationStatus: 'approved' } }, { upsert: true, new: true, setDefaultsOnInsert: true });

  let vehicle = await Vehicle.findOne({ fleetId: fleet.id, registrationNumber: 'WB01VC0001' });
  if (!vehicle) vehicle = await Vehicle.create({
    fleetId: fleet.id, registrationNumber: 'WB01VC0001', make: 'Sample Motors', model: 'Executive Sedan',
    category: 'sedan', seatingCapacity: 4, airConditioned: true, verificationStatus: 'approved'
  });
  let assignment = await DriverVehicleAssignment.findOne({ vehicleId: vehicle.id, active: true });
  if (!assignment) assignment = await DriverVehicleAssignment.create({ fleetId: fleet.id, vehicleId: vehicle.id, driverId: driver.id });
  vehicle.currentDriverId = driver.id;
  await vehicle.save();

  const exampleRates = { sedan: [150, 18, 200], suv: [220, 24, 300], muv: [280, 28, 380], tempo_traveller: [600, 40, 800], bus: [1200, 60, 1600], other: [200, 20, 250] };
  for (const [category, [baseFare, perKilometre, minimumFare]] of Object.entries(exampleRates)) {
    await PricingConfiguration.findOneAndUpdate(
      { category, serviceAreaId: { $exists: false } },
      { $setOnInsert: { category, currency: 'INR', baseFare, perKilometre, perMinute: 0, averageSpeedKph: 0, minimumFare, platformFee: 0, taxRate: 0, discount: 0, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  for (const [key, value] of [['publicBookingEnabled', false], ['complianceConfirmed', false], ['negotiatedPricingEnabled', false]]) {
    await PlatformSetting.findOneAndUpdate({ key }, { $setOnInsert: { value, updatedBy: admin.id } }, { upsert: true, setDefaultsOnInsert: true });
  }
  console.log(`Development seed ready. Login email(s): ${admin.email}, ${owner.email}, ${driver.email}`);
  console.log('Use SEED_PASSWORD for these local accounts; the driver must sign in and explicitly enable location sharing.');
} finally {
  await mongoose.disconnect();
}
