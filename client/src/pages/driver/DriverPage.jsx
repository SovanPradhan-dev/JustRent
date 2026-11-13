import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Bell, CarFront, Check, Clock3, LocateFixed, MapPin, Navigation, Phone, Power, ShieldCheck, Signal, SignalHigh } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { api, getApiError } from '../../services/api.js';

const stateLabels = {
  offline: ['OFFLINE', 'gray'], online: ['ONLINE · SHARING GPS', 'green'],
  denied: ['LOCATION PERMISSION DENIED', 'red'], unavailable: ['GPS UNAVAILABLE', 'amber']
};

export default function DriverPage() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const watchId = useRef(null);
  const [driverData, setDriverData] = useState(null);
  const [trackingState, setTrackingState] = useState('offline');
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({licenseNumber:'',licenseExpiresAt:''});
  const [profileBusy, setProfileBusy] = useState(false);
  const [documentKind, setDocumentKind] = useState('driver_license');
  const [documentFile, setDocumentFile] = useState(null);
  const [documentExpiry, setDocumentExpiry] = useState('');

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/drivers/me').then(({data})=>{
      if (!active) return;
      setDriverData(data);
      if (data.driver.online) setTrackingState('online');
    }).catch((e)=>{if(active)setError(getApiError(e));}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;stopWatch();};
  }, [stopWatch]);
  useEffect(()=>{
    if(!socket)return undefined;
    const refresh=()=>api.get('/drivers/me').then(({data})=>setDriverData(data)).catch((e)=>setError(getApiError(e)));
    socket.on('booking:assigned',refresh);
    return()=>socket.off('booking:assigned',refresh);
  },[socket]);

  const sendPosition = useCallback(async (position, vehicleId) => {
    const coords = position.coords;
    const update = {
      vehicleId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed == null ? undefined : coords.speed,
      heading: coords.heading == null ? undefined : coords.heading,
      accuracy: coords.accuracy
    };
    setLocation({ ...update, timestamp: new Date(position.timestamp).toISOString() });
    try {
      await api.post('/locations/update', update);
      setError('');
      setTrackingState('online');
    } catch (requestError) {
      setError(`Location update was not accepted: ${getApiError(requestError)}`);
    }
  }, []);

  const beginWatch = useCallback((vehicleId) => {
    if (!navigator.geolocation) {
      setTrackingState('unavailable');
      setError('This browser does not support GPS location. Try a current browser on a device with location services enabled.');
      return;
    }
    stopWatch();
    watchId.current = navigator.geolocation.watchPosition(
      (position) => sendPosition(position, vehicleId),
      (geoError) => {
        stopWatch();
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setTrackingState('denied');
          setError('Location permission was denied. Allow location access in your browser settings, then choose Start sharing again.');
        } else {
          setTrackingState('unavailable');
          setError(geoError.code === geoError.TIMEOUT ? 'GPS did not respond in time. Check your location settings and try again.' : 'Your device could not determine a GPS location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, [sendPosition, stopWatch]);

  const toggleTracking = async () => {
    const assignment = driverData?.assignment;
    if (!assignment?.vehicleId?._id) {
      setError('You need a fleet vehicle assignment before enabling location sharing.');
      return;
    }
    setError('');
    setSharing(true);
    try {
      if (trackingState === 'online' && watchId.current !== null) {
        await api.patch('/drivers/availability', { online: false });
        stopWatch();
        setTrackingState('offline');
      } else {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
          setTrackingState('unavailable');
          setError('Location sharing requires a secure HTTPS connection.');
          return;
        }
        await api.patch('/drivers/availability', { online: true });
        setTrackingState('online');
        beginWatch(assignment.vehicleId._id);
      }
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setSharing(false); }
  };
  const updateBookingStatus = async (status) => {
    if (!activeBooking) return;
    setActionBusy(true);setError('');
    try {
      await api.patch(`/bookings/${activeBooking._id}/status`,{status});
      const {data}=await api.get('/drivers/me');
      setDriverData(data);
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setActionBusy(false); }
  };
  const saveProfile=async(event)=>{event.preventDefault();setProfileBusy(true);setError('');try{await api.patch('/drivers/me/profile',profileForm);const {data}=await api.get('/drivers/me');setDriverData(data);}catch(e){setError(getApiError(e));}finally{setProfileBusy(false);}};
  const uploadDriverDocument=async(event)=>{event.preventDefault();if(!documentFile){setError('Choose a document file to upload.');return;}const body=new FormData();body.append('document',documentFile);body.append('kind',documentKind);if(documentExpiry)body.append('expiresAt',documentExpiry);setError('');try{await api.post('/documents/driver',body,{headers:{'Content-Type':'multipart/form-data'}});setDocumentFile(null);event.currentTarget.reset();setError('Document uploaded for administrator review.');}catch(e){setError(getApiError(e));}};

  const assignment = driverData?.assignment;
  const status = stateLabels[trackingState] || stateLabels.offline;
  const activeBooking = driverData?.bookings?.find((booking) => ['confirmed', 'driver_accepted', 'driver_arriving', 'arrived', 'otp_verified', 'in_progress'].includes(booking.status));

  return <div className="driver-app"><header className="driver-topbar"><Brand/><div className="driver-top-actions"><span className="driver-greeting">Good day, {user?.name?.split(' ')[0]}</span><button aria-label="Sign out" className="icon-button" onClick={logout}><Power size={17}/></button></div></header>
    <main className="driver-content"><div className="driver-welcome"><div><span className="eyebrow">YOUR DRIVER APP</span><h1>Your day, in motion.</h1><p>Stay ready, keep your location sharing in your control.</p></div><div className={`driver-status-badge ${status[1]}`}><i/>{status[0]}</div></div>
      {error&&<div role="alert" className="driver-error"><AlertCircle size={18}/><span>{error}</span></div>}
      <section className="tracking-consent-card"><div className="consent-icon"><LocateFixed size={21}/></div><div className="consent-copy"><h2>Location sharing</h2><p>Your live location is shared with your assigned fleet while you are online, and with your passenger only during their active booking. You choose when to start and stop sharing. GPS is not collected when you are offline.</p><div className="consent-meta"><ShieldCheck size={15}/> Clear, authorized and in your control</div></div><button className={`tracking-toggle ${trackingState==='online'&&watchId.current!==null?'is-on':''}`} onClick={toggleTracking} disabled={sharing||!assignment}><span>{sharing?'Updating…':trackingState==='online'&&watchId.current!==null?'Stop sharing':'Start sharing'}</span><span className="toggle-knob">{trackingState==='online'&&watchId.current!==null?<Check size={14}/>:<Power size={14}/>}</span></button></section>
      {loading?<div className="driver-loading">Loading your workspace…</div>:<>
        <div className="driver-columns"><div className="driver-main-column">
          <section className="driver-card assigned-card"><div className="driver-card-heading"><div><span className="eyebrow">TODAY’S ASSIGNMENT</span><h2>Your vehicle</h2></div><span className="driver-card-icon"><CarFront size={20}/></span></div>{assignment?.vehicleId?<div className="assigned-vehicle"><div className="assigned-car-art"><CarFront size={38}/></div><div className="assigned-car-info"><b>{assignment.vehicleId.registrationNumber}</b><span>{assignment.vehicleId.make} {assignment.vehicleId.model}</span><small>{assignment.vehicleId.seatingCapacity} seats · {assignment.vehicleId.airConditioned?'Air conditioned':'Non-AC'}</small></div><span className="assignment-active"><i/> Assigned</span></div>:<div className="driver-empty"><CarFront size={24}/><b>No vehicle assignment yet</b><span>Your fleet owner can assign a vehicle to your driver account.</span></div>}</section>
          <section className="driver-card"><div className="driver-card-heading"><div><span className="eyebrow">DRIVER VERIFICATION</span><h2>License profile</h2></div><span className={`admin-status ${driverData?.profile?.verificationStatus||'pending'}`}>{driverData?.profile?.verificationStatus||'pending'}</span></div><form className="driver-profile-form" onSubmit={saveProfile}><label>Driver license number<input value={profileForm.licenseNumber} onChange={(e)=>setProfileForm({...profileForm,licenseNumber:e.target.value})} required maxLength={80}/></label><label>License expiry date<input type="date" min={new Date().toISOString().slice(0,10)} value={profileForm.licenseExpiresAt} onChange={(e)=>setProfileForm({...profileForm,licenseExpiresAt:e.target.value})} required/></label><button disabled={profileBusy}>{profileBusy?'Saving…':'Save license details'}</button></form><form className="driver-document-form" onSubmit={uploadDriverDocument}><label>Document type<select value={documentKind} onChange={(e)=>setDocumentKind(e.target.value)}><option value="driver_license">Driver license</option><option value="driver_identity">Driver identity</option><option value="other">Other required document</option></select></label><label>Document file<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e)=>setDocumentFile(e.target.files?.[0]||null)} required/></label>{documentKind==='driver_license'&&<label>Document expiry<input type="date" value={documentExpiry} onChange={(e)=>setDocumentExpiry(e.target.value)} required/></label>}<button>Upload for review</button></form><p className="document-security-note"><ShieldCheck size={14}/> Files are private and visible only to you and authorized administrators or fleet owners.</p></section>
          <section className="driver-card journey-card"><div className="driver-card-heading"><div><span className="eyebrow">{activeBooking?'CURRENT JOURNEY':'STAY READY'}</span><h2>{activeBooking?'Your active booking':'No active journey'}</h2></div><span className="driver-card-icon"><Navigation size={19}/></span></div>{activeBooking?<><div className="journey-stops"><div className="journey-stop"><span className="stop-dot pickup"/><div><small>PICKUP</small><b>{activeBooking.pickup?.label}</b></div></div><span className="journey-dash"/><div className="journey-stop"><span className="stop-dot destination"/><div><small>DESTINATION</small><b>{activeBooking.destination?.label}</b></div></div></div><div className="passenger-contact"><span className="passenger-avatar">{activeBooking.passengerId?.name?.slice(0,1)}</span><div><b>{activeBooking.passengerId?.name}</b><small>Passenger · {activeBooking.passengerCount} travelling</small></div>{activeBooking.passengerId?.phone&&<a href={`tel:${activeBooking.passengerId.phone}`}><Phone size={16}/> Call passenger</a>}</div><div className="driver-booking-status">Journey status: {activeBooking.status?.replaceAll('_',' ')}</div><div className="driver-trip-actions">{activeBooking.status==='confirmed'&&<button disabled={actionBusy} onClick={()=>updateBookingStatus('driver_accepted')}>Accept booking</button>}{activeBooking.status==='driver_accepted'&&<button disabled={actionBusy} onClick={()=>updateBookingStatus('driver_arriving')}>Head to pickup</button>}{activeBooking.status==='driver_arriving'&&<button disabled={actionBusy} onClick={()=>updateBookingStatus('arrived')}>Arrived at pickup</button>}{activeBooking.status==='arrived'&&<span>Ask your passenger for their six-digit pickup verification code.</span>}{activeBooking.status==='otp_verified'&&<button disabled={actionBusy} onClick={()=>updateBookingStatus('in_progress')}>Start trip</button>}{activeBooking.status==='in_progress'&&<button disabled={actionBusy} onClick={()=>updateBookingStatus('completed')}>Complete trip</button>}</div></>:<div className="driver-empty"><MapPin size={22}/><span>When your fleet assigns a booking, your pickup and destination will appear here.</span></div>}</section>
        </div><aside className="driver-side-column">
          <section className="driver-card gps-card"><span className="eyebrow">GPS STATUS</span><div className={`gps-state-icon ${status[1]}`}>{trackingState==='online'?<SignalHigh size={20}/>:<Signal size={20}/>}</div><h3>{trackingState==='online'?'Location sharing is on':trackingState==='denied'?'Permission needed':trackingState==='unavailable'?'GPS unavailable':'You’re offline'}</h3><p>{location?`Last update ${new Date(location.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Your position will update here when you start sharing.'}</p>{location&&<div className="gps-coordinates"><MapPin size={14}/>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</div>}<div className="gps-quality"><span><Clock3 size={14}/> {location?.accuracy?`±${Math.round(location.accuracy)}m accuracy`:'Waiting for GPS'}</span>{location?.speed!=null&&<span><Navigation size={14}/>{Math.round(location.speed*3.6)} km/h</span>}</div></section>
          <section className="driver-card safety-card"><span className="eyebrow">HERE FOR YOU</span><div className="safety-row"><span><Phone size={18}/></span><div><b>Need support?</b><small>We’re here to help on your shift.</small></div></div><a href="tel:+913300000000" className="support-call">Contact support <ArrowRight size={15}/></a><p className="emergency-note"><ShieldCheck size={14}/> For emergencies, contact local emergency services.</p></section>
        </aside></div>
        <section className="driver-card history-card"><div><span className="eyebrow">YOUR RECENT ACTIVITY</span><h2>Recent bookings</h2></div>{driverData?.bookings?.length?<div className="driver-booking-list">{driverData.bookings.slice(0,6).map((booking)=><div className="driver-booking-row" key={booking._id}><span className="booking-icon-small"><CarFront size={16}/></span><div><b>{booking.pickup?.label} <span>→</span> {booking.destination?.label}</b><small>{new Date(booking.pickupAt).toLocaleString()} · {booking.passengerId?.name}</small></div><span className={`booking-state ${booking.status}`}>{booking.status.replaceAll('_',' ')}</span></div>)}</div>:<div className="driver-empty"><Clock3 size={20}/><span>Completed and assigned journeys will appear here.</span></div>}</section>
      </>}
    </main>
    <footer className="driver-footer">Vehicle Connect Driver · Location is only shared when you choose to go online.</footer>
  </div>;
}
