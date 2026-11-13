export class GeocodingError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GeocodingError';
    this.status = status;
  }
}

export function createGeoapifyUrl(query, apiKey) {
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.search = new URLSearchParams({
    text: `${query}, Kolkata, West Bengal, India`,
    filter: 'countrycode:in',
    bias: 'proximity:88.3639,22.5726',
    limit: '5',
    format: 'geojson',
    apiKey
  }).toString();
  return url;
}

export function normalizeGeoapifyResults(payload) {
  if (!Array.isArray(payload?.features)) throw new GeocodingError('Location search provider returned an invalid response.');
  return payload.features.map((feature) => {
    const coordinates = feature?.geometry?.coordinates;
    const latitude = Number(coordinates?.[1]);
    const longitude = Number(coordinates?.[0]);
    const label = feature?.properties?.formatted;
    return { label, latitude, longitude };
  }).filter((place) => typeof place.label === 'string' && place.label.length > 0 &&
    Number.isFinite(place.latitude) && place.latitude >= -90 && place.latitude <= 90 &&
    Number.isFinite(place.longitude) && place.longitude >= -180 && place.longitude <= 180);
}

export async function searchPlaces(query) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new GeocodingError('Location search is not configured. Set GEOAPIFY_API_KEY in server/.env.', 503);

  let response;
  try {
    response = await fetch(createGeoapifyUrl(query, apiKey), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new GeocodingError('The location search provider could not be reached.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new GeocodingError('The location provider rejected the request. Check the Geoapify API key and API access restrictions.', 502);
  }
  if (response.status === 429) throw new GeocodingError('Location search is temporarily rate-limited. Please try again shortly.', 503);
  if (!response.ok) throw new GeocodingError(`Location search provider returned ${response.status}.`);
  return normalizeGeoapifyResults(await response.json());
}
