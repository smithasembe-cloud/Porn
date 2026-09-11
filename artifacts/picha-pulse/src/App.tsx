import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useCreateMedia,
  useGetCurrentAuthUser,
  useGetMedia,
  useListMedia,
  useRequestUploadUrl,
  useGetSiteVisitorCount,
  useRecordSiteVisit,
  getGetCurrentAuthUserQueryKey,
  getGetMediaQueryKey,
  getListMediaQueryKey,
} from '@workspace/api-client-react';
import type { Media } from '@workspace/api-client-react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileImage,
  FileVideo,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MonitorDown,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  UploadCloud,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
  useParams,
} from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const SAVED_KEY = 'picha-pulse-saved';
const mediaUrl = (objectPath: string) => `/api/storage${objectPath}`;
const VISITOR_SESSION_KEY = 'picha-pulse-visitor-session';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function readSaved(): number[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

function formatWhen(date: string) {
  const value = new Date(date).getTime();
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(date));
}

async function createVideoPoster(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        const targetTime = Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(0.5, Math.max(0.05, video.duration / 3))
          : 0.1;
        video.currentTime = targetTime;
      };
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('This video could not be previewed.'));
      video.src = sourceUrl;
      video.load();
    });

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('This video could not produce a preview image.');
    return new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}-poster.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
    video.removeAttribute('src');
    video.load();
  }
}

function validateUploadFile(file: File) {
  const maxBytes = 100 * 1024 * 1024;
  if (!['image/', 'video/'].some((prefix) => file.type.startsWith(prefix))) throw new Error('Choose a JPG, PNG, WEBP, GIF, MP4, or other supported image/video file.');
  if (file.size <= 0 || file.size > maxBytes) throw new Error('That file is too large. Please choose a file under 100 MB.');
}

function VisitorSession() {
  const recordVisit = useRecordSiteVisit();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (sessionStorage.getItem(VISITOR_SESSION_KEY)) return;
    void recordVisit.mutateAsync(undefined).then((count) => {
      sessionStorage.setItem(VISITOR_SESSION_KEY, 'counted');
      queryClient.setQueryData(['/api/site/visitors'], count);
    }).catch(() => undefined);
  }, [queryClient, recordVisit]);
  return null;
}

