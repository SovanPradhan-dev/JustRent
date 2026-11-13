import { ArrowUpRight, CarFront } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ inverse = false }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-ink'}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-ink"><CarFront size={21} strokeWidth={2.5} /></span>
      <span>vehicle<span className={inverse ? 'text-white/60' : 'text-slate-400'}>connect</span></span>
    </Link>
  );
}

export function ArrowLink({ to, children, inverse = false }) {
  return <Link to={to} className={`inline-flex items-center gap-2 text-sm font-bold ${inverse ? 'text-brand' : 'text-ink'} hover:gap-3 transition-all`}>{children}<ArrowUpRight size={16} /></Link>;
}
