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
  const [payments,setPayments]=useState([]);
  const [error,setError]=useState('');
  const [paymentNotice,setPaymentNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const [paymentBusy,setPaymentBusy]=useState('');
  const load=useCallback(async()=>{try{const [{data:bookingData},{data:paymentData}]=await Promise.all([api.get('/bookings/mine'),api.get('/payments/mine')]);setBookings(bookingData.bookings);setPayments(paymentData.payments);}catch(e){setError(getApiError(e));}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const cancel=async(id)=>{if(!window.confirm('Cancel this booking request?'))return;try{await api.patch(`/bookings/${id}/status`,{status:'cancelled'});await load();}catch(e){setError(getApiError(e));}};
  const pay=async(booking)=>{
    setError('');setPaymentBusy(booking._id);
    try{
      const {data:order}=await api.post('/payments/orders',{bookingId:booking._id});
      if(!window.Razorpay){
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='https://checkout.razorpay.com/v1/checkout.js';
          script.onload=resolve;
          script.onerror=()=>reject(new Error('Payment checkout could not be loaded. Please try again later.'));
          document.body.appendChild(script);
        });
      }
      if(!window.Razorpay)throw new Error('Payment checkout is unavailable.');
      const checkout=new window.Razorpay({
        key:order.keyId,amount:order.amount,currency:order.currency,name:'Vehicle Connect',
        description:`Booking ${booking._id.slice(-8).toUpperCase()}`,order_id:order.orderId,
        prefill:{name:user?.name,email:user?.email,contact:user?.phone},
        handler:async(response)=>{
          try{
            const {data}=await api.post('/payments/verify',response);
            setPaymentNotice(data.status==='captured'?'Payment received and confirmed.':'Payment authorized; final confirmation is pending.');
            await load();
          }catch(e){setError(getApiError(e));}
          finally{setPaymentBusy('');}
        },
        modal:{ondismiss:()=>setPaymentBusy('')}
      });
      checkout.on('payment.failed',()=>{setError('Payment was not completed. You can retry from this booking.');setPaymentBusy('');});
      checkout.open();
    }catch(e){setError(getApiError(e));setPaymentBusy('');}
  };
  const paymentByBooking=new Map(payments.map((payment)=>[payment.bookingId,payment]));
  const payableStatuses=[...activeStatuses,'completed'];
  const active=bookings.find((booking)=>activeStatuses.includes(booking.status));
  return <div className="passenger-dashboard"><header className="passenger-dash-header"><Brand/><nav><Link to="/passenger">My journeys</Link><Link to="/passenger/search">Find a vehicle</Link></nav><div><button className="passenger-user-chip" onClick={logout}>{user?.name?.slice(0,1).toUpperCase()} <span>Sign out</span></button></div></header>
    <main className="passenger-dash-content"><div className="passenger-greeting"><div><span className="eyebrow">YOUR VEHICLE CONNECT</span><h1>Good journeys begin here, {user?.name?.split(' ')[0]}.</h1><p>Plan your next trip, keep an eye on an active ride, or revisit your recent journeys.</p></div><Link className="button button-dark" to="/passenger/search"><Plus size={16}/> Plan a journey</Link></div>
      {error&&<div role="alert" className="notice-error"><CircleAlert size={16}/>{error}</div>}
      {paymentNotice&&<div role="status" className="notice-success"><ShieldCheck size={16}/>{paymentNotice}</div>}
      <div className="passenger-stats"><div><span><CarFront size={17}/></span><small>Total journeys</small><b>{bookings.length}</b></div><div><span><Clock3 size={17}/></span><small>Active journeys</small><b>{bookings.filter((booking)=>activeStatuses.includes(booking.status)).length}</b></div><div><span><ShieldCheck size={17}/></span><small>Trusted fleets</small><b>Verified</b></div></div>
      {active&&<section className="active-journey-card"><div className="active-journey-heading"><div><span className="eyebrow">YOUR ACTIVE JOURNEY</span><h2>You’re all set.</h2><p>Your vehicle and driver details are available while this trip is active.</p></div><span className="active-status"><i/>{active.status.replaceAll('_',' ')}</span></div><div className="active-journey-route"><span><MapPin size={15}/><b>{active.pickup?.label}</b></span><ArrowRight size={15}/><span><MapPin size={15}/><b>{active.destination?.label}</b></span></div><div className="active-journey-footer"><span><CalendarDays size={15}/>{new Date(active.pickupAt).toLocaleString()}</span><Link className="button button-dark" to={`/passenger/tracking/${active._id}`}>Track your vehicle <ArrowRight size={15}/></Link></div></section>}
      <section className="passenger-booking-history"><div className="booking-history-head"><div><span className="eyebrow">YOUR TRAVEL, IN ONE PLACE</span><h2>Recent journeys</h2></div><Link to="/passenger/search">Plan a new journey <ArrowRight size={14}/></Link></div>
        {loading?<div className="passenger-empty-state">Loading your journeys…</div>:!bookings.length?<div className="passenger-empty-state"><span><CarFront size={22}/></span><b>Your next journey starts here.</b><p>Book a vehicle for your trip and all the details will be saved here.</p><Link className="button button-dark" to="/passenger/search">Find a vehicle <ArrowRight size={15}/></Link></div>:<div className="passenger-booking-list">{bookings.map((booking)=>{const payment=paymentByBooking.get(booking._id);return <article className="passenger-booking-row" key={booking._id}><span className="passenger-booking-icon"><CarFront size={18}/></span><div className="passenger-booking-route"><b>{booking.pickup?.label} <span>→</span> {booking.destination?.label}</b><small>{new Date(booking.pickupAt).toLocaleString()} · {booking.vehicleId?.registrationNumber||'Vehicle pending'}</small></div><span className={`passenger-booking-status ${booking.status}`}>{booking.status.replaceAll('_',' ')}</span>{activeStatuses.includes(booking.status)&&<Link className="row-action" to={`/passenger/tracking/${booking._id}`}>Track <ArrowRight size={14}/></Link>}{booking.status==='pending'&&<button className="cancel-booking" onClick={()=>cancel(booking._id)}>Cancel request</button>}{payment?.status==='captured'?<span className="booking-total">Paid · {payment.currency} {Number(payment.amount).toLocaleString('en-IN')}</span>:payment?.status==='authorized'?<span className="booking-total">Payment processing</span>:payableStatuses.includes(booking.status)?<button className="cancel-booking" disabled={paymentBusy===booking._id} onClick={()=>pay(booking)}>{paymentBusy===booking._id?'Opening checkout…':`Pay ${booking.fare?.currency||'INR'} ${Number(booking.fare?.total||0).toLocaleString('en-IN')}`}</button>:!activeStatuses.includes(booking.status)&&booking.status!=='pending'?<span className="booking-total">{booking.fare?.currency||'INR'} {Number(booking.fare?.total||0).toLocaleString('en-IN')}</span>:null}</article>})}</div>}
      </section>
    </main>
  </div>;
}
