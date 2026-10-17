import { createContext, useContext, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider as RealClerkProvider, Show as RealShow, SignIn as RealSignIn, SignUp as RealSignUp, useClerk as useRealClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Compass, Menu, Minus, Plus, Send, ShieldCheck, Sparkles, Waves, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  getGetAdminOverviewQueryKey, getGetBookingQueryKey, getGetHotelQueryKey,
  getGetRoomTypeQueryKey, getGetRoomTypesQueryKey, getHealthCheckQueryKey,
  getListAdminBookingsQueryKey, getListMyBookingsQueryKey, useCancelBooking,
  useCreateBooking, useGetAdminOverview, useGetBooking, useGetHotel,
  useGetRoomType, useGetRoomTypes, useHealthCheck, useListAdminBookings,
  useListMyBookings, useSubmitContact, useSubscribeNewsletter,
} from '@workspace/api-client-react';
import type { Booking, BookingInput, GetRoomTypesParams, ListAdminBookingsParams, RoomType } from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';

function isValidClerkKey(key: string | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  if (!key.startsWith('pk_test_') && !key.startsWith('pk_live_')) return false;
  if (key.includes('REPLIT_MANAGED') || key.includes('placeholder')) return false;
  try {
    const raw = key.replace(/^pk_(test|live)_/, '');
    const decoded = atob(raw);
    return decoded.includes('.') && decoded.endsWith('$');
  } catch {
    return false;
  }
}

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
let clerkPubKey = '';
try {
  clerkPubKey = (rawClerkKey && typeof window !== 'undefined' ? publishableKeyFromHost(window.location.hostname, rawClerkKey) : rawClerkKey) || rawClerkKey;
} catch {
  clerkPubKey = rawClerkKey;
}
const hasValidClerk = isValidClerkKey(clerkPubKey);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

interface DemoUser {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryEmailAddress: { emailAddress: string };
  role: 'guest' | 'admin';
}

