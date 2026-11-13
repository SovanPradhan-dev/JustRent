import { useEffect, useState } from 'react';
import { ArrowLeft, CarFront, Check, Plus, ShieldCheck, Trash2 } from 'lucide-react';
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
  const [documents,setDocuments]=useState([]);
  const [fleetDocumentKind,setFleetDocumentKind]=useState('owner_identity');
  const [fleetDocumentFile,setFleetDocumentFile]=useState(null);
  const [uploading,setUploading]=useState(false);
  const [uploadMessage,setUploadMessage]=useState('');
  const load = async () => {
    try { const [vehicleResponse,documentResponse]=await Promise.all([api.get('/vehicles/manage'),api.get('/documents/mine')]);setVehicles(vehicleResponse.data.vehicles);setDocuments(documentResponse.data.documents); }
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
  const uploadFleetDocument=async(event)=>{event.preventDefault();if(!fleetDocumentFile)return;setUploading(true);setError('');setUploadMessage('');const body=new FormData();body.append('document',fleetDocumentFile);body.append('kind',fleetDocumentKind);try{await api.post('/documents/fleet',body,{headers:{'Content-Type':'multipart/form-data'}});setFleetDocumentFile(null);setUploadMessage('Fleet document uploaded for administrator review.');await load();}catch(e){setError(getApiError(e));}finally{setUploading(false);}};
  const uploadVehicleDocument=async(vehicleId,event)=>{event.preventDefault();const form=event.currentTarget;const file=form.elements.document.files[0];if(!file)return;const body=new FormData();body.append('document',file);body.append('kind',form.elements.kind.value);if(form.elements.expiresAt.value)body.append('expiresAt',form.elements.expiresAt.value);setError('');try{await api.post(`/documents/vehicles/${vehicleId}`,body,{headers:{'Content-Type':'multipart/form-data'}});form.reset();setUploadMessage('Vehicle document uploaded for administrator review.');await load();}catch(e){setError(getApiError(e));}};

  return <div className="fleet-shell"><aside className="fleet-sidebar"><div className="sidebar-brand"><Brand/></div><div className="sidebar-account"><span className="account-avatar">{user?.name?.slice(0,1).toUpperCase()}</span><div><b>{user?.name}</b><small>Fleet workspace</small></div></div><span className="sidebar-caption">WORKSPACE</span><nav className="fleet-nav"><Link className="fleet-nav-item" to="/fleet/tracking"> <ArrowLeft size={18}/> Live Tracking</Link><Link className="fleet-nav-item active" to="/fleet/vehicles"><CarFront size={18}/> Vehicles</Link><Link className="fleet-nav-item" to="/fleet/bookings"><CarFront size={18}/> Bookings</Link></nav><div className="sidebar-bottom"><button className="sidebar-logout" onClick={logout}>Sign out</button><small>VEHICLE CONNECT · FLEET</small></div></aside>
    <main className="fleet-main"><header className="fleet-topbar"><div><div className="breadcrumbs">Fleet workspace <span>/</span> <b>Vehicles</b></div><h1>Vehicle management</h1></div><Link to="/fleet/tracking" className="button button-outline">Live tracking</Link></header>
      {error&&<div role="alert" className="notice-error">{error}</div>}
      {uploadMessage&&<div className="search-result-notice success"><Check size={17}/><div><b>Upload received</b><span>{uploadMessage}</span></div></div>}
      <section className="vehicle-management-intro"><div><span className="eyebrow">YOUR FLEET</span><h2>Every vehicle, in one place.</h2><p>Register vehicles and assign a fleet driver to enable authorized GPS tracking.</p></div><span className="management-count">{vehicles.length} vehicles</span></section>
      <form className="vehicle-create-card" onSubmit={addVehicle}><div className="vehicle-create-title"><span><Plus size={18}/></span><div><h3>Add a vehicle</h3><p>New vehicles start in pending verification.</p></div></div><div className="vehicle-form-grid"><label>Registration number<input required value={form.registrationNumber} onChange={(e)=>setForm({...form,registrationNumber:e.target.value.toUpperCase()})} placeholder="WB 01 AB 1234"/></label><label>Make<input required value={form.make} onChange={(e)=>setForm({...form,make:e.target.value})} placeholder="Vehicle make"/></label><label>Model<input required value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})} placeholder="Vehicle model"/></label><label>Category<select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}><option value="sedan">Sedan</option><option value="suv">SUV</option><option value="muv">MUV</option><option value="tempo_traveller">Tempo traveller</option><option value="bus">Bus</option><option value="other">Other</option></select></label><label>Seats<input type="number" min="1" max="100" required value={form.seatingCapacity} onChange={(e)=>setForm({...form,seatingCapacity:Number(e.target.value)})}/></label><label className="checkbox-label"><input type="checkbox" checked={form.airConditioned} onChange={(e)=>setForm({...form,airConditioned:e.target.checked})}/> Air conditioned</label></div><button className="button button-dark" disabled={busy}>{busy?'Saving…':'Register vehicle'} <Plus size={16}/></button></form>
      <section className="vehicle-create-card"><div className="vehicle-create-title"><span><ShieldCheck size={18}/></span><div><h3>Fleet verification documents</h3><p>Upload an identity document and company registration where applicable.</p></div></div><form className="owner-document-form" onSubmit={uploadFleetDocument}><select value={fleetDocumentKind} onChange={(e)=>setFleetDocumentKind(e.target.value)}><option value="owner_identity">Owner identity</option><option value="company_registration">Company registration</option></select><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e)=>setFleetDocumentFile(e.target.files?.[0]||null)} required/><button className="button button-dark" disabled={uploading||!fleetDocumentFile}>{uploading?'Uploading…':'Upload document'}</button></form><div className="uploaded-document-list">{documents.filter((document)=>document.kind==='owner_identity'||document.kind==='company_registration').map((document)=><span key={document._id}>{document.kind.replaceAll('_',' ')} · {document.status}</span>)}</div></section>
      <section className="managed-list"><div className="managed-list-title"><h2>Registered vehicles</h2><span>Vehicle verification is required before bookings are enabled.</span></div>{loading?<p>Loading vehicles…</p>:!vehicles.length?<div className="panel-empty"><CarFront/><b>No vehicles yet</b><span>Add your first vehicle using the form above.</span></div>:vehicles.map((vehicle)=><article key={vehicle._id} className="managed-vehicle-card"><span className="managed-car"><CarFront size={23}/></span><div className="managed-vehicle-name"><b>{vehicle.registrationNumber}</b><span>{vehicle.make} {vehicle.model} · {vehicle.seatingCapacity} seats · {vehicle.category.replaceAll('_',' ')}</span><small className={`verification ${vehicle.verificationStatus}`}>{vehicle.verificationStatus} verification</small></div><div className="assign-driver-form"><label>Assign driver by account email<input value={driverEmails[vehicle._id]||''} onChange={(e)=>setDriverEmails({...driverEmails,[vehicle._id]:e.target.value})} type="email" placeholder={vehicle.currentDriverId?'Change assigned driver':'driver@example.com'}/></label><button onClick={()=>assignDriver(vehicle._id)} disabled={!driverEmails[vehicle._id]}>Assign</button></div><button className="deactivate-button" aria-label={`Deactivate ${vehicle.registrationNumber}`} onClick={()=>deactivate(vehicle._id)}><Trash2 size={17}/></button><form className="vehicle-doc-upload" onSubmit={(event)=>uploadVehicleDocument(vehicle._id,event)}><select name="kind" onChange={(event)=>{const expiry=event.currentTarget.form.elements.expiresAt;expiry.required=event.target.value!=='vehicle_registration';}}><option value="vehicle_registration">Registration</option><option value="insurance">Insurance</option><option value="commercial_permit">Commercial permit</option><option value="fitness">Fitness certificate</option><option value="pollution">Pollution certificate</option><option value="tax">Tax document</option></select><input name="document" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required/><input name="expiresAt" type="date" aria-label="Document expiry date"/><button>Upload document</button></form><div className="uploaded-document-list">{documents.filter((document)=>String(document.vehicleId?._id||document.vehicleId)===vehicle._id).map((document)=><span key={document._id}>{document.kind.replaceAll('_',' ')} · {document.status}</span>)}</div></article>)}</section>
    </main></div>;
}
