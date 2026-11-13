import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeoapifyUrl, normalizeGeoapifyResults } from './geocodingService.js';

test('Geoapify autocomplete is restricted to India and biased to Kolkata', () => {
  const url = createGeoapifyUrl('Park Street', 'test-key');
  assert.equal(url.hostname, 'api.geoapify.com');
  assert.equal(url.pathname, '/v1/geocode/autocomplete');
  assert.equal(url.searchParams.get('text'), 'Park Street, Kolkata, West Bengal, India');
  assert.equal(url.searchParams.get('filter'), 'countrycode:in');
  assert.equal(url.searchParams.get('bias'), 'proximity:88.3639,22.5726');
  assert.equal(url.searchParams.get('apiKey'), 'test-key');
});

test('Geoapify suggestions are normalized and invalid coordinates are discarded', () => {
  const places = normalizeGeoapifyResults({
    features: [
      { properties: { formatted: 'Park Street, Kolkata' }, geometry: { coordinates: [88.35, 22.55] } },
      { properties: { formatted: 'Invalid place' }, geometry: { coordinates: [200, 22] } },
      { properties: {}, geometry: { coordinates: [88, 22] } }
    ]
  });
  assert.deepEqual(places, [{ label: 'Park Street, Kolkata', latitude: 22.55, longitude: 88.35 }]);
  assert.throws(() => normalizeGeoapifyResults({ results: [] }), /invalid response/);
});
