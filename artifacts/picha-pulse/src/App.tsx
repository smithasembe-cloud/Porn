import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { AdultAccessGate } from '@/components/adult-access-gate';
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
import { removeMediaFromOffline, saveMediaForOffline } from '@/lib/offline-saver';
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
  FileImage,
  FileVideo,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  Minimize2,
  MonitorDown,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  UploadCloud,
  Video,
  WifiOff,
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
const SAVED_MEDIA_KEY = 'picha-pulse-saved-media';
const mediaUrl = (objectPath: string) => `/api/storage${objectPath}`;
const VISITOR_SESSION_KEY = 'picha-pulse-visitor-session';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallContextValue {
  canInstall: boolean;
  installed: boolean;
  install: () => Promise<boolean>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    const safariNavigator = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || safariNavigator.standalone === true;
  });

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return false;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      return choice.outcome === 'accepted';
    } catch {
      return false;
    } finally {
      setInstallEvent(null);
    }
  };

  return (
    <PwaInstallContext.Provider value={{ canInstall: Boolean(installEvent) && !installed, installed, install }}>
      {children}
    </PwaInstallContext.Provider>
  );
}

function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error('PWA install controls must be used inside PwaInstallProvider.');
  return context;
}

function readSaved(): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function readSavedMedia(): Media[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_MEDIA_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Media => item && Number.isInteger(item.id) && typeof item.objectPath === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeSavedMedia(media: Media, keep: boolean) {
  const items = new Map(readSavedMedia().map((item) => [item.id, item]));
  if (keep) items.set(media.id, media);
  else items.delete(media.id);
  localStorage.setItem(SAVED_MEDIA_KEY, JSON.stringify([...items.values()]));
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
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

async function optimizeImageForUpload(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1.5 * 1024 * 1024 || file.size > 32 * 1024 * 1024) {
    return file;
  }

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 2560;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'picha-pulse-photo';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
      } else {
        reject(new Error(`Upload did not complete (${request.status}). Please try again.`));
      }
    });
    request.addEventListener('error', () => reject(new Error('Network error while uploading. Check your connection and try again.')));
    request.addEventListener('abort', () => reject(new Error('Upload was interrupted. Please try again.')));
    request.send(file);
  });
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
  const online = useOnlineStatus();
  const { data: auth } = useGetCurrentAuthUser();
  const { data: siteVisitors } = useGetSiteVisitorCount();
  const user = auth?.user;
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const isMediaRoute = location.startsWith('/media/');
  const isActive = (path: string) => location === path;
  const login = () => { if (online) window.location.href = `/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`; };
  const logout = () => { if (online) window.location.href = `/api/logout?returnTo=${encodeURIComponent(window.location.pathname)}`; };
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setInstallEvent(null);
      setInstallDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
    }
  };
  return (
    <div className={`${isMediaRoute ? 'media-route-root' : 'grain min-h-[100dvh] bg-background'}`}>
      {!isMediaRoute && <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link href="/" data-testid="link-brand" className="group flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-[4px_4px_0_hsl(var(--secondary))] transition-transform group-hover:-translate-y-0.5">
              <span className="font-display text-xl font-bold">P</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent animate-pulse" />
            </span>
            <span className="font-display text-[1.35rem] font-bold tracking-[-.055em]">picha<span className="text-primary">pulse</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" data-testid="link-nav-feed" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>The feed</Link>
            <Link href="/saved" data-testid="link-nav-saved" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/saved') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>Saved</Link>
            <Link href="/about" data-testid="link-nav-about" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive('/about') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>About</Link>
            <Link href="/about#install" data-testid="link-nav-install" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10"><MonitorDown size={15} /> Install</Link>
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
              <button onClick={logout} disabled={!online} data-testid="button-logout" title={online ? 'Log out' : 'Internet required to log out'} className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card font-mono-ui text-xs font-bold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:flex">{initials(`${user.firstName || ''} ${user.lastName || ''}`)}</button>
            ) : (
              <button onClick={login} disabled={!online} data-testid="button-login" title={online ? 'Log in' : 'Internet required to log in'} className="hidden items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:flex"><LogIn size={15} /> Log in</button>
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
              <Link onClick={() => setMenuOpen(false)} href="/about#install" data-testid="link-mobile-install" className="rounded-lg px-3 py-3 font-semibold text-primary hover:bg-primary/10">Install Picha Pulse</Link>
              <Link onClick={() => setMenuOpen(false)} href="/upload" data-testid="link-mobile-upload" className="mt-2 rounded-lg bg-primary px-3 py-3 font-bold text-primary-foreground">Share a moment</Link>
              <button onClick={user ? logout : login} disabled={!online} data-testid="button-mobile-auth" className="flex items-center gap-2 rounded-lg px-3 py-3 text-left font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{user ? <LogOut size={16} /> : <LogIn size={16} />}{user ? 'Log out' : 'Log in'}</button>
            </div>
          </div>
        )}
      </header>}
      {!isMediaRoute && !online && (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 border-b border-amber-500/25 bg-amber-100 px-4 py-2.5 text-center text-xs font-semibold text-amber-950">
          <WifiOff size={15} className="shrink-0" />
          <span>Offline mode: cached stories and saved moments remain available. Sign-in and publishing need internet.</span>
        </div>
      )}
      {!isMediaRoute && installEvent && !installDismissed && (
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
      <main className={isMediaRoute ? 'media-route-main' : undefined}>{children}</main>
      {!isMediaRoute && <footer className="border-t border-border/80 bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p><span className="font-display font-bold text-foreground">picha<span className="text-primary">pulse</span></span> · what Kenya is seeing now.</p>
          <div className="flex gap-5"><Link href="/about" data-testid="link-footer-about" className="hover:text-primary">About</Link><Link href="/upload" data-testid="link-footer-upload" className="hover:text-primary">Share media</Link></div>
        </div>
      </footer>}
    </div>
  );
}

