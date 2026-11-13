import { useEffect, useState } from 'react';
import { ArrowLeft, CarFront, Clock3, MapPin, Navigation, Phone, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import TileMap from '../../components/TileMap.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { api, getApiError } from '../../services/api.js';

export default function PassengerTrackingPage() {
  const { bookingId } = useParams();
  const socket = useSocket();
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(`/bookings/${bookingId}`).then(({data})=>{
      if (!active) return;
      setBooking(data.booking);
      if (data.booking.vehicleId) api.get(`/vehicles/${data.booking.vehicleId._id}/location`).then((response)=>{
        if(active&&response.data.location)setVehicles([{...data.booking.vehicleId,...response.data.vehicle,location:response.data.location,trackingStatus:'on_trip'}]);
      }).catch((e)=>{if(active)setError(getApiError(e));});
    }).catch((e)=>{if(active)setError(getApiError(e));}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[bookingId]);
  useEffect(()=>{
    if(!socket||!bookingId)return undefined;
    socket.emit('trip:tracking:subscribe',{bookingId},(response)=>{if(response?.error)setError(response.error);});
    const update=(location)=>setVehicles((current)=>current.map((vehicle)=>({...vehicle,location,latestLocation:{type:'Point',coordinates:[location.longitude,location.latitude]}})));
    socket.on('trip:location:update',update);
    return ()=>{socket.off('trip:location:update',update);};
  },[socket,bookingId]);
  const vehicle=vehicles[0];
  if(loading)return <div className="tracking-loading">Loading your journey…</div>;
  return <div className="passenger-tracking"><header className="passenger-track-header"><Link to="/dashboard" className="back-home"><ArrowLeft size={16}/> My journeys</Link><Brand/><span className="track-protected"><ShieldCheck size={15}/> Private trip</span></header>
    {error&&<div role="alert" className="notice-error passenger-error">{error}</div>}
    {booking?<><div className="passenger-track-heading"><span className="eyebrow">YOUR JOURNEY · {booking.status?.replaceAll('_',' ').toUpperCase()}</span><h1>Your ride, in view.</h1><p>Only your assigned vehicle location is shared with you for this booking.</p></div><div className="passenger-track-layout"><section className="passenger-map-card"><TileMap vehicles={vehicles} selectedId={vehicle?._id} onSelect={()=>{}}/><div className="map-journey-note"><span className="live-pill"><i/> Live location</span><span>{vehicle?.location?.timestamp?`Updated ${new Date(vehicle.location.timestamp).toLocaleTimeString()}`:'Waiting for the driver’s first location update'}</span></div></section><aside className="passenger-ride-card"><span className="eyebrow">YOUR DRIVER</span>{booking.driverId?<div className="passenger-driver"><span className="driver-avatar">{booking.driverId.name?.slice(0,1)}</span><div><b>{booking.driverId.name}</b><small>Professional driver</small></div>{booking.driverId.phone&&<a href={`tel:${booking.driverId.phone}`} className="phone-action"><Phone size={16}/></a>}</div>:<p className="empty-detail">Your fleet is arranging a driver.</p>}<div className="passenger-vehicle"><span><CarFront size={20}/></span><div><b>{booking.vehicleId?.registrationNumber||'Vehicle assigned soon'}</b><small>{booking.vehicleId?.make} {booking.vehicleId?.model}</small></div></div><div className="journey-stops passenger-stops"><div className="journey-stop"><span className="stop-dot pickup"/><div><small>PICKUP</small><b>{booking.pickup?.label}</b></div></div><span className="journey-dash"/><div className="journey-stop"><span className="stop-dot destination"/><div><small>DESTINATION</small><b>{booking.destination?.label}</b></div></div></div><div className="passenger-arrival"><Clock3 size={16}/><span>Pickup at {new Date(booking.pickupAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div><div className="passenger-safety"><ShieldCheck size={16}/> Your live trip is visible only to you and your authorized fleet.</div></aside></div></>:<div className="passenger-no-booking"><CarFront size={30}/><h2>Journey unavailable</h2><p>{error||'This booking could not be found or you do not have permission to view it.'}</p><Link className="button button-dark" to="/dashboard">Back to dashboard</Link></div>}
  </div>;
}
