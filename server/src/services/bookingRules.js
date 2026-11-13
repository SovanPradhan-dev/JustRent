export const bookingTransitions = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['driver_accepted', 'cancelled'],
  driver_accepted: ['driver_arriving', 'cancelled'],
  driver_arriving: ['arrived', 'cancelled', 'no_show'],
  arrived: ['otp_verified', 'cancelled', 'no_show'],
  otp_verified: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'disputed'],
  completed: [],
  cancelled: [],
  rejected: [],
  expired: [],
  no_show: [],
  disputed: []
};

export function canTransitionBooking(from, to) {
  return bookingTransitions[from]?.includes(to) || false;
}