function MediaVisual({ media, className = '', eager = false }: { media: Media; className?: string; eager?: boolean }) {
  const src = mediaUrl(media.objectPath);
  return media.type === 'video' ? (
    <div className={`relative overflow-hidden bg-[#132b35] ${className}`}>
      {media.thumbnailObjectPath ? <img src={mediaUrl(media.thumbnailObjectPath)} alt={`${media.title} video poster`} loading={eager ? 'eager' : 'lazy'} className="h-full w-full object-cover" /> : <video src={src} muted playsInline preload={eager ? 'metadata' : 'none'} className="h-full w-full object-cover" />}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/65 via-transparent to-foreground/10" />
      <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-background/60 bg-background/90 text-foreground shadow-xl transition-transform group-hover:scale-110"><Play size={19} fill="currentColor" /></span></span>
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-foreground/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-background backdrop-blur-md"><Play size={11} fill="currentColor" /> Clip</span>
    </div>
  ) : <img src={src} alt={media.title} loading={eager ? 'eager' : 'lazy'} className={`h-full w-full object-cover ${className}`} />;
}

function SaveButton({ media }: { media: Media }) {
  const [saved, setSaved] = useState(() => readSaved().includes(media.id));
  const [offlineState, setOfflineState] = useState<'idle' | 'saving' | 'ready' | 'unavailable'>('idle');
  const [offlineMessage, setOfflineMessage] = useState('');
  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    if (offlineState === 'saving') return;
    const nextSaved = !saved;
    const next = nextSaved ? [...new Set([...readSaved(), media.id])] : readSaved().filter((item) => item !== media.id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    writeSavedMedia(media, nextSaved);
    setSaved(nextSaved);
    setOfflineMessage('');
    window.dispatchEvent(new Event('picha-saved-change'));
    if (nextSaved) {
      setOfflineState('saving');
      const result = await saveMediaForOffline(media);
      setOfflineState(result.ok ? 'ready' : 'unavailable');
      setOfflineMessage(result.message);
    } else {
      setOfflineState('idle');
      void removeMediaFromOffline(media.id);
    }
  };
  const label = offlineState === 'saving'
    ? 'Saving moment for offline viewing'
    : offlineMessage || (saved ? 'Saved on this device' : 'Save this moment and try to make it available offline');
  return <span className="relative inline-flex">
    <button onClick={toggle} disabled={offlineState === 'saving'} data-testid={`button-save-${media.id}`} aria-label={saved ? 'Remove from saved' : 'Save media'} aria-pressed={saved} title={label} className={`relative flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all hover:scale-105 disabled:cursor-wait ${saved ? 'bg-accent text-accent-foreground' : 'bg-background/80 text-foreground hover:bg-accent'}`}>
      {offlineState === 'saving' ? <LoaderCircle size={16} className="animate-spin-soft" /> : offlineState === 'ready' ? <Check size={16} strokeWidth={3} /> : <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />}
    </button>
    <span role="status" aria-live="polite" className="sr-only">{label}</span>
  </span>;
}

