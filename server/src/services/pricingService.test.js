import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceInKilometres } from './pricingService.js';

test('distance estimates are based on coordinates, not client-supplied prices', () => {
  assert.equal(distanceInKilometres([88.3639, 22.5726], [88.3639, 22.5726]), 0);
  const oneDegreeAtEquator = distanceInKilometres([0, 0], [1, 0]);
  assert.ok(oneDegreeAtEquator > 111 && oneDegreeAtEquator < 112);
});