function initials(name?: string | null) {
  return (name || 'PP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: auth } = useGetCurrentAuthUser();
  const { data: siteVisitors } = useGetSiteVisitorCount();
  const user = auth?.user;
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const isActive = (path: string) => location === path;
  const login = () => { window.location.href = `/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`; };
  const logout = () => { window.location.href = `/api/logout?returnTo=${encodeURIComponent(window.location.pathname)}`; };
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" data-testid="link-brand" className="group flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-primary-foreground shadow-[4px_4px_0_hsl(var(--secondary))] transition-transform group-hover:-translate-y-0.5">
              <span className="font-display text-lg font-bold">P</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
            </span>
            <span className="font-display text-xl font-bold tracking-[-.06em]">picha<span className="text-primary">pulse</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" data-testid="link-nav-feed" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>The feed</Link>
            <Link href="/saved" data-testid="link-nav-saved" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/saved') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>Saved</Link>
            <Link href="/about" data-testid="link-nav-about" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/about') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>About</Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 font-mono-ui text-[10px] text-muted-foreground sm:flex" title="Picha Pulse visitors">
              <Eye size={13} className="text-primary" />
              {siteVisitors?.count?.toLocaleString('en-KE') ?? '—'}
            </span>
            <Link href="/upload" data-testid="link-header-upload" className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:flex">
              <Plus size={16} strokeWidth={2.5} /> Share a moment
            </Link>
            {user ? (
              <button onClick={logout} data-testid="button-logout" title="Log out" className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card font-mono-ui text-xs font-bold transition-colors hover:border-primary hover:text-primary sm:flex">{initials(`${user.firstName || ''} ${user.lastName || ''}`)}</button>
            ) : (
              <button onClick={login} data-testid="button-login" className="hidden items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary sm:flex"><LogIn size={15} /> Log in</button>
            )}
            <button onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card md:hidden">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-border bg-card px-5 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              <Link onClick={() => setMenuOpen(false)} href="/" data-testid="link-mobile-feed" className="rounded-lg px-3 py-3 font-semibold hover:bg-muted">The feed</Link>
              <Link onClick={() => setMenuOpen(false)} href="/saved" data-testid="link-mobile-saved" className="rounded-lg px-3 py-3 font-semibold hover:bg-muted">Saved moments</Link>
              <Link onClick={() => setMenuOpen(false)} href="/about" data-testid="link-mobile-about" className="rounded-lg px-3 py-3 font-semibold hover:bg-muted">About Picha Pulse</Link>
              <Link onClick={() => setMenuOpen(false)} href="/upload" data-testid="link-mobile-upload" className="mt-2 rounded-lg bg-primary px-3 py-3 font-bold text-primary-foreground">Share a moment</Link>
              <button onClick={user ? logout : login} data-testid="button-mobile-auth" className="flex items-center gap-2 rounded-lg px-3 py-3 text-left font-semibold hover:bg-muted">{user ? <LogOut size={16} /> : <LogIn size={16} />}{user ? 'Log out' : 'Log in'}</button>
            </div>
          </div>
        )}
      </header>
      {installEvent && !installDismissed && (
        <div className="border-b border-primary/20 bg-primary px-5 py-3 text-primary-foreground">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 sm:px-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Download size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Install Picha Pulse on your phone</p>
                <p className="hidden text-xs text-primary-foreground/75 sm:block">Open the feed like an app from your home screen.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={install} data-testid="button-install-banner" className="rounded-full bg-primary-foreground px-4 py-2 text-xs font-bold text-primary transition-transform hover:-translate-y-0.5">
                Install now
              </button>
              <button onClick={() => setInstallDismissed(true)} data-testid="button-dismiss-install-banner" aria-label="Dismiss install prompt" className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground/75 hover:bg-primary-foreground/15 hover:text-primary-foreground">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      <main>{children}</main>
      <footer className="border-t border-border/80 bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p><span className="font-display font-bold text-foreground">picha<span className="text-primary">pulse</span></span> · what Kenya is seeing now.</p>
          <div className="flex gap-5"><Link href="/about" data-testid="link-footer-about" className="hover:text-primary">About</Link><Link href="/upload" data-testid="link-footer-upload" className="hover:text-primary">Share media</Link></div>
        </div>
      </footer>
    </div>
  );
}