function MediaCard({ media, index = 0 }: { media: Media; index?: number }) {
  return (
    <article data-testid={`card-media-${media.id}`} className="group photo-card animate-rise overflow-hidden rounded-[1.2rem] border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/45" style={{ animationDelay: `${index * 55}ms` }}>
        <div className={`relative overflow-hidden ${index % 5 === 2 ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}>
          <Link href={`/media/${media.id}`} aria-label={`View ${media.title}`} className="absolute inset-0 block">
            <MediaVisual media={media} className="transition-transform duration-700 group-hover:scale-[1.045]" />
          </Link>
          <div className="absolute right-3 top-3"><SaveButton media={media} /></div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur-md"><MapPin size={11} className="text-primary" /> {media.location || 'Kenya'}</div>
        </div>
        <div className="p-4 sm:p-[1.15rem]">
          <div className="mb-2 flex items-center justify-between gap-3"><span className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-primary">{media.type === 'image' ? 'Photograph' : 'Short clip'}</span><span className="font-mono-ui text-[9px] text-muted-foreground">{formatWhen(media.createdAt)}</span></div>
          <Link href={`/media/${media.id}`} className="block" data-testid={`link-card-title-${media.id}`}><h3 className="line-clamp-2 font-display text-[1.2rem] font-semibold leading-[1.08] tracking-[-.025em] transition-colors group-hover:text-primary">{media.title}</h3></Link>
          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted-foreground"><span>by <strong className="font-semibold text-foreground">{media.uploaderName || 'A neighbour'}</strong></span><span className="font-mono-ui">{media.views.toLocaleString('en-KE')} views</span></div>
        </div>
    </article>
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
      <section className="mx-auto max-w-[1440px] px-5 pb-9 pt-10 sm:px-8 sm:pt-16">
        <div className="grid items-center gap-9 lg:grid-cols-[.92fr_1.08fr]">
          <div className="animate-rise">
            <div className="mb-5 flex items-center gap-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.2em] text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> A view from everywhere</div>
            <h1 className="max-w-3xl font-display text-[clamp(3.45rem,7.5vw,7.2rem)] font-semibold leading-[.88] tracking-[-.075em]">Kenya,<br /><span className="text-primary italic">as it happens.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">A living window into the places, people and little moments shaping the day. Shared by the people who are there.</p>
            <div className="mt-8 flex items-center gap-3 font-mono-ui text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span className="h-px w-8 bg-accent" /> Nairobi · Mombasa · Kisumu · everywhere</div>
          </div>
          {media[0] ? <Link href={`/media/${media[0].id}`} data-testid={`link-featured-media-${media[0].id}`} className="group relative block min-h-[270px] overflow-hidden rounded-[1.6rem] bg-secondary shadow-[0_25px_60px_hsl(var(--foreground)/.15)] sm:min-h-[370px]">
            <MediaVisual media={media[0]} eager className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.035]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102c2d]/90 via-[#102c2d]/15 to-transparent" />
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-3 py-2 font-mono-ui text-[9px] uppercase tracking-[.16em] text-white backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> From the community</div>
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/75"><MapPin size={13} /> {media[0].location || 'Kenya'} <span className="mx-1 text-white/45">/</span> {formatWhen(media[0].createdAt)}</span>
              <div className="flex items-end justify-between gap-4"><h2 className="max-w-xl font-display text-3xl font-semibold leading-[.98] tracking-[-.04em] sm:text-5xl">{media[0].title}</h2><span className="mb-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/50 transition-colors group-hover:bg-accent group-hover:text-foreground sm:flex"><ArrowUpRight size={19} /></span></div>
            </div>
          </Link> : <div className="hero-panel relative flex min-h-[270px] overflow-hidden rounded-[1.6rem] p-6 text-secondary-foreground sm:min-h-[370px] sm:p-9">
            <div className="hero-orbit absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full border-[1px] border-accent/35 before:absolute before:inset-8 before:rounded-full before:border before:border-primary/40 after:absolute after:inset-20 after:rounded-full after:border after:border-accent/20" />
            <div className="absolute bottom-10 right-14 h-4 w-4 rounded-full bg-accent shadow-[0_0_0_10px_hsl(var(--accent)/.12)]" />
            <div className="relative flex flex-col justify-between"><Sparkles size={23} className="text-accent" /><p className="max-w-[360px] font-display text-3xl font-semibold leading-tight sm:text-5xl">Everyday life,<br /><span className="text-accent italic">in its own frame.</span></p><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary-foreground/60">A living noticeboard for Kenya</span></div>
          </div>}
        </div>
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/75 p-3 shadow-sm md:flex-row md:items-center md:justify-between md:px-4">
          <label className="relative flex w-full max-w-lg items-center">
            <Search size={18} className="absolute left-4 text-primary" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-media" type="search" placeholder="Find a place, person or moment" className="h-12 w-full rounded-xl border border-transparent bg-background pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
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
        <div className="mb-7 flex items-end justify-between gap-4"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">The neighbourhood window</span><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.045em] sm:text-4xl">The pulse right now</h2></div><span className="rounded-full bg-accent/35 px-3 py-1.5 font-mono-ui text-[10px] text-foreground">{media.length ? `${media.length} ${media.length === 1 ? 'moment' : 'moments'}` : 'Waiting for the first moment'}</span></div>
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    setFullscreenAvailable(Boolean(document.fullscreenEnabled && viewerRef.current?.requestFullscreen));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const share = async () => {
    if (!media) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: media.title, text: media.description, url: window.location.href });
      } else {
        await navigator.clipboard?.writeText(window.location.href);
      }
    } catch {
      // A cancelled share sheet should not interrupt the viewer.
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRef.current?.requestFullscreen?.();
    } catch {
      // The full-viewport viewer remains usable when browser fullscreen is unavailable.
    }
  };

  const goBack = () => setLocation('/');
  if (mediaQuery.isLoading) {
    return (
      <div className="media-route-state">
        <button onClick={goBack} data-testid="button-detail-back" aria-label="Back to the feed" className="media-viewer-back"><ArrowLeft size={18} /></button>
        <LoaderCircle className="animate-spin-soft text-accent" size={30} />
      </div>
    );
  }
  if (mediaQuery.isError || !media) {
    return (
      <div className="media-route-state">
        <button onClick={goBack} data-testid="button-detail-back" aria-label="Back to the feed" className="media-viewer-back"><ArrowLeft size={18} /></button>
        <div className="max-w-sm px-6 text-center">
          <CircleAlert className="mx-auto mb-4 text-accent" size={28} />
          <h1 className="font-display text-2xl font-bold">This moment moved on.</h1>
          <p className="mt-2 text-sm text-white/65">We could not load that media.</p>
          <button onClick={() => mediaQuery.refetch()} data-testid="button-retry-media" className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-foreground">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <section ref={viewerRef} data-testid="media-fullscreen-viewer" className="media-viewer relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {media.type === 'video' ? (
          <video
            ref={videoRef}
            src={mediaUrl(media.objectPath)}
            poster={media.thumbnailObjectPath ? mediaUrl(media.thumbnailObjectPath) : undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={media.title}
            data-testid="video-fullscreen-media"
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={mediaUrl(media.objectPath)}
            alt={media.title}
            draggable={false}
            style={{ transform: `scale(${zoom})` }}
            data-testid="image-fullscreen-media"
            className="h-full w-full select-none object-contain transition-transform duration-300"
          />
        )}
        <div className="media-viewer-shade pointer-events-none absolute inset-0" />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-7">
        <button onClick={goBack} data-testid="button-detail-back" aria-label="Back to the feed" title="Back to the feed" className="media-viewer-control">
          <ArrowLeft size={18} /><span className="hidden sm:inline">Back to pulse</span>
        </button>
        <div className="flex items-center gap-2">
          {media.type === 'image' && (
            <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/35 p-1 text-white backdrop-blur-md">
              <button onClick={() => setZoom(Math.max(1, zoom - 0.25))} data-testid="button-zoom-out" aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"><ZoomOut size={16} /></button>
              <span className="font-mono-ui px-1 text-[10px]">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(2.5, zoom + 0.25))} data-testid="button-zoom-in" aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"><ZoomIn size={16} /></button>
            </div>
          )}
          <SaveButton media={media} />
          <button onClick={share} data-testid="button-share-media" aria-label="Share this moment" title="Share this moment" className="media-viewer-control"><Share2 size={17} /></button>
          {fullscreenAvailable && (
            <button onClick={toggleFullscreen} data-testid="button-toggle-fullscreen" aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} title={isFullscreen ? 'Exit full screen' : 'Enter full screen'} className="media-viewer-control">
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`relative z-10 mt-auto w-full px-5 pt-24 sm:px-9 ${media.type === 'video' ? 'pb-[calc(env(safe-area-inset-bottom)+5.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom)+1.5rem)]'}`}
      >
        <div className="max-w-4xl">
          <span className="inline-flex rounded-full border border-white/20 bg-black/35 px-3 py-1.5 font-mono-ui text-[9px] uppercase tracking-[.18em] text-accent backdrop-blur-md">
            {media.type === 'image' ? 'A photograph' : 'Community clip'}
          </span>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-[.95] tracking-[-.05em] drop-shadow-md sm:text-5xl">{media.title}</h1>
          {media.description && <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{media.description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/80">
            <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-2 backdrop-blur-md"><MapPin size={13} className="text-accent" />{media.location || 'Kenya'}</span>
            <span className="rounded-full bg-black/35 px-3 py-2 backdrop-blur-md">{formatWhen(media.createdAt)}</span>
            <span className="rounded-full bg-black/35 px-3 py-2 font-mono-ui text-[10px] backdrop-blur-md">{media.views.toLocaleString('en-KE')} views</span>
            <span className="rounded-full bg-black/35 px-3 py-2 backdrop-blur-md">Shared by {media.uploaderName || 'A neighbour'}</span>
          </div>
        </div>
      </div>
    </section>
  );
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
  return (
    <section className="bg-background px-5 py-12 text-foreground sm:px-8 sm:py-16">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">From around the same story</span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-.05em] sm:text-4xl">Related pictures</h2>
          </div>
          <span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Refreshes hourly</span>
        </div>
        <div className="related-media-rail">
          {items.map((item) => (
            <a key={item.imageUrl} href={item.sourceUrl} target="_blank" rel="noreferrer" data-testid={`related-image-${mediaId}`} className="related-media-card group">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-semibold leading-snug">{item.title}</p>
                <p className="mt-2 font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">{item.source}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function UploadPage() {
  const online = useOnlineStatus();
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
    if (!navigator.onLine) {
      setStage('error');
      setError('Reconnect to the internet before uploading or publishing.');
      return;
    }
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
  if (!online) return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-16 sm:py-24"><div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-8 text-center shadow-[0_18px_50px_rgba(33,55,71,.08)] sm:p-14"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-900"><WifiOff size={28} /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Offline mode</span><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">Publishing needs<br /><span className="text-primary">internet.</span></h1><p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Your files are never sent while offline. Reconnect to sign in and publish securely.</p><Link href="/" data-testid="link-offline-browse" className="mt-8 inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 font-bold text-secondary-foreground"><ArrowLeft size={16} /> Back to the feed</Link></div></div>;
  if (authLoading) return <div className="mx-auto max-w-3xl px-5 py-20"><div className="skeleton h-7 w-32 rounded" /><div className="skeleton mt-4 h-16 w-3/4 rounded" /><div className="skeleton mt-10 h-72 rounded-2xl" /></div>;
  if (!auth?.user) return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-16 sm:py-24"><div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-8 text-center shadow-[0_18px_50px_rgba(33,55,71,.08)] sm:p-14"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent"><UploadCloud size={28} /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Contributor access</span><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">Bring the next<br /><span className="text-primary">moment.</span></h1><p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Log in to upload a photo or short clip. Your view of Kenya belongs here.</p><button onClick={login} data-testid="button-upload-login" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"><LogIn size={17} /> Log in to share</button></div></div>;
  if (stage === 'done') return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-16"><div className="mx-auto max-w-xl rounded-[1.5rem] border border-border bg-card p-8 text-center sm:p-14"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-accent"><Check size={30} strokeWidth={3} /></div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Published to the pulse</span><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">That’s a wrap.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your moment is now live for people around Kenya to discover.</p><div className="mt-8 flex justify-center gap-3"><Link href="/" data-testid="link-upload-done-feed" className="rounded-full bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">See the feed</Link><button onClick={() => { setStage('idle'); setFile(null); setTitle(''); setDescription(''); setLocation(''); setProgress(0); }} data-testid="button-upload-another" className="rounded-full border border-border px-5 py-3 text-sm font-bold hover:border-primary hover:text-primary">Share another</button></div></div></div>;
  return <div className="pulse-grid min-h-[calc(100dvh-9rem)] px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-5xl"><div className="mb-10 max-w-2xl"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your corner of the story</span><h1 className="mt-3 font-display text-5xl font-bold leading-[.9] tracking-[-.07em] sm:text-7xl">Share what<br /><span className="text-primary">you see.</span></h1><p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">Photos and short clips from the people who are actually there. Keep it clear, keep it kind, keep it moving.</p></div><div className="grid gap-8 lg:grid-cols-[1fr_.8fr]"><div><button onClick={() => inputRef.current?.click()} data-testid="button-select-file" className={`group relative flex min-h-[310px] w-full flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-all ${file ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary hover:bg-primary/5'}`}><input ref={inputRef} type="file" accept="image/*,video/*" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) { setFile(selected); setProgress(0); } }} data-testid="input-upload-file" className="hidden" />{file ? <><div className="relative mb-5 h-28 w-40 overflow-hidden rounded-xl bg-secondary">{file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt="Selected preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-accent"><FileVideo size={38} /></div>}</div><span className="max-w-full truncate font-display font-bold">{file.name}</span><span className="mt-1 font-mono-ui text-[10px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB · ready to share</span><span className="mt-4 text-xs font-bold text-primary">Choose a different file</span></> : <><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent transition-transform group-hover:rotate-3"><UploadCloud size={29} /></div><span className="font-display text-xl font-bold">Drop a photo or clip here</span><span className="mt-2 text-sm text-muted-foreground">or tap to browse · JPG, PNG, MP4 up to 100 MB</span></>}</button>{stage !== 'idle' && stage !== 'error' && <div className="mt-4 rounded-xl border border-border bg-card p-4"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{stage === 'requesting' ? 'Preparing a secure upload…' : stage === 'uploading' ? 'Sending your file…' : 'Putting it on the pulse…'}</span><span className="font-mono-ui text-primary">{stage === 'uploading' ? `${progress}%` : '…'}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${stage === 'uploading' ? Math.max(progress, 8) : 100}%` }} /></div></div>}{stage === 'error' && <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><CircleAlert size={18} className="mt-0.5 shrink-0 text-destructive" /><div><strong className="font-semibold">Upload paused.</strong><p className="mt-1 text-muted-foreground">{error}</p></div></div>}</div><div className="rounded-[1.5rem] border border-border bg-card p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-mono-ui text-xs text-accent">02</span><h2 className="font-display text-xl font-bold">Give it a little context</h2></div><div className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Headline <em className="font-normal normal-case text-primary">required</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="input-upload-title" placeholder="What are we looking at?" className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Short note</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} data-testid="input-upload-description" placeholder="The detail that makes this moment yours..." rows={4} className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Where was this?</span><input value={location} onChange={(event) => setLocation(event.target.value)} data-testid="input-upload-location" placeholder="e.g. Gikambura, Kiambu" className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary" /></label><button disabled={!file || !title.trim() || stage === 'requesting' || stage === 'uploading' || stage === 'publishing'} onClick={submit} data-testid="button-submit-upload" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">{stage === 'requesting' || stage === 'uploading' || stage === 'publishing' ? <LoaderCircle size={18} className="animate-spin-soft" /> : <UploadCloud size={18} />} {stage === 'requesting' ? 'Preparing…' : stage === 'uploading' ? 'Uploading…' : stage === 'publishing' ? 'Publishing…' : 'Publish to the pulse'}</button></div></div></div></div></div>;
}

function SavedPage() {
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(readSaved);
  const mediaQuery = useListMedia({ type: 'all', limit: 100 });
  useEffect(() => {
    const update = () => setSaved(readSaved());
    window.addEventListener('picha-saved-change', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('picha-saved-change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const mediaById = new Map(readSavedMedia().map((item) => [item.id, item]));
  for (const item of mediaQuery.data || []) {
    if (saved.includes(item.id)) mediaById.set(item.id, item);
  }
  const media = saved.map((id) => mediaById.get(id)).filter((item): item is Media => Boolean(item));
  const showLoading = mediaQuery.isLoading && media.length === 0 && saved.length > 0;
  const showError = mediaQuery.isError && media.length === 0 && saved.length > 0;
  return <div className="pulse-grid min-h-[calc(100dvh-9rem)]"><section className="mx-auto max-w-[1440px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20"><div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your pocket of Kenya</span><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.07em] sm:text-7xl">Saved<br /><span className="text-primary italic">moments.</span></h1></div><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Saved moments stay on this device. Photos and clip posters can be cached for offline viewing; video playback needs internet.</p></div>{showLoading ? <FeedSkeleton /> : showError ? <ErrorState onRetry={() => mediaQuery.refetch()} /> : media.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{media.map((item, index) => <MediaCard key={item.id} media={item} index={index} />)}</div> : <div className="rounded-[1.5rem] border border-dashed border-border bg-card/60 px-6 py-20 text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"><Bookmark size={24} /></div><h2 className="font-display text-2xl font-semibold">Nothing tucked away yet.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Tap the bookmark on any moment to keep its details and try to save its photo or poster offline.</p><button onClick={() => setLocation('/')} data-testid="button-saved-browse" className="mt-6 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5">Browse the pulse</button></div>}</section></div>;
}

function AboutPage() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); };
    const installed = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  const install = async () => { if (installEvent) { await installEvent.prompt(); setInstallEvent(null); } else setShowGuide(true); };
  return <div className="pulse-grid"><section className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 sm:px-8 sm:pt-24"><div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">About the pulse</span><h1 className="mt-4 max-w-3xl font-display text-6xl font-bold leading-[.86] tracking-[-.08em] sm:text-8xl">Kenya,<br /><span className="text-primary">in frame.</span></h1><p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">Picha Pulse is a daily window into what people across Kenya are seeing, making, trading, and talking about right now.</p></div><div className="flex min-h-[280px] flex-col justify-between rounded-[1.5rem] bg-primary p-7 text-primary-foreground"><div className="flex justify-between"><span className="font-display text-xl font-bold tracking-[-.05em]">picha<span className="text-accent">pulse</span></span><ArrowUpRight size={23} /></div><p className="max-w-xs font-display text-3xl font-bold leading-tight">The people closest to the moment tell it best.</p><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary-foreground/65">Built for the everyday extraordinary</span></div></div></section><section className="border-y border-border bg-card"><div className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:grid-cols-3 sm:px-8">{[['01', 'Look around', 'Browse trade photography and short community clips from all over the country.'], ['02', 'Keep what matters', 'Save the moments you want to find again. No account needed for your personal pocket.'], ['03', 'Put it on the map', 'Log in, upload a photo or clip, and give your corner of Kenya a little context.']].map(([number, title, body]) => <div key={number} className="border-b border-border py-8 sm:border-b-0 sm:border-r sm:px-8 sm:py-12 sm:first:pl-0 sm:last:border-r-0"><span className="font-mono-ui text-xs text-primary">{number}</span><h2 className="mt-8 font-display text-2xl font-bold tracking-[-.04em]">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p></div>)}</div></section><section id="install" className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24"><div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Carry it with you</span><h2 className="mt-3 font-display text-4xl font-bold tracking-[-.06em] sm:text-6xl">A better<br />daily check-in.</h2></div><div className="rounded-[1.5rem] border border-border bg-card p-7 sm:p-10"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent"><MonitorDown size={23} /></div><div><h3 className="font-display text-2xl font-bold tracking-[-.04em]">Add Picha Pulse to your home screen</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Open the feed like an app, without hunting for a tab. It is quick, lightweight, and made for the daily scroll. Your browser will ask before installing.</p><button onClick={install} data-testid="button-install-app" className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5">{installEvent ? <Download size={16} /> : <ExternalLink size={16} />} {installEvent ? 'Install Picha Pulse' : 'Show install steps'}</button></div></div>{showGuide && <div className="mt-4 rounded-xl bg-muted p-5 text-sm leading-relaxed"><p className="font-bold">iPhone or iPad</p><p className="mt-1 text-muted-foreground">Open this page in Safari, tap Share, then choose “Add to Home Screen”.</p><p className="mt-4 font-bold">Android (Chrome)</p><p className="mt-1 text-muted-foreground">Tap “Install Picha Pulse” above when offered, or open the browser menu and choose “Install app” or “Add to Home screen”.</p><p className="mt-4 font-bold">Desktop (Chrome or Edge)</p><p className="mt-1 text-muted-foreground">Use the install icon in the address bar or select “Install Picha Pulse” from the browser menu.</p></div>}</div></div></section></div>;
}

function Router() {
  return <RoutedErrorBoundary><AppShell><Switch><Route path="/" component={Home} /><Route path="/upload" component={UploadPage} /><Route path="/saved" component={SavedPage} /><Route path="/about" component={AboutPage} /><Route path="/media/:id" component={MediaDetail} /><Route component={NotFound} /></Switch></AppShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdultAccessGate>
        <VisitorSession />
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AdultAccessGate>
    </QueryClientProvider>
  );
}

export default App;