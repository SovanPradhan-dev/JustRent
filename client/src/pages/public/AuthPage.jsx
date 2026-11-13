import { useState } from 'react';
import { ArrowLeft, ArrowRight, CarFront, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getApiError } from '../../services/api.js';

const roleOptions = [
  ['passenger', 'Passenger'], ['individual_owner', 'Individual vehicle owner'], ['fleet_company', 'Fleet company'], ['driver', 'Professional driver']
];

export default function AuthPage({ register = false }) {
  const { login, register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ role: 'passenger' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      if (register) await signUp(form); else await login({ email: form.email, password: form.password });
      navigate(`${location.state?.from?.pathname || '/dashboard'}${location.state?.from?.search || ''}`, { replace: true });
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  };

  return <div className="auth-page"><div className="auth-image"><Link to="/" className="auth-brand"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-ink"><CarFront /></span><b>vehicle<span>connect</span></b></Link><div><span className="eyebrow">THOUGHTFUL JOURNEYS. TRUSTED PEOPLE.</span><h2>A better way<br />to move, together.</h2><p>Meaningful journeys begin with the right people—and the right vehicle.</p></div><div className="auth-note"><ShieldCheck size={18} /> Your information is protected.</div></div>
    <div className="auth-form-wrap"><Link to="/" className="back-home"><ArrowLeft size={16} /> Back to home</Link><div className="auth-form"><span className="eyebrow">{register ? 'WELCOME TO VEHICLE CONNECT' : 'WELCOME BACK'}</span><h1>{register ? 'Let’s get you started.' : 'Good to see you again.'}</h1><p>{register ? 'Create your account and find your place in the journey.' : 'Sign in to pick up where you left off.'}</p>
      <form onSubmit={submit}>
        {register && <><label>Your name<input name="name" autoComplete="name" required value={form.name || ''} onChange={update} placeholder="Full name" /></label><label>Account type<select name="role" value={form.role} onChange={update}>{roleOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{['individual_owner','fleet_company'].includes(form.role) && <label>Business or fleet name<input name="businessName" required value={form.businessName || ''} onChange={update} placeholder="Your fleet name" /></label>}<label>Phone number<input name="phone" type="tel" value={form.phone || ''} onChange={update} placeholder="+91 98765 43210" /></label></>}
        <label>Email address<input name="email" type="email" autoComplete="email" required value={form.email || ''} onChange={update} placeholder="you@example.com" /></label>
        <label>Password<div className="password-input"><input name="password" type={showPassword?'text':'password'} minLength={8} autoComplete={register?'new-password':'current-password'} required value={form.password || ''} onChange={update} placeholder={register?'At least 8 characters':'Your password'} /><button type="button" onClick={()=>setShowPassword((value)=>!value)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {error && <div role="alert" className="form-error">{error}</div>}
        <button disabled={busy} className="button button-dark auth-submit">{busy?'Please wait…':register?'Create your account':'Sign in'} <ArrowRight size={17} /></button>
      </form><div className="auth-switch">{register?'Already have an account?':'New to Vehicle Connect?'} <Link to={register?'/login':'/register'}>{register?'Sign in':'Create an account'}</Link></div><p className="auth-legal">By continuing, you agree to Vehicle Connect’s Terms of Service and Privacy Policy.</p>
    </div></div></div>;
}