function MediaVisual({ media, className = '', eager = false }: { media: Media; className?: string; eager?: boolean }) {
  const src = mediaUrl(media.objectPath);
  return media.type === 'video' ? (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      {media.thumbnailObjectPath ? <img src={mediaUrl(media.thumbnailObjectPath)} alt={`${media.title} video poster`} loading={eager ? 'eager' : 'lazy'} className="h-full w-full object-cover" /> : <video src={src} muted playsInline preload={eager ? 'metadata' : 'none'} className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center bg-foreground/10"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg"><Play size={18} fill="currentColor" /></span></span>
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-foreground/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-background"><Play size={11} fill="currentColor" /> Clip</span>
    </div>
  ) : <img src={src} alt={media.title} loading={eager ? 'eager' : 'lazy'} className={`h-full w-full object-cover ${className}`} />;
}

function SaveButton({ id }: { id: number }) {
  const [saved, setSaved] = useState(() => readSaved().includes(id));
  const toggle = (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const next = saved ? readSaved().filter((item) => item !== id) : [...readSaved(), id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setSaved(!saved);
    window.dispatchEvent(new Event('picha-saved-change'));
  };
  return <button onClick={toggle} data-testid={`button-save-${id}`} aria-label={saved ? 'Remove from saved' : 'Save media'} className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all hover:scale-105 ${saved ? 'bg-accent text-accent-foreground' : 'bg-background/80 text-foreground hover:bg-accent'}`}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>;
}

function MediaCard({ media, index = 0 }: { media: Media; index?: number }) {
  return (
    <Link href={`/media/${media.id}`} data-testid={`card-media-${media.id}`} className="group block animate-rise" style={{ animationDelay: `${index * 55}ms` }}>
      <article className="overflow-hidden rounded-[1.15rem] border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_16px_30px_rgba(33,55,71,.12)]">
        <div className="relative aspect-[4/3] overflow-hidden">
          <MediaVisual media={media} className="transition-transform duration-700 group-hover:scale-[1.04]" />
          <div className="absolute right-3 top-3"><SaveButton id={media.id} /></div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur-md"><MapPin size={11} className="text-primary" /> {media.location || 'Kenya'}</div>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="font-mono-ui text-[10px] uppercase tracking-wider text-primary">{media.type === 'image' ? 'Still' : 'Short clip'}</span><span className="font-mono-ui text-[10px] text-muted-foreground">{formatWhen(media.createdAt)}</span></div>
          <h3 className="line-clamp-2 font-display text-[1.05rem] font-bold leading-tight tracking-[-.025em]">{media.title}</h3>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>by <strong className="font-semibold text-foreground">{media.uploaderName || 'A neighbour'}</strong></span><span>{media.views.toLocaleString('en-KE')} views</span></div>
        </div>
      </article>
    </Link>
  );
}

function FeedSkeleton() {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="overflow-hidden rounded-[1.15rem] border border-border bg-card"><div className="skeleton aspect-[4/3]" /><div className="space-y-3 p-4"><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-5 w-4/5 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>)}</div>;
}

function Home() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [sort, setSort] = useState<'newest' | 'trending'>('newest');
  const params = useMemo(() => ({ type: filter, q: search.trim() || undefined, sort, limit: 100 }), [filter, search, sort]);
  const mediaQuery = useListMedia(params);
  const media = mediaQuery.data || [];
  return (
    <div className="pulse-grid">
      <section className="mx-auto max-w-[1440px] px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div className="animate-rise">
            <div className="mb-5 flex items-center gap-2 font-mono-ui text-[11px] font-medium uppercase tracking-[.2em] text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Live from around Kenya</div>
            <h1 className="max-w-3xl font-display text-[clamp(3.5rem,8vw,7.7rem)] font-bold leading-[.88] tracking-[-.085em]">See what’s<br /><span className="text-primary">moving.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Trade photography, quick community clips, and the small flashes of life that make a place feel like home.</p>
          </div>
          <div className="relative hidden min-h-[220px] overflow-hidden rounded-[1.5rem] bg-secondary p-7 text-secondary-foreground lg:block">
            <div className="absolute -right-8 -top-14 h-48 w-48 rounded-full border-[26px] border-accent/90" />
            <div className="absolute bottom-5 right-14 h-7 w-7 rounded-full bg-primary" />
            <div className="relative flex h-full flex-col justify-between">
              <Sparkles size={23} className="text-accent" />
              <p className="max-w-[260px] font-display text-2xl font-semibold leading-tight">Not a newsroom.<br /><span className="text-accent">A living noticeboard.</span></p>
              <span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary-foreground/60">Nairobi · Mombasa · Kisumu · everywhere</span>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-y border-border py-4 md:flex-row md:items-center md:justify-between">
          <label className="relative flex w-full max-w-lg items-center">
            <Search size={18} className="absolute left-4 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-media" type="search" placeholder="Search places, people, moments..." className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
          </label>
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground sm:block">Show me</span>
            {(['all', 'image', 'video'] as const).map((type) => <button key={type} onClick={() => setFilter(type)} data-testid={`button-filter-${type}`} className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-all ${filter === type ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>{type === 'all' ? 'Everything' : type === 'image' ? 'Photos' : 'Clips'}</button>)}
          </div>
          <div className="flex items-center gap-2">
            {(['newest', 'trending'] as const).map((value) => <button key={value} onClick={() => setSort(value)} data-testid={`button-sort-${value}`} className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-all ${sort === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>{value}</button>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8">
        <div className="mb-6 flex items-end justify-between"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Fresh drops</span><h2 className="mt-1 font-display text-3xl font-bold tracking-[-.05em]">The pulse right now</h2></div><span className="font-mono-ui text-xs text-muted-foreground">{media.length ? `${media.length} ${media.length === 1 ? 'story' : 'stories'}` : 'No stories yet'}</span></div>
        {mediaQuery.isLoading ? <FeedSkeleton /> : mediaQuery.isError ? <ErrorState onRetry={() => mediaQuery.refetch()} /> : media.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{media.map((item, index) => <MediaCard key={item.id} media={item} index={index} />)}</div> : <EmptyFeed search={Boolean(search)} onClear={() => setSearch('')} />}
      </section>
    </div>
  );
}

function EmptyFeed({ search, onClear }: { search: boolean; onClear: () => void }) {
  return <div className="rounded-[1.5rem] border border-dashed border-border bg-card/50 px-6 py-20 text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"><Search size={24} /></div><h3 className="font-display text-2xl font-bold">{search ? 'Nothing by that name yet.' : 'The board is warming up.'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{search ? 'Try a different place, person, or phrase. Kenya is a big story.' : 'Be the first to put a moment on the map.'}</p>{search ? <button onClick={onClear} data-testid="button-clear-search" className="mt-6 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground">Clear search</button> : <Link href="/upload" data-testid="link-empty-upload" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Share the first moment</Link>}</div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/5 px-6 py-16 text-center"><CircleAlert size={25} className="mx-auto mb-4 text-destructive" /><h3 className="font-display text-xl font-bold">The pulse is out of reach.</h3><p className="mt-2 text-sm text-muted-foreground">Something interrupted the feed. Give it another beat.</p><button onClick={onRetry} data-testid="button-retry-feed" className="mt-5 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground">Try again</button></div>;
}

function MediaDetailCore() {
  const { id } = useParams<{ id: string }>();
  const mediaQuery = useGetMedia(Number(id), { query: { queryKey: getGetMediaQueryKey(Number(id)), enabled: Boolean(id) } });
  const media = mediaQuery.data;
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [location, setLocation] = useLocation();
  const share = async () => { if (navigator.share && media) await navigator.share({ title: media.title, text: media.description, url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href); };
  useEffect(() => { if (videoRef.current && media?.type === 'video') { if (media.thumbnailObjectPath) videoRef.current.poster = mediaUrl(media.thumbnailObjectPath); videoRef.current.play().catch(() => setPlaying(false)); } }, [media]);
  if (mediaQuery.isLoading) return <div className="flex min-h-[75dvh] items-center justify-center"><LoaderCircle className="animate-spin-soft text-primary" /></div>;
  if (mediaQuery.isError || !media) return <div className="mx-auto max-w-lg px-5 py-24 text-center"><CircleAlert className="mx-auto mb-4 text-destructive" /><h1 className="font-display text-2xl font-bold">This moment moved on.</h1><p className="mt-2 text-sm text-muted-foreground">We could not load that media.</p><button onClick={() => mediaQuery.refetch()} data-testid="button-retry-media" className="mt-5 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground">Try again</button></div>;
  return <div className="min-h-[calc(100dvh-4.5rem)] bg-secondary text-secondary-foreground"><div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-[1440px] lg:grid-cols-[1.35fr_.65fr]"><div className="relative flex min-h-[55dvh] items-center justify-center overflow-hidden bg-foreground p-5 lg:min-h-0"><button onClick={() => setLocation('/')} data-testid="button-detail-back" className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-xs font-bold text-foreground backdrop-blur-md"><ArrowLeft size={15} /> Back to pulse</button>{media.type === 'video' ? <div className="relative max-h-full w-full max-w-4xl"><video ref={videoRef} src={mediaUrl(media.objectPath)} controls playsInline className="max-h-[75dvh] w-full object-contain" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /><button onClick={() => { if (videoRef.current?.paused) videoRef.current.play(); else videoRef.current?.pause(); }} data-testid="button-video-play" className="absolute bottom-14 left-5 flex h-10 w-10 items-center justify-center rounded-full bg-background/85 text-foreground">{playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button></div> : <div className="relative flex h-full max-h-[85dvh] w-full items-center justify-center overflow-auto"><img src={mediaUrl(media.objectPath)} alt={media.title} style={{ transform: `scale(${zoom})` }} className="max-h-full max-w-full object-contain transition-transform duration-300" /><div className="absolute bottom-5 right-5 flex items-center gap-1 rounded-full bg-background/85 p-1 text-foreground backdrop-blur-md"><button onClick={() => setZoom(Math.max(1, zoom - .25))} data-testid="button-zoom-out" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ZoomOut size={16} /></button><span className="font-mono-ui px-1 text-[10px]">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(Math.min(2.5, zoom + .25))} data-testid="button-zoom-in" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ZoomIn size={16} /></button></div></div>}</div><aside className="flex flex-col justify-between p-6 sm:p-10 lg:p-14"><div><div className="mb-8 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">{media.type === 'image' ? 'Trade still' : 'Community clip'}</span><div className="flex gap-2"><SaveButton id={media.id} /><button onClick={share} data-testid="button-share-media" className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary-foreground/20 transition-colors hover:bg-secondary-foreground/10"><Share2 size={16} /></button></div></div><h1 className="max-w-xl font-display text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-6xl">{media.title}</h1><p className="mt-6 max-w-lg text-sm leading-relaxed text-secondary-foreground/75 sm:text-base">{media.description || 'A moment shared from the community.'}</p><div className="mt-9 flex flex-wrap gap-2"><span className="flex items-center gap-2 rounded-full bg-secondary-foreground/10 px-3 py-2 text-xs"><MapPin size={13} className="text-accent" /> {media.location || 'Kenya'}</span><span className="flex items-center gap-2 rounded-full bg-secondary-foreground/10 px-3 py-2 text-xs"><Clock3 size={13} className="text-accent" /> {formatWhen(media.createdAt)}</span><span className="rounded-full bg-secondary-foreground/10 px-3 py-2 font-mono-ui text-[10px]">{media.views.toLocaleString('en-KE')} views</span></div></div><div className="mt-12 border-t border-secondary-foreground/15 pt-5"><p className="font-mono-ui text-[10px] uppercase tracking-widest text-secondary-foreground/55">Shared by</p><p className="mt-2 font-display text-lg font-bold">{media.uploaderName || 'A neighbour'}</p></div></aside></div></div>;
}

function MediaDetail() {
  const { id } = useParams<{ id: string }>();
  const mediaQuery = useGetMedia(Number(id), { query: { queryKey: getGetMediaQueryKey(Number(id)), enabled: Boolean(id) } });
  return <><MediaDetailCore /><RelatedImages mediaId={mediaQuery.data?.id} query={mediaQuery.data ? [mediaQuery.data.title, mediaQuery.data.location, mediaQuery.data.description].filter(Boolean).join(' ') : ''} /></>;
}

function RelatedImages({ mediaId, query }: { mediaId?: number; query: string }) {
  const [items, setItems] = useState<Array<{ title: string; imageUrl: string; sourceUrl: string; source: string }>>([]);
  useEffect(() => {
    if (!mediaId) return;
    let cancelled = false;
    const load = () => fetch(`/api/media/${mediaId}/related`).then((response) => response.json()).then((payload) => { if (!cancelled) setItems(payload.items || []); }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 3_600_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [mediaId, query]);
  if (!items.length) return null;
  return <section className="bg-background px-5 py-12 text-foreground sm:px-8 sm:py-16"><div className="mx-auto max-w-[1440px]"><div className="mb-6 flex items-end justify-between gap-4"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">From around the same story</span><h2 className="mt-2 font-display text-3xl font-bold tracking-[-.05em] sm:text-4xl">Related pictures</h2></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Refreshes hourly</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map((item) => <a key={item.imageUrl} href={item.sourceUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-border bg-card"><div className="aspect-[4/3] overflow-hidden bg-muted"><img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div><div className="p-3"><p className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</p><p className="mt-2 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">{item.source}</p></div></a>)}</div></div></section>;
}

function UploadPage() {
  const { data: auth, isLoading: authLoading } = useGetCurrentAuthUser();
  const requestUpload = useRequestUploadUrl();
  const createMedia = useCreateMedia();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState<'idle' | 'thumbnailing' | 'requesting' | 'uploading' | 'publishing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const login = () => { window.location.href = `/api/login?returnTo=${encodeURIComponent('/upload')}`; };
  const submit = async () => {
    if (!file || !title.trim()) return;
    setError('');
    try {
      validateUploadFile(file);
      let thumbnailObjectPath: string | undefined;
      if (file.type.startsWith('video/')) {
        setStage('thumbnailing');
        const poster = await createVideoPoster(file);
        const posterResponse = await requestUpload.mutateAsync({ data: { name: poster.name, size: poster.size, contentType: poster.type } });
        const posterUpload = await fetch(posterResponse.uploadURL, { method: 'PUT', headers: { 'Content-Type': poster.type }, body: poster });
        if (!posterUpload.ok) throw new Error('Video preview upload did not complete');
        thumbnailObjectPath = posterResponse.objectPath;
      }
      setStage('requesting');
      const response = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      setStage('uploading');
      const upload = await fetch(response.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!upload.ok) throw new Error('Upload did not complete');
      setProgress(100); setStage('publishing');
      await createMedia.mutateAsync({ data: { title: title.trim(), description: description.trim(), location: location.trim(), type: file.type.startsWith('video/') ? 'video' : 'image', mimeType: file.type, objectPath: response.objectPath, thumbnailObjectPath, uploaderName: `${auth?.user?.firstName || ''} ${auth?.user?.lastName || ''}`.trim() || undefined } });
      await queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      setStage('done');
    } catch (caught) { setStage('error'); setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.'); }
  };
  if (authLoading) return <div className="mx-auto max-w-3xl px-5 py-20"><div className="skeleton h-7 w-32 rounded" /><div className="skeleton mt-4 h-16 w-3/4 rounded" /><div className="skeleton mt-10 h-72 rounded-2xl" /></div>;
  if (!auth?.user) return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-16 sm:py-24"><div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-8 text-center shadow-[0_18px_50px_rgba(33,55,71,.08)] sm:p-14"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent"><UploadCloud size={28} /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Contributor access</span><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">Bring the next<br /><span className="text-primary">moment.</span></h1><p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Log in to upload a photo or short clip. Your view of Kenya belongs here.</p><button onClick={login} data-testid="button-upload-login" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"><LogIn size={17} /> Log in to share</button></div></div>;
  if (stage === 'done') return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-16"><div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-8 text-center sm:p-14"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-accent"><Check size={30} strokeWidth={3} /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Published to the pulse</span><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">That’s a wrap.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your moment is now live for people around Kenya to discover.</p><div className="mt-8 flex justify-center gap-3"><Link href="/" data-testid="link-upload-done-feed" className="rounded-full bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">See the feed</Link><button onClick={() => { setStage('idle'); setFile(null); setTitle(''); setDescription(''); setLocation(''); setProgress(0); }} data-testid="button-upload-another" className="rounded-full border border-border px-5 py-3 text-sm font-bold hover:border-primary hover:text-primary">Share another</button></div></div></div>;
  return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-5xl"><div className="mb-10 max-w-2xl"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your corner of the story</span><h1 className="mt-3 font-display text-5xl font-bold leading-[.9] tracking-[-.07em] sm:text-7xl">Share what<br /><span className="text-primary">you see.</span></h1><p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">Photos and short clips from the people who are actually there. Keep it clear, keep it kind, keep it moving.</p></div><div className="grid gap-8 lg:grid-cols-[1fr_.8fr]"><div><button onClick={() => inputRef.current?.click()} data-testid="button-select-file" className={`group relative flex min-h-[310px] w-full flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-all ${file ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary hover:bg-primary/5'}`}><input ref={inputRef} type="file" accept="image/*,video/*" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) { setFile(selected); setProgress(0); } }} data-testid="input-upload-file" className="hidden" />{file ? <><div className="relative mb-5 h-28 w-40 overflow-hidden rounded-xl bg-secondary">{file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt="Selected preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-accent"><FileVideo size={38} /></div>}</div><span className="max-w-full truncate font-display font-bold">{file.name}</span><span className="mt-1 font-mono-ui text-[10px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB · ready to share</span><span className="mt-4 text-xs font-bold text-primary">Choose a different file</span></> : <><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent transition-transform group-hover:rotate-3"><UploadCloud size={29} /></div><span className="font-display text-xl font-bold">Drop a photo or clip here</span><span className="mt-2 text-sm text-muted-foreground">or tap to browse · JPG, PNG, MP4 up to 100 MB</span></>}</button>{stage !== 'idle' && stage !== 'error' && <div className="mt-4 rounded-xl border border-border bg-card p-4"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{stage === 'requesting' ? 'Preparing a secure upload…' : stage === 'uploading' ? 'Sending your file…' : 'Putting it on the pulse…'}</span><span className="font-mono-ui text-primary">{stage === 'uploading' ? `${progress}%` : '…'}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${stage === 'uploading' ? Math.max(progress, 8) : 100}%` }} /></div></div>}{stage === 'error' && <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><CircleAlert size={18} className="mt-0.5 shrink-0 text-destructive" /><div><strong className="font-semibold">Upload paused.</strong><p className="mt-1 text-muted-foreground">{error}</p></div></div>}</div><div className="rounded-[1.5rem] border border-border bg-card p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-mono-ui text-xs text-accent">02</span><h2 className="font-display text-xl font-bold">Give it a little context</h2></div><div className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Headline <em className="font-normal normal-case text-primary">required</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="input-upload-title" placeholder="What are we looking at?" className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Short note</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} data-testid="input-upload-description" placeholder="The detail that makes this moment yours..." rows={4} className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Where was this?</span><input value={location} onChange={(event) => setLocation(event.target.value)} data-testid="input-upload-location" placeholder="e.g. Gikambura, Kiambu" className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" /></label><button disabled={!file || !title.trim() || stage === 'requesting' || stage === 'uploading' || stage === 'publishing'} onClick={submit} data-testid="button-submit-upload" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">{stage === 'requesting' || stage === 'uploading' || stage === 'publishing' ? <LoaderCircle size={18} className="animate-spin-soft" /> : <UploadCloud size={18} />} {stage === 'requesting' ? 'Preparing…' : stage === 'uploading' ? 'Uploading…' : stage === 'publishing' ? 'Publishing…' : 'Publish to the pulse'}</button></div></div></div></div></div>;
}

function SavedPage() {
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(readSaved);
  const mediaQuery = useListMedia({ type: 'all', limit: 100 });
  useEffect(() => { const update = () => setSaved(readSaved()); window.addEventListener('picha-saved-change', update); return () => window.removeEventListener('picha-saved-change', update); }, []);
  const media = (mediaQuery.data || []).filter((item) => saved.includes(item.id));
  return <div className="pulse-grid min-h-[calc(100dvh-9rem)]"><section className="mx-auto max-w-[1440px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20"><div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your pocket of Kenya</span><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.07em] sm:text-7xl">Saved<br /><span className="text-primary">moments.</span></h1></div><p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Keep the stories that made you stop scrolling. They live here on this device.</p></div>{mediaQuery.isLoading ? <FeedSkeleton /> : media.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{media.map((item, index) => <MediaCard key={item.id} media={item} index={index} />)}</div> : <div className="rounded-[1.5rem] border border-dashed border-border bg-card/50 px-6 py-20 text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"><Bookmark size={24} /></div><h2 className="font-display text-2xl font-bold">Nothing tucked away yet.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Tap the bookmark on any moment you want to come back to.</p><button onClick={() => setLocation('/')} data-testid="button-saved-browse" className="mt-6 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground">Browse the pulse</button></div>}</section></div>;
}

function AboutPage() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => { const capture = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); }; window.addEventListener('beforeinstallprompt', capture); return () => window.removeEventListener('beforeinstallprompt', capture); }, []);
  const install = async () => { if (installEvent) { await installEvent.prompt(); setInstallEvent(null); } else setShowGuide(true); };
  return <div className="pulse-grid"><section className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 sm:px-8 sm:pt-24"><div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">About the pulse</span><h1 className="mt-4 max-w-3xl font-display text-6xl font-bold leading-[.86] tracking-[-.08em] sm:text-8xl">Kenya,<br /><span className="text-primary">in frame.</span></h1><p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">Picha Pulse is a daily window into what people across Kenya are seeing, making, trading, and talking about right now.</p></div><div className="flex min-h-[280px] flex-col justify-between rounded-[1.5rem] bg-primary p-7 text-primary-foreground"><div className="flex justify-between"><span className="font-display text-xl font-bold tracking-[-.05em]">picha<span className="text-accent">pulse</span></span><ArrowUpRight size={23} /></div><p className="max-w-xs font-display text-3xl font-bold leading-tight">The people closest to the moment tell it best.</p><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary-foreground/65">Built for the everyday extraordinary</span></div></div></section><section className="border-y border-border bg-card"><div className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:grid-cols-3 sm:px-8">{[['01', 'Look around', 'Browse trade photography and short community clips from all over the country.'], ['02', 'Keep what matters', 'Save the moments you want to find again. No account needed for your personal pocket.'], ['03', 'Put it on the map', 'Log in, upload a photo or clip, and give your corner of Kenya a little context.']].map(([number, title, body]) => <div key={number} className="border-b border-border py-8 sm:border-b-0 sm:border-r sm:px-8 sm:py-12 sm:first:pl-0 sm:last:border-r-0"><span className="font-mono-ui text-xs text-primary">{number}</span><h2 className="mt-8 font-display text-2xl font-bold tracking-[-.04em]">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p></div>)}</div></section><section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24"><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Carry it with you</span><h2 className="mt-3 font-display text-4xl font-bold tracking-[-.06em] sm:text-6xl">A better<br />daily check-in.</h2></div><div className="rounded-[1.5rem] border border-border bg-card p-7 sm:p-10"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent"><MonitorDown size={23} /></div><div><h3 className="font-display text-2xl font-bold tracking-[-.04em]">Add Picha Pulse to your home screen</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Open the feed like an app, without hunting for a tab. It is quick, lightweight, and made for the daily scroll.</p><button onClick={install} data-testid="button-install-app" className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5">{installEvent ? <Download size={16} /> : <ExternalLink size={16} />} {installEvent ? 'Add to home screen' : 'Show install steps'}</button></div></div>{showGuide && <div className="mt-4 rounded-xl bg-muted p-5 text-sm leading-relaxed"><p className="font-bold">On iPhone or iPad</p><p className="mt-1 text-muted-foreground">Open this page in Safari, tap the Share button, then choose “Add to Home Screen”.</p><p className="mt-4 font-bold">On Chrome</p><p className="mt-1 text-muted-foreground">Open the browser menu, then choose “Install Picha Pulse” or “Add to Home screen”.</p></div>}</div></div></section></div>;
}

function Router() {
  return <RoutedErrorBoundary><AppShell><Switch><Route path="/" component={Home} /><Route path="/upload" component={UploadPage} /><Route path="/saved" component={SavedPage} /><Route path="/about" component={AboutPage} /><Route path="/media/:id" component={MediaDetail} /><Route component={NotFound} /></Switch></AppShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><VisitorSession /><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;