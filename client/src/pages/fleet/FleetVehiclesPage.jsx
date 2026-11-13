import { useEffect, useState } from 'react';
import { ArrowLeft, CarFront, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api, getApiError } from '../../services/api.js';

const emptyForm = { registrationNumber: '', make: '', model: '', category: 'sedan', seatingCapacity: 4, airConditioned: true };

export default function FleetVehiclesPage() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [driverEmails, setDriverEmails] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try { const {data}=await api.get('/vehicles/manage');setVehicles(data.vehicles); }
    catch(e){setError(getApiError(e));}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);
  const addVehicle = async (event) => {
    event.preventDefault();setBusy(true);setError('');
    try {await api.post('/vehicles',form);setForm(emptyForm);await load();}
    catch(e){setError(getApiError(e));}
    finally{setBusy(false);}
  };
  const assignDriver = async (vehicleId) => {
    setError('');
    try {await api.post(`/vehicles/${vehicleId}/assignment`,{driverEmail:driverEmails[vehicleId]});setDriverEmails((current)=>({...current,[vehicleId]:''}));await load();}
    catch(e){setError(getApiError(e));}
  };
  const deactivate = async (vehicleId) => {
    if (!window.confirm('Deactivate this vehicle? It will no longer be available for new operations.')) return;
    try {await api.delete(`/vehicles/${vehicleId}`);await load();}
    catch(e){setError(getApiError(e));}
  };

  return <div className="fleet-shell"><aside className="fleet-sidebar"><div className="sidebar-brand"><Brand/></div><div className="sidebar-account"><span className="account-avatar">{user?.name?.slice(0,1).toUpperCase()}</span><div><b>{user?.name}</b><small>Fleet workspace</small></div></div><span className="sidebar-caption">WORKSPACE</span><nav className="fleet-nav"><Link className="fleet-nav-item" to="/fleet/tracking"> <ArrowLeft size={18}/> Live Tracking</Link><Link className="fleet-nav-item active" to="/fleet/vehicles"><CarFront size={18}/> Vehicles</Link><Link className="fleet-nav-item" to="/fleet/bookings"><CarFront size={18}/> Bookings</Link></nav><div className="sidebar-bottom"><button className="sidebar-logout" onClick={logout}>Sign out</button><small>VEHICLE CONNECT · FLEET</small></div></aside>
    <main className="fleet-main"><header className="fleet-topbar"><div><div className="breadcrumbs">Fleet workspace <span>/</span> <b>Vehicles</b></div><h1>Vehicle management</h1></div><Link to="/fleet/tracking" className="button button-outline">Live tracking</Link></header>
      {error&&<div role="alert" className="notice-error">{error}</div>}
      <section className="vehicle-management-intro"><div><span className="eyebrow">YOUR FLEET</span><h2>Every vehicle, in one place.</h2><p>Register vehicles and assign a fleet driver to enable authorized GPS tracking.</p></div><span className="management-count">{vehicles.length} vehicles</span></section>
      <form className="vehicle-create-card" onSubmit={addVehicle}><div className="vehicle-create-title"><span><Plus size={18}/></span><div><h3>Add a vehicle</h3><p>New vehicles start in pending verification.</p></div></div><div className="vehicle-form-grid"><label>Registration number<input required value={form.registrationNumber} onChange={(e)=>setForm({...form,registrationNumber:e.target.value.toUpperCase()})} placeholder="WB 01 AB 1234"/></label><label>Make<input required value={form.make} onChange={(e)=>setForm({...form,make:e.target.value})} placeholder="Vehicle make"/></label><label>Model<input required value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})} placeholder="Vehicle model"/></label><label>Category<select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="muv">MUV</option><option value="tempo_traveller">Tempo traveller</option><option value="bus">Bus</option><option value="other">Other</option></select></label><label>Seats<input type="number" min="1" max="100" required value={form.seatingCapacity} onChange={(e)=>setForm({...form,seatingCapacity:Number(e.target.value)})}/></label><label className="checkbox-label"><input type="checkbox" checked={form.airConditioned} onChange={(e)=>setForm({...form,airConditioned:e.target.checked})}/> Air conditioned</label></div><button className="button button-dark" disabled={busy}>{busy?'Saving…':'Register vehicle'} <Plus size={16}/></button></form>
      <section className="managed-list"><div className="managed-list-title"><h2>Registered vehicles</h2><span>Vehicle verification is required before bookings are enabled.</span></div>{loading?<p>Loading vehicles…</p>:!vehicles.length?<div className="panel-empty"><CarFront/><b>No vehicles yet</b><span>Add your first vehicle using the form above.</span></div>:vehicles.map((vehicle)=><article key={vehicle._id} className="managed-vehicle-card"><span className="managed-car"><CarFront size={23}/></span><div className="managed-vehicle-name"><b>{vehicle.registrationNumber}</b><span>{vehicle.make} {vehicle.model} · {vehicle.seatingCapacity} seats · {vehicle.category.replaceAll('_',' ')}</span><small className={`verification ${vehicle.verificationStatus}`}>{vehicle.verificationStatus} verification</small></div><div className="assign-driver-form"><label>Assign driver by account email<input value={driverEmails[vehicle._id]||''} onChange={(e)=>setDriverEmails({...driverEmails,[vehicle._id]:e.target.value})} type="email" placeholder={vehicle.currentDriverId?'Change assigned driver':'driver@example.com'}/></label><button onClick={()=>assignDriver(vehicle._id)} disabled={!driverEmails[vehicle._id]}>Assign</button></div><button className="deactivate-button" aria-label={`Deactivate ${vehicle.registrationNumber}`} onClick={()=>deactivate(vehicle._id)}><Trash2 size={17}/></button></article>)}</section>
    </main></div>;
}
