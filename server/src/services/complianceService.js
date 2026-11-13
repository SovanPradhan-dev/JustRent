import { DriverDocument, DriverProfile, FleetDocument, VehicleDocument } from '../models/index.js';

async function hasApprovedDocument(Model, filter, expires) {
  const query = { ...filter, status: 'approved' };
  if (expires) query.expiresAt = { $gt: new Date() };
  return Boolean(await Model.exists(query));
}

export async function fleetComplianceApproved(fleet) {
  const required = ['owner_identity'];
  if (fleet.businessType === 'company') required.push('company_registration');
  for (const kind of required) {
    if (!(await hasApprovedDocument(FleetDocument, { fleetId: fleet.id, kind }, false))) return false;
  }
  return true;
}

export async function vehicleComplianceApproved(vehicleId) {
  const registration = await hasApprovedDocument(VehicleDocument, { vehicleId, kind: 'vehicle_registration' }, false);
  const insurance = await hasApprovedDocument(VehicleDocument, { vehicleId, kind: 'insurance' }, true);
  return registration && insurance;
}

export async function driverComplianceApproved(driverId) {
  const [profile, identity, license] = await Promise.all([
    DriverProfile.findOne({ userId: driverId, verificationStatus: 'approved' }).select('licenseExpiresAt'),
    hasApprovedDocument(DriverDocument, { driverId, kind: 'driver_identity' }, false),
    hasApprovedDocument(DriverDocument, { driverId, kind: 'driver_license' }, true)
  ]);
  return Boolean(profile?.licenseExpiresAt && profile.licenseExpiresAt > new Date() && identity && license);
}
