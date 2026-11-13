import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionBooking } from './bookingRules.js';

test('booking progresses through the expected driver and passenger states', () => {
  const transitions = [
    ['pending', 'confirmed'],
    ['confirmed', 'driver_accepted'],
    ['driver_accepted', 'driver_arriving'],
    ['driver_arriving', 'arrived'],
    ['arrived', 'otp_verified'],
    ['otp_verified', 'in_progress'],
    ['in_progress', 'completed']
  ];
  for (const [from, to] of transitions) assert.equal(canTransitionBooking(from, to), true, `${from} -> ${to}`);
});

test('booking cannot skip pickup verification or leave a terminal state', () => {
  assert.equal(canTransitionBooking('arrived', 'in_progress'), false);
  assert.equal(canTransitionBooking('completed', 'cancelled'), false);
  assert.equal(canTransitionBooking('unknown', 'confirmed'), false);
});
