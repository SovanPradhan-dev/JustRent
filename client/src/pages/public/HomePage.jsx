import { ArrowRight, BadgeCheck, CarFront, Check, ChevronDown, Clock3, MapPin, ShieldCheck, Sparkles, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowLink, Brand } from '../../components/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const categories = [
  { name: 'Executive sedan', desc: 'A considered choice for airport runs and city meetings.', image: 'photo-1552519507-da3b142c6e3d' },
  { name: 'Premium SUV', desc: 'Room to settle in, with space for people and luggage.', image: 'photo-1519641471654-76ce0107ad1b' },
  { name: 'Group travel', desc: 'Thoughtful travel for teams, families and every in-between.', image: 'photo-1544620347-c4fd4a3d5957' }
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;
  const [journey, setJourney] = useState({ pickup: '', destination: '', pickupAt: '', passengers: '1' });
  const searchJourney = (event) => {
    event.preventDefault();
    const params = new URLSearchParams(journey);
    navigate(`/passenger/search?${params.toString()}`);
  };
  return (
    <div className="min-h-screen bg-white">
      <header className="public-nav">
        <Brand />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#vehicles">Vehicles</a><a href="#how">How it works</a><Link to="/about">About</Link><a href="#fleet">For fleets</a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? <Link className="button button-dark !px-5 !py-2.5" to="/dashboard">My workspace <ArrowRight size={15} /></Link> : <><Link className="hidden text-sm font-semibold sm:inline" to="/login">Log in</Link><Link className="button button-dark !px-5 !py-2.5" to="/register">Get started <ArrowRight size={15} /></Link></>}
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-photo" />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="hero-kicker"><span className="h-2 w-2 rounded-full bg-brand" /> A better way to move</div>
            <h1>Every journey,<br /><span>thoughtfully</span> connected.</h1>
            <p>Chauffeur-driven travel, made more considered. Find the right vehicle, a trusted driver and a smoother way to get there.</p>
            <div className="flex flex-wrap gap-3"><a href="#book" className="button button-brand">Plan your journey <ArrowRight size={17} /></a><a href="#how" className="button button-glass">See how it works</a></div>
            <div className="hero-trust"><div className="avatar-stack"><span>R</span><span>A</span><span>S</span></div><div><div className="flex items-center gap-1 text-brand"><BadgeCheck size={14} /> Thoughtful journeys</div><small>Built around people, not just rides</small></div></div>
          </div>
          <form id="book" className="booking-card" onSubmit={searchJourney}>
            <div className="booking-title"><div><span className="eyebrow">YOUR NEXT JOURNEY</span><h2>Where to?</h2></div><span className="booking-icon"><MapPin size={20} /></span></div>
            <div className="journey-fields">
              <label><span>Pickup location</span><input required value={journey.pickup} onChange={(event)=>setJourney({...journey,pickup:event.target.value})} placeholder="Enter pickup point" /></label>
              <span className="route-line" />
              <label><span>Destination</span><input required value={journey.destination} onChange={(event)=>setJourney({...journey,destination:event.target.value})} placeholder="Where are you headed?" /></label>
            </div>
            <div className="booking-row">
              <label><span>Date & time</span><input required min={new Date().toISOString().slice(0,16)} value={journey.pickupAt} onChange={(event)=>setJourney({...journey,pickupAt:event.target.value})} type="datetime-local" /></label>
              <label><span>Passengers</span><select value={journey.passengers} onChange={(event)=>setJourney({...journey,passengers:event.target.value})}><option value="1">1 passenger</option><option value="2">2 passengers</option><option value="3">3 passengers</option><option value="4">4 passengers</option><option value="5">5+ passengers</option></select></label>
            </div>
            <button type="submit" className="button button-dark booking-submit">Find a vehicle <ArrowRight size={17} /></button>
            <p className="booking-note"><ShieldCheck size={14} /> Trusted fleets. Professional drivers. Clear journey details.</p>
          </form>
          <div className="hero-index">22°34′N &nbsp; 88°22′E <span>—&nbsp; KOLKATA, INDIA</span></div>
        </section>

        <section className="trust-strip"><span>Designed for the way you travel</span><div><BadgeCheck size={17} /> Verified fleet partners</div><div><ShieldCheck size={17} /> Professional drivers</div><div><Clock3 size={17} /> Your time, respected</div></section>

        <section id="vehicles" className="section-wrap">
          <div className="section-heading"><div><span className="eyebrow">THE RIGHT VEHICLE, EVERY TIME</span><h2>Space for the journey<br />you have in mind.</h2></div><ArrowLink to="/register">Explore the fleet</ArrowLink></div>
          <div className="category-grid">{categories.map((category, index) => <article className="category-card" key={category.name}><div className="category-image" style={{ backgroundImage: `url(https://images.unsplash.com/${category.image}?auto=format&fit=crop&w=1000&q=85)` }}><span>0{index + 1}</span></div><div className="category-copy"><div><h3>{category.name}</h3><p>{category.desc}</p></div><ArrowRight size={19} /></div></article>)}</div>
        </section>

        <section id="how" className="how-section"><div className="section-wrap"><div className="section-heading"><div><span className="eyebrow">SIMPLE BY DESIGN</span><h2>From the first detail<br />to the final destination.</h2></div><p className="section-intro">Good journeys have a way of making everything else feel a little easier.</p></div><div className="steps-grid">{[['01','Tell us what you need','Share your pickup, destination and when you want to travel.'],['02','Choose with confidence','Compare verified vehicles and find the right fit for your journey.'],['03','Enjoy the journey','Your professional driver takes care of the details along the way.']].map(([n,title,desc])=><article key={n}><span className="step-number">{n}</span><div className="step-rule" /><h3>{title}</h3><p>{desc}</p></article>)}</div></div></section>

        <section className="split-section"><div className="split-image" /><div className="split-copy"><span className="eyebrow">MORE THAN A MARKETPLACE</span><h2>Better journeys<br />start with trust.</h2><p>We bring people and professional fleets together with transparency, care and the freedom to choose what works for you.</p><ul><li><Check size={17} /> Verified vehicle and driver information</li><li><Check size={17} /> Clear details before you book</li><li><Check size={17} /> A real person, behind every journey</li></ul><ArrowLink to="/about">Get to know us</ArrowLink></div></section>

        <section id="fleet" className="fleet-cta"><div className="fleet-cta-art" /><div><span className="eyebrow">FOR FLEETS & VEHICLE OWNERS</span><h2>Your vehicles.<br />More opportunity.</h2><p>One place to manage vehicles, drivers, bookings and live operations—built for the people who keep every journey moving.</p><Link className="button button-brand" to="/register">Partner with us <ArrowRight size={17} /></Link></div><div className="cta-stat"><strong><Sparkles size={21} /></strong><span>Made for the people<br />behind the journey.</span></div></section>

        <section className="quote-section"><span className="eyebrow">A MORE HUMAN WAY TO MOVE</span><blockquote>Every journey deserves clear details, trusted people and the confidence that someone has thought it through.</blockquote><div className="quote-pips"><i /></div></section>

        <section className="faq-section"><div><span className="eyebrow">GOOD TO KNOW</span><h2>A few things<br />you might wonder.</h2><p>Still have a question? We’re happy to help.</p><Link to="/about" className="faq-link">Visit our help centre <ArrowRight size={15} /></Link></div><div className="faq-list">{[['What is Vehicle Connect?','A marketplace that connects passengers with verified commercial vehicle owners, fleets and professional drivers.'],['Where are you available?','We are beginning in Kolkata, West Bengal, with plans to grow alongside our partner fleets.'],['How do I become a fleet partner?','Register as an individual owner or fleet company to create your workspace and submit your details for review.'],['When can I book a vehicle?','Booking availability depends on approved local compliance, vehicle verification and service-area coverage.']].map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={18} /></summary><p>{a}</p></details>)}</div></section>
      </main>
      <footer className="public-footer"><div className="footer-main"><div><Brand inverse /><p>Thoughtful journeys. Trusted vehicles.<br />A better way to move, together.</p></div><div><b>Explore</b><Link to="/about">About us</Link><a href="#how">How it works</a><a href="#vehicles">Vehicles</a></div><div><b>Partner with us</b><Link to="/register">Vehicle owners</Link><Link to="/register">Fleet companies</Link><Link to="/register">Professional drivers</Link></div><div><b>Get in touch</b>{supportEmail?<a href={`mailto:${supportEmail}`}>{supportEmail}</a>:<span>Support contact details are being configured.</span>}<span>Kolkata, West Bengal</span></div></div><div className="footer-bottom"><span>© 2026 Vehicle Connect. Built around better journeys.</span><span>Privacy &nbsp;·&nbsp; Terms &nbsp;·&nbsp; Accessibility</span></div></footer>
    </div>
  );
}
