import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CarFront, CircleAlert, Clock3, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, getApiError } from '../../services/api.js';

const activeStatuses = ['confirmed','driver_accepted','driver_arriving','arrived','otp_verified','in_progress'];

export default function PassengerDashboard() {
  const {user,logout}=useAuth();
  const [bookings,setBookings]=useState([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{try{const {data}=await api.get('/bookings/mine');setBookings(data.bookings);}catch(e){setError(getApiError(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const cancel=async(id)=>{if(!window.confirm('Cancel this booking request?'))return;try{await api.patch(`/bookings/${id}/status`,{status:'cancelled'});await load();}catch(e){setError(getApiError(e));}};
  const active=bookings.find((booking)=>activeStatuses.includes(booking.status));
  return <div className="passenger-dashboard"><header className="passenger-dash-header"><Brand/><nav><Link to="/passenger">My journeys</Link><Link to="/passenger/search">Find a vehicle</Link></nav><div><button className="passenger-user-chip" onClick={logout}>{user?.name?.slice(0,1).toUpperCase()} <span>Sign out</span></button></div></header>
    <main className="passenger-dash-content"><div className="passenger-greeting"><div><span className="eyebrow">YOUR VEHICLE CONNECT</span><h1>Good journeys begin here, {user?.name?.split(' ')[0]}.</h1><p>Plan your next trip, keep an eye on an active ride, or revisit your recent journeys.</p></div><Link className="button button-dark" to="/passenger/search"><Plus size={16}/> Plan a journey</Link></div>
      {error&&<div role="alert" className="notice-error"><CircleAlert size={16}/>{error}</div>}
      <div className="passenger-stats"><div><span><CarFront size={17}/></span><small>Total journeys</small><b>{bookings.length}</b></div><div><span><Clock3 size={17}/></span><small>Active journeys</small><b>{bookings.filter((booking)=>activeStatuses.includes(booking.status)).length}</b></div><div><span><ShieldCheck size={17}/></span><small>Trusted fleets</small><b>Verified</b></div></div>
      {active&&<section className="active-journey-card"><div className="active-journey-heading"><div><span className="eyebrow">YOUR ACTIVE JOURNEY</span><h2>You’re all set.</h2><p>Your vehicle and driver details are available while this trip is active.</p></div><span className="active-status"><i/>{active.status.replaceAll('_',' ')}</span></div><div className="active-journey-route"><span><MapPin size={15}/><b>{active.pickup?.label}</b></span><ArrowRight size={15}/><span><MapPin size={15}/><b>{active.destination?.label}</b></span></div><div className="active-journey-footer"><span><CalendarDays size={15}/>{new Date(active.pickupAt).toLocaleString()}</span><Link className="button button-dark" to={`/passenger/tracking/${active._id}`}>Track your vehicle <ArrowRight size={15}/></Link></div></section>}
      <section className="passenger-booking-history"><div className="booking-history-head"><div><span className="eyebrow">YOUR TRAVEL, IN ONE PLACE</span><h2>Recent journeys</h2></div><Link to="/passenger/search">Plan a new journey <ArrowRight size={14}/></Link></div>
        {loading?<div className="passenger-empty-state">Loading your journeys…</div>:!bookings.length?<div className="passenger-empty-state"><span><CarFront size={22}/></span><b>Your next journey starts here.</b><p>Book a vehicle for your trip and all the details will be saved here.</p><Link className="button button-dark" to="/passenger/search">Find a vehicle <ArrowRight size={15}/></Link></div>:<div className="passenger-booking-list">{bookings.map((booking)=><article className="passenger-booking-row" key={booking._id}><span className="passenger-booking-icon"><CarFront size={18}/></span><div className="passenger-booking-route"><b>{booking.pickup?.label} <span>→</span> {booking.destination?.label}</b><small>{new Date(booking.pickupAt).toLocaleString()} · {booking.vehicleId?.registrationNumber||'Vehicle pending'}</small></div><span className={`passenger-booking-status ${booking.status}`}>{booking.status.replaceAll('_',' ')}</span>{activeStatuses.includes(booking.status)?<Link className="row-action" to={`/passenger/tracking/${booking._id}`}>Track <ArrowRight size={14}/></Link>:booking.status==='pending'?<button className="cancel-booking" onClick={()=>cancel(booking._id)}>Cancel request</button>:<span className="booking-total">{booking.fare?.currency||'INR'} {Number(booking.fare?.total||0).toLocaleString('en-IN')}</span>}</article>)}</div>}
      </section>
    </main>
  </div>;
}
