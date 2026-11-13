import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';

const TILE_SIZE = 256;
const DEFAULT_CENTER = { latitude: 22.5726, longitude: 88.3639 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function project(latitude, longitude, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin(clamp(latitude, -85.0511, 85.0511) * Math.PI / 180);
  return {
    x: (longitude + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  };
}

function unproject(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  return { latitude: 180 / Math.PI * Math.atan(Math.sinh(n)), longitude };
}

export default function TileMap({ vehicles = [], selectedId, onSelect, focusVehicle, focusRequest, history = [], pickupPoint, destinationPoint }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(12);
  const [drag, setDrag] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 700 });
  const surface = useRef(null);
  const width = dimensions.width;
  const height = dimensions.height;
  const centerPixel = project(center.latitude, center.longitude, zoom);
  const startX = Math.floor((centerPixel.x - width / 2) / TILE_SIZE);
  const startY = Math.floor((centerPixel.y - height / 2) / TILE_SIZE);
  const columns = Math.ceil(width / TILE_SIZE) + 2;
  const rows = Math.ceil(height / TILE_SIZE) + 2;
  const markers = useMemo(() => vehicles.map((vehicle) => {
    const latitude = vehicle.location?.latitude ?? vehicle.latestLocation?.coordinates?.[1];
    const longitude = vehicle.location?.longitude ?? vehicle.latestLocation?.coordinates?.[0];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const pixel = project(latitude, longitude, zoom);
    return { vehicle, x: pixel.x - centerPixel.x + width / 2, y: pixel.y - centerPixel.y + height / 2 };
  }).filter(Boolean), [vehicles, zoom, centerPixel.x, centerPixel.y, width, height]);
  const waypointPosition = (point) => {
    if (!point?.coordinates || point.coordinates.length !== 2) return null;
    const pixel = project(point.coordinates[1], point.coordinates[0], zoom);
    return { x: pixel.x - centerPixel.x + width / 2, y: pixel.y - centerPixel.y + height / 2 };
  };
  const pickupPosition = waypointPosition(pickupPoint);
  const destinationPosition = waypointPosition(destinationPoint);

  const reposition = (vehicle) => {
    const latitude = vehicle.location?.latitude ?? vehicle.latestLocation?.coordinates?.[1];
    const longitude = vehicle.location?.longitude ?? vehicle.latestLocation?.coordinates?.[0];
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) setCenter({ latitude, longitude });
  };
  useEffect(() => {
    if (focusVehicle) reposition(focusVehicle);
  }, [focusVehicle?._id, focusVehicle?.lastLocationAt, focusVehicle?.location?.timestamp, focusRequest]);
  useEffect(() => {
    if (!surface.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);

  const onPointerDown = (event) => {
    if (event.target.closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, pixel: centerPixel });
  };
  const onPointerMove = (event) => {
    if (!drag) return;
    setCenter(unproject(drag.pixel.x - (event.clientX - drag.x), drag.pixel.y - (event.clientY - drag.y), zoom));
  };

  return (
    <div ref={surface} className="tile-map" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      {Array.from({ length: columns * rows }, (_, index) => {
        const x = startX + index % columns;
        const y = startY + Math.floor(index / columns);
        const max = 2 ** zoom;
        const tileX = ((x % max) + max) % max;
        if (y < 0 || y >= max) return null;
        return <img key={`${zoom}-${x}-${y}`} className="map-tile" draggable="false" alt="" src={`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`} style={{ left: x * TILE_SIZE - centerPixel.x + width / 2, top: y * TILE_SIZE - centerPixel.y + height / 2 }} />;
      })}
      <svg className="map-overlay" viewBox={`0 0 ${width} ${height}`}>
        {history.length > 1 && <polyline points={history.map((point) => {
          const pixel = project(point.latitude, point.longitude, zoom);
          return `${pixel.x - centerPixel.x + width / 2},${pixel.y - centerPixel.y + height / 2}`;
        }).join(' ')} fill="none" stroke="#4355ee" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {markers.map(({ vehicle, x, y }) => (
        <button key={vehicle._id} type="button" aria-label={`${vehicle.registrationNumber} location`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelect?.(vehicle._id)} className={`map-marker ${vehicle.trackingStatus === 'on_trip' ? 'trip' : ''} ${vehicle.trackingStatus === 'to_pickup' ? 'to-pickup' : ''} ${vehicle.trackingStatus === 'stale' || vehicle.trackingStatus === 'offline' ? 'stale' : ''} ${selectedId === vehicle._id ? 'selected' : ''}`} style={{ left: x, top: y }}>
          <span className="marker-dot" /><span className="marker-label">{vehicle.registrationNumber}</span>
        </button>
      ))}
      {pickupPosition && <div className="map-waypoint pickup-waypoint" style={{ left: pickupPosition.x, top: pickupPosition.y }}><span>P</span><small>Pickup</small></div>}
      {destinationPosition && <div className="map-waypoint destination-waypoint" style={{ left: destinationPosition.x, top: destinationPosition.y }}><span>D</span><small>Destination</small></div>}
      <div className="map-controls">
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(18, value + 1))}><Plus size={18} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(3, value - 1))}><Minus size={18} /></button>
        <button type="button" aria-label="Center selected vehicle" onClick={() => selectedId && reposition(vehicles.find((vehicle) => vehicle._id === selectedId))}><LocateFixed size={18} /></button>
      </div>
      <div className="map-attribution">© OpenStreetMap contributors</div>
      {!markers.length && <div className="map-empty">Vehicle locations appear here when an assigned driver is online and sharing GPS.</div>}
    </div>
  );
}
