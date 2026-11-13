import PlatformSetting from '../models/PlatformSetting.js';

export async function platformSetting(key, fallback = false) {
  const setting = await PlatformSetting.findOne({ key }).select('value');
  return setting ? setting.value : fallback;
}

export async function publicBookingsEnabled() {
  const [environmentEnabled, adminEnabled, complianceConfirmed] = await Promise.all([
    Promise.resolve(process.env.PUBLIC_BOOKING_ENABLED === 'true'),
    platformSetting('publicBookingEnabled'),
    platformSetting('complianceConfirmed')
  ]);
  return environmentEnabled && adminEnabled === true && complianceConfirmed === true;
}
