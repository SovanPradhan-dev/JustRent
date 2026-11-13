import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowUpRight, CarFront, Check, ChevronDown, CircleAlert, Clock3, LocateFixed, MapPin, Navigation, Phone, Radio, RefreshCw, Search, Signal, SignalHigh, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import TileMap from '../../components/TileMap.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { api, getApiError } from '../../services/api.js';

const filters = ['All vehicles', 'Available', 'On trip', 'Idle', 'Offline', 'Location unavailable'];
const statusCopy = {
  online: ['Available', 'green'], to_pickup: ['Travelling to pickup', 'amber'], on_trip: ['On trip', 'blue'], stale: ['Location stale', 'amber'],
  offline: ['Offline', 'gray'], inactive: ['Inactive', 'gray']
};
const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function FleetTrackingPage() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('All vehicles');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyFrom, setHistoryFrom] = useState(dateInput(new Date(Date.now() - 86400000)));
  const [historyTo, setHistoryTo] = useState(dateInput(new Date()));
  const [historyError, setHistoryError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get('/fleets/me/vehicles/locations');
      setVehicles(data.vehicles);
      setSelectedId((previous) => previous || data.vehicles[0]?._id || '');
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!socket || !user?.fleetId) return undefined;
    socket.emit('fleet:tracking:subscribe', { fleetId: user.fleetId }, (response) => {
      if (response?.error) setError(response.error);
    });
    const updateLocation = (update) => setVehicles((current) => current.map((vehicle) => {
      if (vehicle._id !== update.vehicleId) return vehicle;
      return { ...vehicle, trackingStatus: update.bookingStatus === 'in_progress' ? 'on_trip' : update.bookingStatus === 'driver_arriving' ? 'to_pickup' : 'online', lastLocationAt: update.timestamp, location: update, latestLocation: { type: 'Point', coordinates: [update.longitude, update.latitude] } };
    }));
    const updateStatus = ({ vehicleId, trackingStatus }) => setVehicles((current) => current.map((vehicle) => vehicle._id === vehicleId ? { ...vehicle, trackingStatus } : vehicle));
    socket.on('fleet:vehicle:location', updateLocation);
    socket.on('fleet:vehicle:status', updateStatus);
    return () => {
      socket.emit('fleet:tracking:unsubscribe', { fleetId: user.fleetId });
      socket.off('fleet:vehicle:location', updateLocation);
      socket.off('fleet:vehicle:status', updateStatus);
    };
  }, [socket, user?.fleetId]);

  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const matchesText = `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model} ${vehicle.assignedDriver?.name || ''}`.toLowerCase().includes(search.toLowerCase());
    const onTrip = Boolean(vehicle.activeBooking);
    const statusMatches = filter === 'All vehicles' ||
      (filter === 'Available' && vehicle.trackingStatus === 'online' && !onTrip) ||
      (filter === 'On trip' && onTrip) ||
      (filter === 'Idle' && vehicle.trackingStatus === 'offline') ||
      (filter === 'Offline' && vehicle.trackingStatus === 'offline') ||
      (filter === 'Location unavailable' && ['stale', 'offline'].includes(vehicle.trackingStatus));
    return matchesText && statusMatches;
  }), [vehicles, search, filter]);
  const selected = vehicles.find((vehicle) => vehicle._id === selectedId);

  const loadHistory = async () => {
    if (!selected) return;
    setHistoryError('');
    try {
      const { data } = await api.get(`/vehicles/${selected._id}/location-history`, { params: { from: new Date(`${historyFrom}T00:00:00`).toISOString(), to: new Date(`${historyTo}T23:59:59`).toISOString() } });
      setHistory(data.locations);
      setHistoryOpen(true);
    } catch (requestError) { setHistoryError(getApiError(requestError)); }
  };

  const counts = {
    all: vehicles.length,
    online: vehicles.filter((vehicle) => vehicle.trackingStatus === 'online').length,
    trip: vehicles.filter((vehicle) => vehicle.activeBooking).length,
    stale: vehicles.filter((vehicle) => ['stale', 'offline'].includes(vehicle.trackingStatus)).length
  };

  return <div className="fleet-shell">
    <aside className="fleet-sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <div className="sidebar-account"><span className="account-avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><div><b>{user?.name}</b><small>{user?.role === 'individual_owner' ? 'Vehicle owner' : 'Fleet workspace'}</small></div><ChevronDown size={16} /></div>
      <span className="sidebar-caption">WORKSPACE</span>
      <nav className="fleet-nav">
        <Link to="/fleet/tracking" className="fleet-nav-item active"><Navigation size={18} /> Live Tracking <span className="nav-live-dot" /></Link>
        <Link to="/fleet/vehicles" className="fleet-nav-item"><CarFront size={18} /> Vehicles</Link>
        <Link to="/fleet/vehicles" className="fleet-nav-item muted-nav"><Users size={18} /> Drivers</Link>
        <Link to="/fleet/bookings" className="fleet-nav-item"><Activity size={18} /> Bookings</Link>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><CircleAlert size={18} /></span><b>Need a hand?</b><p>Our team is here to help your operation run smoothly.</p><a href="mailto:support@vehicleconnect.in">Contact support <ArrowUpRight size={14} /></a></div><button className="sidebar-logout" onClick={logout}><ArrowLeft size={16} /> Sign out</button><small>VEHICLE CONNECT · FLEET</small></div>
    </aside>
    <main className="fleet-main">
      <header className="fleet-topbar"><div><div className="breadcrumbs">Fleet workspace <span>/</span> <b>Live Tracking</b></div><h1>Live Tracking</h1></div><div className="topbar-actions"><span className="live-pill"><i /> Live updates</span><button className="icon-button" aria-label="Refresh vehicle locations" onClick={refresh}><RefreshCw size={17} /></button><span className="topbar-user">{user?.name?.slice(0,1).toUpperCase()}</span></div></header>
      {error && <div role="alert" className="notice-error"><CircleAlert size={17} /> {error}</div>}
      <div className="metric-row">
        <div className="metric-card"><span className="metric-icon slate"><CarFront size={18}/></span><div><small>Fleet vehicles</small><strong>{counts.all}</strong></div><span className="metric-foot">Registered</span></div>
        <div className="metric-card"><span className="metric-icon mint"><SignalHigh size={18}/></span><div><small>Available</small><strong>{counts.online}</strong></div><span className="metric-foot">Sharing location</span></div>
        <div className="metric-card"><span className="metric-icon blue"><Navigation size={18}/></span><div><small>On active trips</small><strong>{counts.trip}</strong></div><span className="metric-foot">Live journey</span></div>
        <div className="metric-card"><span className="metric-icon amber"><Signal size={18}/></span><div><small>Need attention</small><strong>{counts.stale}</strong></div><span className="metric-foot">Offline or stale</span></div>
      </div>
      <section className="tracking-workspace">
        <div className="vehicle-list-panel">
          <div className="panel-heading"><div><h2>Your vehicles</h2><span>{filteredVehicles.length} vehicles in view</span></div><span className="filter-count">{counts.all}</span></div>
          <div className="vehicle-search"><Search size={16}/><input aria-label="Search vehicles" placeholder="Search registration, model…" value={search} onChange={(event)=>setSearch(event.target.value)} /><span>/</span></div>
          <div className="filter-pills">{filters.map((item)=><button key={item} className={filter===item?'selected':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>
          <div className="vehicle-list">
            {loading ? <div className="list-loading"><span className="skeleton-line"/><span className="skeleton-line"/><span className="skeleton-line"/></div> : !filteredVehicles.length ? <div className="panel-empty"><CarFront size={22}/><b>No vehicles found</b><span>Try a different filter, or register your first vehicle.</span><Link to="/fleet/vehicles">Manage vehicles</Link></div> : filteredVehicles.map((vehicle)=>{
              const status = statusCopy[vehicle.trackingStatus] || statusCopy.inactive;
              return <button key={vehicle._id} onClick={()=>{setSelectedId(vehicle._id);setHistoryOpen(false);}} className={`vehicle-list-item ${selectedId===vehicle._id?'chosen':''}`}><span className={`vehicle-thumb ${status[1]}`}><CarFront size={19}/></span><span className="vehicle-row-copy"><b>{vehicle.registrationNumber || 'Unregistered vehicle'}</b><small>{vehicle.make} {vehicle.model} · {vehicle.seatingCapacity} seats</small><span className={`status-text ${status[1]}`}><i/>{vehicle.activeBooking?'On trip':status[0]}</span></span><ArrowUpRight size={15} className="row-chevron"/></button>;
            })}
          </div>
          <div className="list-legend"><span><i className="legend-dot green"/> Available</span><span><i className="legend-dot blue"/> On trip</span><span><i className="legend-dot amber"/> Stale</span></div>
        </div>
        <div className="map-panel">
          <div className="map-panel-top"><span><MapPin size={15}/> KOLKATA, WEST BENGAL</span><span className="map-live"><i/> Updating live</span></div>
          <TileMap vehicles={vehicles} selectedId={selectedId} onSelect={setSelectedId} focusVehicle={selected} history={history} />
        </div>
        <aside className={`vehicle-detail-panel ${historyOpen?'history-mode':''}`}>
          {selected ? <>
            <div className="detail-top"><div><span className="eyebrow">VEHICLE DETAILS</span><button className="detail-dismiss" aria-label="Close vehicle details" onClick={()=>setSelectedId('')}><X size={16}/></button></div><div className="detail-vehicle-title"><span className="detail-vehicle-image"><CarFront size={28}/></span><div><h2>{selected.registrationNumber}</h2><p>{selected.make} {selected.model}</p></div></div><span className={`detail-status ${statusCopy[selected.trackingStatus]?.[1] || 'gray'}`}><i/>{selected.activeBooking?(selected.activeBooking.status==='driver_arriving'?'Travelling to pickup':selected.activeBooking.status==='in_progress'?'On trip':'Booking assigned'):(statusCopy[selected.trackingStatus] || statusCopy.inactive)[0]}</span></div>
            <div className="detail-section"><span className="detail-label">ASSIGNED DRIVER</span>{selected.assignedDriver?<div className="driver-info"><span className="driver-avatar">{selected.assignedDriver.name?.slice(0,1)}</span><div><b>{selected.assignedDriver.name}</b><small>{selected.assignedDriver.online?'Online and sharing':'Currently offline'}</small></div>{selected.assignedDriver.phone&&<a href={`tel:${selected.assignedDriver.phone}`} className="phone-action" aria-label="Call assigned driver"><Phone size={16}/></a>}</div>:<p className="empty-detail">No driver currently assigned.</p>}</div>
            <div className="detail-section"><span className="detail-label">CURRENT LOCATION</span><div className="location-value"><MapPin size={17}/><span>{selected.location?`${selected.location.latitude.toFixed(5)}, ${selected.location.longitude.toFixed(5)}`:'Waiting for GPS location'}</span></div><div className="detail-meta"><span><Clock3 size={14}/> {selected.location?.timestamp||selected.lastLocationAt?new Date(selected.location?.timestamp||selected.lastLocationAt).toLocaleString():'No location update yet'}</span>{selected.location?.speed!=null&&<span><Activity size={14}/> {Math.round(selected.location.speed*3.6)} km/h</span>}</div></div>
            {selected.activeBooking&&<div className="detail-section trip-detail"><span className="detail-label">ACTIVE JOURNEY</span><div className="trip-route"><span className="route-start"/><div><b>{selected.activeBooking.pickup?.label||'Pickup location'}</b><span>Pickup · {selected.activeBooking.pickupAt?new Date(selected.activeBooking.pickupAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}</span></div></div><div className="trip-route"><span className="route-end"/><div><b>{selected.activeBooking.destination?.label||'Destination'}</b><span>Destination</span></div></div><span className="trip-status-label">Status · {selected.activeBooking.status?.replaceAll('_',' ')}</span></div>}
            <div className="detail-actions"><button className="button button-dark" onClick={async()=>{if(historyOpen){setHistoryOpen(false);return;}if(selected.activeBooking){try{const {data}=await api.get(`/trips/${selected.activeBooking._id}/route`);setHistory(data.locations);setHistoryOpen(true);setHistoryError('');}catch(e){setHistoryError(getApiError(e));}}else await loadHistory();}}><Activity size={16}/>{historyOpen?'Hide trip history':selected.activeBooking?'View complete trip':'Load location history'}</button><button className="button button-outline" onClick={()=>{const loc=selected.location||selected.latestLocation;if(loc?.coordinates){window.open(`https://www.openstreetmap.org/?mlat=${loc.coordinates[1]}&mlon=${loc.coordinates[0]}#map=16/${loc.coordinates[1]}/${loc.coordinates[0]}`,'_blank','noopener,noreferrer');}}}><LocateFixed size={16}/> Open coordinates in map</button></div>
            {historyError&&<div className="inline-error" role="alert">{historyError}</div>}
            <div className="history-picker"><div><b>Location history</b><small>View recorded route points for up to 31 days.</small></div><div className="history-dates"><label>From<input type="date" value={historyFrom} max={historyTo} onChange={(e)=>setHistoryFrom(e.target.value)}/></label><label>To<input type="date" value={historyTo} min={historyFrom} max={dateInput(new Date())} onChange={(e)=>setHistoryTo(e.target.value)}/></label><button onClick={loadHistory}>Show history</button></div></div>
          </>:<div className="panel-empty detail-empty"><CarFront size={26}/><b>Select a vehicle</b><span>Choose a vehicle from the list to see its live status and details.</span></div>}
        </aside>
      </section>
      <div className="fleet-footer"><span><Radio size={14}/> Precise driver locations are visible only to authorized fleet members.</span><Link to="/fleet/vehicles">Manage vehicles <ArrowUpRight size={14}/></Link></div>
    </main>
  </div>;
}
