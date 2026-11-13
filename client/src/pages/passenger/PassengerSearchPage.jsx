import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CarFront, Check, CircleAlert, LoaderCircle, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import { api, getApiError } from '../../services/api.js';

const futureDate = () => {
  const date = new Date(Date.now() + 3600000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

function PlaceField({ label, value, setValue, selected, setSelected, icon }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (value.trim().length < 3 || selected?.label === value) { setResults([]); setError(''); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const { data } = await api.get('/places/search', { params: { q: value } });
        if (active) setResults(data.places);
      } catch (requestError) { if (active) setError(getApiError(requestError)); }
      finally { if (active) setLoading(false); }
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [value, selected]);
  return <label className="place-field"><span>{icon}<b>{label}</b></span><input value={value} onChange={(event) => { setValue(event.target.value); setSelected(null); }} placeholder={`Search ${label.toLowerCase()}`} autoComplete="off" required /><i className={selected ? 'place-picked' : ''}>{selected ? <Check size={14}/> : loading ? <LoaderCircle size={14} className="spin"/> : null}</i>{error&&<small className="place-error">{error}</small>}{results.length>0&&<div className="place-suggestions">{results.map((place)=><button type="button" key={`${place.latitude}-${place.longitude}`} onClick={()=>{setSelected({label:place.label,coordinates:[place.longitude,place.latitude]});setValue(place.label);setResults([]);}}><MapPin size={14}/><span>{place.label}</span></button>)}</div>}</label>;
}

export default function PassengerSearchPage() {
  const [query] = useSearchParams();
  const [pickupText, setPickupText] = useState(query.get('pickup') || '');
  const [destinationText, setDestinationText] = useState(query.get('destination') || '');
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickupAt, setPickupAt] = useState(query.get('pickupAt') || futureDate());
  const [passengers, setPassengers] = useState(query.get('passengers') || '1');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [bookingBusy, setBookingBusy] = useState('');

  const filters = useMemo(() => ['','sedan','suv','muv','tempo_traveller','bus'], []);
  const search = async (event) => {
    event.preventDefault(); setError('');setMessage('');setResults([]);setBookingId('');setPickupCode('');
    if (!pickup || !destination) { setError('Choose both pickup and destination from the location suggestions.');return; }
    setSearching(true);
    try {
      const {data}=await api.get('/vehicles/search',{params:{pickupLng:pickup.coordinates[0],pickupLat:pickup.coordinates[1],destinationLng:destination.coordinates[0],destinationLat:destination.coordinates[1],passengers,category,pickupAt}});
      setResults(data.vehicles);
      if (!data.vehicles.length) setMessage('No verified, available vehicles match this journey right now.');
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setSearching(false); }
  };
  const book = async (item) => {
    setBookingBusy(item.vehicle._id);setError('');setMessage('');
    try {
      const {data}=await api.post('/bookings',{vehicleId:item.vehicle._id,type:'instant',pickup:{label:pickup.label,coordinates:pickup.coordinates},destination:{label:destination.label,coordinates:destination.coordinates},pickupAt,passengerCount:Number(passengers)});
      setBookingId(data.booking._id);setPickupCode(data.pickupCode);setMessage('Booking request sent. Your selected fleet will confirm the driver and vehicle assignment.');
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBookingBusy(''); }
  };

  return <div className="passenger-search-page"><header className="passenger-track-header"><Link to="/passenger" className="back-home"><ArrowLeft size={16}/> Dashboard</Link><Brand/><span className="track-protected"><ShieldCheck size={15}/> Verified fleets</span></header>
    <main className="passenger-search-content"><span className="eyebrow">A JOURNEY THAT FITS</span><h1>Find your vehicle.</h1><p className="search-page-lede">Choose your locations, tell us when you’re travelling, and we’ll show eligible vehicles with configured fare estimates.</p>
      <form className="journey-search-form" onSubmit={search}>
        <div className="search-location-grid"><PlaceField label="Pickup location" value={pickupText} setValue={setPickupText} selected={pickup} setSelected={setPickup} icon={<span className="place-dot pickup-dot"/>}/><span className="search-route-line"/><PlaceField label="Destination" value={destinationText} setValue={setDestinationText} selected={destination} setSelected={setDestination} icon={<span className="place-dot destination-dot"/>}/></div>
        <div className="search-options-grid"><label>Pickup date & time<input type="datetime-local" value={pickupAt} min={new Date().toISOString().slice(0,16)} onChange={(e)=>setPickupAt(e.target.value)} required/></label><label>Passengers<select value={passengers} onChange={(e)=>setPassengers(e.target.value)}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1} passenger{i===0?'':'s'}</option>)}</select></label><label>Vehicle category<select value={category} onChange={(e)=>setCategory(e.target.value)}>{filters.map((item)=><option key={item} value={item}>{item?item.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase()):'Any category'}</option>)}</select></label></div>
        <button className="button button-dark" disabled={searching}>{searching?<><LoaderCircle className="spin" size={16}/> Finding vehicles…</>:<><Search size={16}/> Find available vehicles</>}</button>
      </form>
      {error&&<div role="alert" className="notice-error search-notice"><CircleAlert size={16}/>{error}</div>}
      {message&&<div className={`search-result-notice ${pickupCode?'success':''}`}><Check size={17}/><div><b>{bookingId?'Your booking request is in':'Search complete'}</b><span>{message}</span>{pickupCode&&<><strong>Pickup verification code: {pickupCode}</strong><small>Keep this code private and share it with your driver only when you are at the pickup point.</small><Link to={`/passenger/tracking/${bookingId}`}>View booking details <ArrowRight size={14}/></Link></>}</div></div>}
      {!!results.length&&<section className="search-results"><div className="results-heading"><div><span className="eyebrow">AVAILABLE FOR YOUR JOURNEY</span><h2>{results.length} matching vehicle{results.length===1?'':'s'}</h2></div><span><Users size={15}/> {passengers} passengers</span></div>{results.map((item)=><article className="search-vehicle-card" key={item.vehicle._id}><div className="search-car-image"><CarFront size={34}/></div><div className="search-car-details"><span className="verified-label"><ShieldCheck size={13}/> Verified fleet</span><h3>{item.vehicle.make} {item.vehicle.model}</h3><p>{item.vehicle.category.replaceAll('_',' ')} · {item.vehicle.registrationNumber}</p><div className="search-feature-row"><span><Users size={13}/>{item.vehicle.seatingCapacity} seats</span><span>{item.vehicle.airConditioned?'Air conditioned':'Non-AC'}</span><span>{item.driver?.name} · driver online</span></div><small>{item.fleet?.name}</small></div><div className="search-fare"><span>ESTIMATED FARE</span><b>{item.fare.currency} {Number(item.fare.total).toLocaleString('en-IN',{maximumFractionDigits:2})}</b><small>Fare breakdown stored with booking</small><button className="button button-dark" disabled={Boolean(bookingBusy)||Boolean(bookingId)} onClick={()=>book(item)}>{bookingBusy===item.vehicle._id?'Sending…':'Book this vehicle'} <ArrowRight size={15}/></button></div></article>)}</section>}
    </main>
  </div>;
}