interface AuthContextType {
  user: DemoUser | null;
  isSignedIn: boolean;
  signInAsDemo: (role?: 'guest' | 'admin') => void;
  signOut: () => void;
  addListener: (listener: (emission: { user: DemoUser | null }) => void) => () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isSignedIn: false,
  signInAsDemo: () => {},
  signOut: () => {},
  addListener: () => () => {},
});

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(() => {
    try {
      const saved = localStorage.getItem('serein_demo_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const listenersRef = useRef<Set<(emission: { user: DemoUser | null }) => void>>(new Set());

  const notify = (newUser: DemoUser | null) => {
    listenersRef.current.forEach(cb => {
      try { cb({ user: newUser }); } catch {}
    });
  };

  const signInAsDemo = (role: 'guest' | 'admin' = 'guest') => {
    const newUser: DemoUser = {
      id: role === 'admin' ? 'demo-admin-1' : 'demo-guest-1',
      fullName: role === 'admin' ? 'Hotel Staff' : 'Aarav Patel',
      firstName: role === 'admin' ? 'Hotel' : 'Aarav',
      lastName: role === 'admin' ? 'Staff' : 'Patel',
      primaryEmailAddress: {
        emailAddress: role === 'admin' ? 'admin@theserein.com' : 'aarav.patel@example.com',
      },
      role,
    };
    try { localStorage.setItem('serein_demo_user', JSON.stringify(newUser)); } catch {}
    setUser(newUser);
    notify(newUser);
  };

  const signOut = () => {
    try { localStorage.removeItem('serein_demo_user'); } catch {}
    setUser(null);
    notify(null);
  };

  const addListener = (cb: (emission: { user: DemoUser | null }) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  };

  return (
    <AuthContext.Provider value={{ user, isSignedIn: !!user, signInAsDemo, signOut, addListener }}>
      {children}
    </AuthContext.Provider>
  );
}

function Show({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) {
  if (hasValidClerk) {
    return <RealShow when={when}>{children}</RealShow>;
  }
  const { isSignedIn } = useContext(AuthContext);
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  return null;
}

function useClerk() {
  if (hasValidClerk) {
    return useRealClerk();
  }
  const auth = useContext(AuthContext);
  return {
    user: auth.user,
    signOut: auth.signOut,
    addListener: auth.addListener,
  };
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#29483a', colorForeground: '#29483a', colorMutedForeground: '#6e776e',
    colorDanger: '#a6423d', colorBackground: '#fbf9f3', colorInput: '#fffdf8',
    colorInputForeground: '#29483a', colorNeutral: '#d8d1c3', fontFamily: 'DM Sans, sans-serif', borderRadius: '8px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f3] rounded-xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#29483a] font-serif', headerSubtitle: 'text-[#66736a]',
    socialButtonsBlockButtonText: 'text-[#29483a]', formFieldLabel: 'text-[#29483a]',
    footerActionLink: 'text-[#29483a]', footerActionText: 'text-[#66736a]',
    dividerText: 'text-[#66736a]', identityPreviewEditButton: 'text-[#29483a]',
    formFieldSuccessText: 'text-[#29483a]', alertText: 'text-[#29483a]',
    logoBox: 'rounded-md', logoImage: 'object-contain', socialButtonsBlockButton: 'border-[#d8d1c3]',
    formButtonPrimary: '!bg-[#29483a] text-white hover:!bg-[#203a2f] font-semibold', formFieldInput: 'border-[#d8d1c3] bg-[#fffdf8]',
    footerAction: 'text-[#66736a]', dividerLine: 'bg-[#d8d1c3]', alert: 'border-[#d8d1c3]',
    otpCodeFieldInput: 'border-[#d8d1c3]', formFieldRow: 'text-[#29483a]', main: 'text-[#29483a]',
  },
};

const images = {
  hero: '/serein-coast.jpg',
  room: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1400',
  dining: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1200',
  coast: 'https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg?auto=compress&cs=tinysrgb&w=1400',
};

function money(paise: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(BigInt(paise) / 100n);
}
function dateLabel(date: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}
function nights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000));
}
function nextDate(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

function ActionLink({ href, children, inverse = false }: { href: string; children: ReactNode; inverse?: boolean }) {
  return <Link href={href} className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] transition-colors ${inverse ? 'text-[#f7f2e8] hover:text-[#d9c69a]' : 'text-[#29483a] hover:text-[#8f7446]'}`}>{children}<ArrowUpRight size={14} aria-hidden="true" /></Link>;
}
function Button({ children, onClick, type = 'button', disabled = false, inverse = false, className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; inverse?: boolean; className?: string }) {
  return <button data-testid="button-action" type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 px-6 text-[11px] font-semibold uppercase tracking-[.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${inverse ? 'bg-[#f4f0e6] text-[#29483a] hover:bg-white' : 'bg-[#29483a] text-[#f8f5ed] hover:bg-[#203a2f]'} ${className}`}>{children}</button>;
}
function Header() {
  const [open, setOpen] = useState(false);
  const [path] = useLocation();
  const auth = useClerk();
  const user = auth?.user;
  const links = [['Stay', '/rooms'], ['Our story', '/about'], ['The table', '/dining'], ['Experiences', '/experiences'], ['Journal', '/gallery']];
  return <header className="relative z-30 bg-[#f7f4ec]">
    <div className="page-wrap flex h-[82px] items-center justify-between">
      <Link href="/" className="flex items-center gap-3 text-[#29483a]" aria-label="The Serein home">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b49a67] text-[15px] serif">S</span>
        <span><span className="block serif text-[20px] leading-none tracking-[.04em]">the serein</span><span className="mt-1 block text-[8px] uppercase tracking-[.25em]">Kerala · by the sea</span></span>
      </Link>
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} className="nav-link text-[11px] font-medium tracking-[.08em] text-[#45574c]" aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="hidden items-center gap-5 lg:flex">
        <Link href="/my-stays" className="text-[11px] tracking-[.05em] text-[#45574c] hover:text-[#29483a]">My stays</Link>
        {user ? (
          <button type="button" onClick={() => auth.signOut()} className="text-[11px] tracking-[.05em] text-[#45574c] hover:text-[#29483a]">Sign out</button>
        ) : (
          <Link href="/sign-in" className="text-[11px] tracking-[.05em] text-[#45574c] hover:text-[#29483a]">Sign in</Link>
        )}
        <Link href="/rooms" className="bg-[#29483a] px-5 py-3 text-[10px] uppercase tracking-[.16em] text-[#f8f5ed] transition-colors hover:bg-[#203a2f]">Find your quiet</Link>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center text-[#29483a] lg:hidden" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} data-testid="button-menu">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav className="absolute inset-x-0 top-full border-t border-[#e0dacd] bg-[#f7f4ec] px-6 py-5 shadow-lg lg:hidden" aria-label="Mobile navigation">
      {[...links, ['Facilities', '/facilities'], ['Offers', '/offers'], ['Contact', '/contact'], ['My stays', '/my-stays']].map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-[#e4ded2] py-3 text-sm text-[#29483a]">{label}</Link>)}
      {user ? (
        <button type="button" onClick={() => { auth.signOut(); setOpen(false); }} className="block w-full border-b border-[#e4ded2] py-3 text-left text-sm text-[#29483a]">Sign out</button>
      ) : (
        <Link href="/sign-in" onClick={() => setOpen(false)} className="block border-b border-[#e4ded2] py-3 text-sm text-[#29483a]">Sign in</Link>
      )}
      <Link href="/rooms" onClick={() => setOpen(false)} className="mt-5 block bg-[#29483a] p-4 text-center text-xs uppercase tracking-[.16em] text-[#f8f5ed]">Find your quiet</Link>
    </nav>}
  </header>;
}
function Footer() {
  const subscribe = useSubscribeNewsletter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setSent(false); subscribe.mutate({ data: { email } }, { onSuccess: () => { setSent(true); setEmail(''); } }); }
  return <footer className="bg-[#203a2f] text-[#f4f0e6]">
    <div className="page-wrap grid gap-12 py-16 md:grid-cols-[1.2fr_.8fr_1fr] md:py-20">
      <div><div className="serif text-3xl">the serein</div><p className="mt-4 max-w-sm text-sm leading-7 text-[#d2d5c9]">A small coastal sanctuary on Kerala’s quieter shore. Come for a while; leave a little more yourself.</p><p className="eyebrow mt-8 text-[#d5c195]">Marari coast · Kerala, India</p></div>
      <div><p className="eyebrow text-[#d5c195]">Wander</p><div className="mt-5 grid grid-cols-2 gap-y-3 text-sm text-[#e3e5dc]"><Link href="/rooms">Stay</Link><Link href="/about">Our story</Link><Link href="/dining">Dining</Link><Link href="/facilities">Facilities</Link><Link href="/experiences">Experiences</Link><Link href="/offers">Offers</Link><Link href="/gallery">Gallery</Link><Link href="/faq">FAQs</Link><Link href="/contact">Contact</Link></div></div>
      <div><p className="eyebrow text-[#d5c195]">A note from the coast</p><p className="mt-4 text-sm leading-6 text-[#d2d5c9]">Seasonal letters, local stories, and the occasional reason to return.</p><form onSubmit={submit} className="mt-4 flex border-b border-[#899288]"><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" data-testid="input-newsletter" type="email" required placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-[#c1c9bd] focus:outline-none" /><button data-testid="button-newsletter" aria-label="Subscribe" disabled={subscribe.isPending} className="px-2 text-[#d5c195] disabled:opacity-50"><Send size={16} /></button></form>{sent && <p role="status" className="mt-3 text-xs text-[#d5c195]">Thank you. You’re on the list.</p>}{subscribe.isError && <p role="alert" className="mt-3 text-xs text-[#efc2ba]">We couldn’t subscribe just now. Please try again.</p>}</div>
    </div>
    <div className="border-t border-[#526458]"><div className="page-wrap flex flex-col gap-3 py-5 text-xs text-[#c6cdc2] sm:flex-row sm:items-center sm:justify-between"><span>© The Serein, Kerala</span><div className="flex gap-5"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation">Cancellation</Link></div><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#bdc895]" />Open to the quiet</span></div></div>
  </footer>;
}
function Shell({ children }: { children: ReactNode }) { return <div className="min-h-[100dvh] bg-[#f7f4ec] text-[#29483a]"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to content</a><Header /><main id="main-content">{children}</main><Footer /></div>; }
function PageHeading({ kicker, title, intro }: { kicker: string; title: string; intro?: string }) { return <div className="page-wrap py-14 md:py-20"><p className="eyebrow text-[#8a764c]">{kicker}</p><h1 className="serif mt-4 max-w-4xl text-4xl leading-[1.12] text-[#29483a] md:text-6xl">{title}</h1>{intro && <p className="mt-5 max-w-2xl text-base leading-7 text-[#657268]">{intro}</p>}</div>; }
function QueryState({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: ReactNode }) {
  if (loading) return <div className="space-y-4" aria-label="Loading"><div className="skeleton h-48 w-full" /><div className="skeleton h-5 w-1/3" /><div className="skeleton h-4 w-2/3" /></div>;
  if (error) return <div className="border border-[#d8d1c3] bg-[#fbf9f3] px-6 py-10 text-center"><p className="serif text-2xl">The coast is a little quiet right now.</p><p className="mt-2 text-sm text-[#657268]">We couldn’t reach this information. Please try again.</p><button type="button" onClick={retry} className="mt-5 border-b border-[#29483a] pb-1 text-xs uppercase tracking-[.16em]">Try again</button></div>;
  return <>{children}</>;
}
function EmptyState({ title, children, href = '/rooms' }: { title: string; children: ReactNode; href?: string }) { return <div className="border border-[#d8d1c3] bg-[#fbf9f3] px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#b49a67] text-[#8a764c]"><Waves size={20} /></span><h2 className="serif mt-5 text-2xl">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#657268]">{children}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[.15em]">Explore the sanctuary <ArrowRight size={14} /></Link></div>; }

function HomePage() {
  const hotel = useGetHotel({ query: { queryKey: getGetHotelQueryKey() } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return <Shell>
    <section className="relative flex min-h-[620px] items-end overflow-hidden bg-[#253e35] md:min-h-[680px]">
      <div className="hero-image absolute inset-0 opacity-75" style={{ backgroundImage: `url(${images.hero})` }} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#14271f]/80 via-[#182920]/25 to-transparent" />
      <div className="page-wrap relative z-10 pb-14 pt-32 text-[#f7f2e8] md:pb-20">
        <div className="reveal max-w-3xl"><p className="eyebrow mb-7 text-[#dbc99d]">A coastal sanctuary · Kerala, India</p><h1 className="serif text-5xl leading-[1.07] md:text-[76px]">A softer kind<br />of somewhere.</h1><p className="mt-6 max-w-lg text-base leading-7 text-[#eee9dc] md:text-lg">{hotel.data?.tagline || 'Where the sea slows down, and so can you.'}</p><div className="mt-9 flex flex-wrap gap-4"><Link href="/rooms" className="bg-[#f4f0e6] px-7 py-4 text-[10px] uppercase tracking-[.18em] text-[#29483a] transition-colors hover:bg-white">Discover your stay <ArrowRight className="ml-3 inline" size={15} /></Link><Link href="/about" className="flex items-center gap-2 border border-white/60 px-6 py-4 text-[10px] uppercase tracking-[.18em] text-white hover:bg-white/10">Our story</Link></div></div>
        <div className="mt-16 flex items-center gap-3 text-[10px] uppercase tracking-[.2em] text-[#f0e9dc]"><span className="h-px w-10 bg-[#d5c195]" />Marari, in its own time <ArrowDown size={13} /></div>
      </div>
      <div className="absolute bottom-8 right-8 hidden items-center gap-2 text-[10px] uppercase tracking-[.18em] text-white/80 md:flex"><span className={`h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-[#dd9e8e]' : 'bg-[#d5c195]'}`} />{health.isError ? 'Reservations reconnecting' : 'A place to exhale'}</div>
    </section>
    <section className="page-wrap grid gap-12 py-20 md:grid-cols-[.85fr_1.15fr] md:py-28">
      <div><p className="eyebrow text-[#8a764c]">A different rhythm</p><h2 className="serif mt-5 text-4xl leading-tight md:text-5xl">Not a place to do more.<br /><i>A place to feel more.</i></h2></div>
      <div className="max-w-xl self-end"><p className="text-[15px] leading-8 text-[#5b6b60]">{hotel.data?.description || 'Tucked between a village and the Arabian Sea, The Serein is shaped by the slow, generous rhythm of the Malabar coast. Stay close to the water, eat what is in season, and let the hours arrive without a plan.'}</p><ActionLink href="/about">Meet the place</ActionLink></div>
    </section>
    <section className="grid min-h-[520px] md:grid-cols-2">
      <div className="hero-image min-h-[340px]" style={{ backgroundImage: `url(${images.coast})` }} aria-label="The Kerala shoreline" role="img" />
      <div className="flex flex-col justify-center bg-[#e9e4d8] px-8 py-16 md:px-16 lg:px-24"><p className="eyebrow text-[#8a764c]">Stay a little differently</p><h2 className="serif mt-5 max-w-lg text-4xl leading-tight md:text-5xl">Rooms made for the long pause.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#647166]">Barefoot comfort, handmade details, and the kind of morning light you find yourself remembering.</p><div className="mt-8"><ActionLink href="/rooms">Explore the rooms</ActionLink></div></div>
    </section>
    <section className="page-wrap py-20 md:py-28">
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="eyebrow text-[#8a764c]">Made of this place</p><h2 className="serif mt-4 text-4xl md:text-5xl">The coast, closer.</h2></div><ActionLink href="/experiences">All experiences</ActionLink></div>
      <div className="grid gap-7 md:grid-cols-3">
        {[{ n: '01', title: 'Morning, by water', body: 'Walk the fishing shore before the village stirs.', icon: <Waves /> }, { n: '02', title: 'At the Malabar table', body: 'A thoughtful plate, rooted in the season and its soil.', icon: <Sparkles /> }, { n: '03', title: 'The unhurried hour', body: 'Find your own small ritual under a palm canopy.', icon: <Compass /> }].map(item => <Link href={item.title.includes('table') ? '/dining' : '/experiences'} key={item.n} className="group border-t border-[#cfc7b8] py-6"><div className="flex items-center justify-between text-[#8a764c]"><span className="eyebrow">{item.n} / Serein days</span><span className="transition-transform group-hover:translate-x-1">{item.icon}</span></div><h3 className="serif mt-12 text-2xl">{item.title}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-[#657268]">{item.body}</p></Link>)}
      </div>
    </section>
    <section className="bg-[#29483a] py-20 text-[#f7f2e8] md:py-24"><div className="page-wrap grid gap-10 md:grid-cols-[1fr_auto] md:items-center"><div><p className="eyebrow text-[#d5c195]">A little room to breathe</p><h2 className="serif mt-4 max-w-2xl text-4xl md:text-5xl">Your days are waiting to be less full.</h2></div><Link href="/rooms" className="inline-flex h-14 items-center justify-center gap-3 bg-[#f4f0e6] px-7 text-[10px] uppercase tracking-[.17em] text-[#29483a] hover:bg-white">Find your dates <ArrowRight size={15} /></Link></div></section>
  </Shell>;
}

function AboutPage() { return <Shell><PageHeading kicker="A place with a pulse" title="The quiet is ours to share." intro="The Serein is a small retreat on the Marari coast, shaped with the people, flavours and landscapes that make this part of Kerala feel like nowhere else." />
  <section className="page-wrap grid gap-10 pb-20 md:grid-cols-[1fr_1fr] md:pb-28"><div className="hero-image min-h-[380px]" style={{ backgroundImage: `url(${images.coast})` }} /><div className="flex flex-col justify-center"><p className="eyebrow text-[#8a764c]">Between village and sea</p><h2 className="serif mt-4 text-4xl">A slower kind of welcome.</h2><p className="mt-5 text-sm leading-7 text-[#657268]">Here, hospitality is not a performance. It is a handpicked flower on the bedside table, a name remembered, a meal made with what the morning brought in. The Serein is built around that simple belief: the best luxury gives you space to notice.</p><p className="mt-4 text-sm leading-7 text-[#657268]">We are guests on this coast, and our care for it begins with listening—to our neighbours, to the tides, and to what the land can give without being asked for too much.</p><div className="mt-8"><ActionLink href="/experiences">Find your way here</ActionLink></div></div></section>
  <section className="bg-[#e9e4d8] py-16 md:py-20"><div className="page-wrap grid gap-10 md:grid-cols-3">{[['The shore', 'A quiet stretch of the Arabian Sea, just beyond the palms.'], ['The village', 'A living neighbourhood, not a view arranged for visitors.'], ['The table', 'Local harvests, the day’s catch, and a little curiosity.']].map(([h,b]) => <div key={h} className="border-t border-[#bfb7a8] pt-5"><p className="eyebrow text-[#8a764c]">Our sense of place</p><h3 className="serif mt-5 text-2xl">{h}</h3><p className="mt-3 text-sm leading-6 text-[#657268]">{b}</p></div>)}</div></section>
  <section className="page-wrap flex flex-col items-start justify-between gap-6 py-16 sm:flex-row sm:items-center"><div><p className="eyebrow text-[#8a764c]">Come find your quiet</p><h2 className="serif mt-3 text-3xl">The sea is not far.</h2></div><ActionLink href="/contact">Ask us anything</ActionLink></section>
</Shell>; }

function RoomCard({ room }: { room: RoomType }) {
  const photo = room.imageUrl || room.gallery?.[0] || images.room;
  return <article className="group grid overflow-hidden border border-[#ded8cc] bg-[#fbf9f3] md:grid-cols-[.95fr_1.05fr]" data-testid={`card-room-${room.id}`}>
    <Link href={`/rooms/${room.id}`} className="hero-image min-h-[260px] overflow-hidden bg-[#dfd8ca]" style={{ backgroundImage: `url(${photo})` }} aria-label={`View ${room.name}`} />
    <div className="flex flex-col justify-between p-6 md:p-8"><div><div className="flex items-center justify-between"><p className="eyebrow text-[#8a764c]">{room.category}</p><span className="text-xs text-[#657268]">{room.availableRooms} available</span></div><h2 className="serif mt-3 text-3xl">{room.name}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-[#657268]">{room.description}</p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#59695e]"><span>{room.sizeSqm} m²</span><span>{room.bed}</span><span>Up to {room.maxGuests} guests</span></div></div><div className="mt-8 flex items-end justify-between border-t border-[#e4ded2] pt-5"><div><span className="serif text-2xl">{money(room.pricePerNight, room.currency)}</span><span className="ml-1 text-xs text-[#657268]"> / night</span></div><ActionLink href={`/rooms/${room.id}`}>View this room</ActionLink></div></div>
  </article>;
}
function RoomsPage() {
  const params = new URLSearchParams(window.location.search);
  const [checkIn, setCheckIn] = useState(params.get('checkIn') || nextDate(30));
  const [checkOut, setCheckOut] = useState(params.get('checkOut') || nextDate(32));
  const [adults, setAdults] = useState(Number(params.get('adults') || 2));
  const [children, setChildren] = useState(Number(params.get('children') || 0));
  const [rooms, setRooms] = useState(Number(params.get('rooms') || 1));
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<GetRoomTypesParams>({});
  const query = useGetRoomTypes(filters, { query: { queryKey: getGetRoomTypesQueryKey(filters) } });
  function search(event: FormEvent) { event.preventDefault(); setFilters({ checkIn, checkOut, adults, children, rooms, ...(category ? { category } : {}), ...(minPrice ? { minPrice: Number.parseInt(minPrice, 10) * 100 } : {}), ...(maxPrice ? { maxPrice: Number.parseInt(maxPrice, 10) * 100 } : {}) }); setSearched(true); }
  const roomList = (query.data || []).filter(room => room.published);
  return <Shell><PageHeading kicker="Find your place" title="Stay close to the sea." intro="A handful of considered rooms. Each one has its own pace, its own patch of light, and room for the things you came here to feel." />
    <div className="page-wrap pb-16">
      <form onSubmit={search} className="grid gap-3 border border-[#d8d1c3] bg-[#eeeadf] p-4 md:grid-cols-6 md:p-5">
        <label className="text-[10px] uppercase tracking-[.14em] text-[#66736a]">Arrive<input data-testid="input-checkin" required type="date" min={nextDate(0)} value={checkIn} onChange={e => setCheckIn(e.target.value)} className="mt-2 block w-full border-0 border-b border-[#bfb7a8] bg-transparent py-2 text-sm text-[#29483a] focus:ring-0" /></label>
        <label className="text-[10px] uppercase tracking-[.14em] text-[#66736a]">Depart<input data-testid="input-checkout" required type="date" min={checkIn || nextDate(1)} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="mt-2 block w-full border-0 border-b border-[#bfb7a8] bg-transparent py-2 text-sm text-[#29483a]" /></label>
        <label className="text-[10px] uppercase tracking-[.14em] text-[#66736a]">Adults<input data-testid="input-adults" type="number" min="1" max="12" value={adults} onChange={e => setAdults(Number(e.target.value))} className="mt-2 block w-full border-0 border-b border-[#bfb7a8] bg-transparent py-2 text-sm" /></label>
        <label className="text-[10px] uppercase tracking-[.14em] text-[#66736a]">Children<input data-testid="input-children" type="number" min="0" max="12" value={children} onChange={e => setChildren(Number(e.target.value))} className="mt-2 block w-full border-0 border-b border-[#bfb7a8] bg-transparent py-2 text-sm" /></label>
        <label className="text-[10px] uppercase tracking-[.14em] text-[#66736a]">Rooms<input data-testid="input-rooms" type="number" min="1" max="8" value={rooms} onChange={e => setRooms(Number(e.target.value))} className="mt-2 block w-full border-0 border-b border-[#bfb7a8] bg-transparent py-2 text-sm" /></label>
        <Button type="submit" className="self-end" disabled={query.isFetching}>{query.isFetching ? 'Looking…' : 'Search dates'}<ArrowRight size={14} /></Button>
      </form>
      <div className="mt-10 grid gap-9 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-7 border-b border-[#d8d1c3] pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
          <div><p className="eyebrow text-[#8a764c]">Refine your stay</p><label className="mt-5 block text-xs text-[#657268]">Room style<select data-testid="select-category" value={category} onChange={e => setCategory(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-[#fbf9f3] px-3 py-3 text-sm"><option value="">Every room</option><option value="suite">Suite</option><option value="villa">Villa</option><option value="room">Room</option></select></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-[#657268]">From ₹<input data-testid="input-price-min" inputMode="numeric" type="number" step="1" min="0" placeholder="Any" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-[#fbf9f3] px-3 py-3 text-sm" /></label><label className="text-xs text-[#657268]">To ₹<input data-testid="input-price-max" inputMode="numeric" type="number" step="1" min="0" placeholder="Any" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-[#fbf9f3] px-3 py-3 text-sm" /></label></div>
          <Button className="w-full" onClick={() => setFilters({ checkIn, checkOut, adults, children, rooms, ...(category ? { category } : {}), ...(minPrice ? { minPrice: Number.parseInt(minPrice, 10) * 100 } : {}), ...(maxPrice ? { maxPrice: Number.parseInt(maxPrice, 10) * 100 } : {}) })}>Apply filters</Button>
          {searched && <button type="button" onClick={() => { setCategory(''); setMinPrice(''); setMaxPrice(''); setFilters({}); }} className="text-xs underline underline-offset-4">Clear filters</button>}
        </aside>
        <section aria-live="polite"><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow text-[#8a764c]">Your coastal hideaway</p><h2 className="serif mt-2 text-2xl">{query.isLoading ? 'Checking what’s possible' : `${roomList.length} ${roomList.length === 1 ? 'room' : 'rooms'} to consider`}</h2></div><span className="hidden text-xs text-[#657268] sm:block">{checkIn && checkOut ? `${dateLabel(checkIn)} — ${dateLabel(checkOut)}` : 'Choose your dates'}</span></div>
          <QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{roomList.length ? <div className="space-y-5">{roomList.map(room => <RoomCard key={room.id} room={room} />)}</div> : <EmptyState title="No rooms to show just yet">Availability is supplied live by our reservations team. Try another set of dates or check back shortly.</EmptyState>}</QueryState>
        </section>
      </div>
    </div>
  </Shell>;
}

function RoomDetailPage({ id }: { id: string }) {
  const room = useGetRoomType(id, { query: { queryKey: getGetRoomTypeQueryKey(id) } });
  const create = useCreateBooking();
  const client = useQueryClient();
  const [checkIn, setCheckIn] = useState(nextDate(30)); const [checkOut, setCheckOut] = useState(nextDate(32));
  const [adults, setAdults] = useState(2); const [children, setChildren] = useState(0); const [rooms, setRooms] = useState(1);
  const [guestName, setGuestName] = useState(''); const [guestEmail, setGuestEmail] = useState(''); const [guestPhone, setGuestPhone] = useState(''); const [specialRequests, setSpecialRequests] = useState('');
  const [created, setCreated] = useState<Booking | null>(null);
  function book(event: FormEvent) {
    event.preventDefault();
    const input: BookingInput = { roomTypeId: id, checkIn, checkOut, rooms, adults, children, guestName, guestEmail, guestPhone, specialRequests: specialRequests || undefined, idempotencyKey: crypto.randomUUID() };
    create.mutate({ data: input }, { onSuccess: booking => { setCreated(booking); client.invalidateQueries({ queryKey: getListMyBookingsQueryKey() }); client.invalidateQueries({ queryKey: getGetRoomTypesQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); client.invalidateQueries({ queryKey: getListAdminBookingsQueryKey() }); } });
  }
  return <Shell><div className="page-wrap pt-8"><Link href="/rooms" className="inline-flex items-center gap-2 text-xs uppercase tracking-[.14em]"><ArrowLeft size={14} /> All rooms</Link></div><QueryState loading={room.isLoading} error={room.isError} retry={() => room.refetch()}>{room.data && <><div className="page-wrap py-8"><div className="hero-image min-h-[300px] md:min-h-[520px]" style={{ backgroundImage: `url(${room.data.imageUrl || room.data.gallery?.[0] || images.room})` }} role="img" aria-label={room.data.name} /></div><div className="page-wrap grid gap-12 pb-20 lg:grid-cols-[1fr_390px]"><div><p className="eyebrow text-[#8a764c]">{room.data.category} · {room.data.sizeSqm} m²</p><h1 className="serif mt-3 text-4xl md:text-5xl">{room.data.name}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-[#657268]">{room.data.description}</p><div className="mt-7 flex flex-wrap gap-3 text-xs">{[room.data.bed, `Up to ${room.data.maxGuests} guests`, `${room.data.sizeSqm} m²`].map(item => <span key={item} className="border border-[#d8d1c3] px-4 py-3">{item}</span>)}</div><h2 className="serif mt-12 text-2xl">Thoughtful details</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{room.data.amenities.map(item => <p key={item} className="flex items-center gap-3 text-sm text-[#58685e]"><Check size={15} className="text-[#9c8250]" />{item}</p>)}</div></div>
      <form onSubmit={book} className="h-fit border border-[#d8d1c3] bg-[#fbf9f3] p-6"><div className="flex items-end justify-between border-b border-[#e4ded2] pb-5"><div><span className="serif text-2xl">{money(room.data.pricePerNight, room.data.currency)}</span><span className="text-xs text-[#657268]"> / night</span></div><span className="text-xs text-[#657268]">{room.data.availableRooms} available</span></div>
        {created ? <div role="status" className="py-6"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9e4d8] text-[#29483a]"><Check /></span><h2 className="serif mt-4 text-2xl">Your stay is on hold.</h2><p className="mt-2 text-sm leading-6 text-[#657268]">Reference {created.reference}. This booking is <strong>pending payment</strong>, not confirmed. We’ve held the room until {created.holdExpiresAt ? new Date(created.holdExpiresAt).toLocaleString('en-IN') : 'the hold expires'}.</p><Link href={`/booking/${created.id}/confirmation`} className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[.14em]">View booking details <ArrowRight size={14} /></Link></div> : <>
          <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-xs text-[#657268]">Arrive<input data-testid="booking-checkin" required type="date" min={nextDate(0)} value={checkIn} onChange={e => setCheckIn(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="text-xs text-[#657268]">Depart<input data-testid="booking-checkout" required type="date" min={checkIn} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label></div>
          <div className="mt-3 grid grid-cols-3 gap-3">{[['Adults', adults, setAdults, 1], ['Children', children, setChildren, 0], ['Rooms', rooms, setRooms, 1]].map(([label, value, setValue, min]) => <label key={String(label)} className="text-xs text-[#657268]">{String(label)}<input type="number" min={Number(min)} max={label === 'Rooms' ? 8 : 12} value={Number(value)} onChange={e => (setValue as (n:number)=>void)(Number(e.target.value))} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label>)}</div>
          <div className="mt-5 space-y-3"><label className="block text-xs text-[#657268]">Your name<input data-testid="booking-name" required minLength={2} value={guestName} onChange={e => setGuestName(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">Email address<input data-testid="booking-email" required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">Phone<input data-testid="booking-phone" required type="tel" minLength={6} value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">A note for us <span className="text-[#879086]">(optional)</span><textarea data-testid="booking-requests" rows={3} maxLength={1200} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label></div>
          {create.isError && <p role="alert" className="mt-4 text-sm text-[#a6423d]">We couldn’t place this booking. Your card has not been charged. Please check your details and try again.</p>}
          <Button type="submit" disabled={create.isPending || nights(checkIn, checkOut) < 1 || room.data.availableRooms < rooms} className="mt-5 w-full">{create.isPending ? 'Holding your room…' : 'Request this stay'}<ArrowRight size={14} /></Button>
          <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-[#68766c]"><ShieldCheck size={14} />A room hold is not a confirmation. Payment is not collected here.</p>
        </>}</form></div></>}</QueryState></Shell>;
}

function StaticPage({ kind }: { kind: string }) {
  const content: Record<string, { kicker: string; title: string; intro: string; sections: [string,string][] }> = {
    facilities: { kicker: 'A few good things', title: 'Space to settle in.', intro: 'Everything here is here for a reason: to make a stay feel easy, restorative, and connected to the coast.', sections: [['A pool made for the afternoon', 'A quiet freshwater pool sits beneath the palms, with space to read, float, or do very little.'], ['The small comforts', 'Thoughtfully tended gardens, shared spaces to gather, and corners that invite you to be alone.'], ['Wellbeing, your way', 'Ask our team about restorative treatments and gentle movement arranged around your time here.']] },
    dining: { kicker: 'The Serein table', title: 'Good food, from here.', intro: 'Malabar’s layered, generous food culture is our starting point. What arrives at the table changes with the season, the market, and the morning catch.', sections: [['The day’s catch', 'Fish brought in by local boats, simply cooked and paired with bright, fragrant coastal flavours.'], ['A slower breakfast', 'Fruit, warm breads, local coffee, and time enough for another cup.'], ['Gather around', 'Tell us what you love to eat. Our kitchen will do its best to make the moment yours.']] },
    experiences: { kicker: 'Find your own rhythm', title: 'A coast best met slowly.', intro: 'The most meaningful experiences here are not scheduled to the minute. They begin with curiosity and a local who knows the way.', sections: [['Walk the shore', 'Follow the waterline at first light, with a member of our team to introduce you to the coastal village.'], ['A Malabar kitchen', 'Meet the ingredients and traditions behind the dishes that find their way to our table.'], ['Take the long way', 'Discover nearby waterways and village life at a pace that leaves room for a pause.']] },
    offers: { kicker: 'A little more time', title: 'Stay for the feeling.', intro: 'Our seasonal invitations change with the coast. Speak to us about what is possible for your dates; availability is always confirmed by our reservations team.', sections: [['Longer, lighter stays', 'When you have the time to linger, ask our team about extended-stay arrangements.'], ['A first visit', 'Planning a first visit to the Malabar coast? We would love to help you shape a thoughtful stay.'], ['The right moment', 'Celebrating something quietly? Tell us what the occasion means to you.']] },
    gallery: { kicker: 'Field notes', title: 'Small moments, well kept.', intro: 'The light changes, the tide turns, and there is always another reason to look twice.', sections: [['01 — Shoreline', 'The sea in its many moods, from a silver morning to the last light of day.'], ['02 — The details', 'Handmade textures, shade under the palms, flowers from the garden.'], ['03 — Around the table', 'A place setting, a seasonal plate, and a seat saved for you.']] },
  };
  const info = content[kind] || content.facilities;
  return <Shell><PageHeading kicker={info.kicker} title={info.title} intro={info.intro} /><div className="page-wrap grid gap-10 pb-16 md:grid-cols-[1fr_.8fr] md:pb-24"><div className="hero-image min-h-[340px]" style={{ backgroundImage: `url(${kind === 'dining' ? images.dining : images.coast})` }} /><div className="flex flex-col justify-center gap-8">{info.sections.map(([title, body], i) => <article key={title} className="border-t border-[#d3ccbe] pt-5"><p className="eyebrow text-[#8a764c]">0{i + 1} / {info.kicker}</p><h2 className="serif mt-3 text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-[#657268]">{body}</p></article>)}</div></div><section className="bg-[#e9e4d8] py-14"><div className="page-wrap flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><p className="serif max-w-xl text-3xl">Have something specific in mind?</p><ActionLink href="/contact">Talk to our team</ActionLink></div></section></Shell>;
}

function ContactPage() {
  const contact = useSubmitContact(); const hotel = useGetHotel({ query: { queryKey: getGetHotelQueryKey() } }); const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setSent(false); contact.mutate({ data: { name: String(data.get('name')), email: String(data.get('email')), subject: String(data.get('subject')), message: String(data.get('message')) } }, { onSuccess: () => { setSent(true); form.reset(); } }); }
  return <Shell><PageHeading kicker="We’re listening" title="Start a conversation." intro="Planning a stay, wondering about the coast, or simply have a question? Write to us. A real person will get back to you." /><div className="page-wrap grid gap-12 pb-20 md:grid-cols-[.75fr_1.25fr] md:pb-28"><aside className="space-y-7"><div className="border-t border-[#d4ccbd] pt-5"><p className="eyebrow text-[#8a764c]">Call us</p><p className="mt-3 text-sm">{hotel.data?.phone || 'Please use the contact form'}</p></div><div className="border-t border-[#d4ccbd] pt-5"><p className="eyebrow text-[#8a764c]">Write to us</p><p className="mt-3 text-sm">{hotel.data?.email || 'Send a note using the form'}</p></div><div className="border-t border-[#d4ccbd] pt-5"><p className="eyebrow text-[#8a764c]">Find the coast</p><p className="mt-3 text-sm leading-6">{hotel.data?.location || 'The Malabar coast, Alappuzha, Kerala'}</p></div><p className="flex gap-3 text-sm leading-6 text-[#657268]"><Clock3 size={17} className="mt-1 shrink-0" />Our small reservations team is here every day, 9am–6pm IST.</p></aside>
    <div className="border border-[#d8d1c3] bg-[#fbf9f3] p-6 md:p-9">{sent ? <div role="status" className="py-12 text-center"><Check className="mx-auto text-[#8a764c]" size={28} /><h2 className="serif mt-4 text-3xl">Your note has found us.</h2><p className="mt-3 text-sm text-[#657268]">Thank you for writing. We’ll be in touch soon.</p><button type="button" onClick={() => setSent(false)} className="mt-6 text-xs uppercase tracking-[.15em] underline underline-offset-4">Send another note</button></div> : <form onSubmit={submit} className="space-y-5"><label className="block text-xs text-[#657268]">Your name<input data-testid="contact-name" required minLength={2} name="name" className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">Email address<input data-testid="contact-email" required type="email" name="email" className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">What can we help with?<input data-testid="contact-subject" required minLength={2} name="subject" className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label><label className="block text-xs text-[#657268]">Your message<textarea data-testid="contact-message" required minLength={5} maxLength={3000} rows={5} name="message" className="mt-2 w-full border border-[#d8d1c3] bg-transparent p-3 text-sm" /></label>{contact.isError && <p role="alert" className="text-sm text-[#a6423d]">Your message couldn’t be sent. Please try again or call us.</p>}<Button type="submit" disabled={contact.isPending}>{contact.isPending ? 'Sending your note…' : 'Send your note'}<ArrowRight size={14} /></Button></form>}</div></div></Shell>;
}
function FAQPage() { const items = [['When can I check in and out?', 'Check-in and check-out details are confirmed with your booking. Please contact our team if you need to plan around a particular arrival.'], ['Is a booking confirmed when I request a stay?', 'No. A booking request creates a temporary room hold and remains pending payment. It is not confirmed unless the booking status changes after the required payment flow.'], ['Can I change or cancel my booking?', 'Cancellation eligibility depends on the booking and its terms. Sign in to view your stay and request cancellation when available, or contact our team.'], ['Are children welcome?', 'Of course. Please include the number of adults and children when you search so we can guide you to a comfortable room.'], ['How do I reach the sanctuary?', 'We are on the Marari coast in Alappuzha, Kerala. Write to our team for directions and help planning your journey.'], ['Can you accommodate dietary needs?', 'Tell us about your dietary needs when you write to us. Our kitchen will do its best to guide you.']]; return <Shell><PageHeading kicker="A few answers" title="The useful details." intro="If there’s something we haven’t covered, our team is only a note away." /><section className="page-wrap max-w-4xl pb-20">{items.map(([q,a],i) => <details key={q} className="group border-t border-[#d4ccbd] py-6" open={i === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span className="serif text-xl">{q}</span><Plus className="shrink-0 text-[#8a764c] group-open:hidden" size={19} /><Minus className="hidden shrink-0 text-[#8a764c] group-open:block" size={19} /></summary><p className="mt-4 max-w-2xl text-sm leading-7 text-[#657268]">{a}</p></details>)}<div className="mt-10 bg-[#e9e4d8] p-7"><p className="serif text-2xl">Still wondering?</p><p className="mt-2 text-sm text-[#657268]">We’re happy to help you plan the quieter details.</p><div className="mt-4"><ActionLink href="/contact">Get in touch</ActionLink></div></div></section></Shell>; }

function BookingSummary({ booking }: { booking: Booking }) {
  return <div className="border border-[#d8d1c3] bg-[#fbf9f3] p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-[#8a764c]">Reference {booking.reference}</p><h2 className="serif mt-2 text-2xl">{booking.roomName}</h2></div><span className={`px-3 py-2 text-[10px] uppercase tracking-[.12em] ${booking.status === 'CONFIRMED' ? 'bg-[#e5eadf] text-[#29483a]' : booking.status === 'PENDING_PAYMENT' ? 'bg-[#efe8d7] text-[#715d34]' : 'bg-[#eee1dd] text-[#854b43]'}`}>{booking.status.replaceAll('_', ' ')}</span></div><div className="mt-6 grid gap-4 border-t border-[#e4ded2] pt-5 sm:grid-cols-3"><div><p className="eyebrow text-[#8a764c]">Arrive</p><p className="mt-2 text-sm">{dateLabel(booking.checkIn)}</p></div><div><p className="eyebrow text-[#8a764c]">Depart</p><p className="mt-2 text-sm">{dateLabel(booking.checkOut)}</p></div><div><p className="eyebrow text-[#8a764c]">Guests</p><p className="mt-2 text-sm">{booking.adults} adults{booking.children ? ` · ${booking.children} children` : ''} · {booking.rooms} {booking.rooms === 1 ? 'room' : 'rooms'}</p></div></div><div className="mt-5 flex items-center justify-between border-t border-[#e4ded2] pt-5"><span className="text-sm text-[#657268]">Total stay amount</span><span className="serif text-xl">{money(booking.totalAmount, booking.currency)}</span></div>{booking.status === 'PENDING_PAYMENT' && <p className="mt-4 bg-[#f0eadb] p-4 text-sm leading-6 text-[#675a3c]">This stay is pending payment and has not been confirmed. {booking.holdExpiresAt ? `Your room hold expires ${new Date(booking.holdExpiresAt).toLocaleString('en-IN')}.` : ''}</p>}</div>;
}
function MyStaysPage() {
  const stays = useListMyBookings({ query: { queryKey: getListMyBookingsQueryKey() } });
  const cancel = useCancelBooking(); const client = useQueryClient(); const [cancelId, setCancelId] = useState('');
  function cancelStay(id: string) { if (!window.confirm('Would you like to request cancellation of this stay?')) return; setCancelId(id); cancel.mutate({ bookingId: id }, { onSuccess: booking => { client.setQueryData(getGetBookingQueryKey(id), booking); client.invalidateQueries({ queryKey: getListMyBookingsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); client.invalidateQueries({ queryKey: getListAdminBookingsQueryKey() }); }, onSettled: () => setCancelId('') }); }
  return <Shell><PageHeading kicker="Your time at The Serein" title="My stays." intro="A quiet place to keep the details of your time with us." /><section className="page-wrap pb-20"><QueryState loading={stays.isLoading} error={stays.isError} retry={() => stays.refetch()}>{stays.data?.length ? <div className="space-y-5">{stays.data.map(booking => <article key={booking.id}><BookingSummary booking={booking} /><div className="flex flex-wrap gap-5 pt-4"><Link href={`/bookings/${booking.id}`} className="text-xs uppercase tracking-[.13em] underline underline-offset-4">View details</Link>{booking.status !== 'CANCELLED' && booking.status !== 'EXPIRED' && <button type="button" data-testid={`button-cancel-${booking.id}`} disabled={cancel.isPending} onClick={() => cancelStay(booking.id)} className="text-xs uppercase tracking-[.13em] text-[#8c4b42] underline underline-offset-4">{cancelId === booking.id ? 'Requesting…' : 'Request cancellation'}</button>}</div></article>)}</div> : <EmptyState title="No stays just yet">When your next coastal pause is arranged, its details will be waiting here.</EmptyState>}</QueryState>{cancel.isError && <p role="alert" className="mt-5 text-sm text-[#a6423d]">We couldn’t request cancellation. Please try again or contact our team.</p>}</section></Shell>;
}
function BookingPage({ id, confirmation = false }: { id: string; confirmation?: boolean }) {
  const booking = useGetBooking(id, { query: { queryKey: getGetBookingQueryKey(id) } });
  return <Shell><PageHeading kicker={confirmation ? 'Your booking request' : 'Stay details'} title={confirmation ? 'A little time, held for you.' : 'Your stay, in detail.'} intro={confirmation ? 'We’ve received your request. Here are the details to keep close.' : 'Your booking information is available here.'} /><section className="page-wrap max-w-3xl pb-20"><QueryState loading={booking.isLoading} error={booking.isError} retry={() => booking.refetch()}>{booking.data && <><BookingSummary booking={booking.data} /><div className="mt-7 flex flex-wrap gap-5"><Link href="/my-stays" className="text-xs uppercase tracking-[.14em] underline underline-offset-4">All my stays</Link><Link href="/contact" className="text-xs uppercase tracking-[.14em] underline underline-offset-4">Ask our team</Link></div></>}</QueryState></section></Shell>;
}

function AdminPage() {
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const [page, setPage] = useState(1); const [status, setStatus] = useState<ListAdminBookingsParams['status'] | ''>('');
  const params: ListAdminBookingsParams = { page, ...(status ? { status } : {}) };
  const bookings = useListAdminBookings(params, { query: { queryKey: getListAdminBookingsQueryKey(params) } });
  const data = overview.data;
  return <Shell><div className="bg-[#203a2f] py-12 text-[#f7f2e8]"><div className="page-wrap"><p className="eyebrow text-[#d5c195]">The Serein / Operations</p><div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="serif text-4xl">Good morning.</h1><p className="mt-2 text-sm text-[#d2d5c9]">A considered view of the stays at the coast.</p></div><Link href="/" className="text-xs uppercase tracking-[.15em]">View guest site <ArrowUpRight size={14} className="ml-1 inline" /></Link></div></div></div>
    <div className="page-wrap py-12"><QueryState loading={overview.isLoading} error={overview.isError} retry={() => overview.refetch()}>{data && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['All bookings', data.totalBookings], ['Pending payment', data.pendingBookings], ['Confirmed stays', data.confirmedBookings], ['Occupancy', `${data.occupancyPercent}%`]].map(([label,value]) => <div key={String(label)} className="border border-[#d8d1c3] bg-[#fbf9f3] p-5"><p className="eyebrow text-[#8a764c]">{label}</p><p className="serif mt-5 text-3xl">{value}</p></div>)}</div><div className="mt-5 flex flex-col justify-between gap-4 border border-[#d8d1c3] bg-[#e9e4d8] p-5 sm:flex-row sm:items-center"><div><p className="eyebrow text-[#8a764c]">Gross revenue</p><p className="serif mt-2 text-2xl">{money(data.grossRevenue, data.currency)}</p></div><p className="text-sm text-[#657268]">Only values returned by the protected operations API are shown.</p></div></>}</QueryState>
      <div className="mt-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow text-[#8a764c]">Reservations</p><h2 className="serif mt-2 text-3xl">Recent bookings</h2></div><label className="text-xs text-[#657268]">Booking status<select data-testid="admin-status" value={status} onChange={e => { setStatus(e.target.value as ListAdminBookingsParams['status'] | ''); setPage(1); }} className="ml-3 border border-[#d8d1c3] bg-[#fbf9f3] p-3 text-sm"><option value="">All statuses</option><option value="PENDING_PAYMENT">Pending payment</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option><option value="EXPIRED">Expired</option></select></label></div>
      <div className="mt-5"><QueryState loading={bookings.isLoading} error={bookings.isError} retry={() => bookings.refetch()}>{bookings.data?.items?.length ? <><div className="overflow-x-auto border border-[#d8d1c3]"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#e9e4d8] text-[10px] uppercase tracking-[.12em]"><tr>{['Guest', 'Room', 'Dates', 'Status', 'Amount'].map(h => <th key={h} className="px-4 py-4 font-medium">{h}</th>)}</tr></thead><tbody>{bookings.data.items.map((b: Booking) => <tr key={b.id} className="border-t border-[#e4ded2] bg-[#fbf9f3]"><td className="px-4 py-4"><div>{b.guestName}</div><div className="mt-1 text-xs text-[#7a857c]">{b.guestEmail}</div></td><td className="px-4 py-4">{b.roomName}</td><td className="px-4 py-4">{dateLabel(b.checkIn)} – {dateLabel(b.checkOut)}</td><td className="px-4 py-4"><span className="text-xs">{b.status.replaceAll('_',' ')}</span></td><td className="px-4 py-4">{money(b.totalAmount,b.currency)}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between text-sm"><span className="text-[#657268]">Page {bookings.data.page} of {Math.max(1,Math.ceil(bookings.data.total / bookings.data.pageSize))} · {bookings.data.total} bookings</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border border-[#d8d1c3] p-3 disabled:opacity-40" aria-label="Previous page"><ArrowLeft size={15} /></button><button type="button" disabled={page * bookings.data.pageSize >= bookings.data.total} onClick={() => setPage(page + 1)} className="border border-[#d8d1c3] p-3 disabled:opacity-40" aria-label="Next page"><ArrowRight size={15} /></button></div></div></> : <EmptyState title="No reservations to show">The protected booking service has no matching reservations at the moment.</EmptyState>}</QueryState></div>
    </div></Shell>;
}

function LegalPage({ type }: { type: 'privacy' | 'terms' | 'cancellation' }) {
  const copy = {
    privacy: { kicker: 'Your trust matters', title: 'Privacy, plainly.', intro: 'We collect only what is needed to respond to enquiries and arrange your stay. Booking information is handled by the services that help us operate The Serein.', parts: [['Information you share', 'When you contact us, subscribe, or request a booking, we receive the information you provide, such as your name, email, and stay details.'], ['How it is used', 'We use your information to respond to you, manage reservations, and communicate service updates relevant to your stay.'], ['Your choices', 'You may contact us to ask about your information or to stop receiving optional updates. We do not promise practices beyond the systems currently in place.']] },
    terms: { kicker: 'The essentials', title: 'A few shared understandings.', intro: 'These notes explain the basics of using this site and submitting a stay request. Your individual booking details and policies are provided with the booking itself.', parts: [['Stay requests', 'A submitted request may create a temporary booking hold. A pending-payment booking is not confirmed, and must not be treated as a confirmed reservation.'], ['Availability and details', 'Room availability, rates, and amenities are provided by our booking service and may change. Please review your booking details carefully.'], ['Getting in touch', 'If anything looks incorrect or you need help, contact The Serein team before making travel arrangements.']] },
    cancellation: { kicker: 'Plans change', title: 'Cancellation, with care.', intro: 'The cancellation terms for a stay depend on the booking and the policy presented for that reservation. Please check your booking details before requesting a change.', parts: [['Ask to cancel', 'Sign in and visit My stays to request cancellation where that action is available. Your request is sent to the booking service; its response determines the updated booking status.'], ['Pending payment', 'A pending-payment hold is not a confirmed stay. The hold expires at the time shown in your booking details.'], ['Need a hand?', 'If you cannot access your booking or are unsure of the terms, write to our team with your booking reference.']] },
  }[type];
  return <Shell><PageHeading kicker={copy.kicker} title={copy.title} intro={copy.intro} /><section className="page-wrap max-w-4xl pb-24">{copy.parts.map(([h,b],i) => <article key={h} className="grid gap-4 border-t border-[#d4ccbd] py-7 md:grid-cols-[180px_1fr]"><p className="eyebrow pt-1 text-[#8a764c]">0{i+1} / {type}</p><div><h2 className="serif text-2xl">{h}</h2><p className="mt-3 text-sm leading-7 text-[#657268]">{b}</p></div></article>)}</section></Shell>;
}

function NotFound() { return <Shell><div className="page-wrap flex min-h-[55vh] flex-col items-start justify-center"><p className="eyebrow text-[#8a764c]">A small detour</p><h1 className="serif mt-4 text-5xl">This path ends here.</h1><p className="mt-4 max-w-md text-sm leading-7 text-[#657268]">The page you’re looking for may have moved. The shore is still just ahead.</p><div className="mt-8"><ActionLink href="/">Back to The Serein</ActionLink></div></div></Shell>; }
function AuthScreen({ signup = false }: { signup?: boolean }) {
  if (hasValidClerk) {
    return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[#f5f1e8] px-4 py-10"><Link href="/" className="flex items-center gap-3 text-[#29483a]"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b49a67] serif">S</span><span className="serif text-2xl">the serein</span></Link><div className="w-full max-w-[440px]">{signup ? <RealSignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /> : <RealSignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}</div><p className="text-center text-xs tracking-wide text-[#657268]">A little quiet, whenever you’re ready.</p></div>;
  }
  const { signInAsDemo } = useContext(AuthContext);
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-[#f5f1e8] px-4 py-10">
      <Link href="/" className="flex items-center gap-3 text-[#29483a]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b49a67] serif text-lg">S</span>
        <span className="serif text-2xl">the serein</span>
      </Link>
      <div className="w-full max-w-[440px] rounded-2xl border border-[#d8d1c3] bg-[#fbf9f3] p-8 shadow-xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-[#29483a]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#29483a]">
            Preview / Demo Mode
          </span>
          <h2 className="mt-4 serif text-2xl text-[#29483a]">Welcome back</h2>
          <p className="mt-2 text-xs text-[#6e776e]">
            Choose an account to test room bookings, view reservations, or explore the manager dashboard.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              signInAsDemo('guest');
              setLocation('/my-stays');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#29483a] py-3.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#f8f5ed] transition-colors hover:bg-[#203a2f]"
          >
            Sign in as Guest (Aarav Patel)
          </button>
          <button
            type="button"
            onClick={() => {
              signInAsDemo('admin');
              setLocation('/admin');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#29483a] bg-white py-3.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#29483a] transition-colors hover:bg-[#f2ede2]"
          >
            Sign in as Hotel Admin
          </button>
        </div>
        <div className="mt-6 border-t border-[#e4ded2] pt-4 text-center">
          <p className="text-[11px] leading-relaxed text-[#7a857c]">
            To enable production Clerk auth, set a real <code className="rounded bg-[#e9e4d8] px-1 py-0.5 text-[10px]">VITE_CLERK_PUBLISHABLE_KEY</code> in <code className="rounded bg-[#e9e4d8] px-1 py-0.5 text-[10px]">.env</code>.
          </p>
        </div>
      </div>
      <p className="text-center text-xs tracking-wide text-[#657268]">A slower stay begins here.</p>
    </div>
  );
}
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/my-stays" /></Show><Show when="signed-out"><HomePage /></Show></>; }
function ProtectedBookings() { return <><Show when="signed-in"><MyStaysPage /></Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>; }
function ClerkCacheInvalidator() {
  const { addListener } = useClerk(); const client = useQueryClient(); const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => { const unsubscribe = addListener(({ user }) => { const userId = user?.id ?? null; if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear(); prevUserIdRef.current = userId; }); return unsubscribe; }, [addListener, client]);
  return null;
}
const seoByRoute: Record<string, { title: string; description: string }> = {
  '/': { title: 'Luxury Kerala Beach Resort | The Serein', description: 'Find a quieter kind of escape at The Serein, a coastal Kerala resort with thoughtful stays, local dining, and time beside the Arabian Sea.' },
  '/about': { title: 'Our Coastal Story in Kerala | The Serein', description: 'Discover the people, place, and slower coastal rhythm behind The Serein, an intimate resort on Kerala’s Arabian Sea shore.' },
  '/rooms': { title: 'Kerala Resort Rooms & Suites | The Serein', description: 'Explore private villas and sea-view suites at The Serein. Search live room availability by stay dates, guests, and room type.' },
  '/facilities': { title: 'Resort Facilities & Amenities | The Serein', description: 'Explore the private beach, infinity pool, Ayurvedic spa, and thoughtful amenities at The Serein on Kerala’s coast.' },
  '/dining': { title: 'Coastal Dining in Kerala | The Serein', description: 'Taste seasonal coastal cooking, Kerala ingredients, and relaxed sea-facing dining during your stay at The Serein.' },
  '/experiences': { title: 'Kerala Coastal Experiences | The Serein', description: 'Plan restorative spa rituals, backwater journeys, and locally guided experiences from The Serein resort in Kerala.' },
  '/gallery': { title: 'A Look Around The Serein | Kerala Resort', description: 'See the rooms, gardens, coastline, and quiet details of The Serein, a small luxury resort by the Arabian Sea.' },
  '/offers': { title: 'Resort Stays & Seasonal Offers | The Serein', description: 'Find stay ideas and seasonal packages at The Serein. Search dates for live room availability and current nightly rates.' },
  '/contact': { title: 'Contact The Serein Resort | Kerala', description: 'Get in touch with The Serein for room enquiries, directions, and help planning a coastal stay in Kerala.' },
  '/faq': { title: 'Guest Questions & Answers | The Serein', description: 'Find practical answers about booking, check-in, amenities, cancellations, and planning a stay at The Serein.' },
  '/my-stays': { title: 'Your Stays | The Serein Guest Account', description: 'Review your stay dates and booking details in your private The Serein guest account.' },
  '/cancellation': { title: 'Cancellation Information | The Serein', description: 'Review the current cancellation information for reservations at The Serein before you book.' },
  '/privacy': { title: 'Privacy Policy | The Serein', description: 'Read how The Serein handles guest account, booking, and enquiry information.' },
  '/terms': { title: 'Booking Terms | The Serein', description: 'Review the booking terms and guest information for stays at The Serein.' },
  '/admin': { title: 'Hotel Operations | The Serein', description: 'A private operations view for authorized The Serein hotel staff.' },
};
function PageMeta() {
  const [location] = useLocation();
  useEffect(() => {
    const path = location.split('?')[0] || '/';
    const isPrivate = /^\/(admin|my-stays|bookings|booking|sign-in|sign-up)(\/|$)/.test(path);
    const routeMeta = seoByRoute[path] ?? (path.startsWith('/rooms/')
      ? { title: 'Private Kerala Resort Suite | The Serein', description: 'View suite details, nightly rates, and live date availability at The Serein coastal resort in Kerala.' }
      : path.startsWith('/booking/') || path.startsWith('/bookings/')
        ? { title: 'Your Booking | The Serein', description: 'View private booking details for your stay at The Serein.' }
        : { title: 'The Serein | Coastal Resort in Kerala', description: 'A considered coastal stay on Kerala’s Arabian Sea shore.' });
    document.title = routeMeta.title;
    const setContent = (selector: string, content: string) => {
      const element = document.head.querySelector<HTMLMetaElement>(selector);
      if (element) element.content = content;
    };
    setContent('meta[name="description"]', routeMeta.description);
    setContent('meta[name="robots"]', isPrivate ? 'noindex, nofollow' : 'index, follow');
    setContent('meta[property="og:title"]', routeMeta.title);
    setContent('meta[property="og:description"]', routeMeta.description);
    setContent('meta[name="twitter:title"]', routeMeta.title);
    setContent('meta[name="twitter:description"]', routeMeta.description);
    const siteUrl = (import.meta.env as ImportMetaEnv & { VITE_SITE_URL?: string }).VITE_SITE_URL?.replace(/\/$/, '');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (siteUrl) {
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${siteUrl}${path === '/' ? '/' : path}`;
      setContent('meta[property="og:url"]', canonical.href);
      setContent('meta[property="og:image"]', `${siteUrl}/serein-coast.jpg`);
      setContent('meta[name="twitter:image"]', `${siteUrl}/serein-coast.jpg`);
    } else {
      canonical?.remove();
    }
  }, [location]);
  return null;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function RoomRoute() { const [, params] = useRoute('/rooms/:roomTypeId'); return params?.roomTypeId ? <RoomDetailPage id={params.roomTypeId} /> : <NotFound />; }
function BookingRoute({ confirmation = false }: { confirmation?: boolean }) { const [, params] = useRoute(confirmation ? '/booking/:bookingId/confirmation' : '/bookings/:bookingId'); return <Show when="signed-in">{params?.bookingId ? <BookingPage id={params.bookingId} confirmation={confirmation} /> : <NotFound />}</Show>; }
function ProtectedBookingRoute({ confirmation = false }: { confirmation?: boolean }) { return <><Show when="signed-in"><BookingRoute confirmation={confirmation} /></Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>; }
function PrivacyRoute() { return <LegalPage type="privacy" />; }
function TermsRoute() { return <LegalPage type="terms" />; }
function CancellationRoute() { return <LegalPage type="cancellation" />; }
function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  const routes = (
    <QueryClientProvider client={queryClient}>
      <ClerkCacheInvalidator />
      <PageMeta />
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={() => <AuthScreen />} />
          <Route path="/sign-up/*?" component={() => <AuthScreen signup />} />
          <Route path="/about" component={AboutPage} />
          <Route path="/rooms" component={RoomsPage} />
          <Route path="/rooms/:roomTypeId" component={RoomRoute} />
          <Route path="/facilities" component={() => <StaticPage kind="facilities" />} />
          <Route path="/dining" component={() => <StaticPage kind="dining" />} />
          <Route path="/experiences" component={() => <StaticPage kind="experiences" />} />
          <Route path="/gallery" component={() => <StaticPage kind="gallery" />} />
          <Route path="/offers" component={() => <StaticPage kind="offers" />} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/faq" component={FAQPage} />
          <Route path="/my-stays" component={ProtectedBookings} />
          <Route path="/booking/:bookingId/confirmation" component={() => <ProtectedBookingRoute confirmation />} />
          <Route path="/bookings/:bookingId" component={() => <ProtectedBookingRoute />} />
          <Route path="/cancellation" component={CancellationRoute} />
          <Route path="/privacy" component={PrivacyRoute} />
          <Route path="/terms" component={TermsRoute} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
      <Toaster />
    </QueryClientProvider>
  );

  if (hasValidClerk) {
    return (
      <RealClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        appearance={appearance}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Come back to the coast when you’re ready' } }, signUp: { start: { title: 'Make room for quiet', subtitle: 'A slower stay begins here' } } }}
        routerPush={to => setLocation(stripBase(to))}
        routerReplace={to => setLocation(stripBase(to), { replace: true })}
      >
        {routes}
      </RealClerkProvider>
    );
  }

  return (
    <DemoAuthProvider>
      {routes}
    </DemoAuthProvider>
  );
}

function App() {
  return <TooltipProvider><WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter></TooltipProvider>;
}
export default App;
