import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, Bookmark, Boxes, Check,
  ChevronDown, CircleAlert, Code2, Compass, Download, ExternalLink, Eye,
  Flag, Gamepad2, Github, Hammer, Home as HomeIcon, Layers3, Link2, LockKeyhole,
  Menu, PackageOpen, Plus, RefreshCcw, Search, ShieldCheck,
  Sparkles, Terminal, Users, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getGetAdminOverviewQueryKey, getGetAdminStatusQueryKey, getGetDiscordVerificationStatusQueryKey,
  getGetProjectQueryKey, getGetUserProfileQueryKey, getListAdminProjectsQueryKey,
  getListFavoritesQueryKey, getListProjectsQueryKey, getListReportsQueryKey, getGetMeQueryKey,
  useConfirmRobloxLink, useCreateDiscordVerification, useCreateProject, useCreateRobloxLink,
  useGetAdminOverview, useGetAdminStatus, useGetDiscordVerificationStatus, useGetMe,
  useGetProject, useGetStats, useGetUserProfile, useListAdminProjects, useListCreators,
  useListFavorites, useListProjects, useListReports, useModerateProject, useReportProject,
  useToggleFavorite, useUpdateMe,
  setAuthTokenGetter, setBaseUrl,
} from '@workspace/api-client-react';
import {
  Compatibility, ProjectType, ReportInputReason, type Project, type UserProfile,
} from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
const apiUrl = (import.meta.env.VITE_API_URL || '').trim() || null;

type AuthContextValue = {
  isSignedIn: boolean;
  openSignIn: () => void;
  openSignUp: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  isSignedIn: false,
  openSignIn: () => undefined,
  openSignUp: () => undefined,
  signOut: () => undefined,
});
type IconType = LucideIcon;

const navItems: { href: string; label: string; icon: IconType }[] = [
  { href: '/', label: 'Inicio', icon: HomeIcon },
  { href: '/explore', label: 'Explorar', icon: Compass },
  { href: '/games', label: 'Juegos', icon: Gamepad2 },
  { href: '/kits', label: 'Kits', icon: Boxes },
  { href: '/resources', label: 'Recursos', icon: Layers3 },
];

const typeLabels: Record<string, string> = {
  game: 'Juego', kit: 'Kit', script: 'Script', map: 'Mapa', system: 'Sistema', resource: 'Recurso', other: 'Otro',
};

const typeIcons: Record<string, IconType> = {
  game: Gamepad2, kit: Boxes, script: Terminal, map: Layers3, system: Hammer, resource: PackageOpen, other: Sparkles,
};

function formatNumber(value?: number) {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('es', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

function formatDate(date?: string) {
  if (!date) return 'Fecha desconocida';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Fecha desconocida' : parsed.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name?: string) {
  return (name || 'IS').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function useAuthGate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const auth = useContext(AuthContext);
  return () => {
    if (auth.isSignedIn) return true;
    toast({ title: 'Inicia sesión para continuar', description: 'Crea tu cuenta gratis y desbloquea esta acción.' });
    setLocation('/sign-in');
    return false;
  };
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
      <img src={`${basePath}/rokito-studios-logo.png`} alt="Rokito Studios" className="size-9 rounded-xl object-cover object-[50%_22%] shadow-[0_8px_24px_hsl(var(--primary)/.2)]" />
      <span className="hidden text-sm font-extrabold tracking-[-.04em] sm:block">ROKITO<span className="text-primary">.</span></span>
    </Link>
  );
}

function Avatar({ user, size = 'md' }: { user?: Partial<UserProfile> | null; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'size-16 text-lg' : size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs';
  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.displayName || user.username || 'Creador'} className={`${dimensions} rounded-full object-cover ring-2 ring-background`} data-testid={`img-avatar-${user.username || 'profile'}`} />
  ) : (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground ring-2 ring-background`} data-testid={`avatar-${user?.username || 'profile'}`}>
      {initials(user?.displayName || user?.username)}
    </span>
  );
}

function Button({ children, variant = 'primary', className = '', onClick, type = 'button', disabled = false, testId }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; testId?: string;
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
    ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
    danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  };
  return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`} data-testid={testId}>{children}</button>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const authGate = useAuthGate();
  const auth = useContext(AuthContext);
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {navItems.map((item) => {
              const ActiveIcon = item.icon;
              const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
              return <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`} data-testid={`link-nav-${item.label.toLowerCase()}`}><ActiveIcon size={16} />{item.label}</Link>;
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/publish" className="hidden items-center gap-2 rounded-xl border border-primary/40 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 sm:flex" data-testid="link-publish-header"><Plus size={16} /> Publicar</Link>
            <Button variant="secondary" className="hidden min-h-10 px-3 sm:inline-flex" onClick={auth.isSignedIn ? auth.signOut : auth.openSignIn} testId={auth.isSignedIn ? "button-sign-out-header" : "button-sign-in-header"}>{auth.isSignedIn ? 'Salir' : 'Entrar'}</Button>
            <button className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden" onClick={() => setMobileMenu((value) => !value)} aria-label="Abrir menú" data-testid="button-mobile-menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {mobileMenu && <div className="border-t border-border/70 bg-background px-4 py-3 md:hidden"><div className="grid grid-cols-2 gap-2">{navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-3 text-sm font-semibold" data-testid={`link-mobile-${item.label.toLowerCase()}`}><item.icon size={16} />{item.label}</Link>)}<Link href="/creators" className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-3 text-sm font-semibold" data-testid="link-mobile-creators"><Users size={16} /> Creadores</Link><Link href="/community" className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-3 text-sm font-semibold" data-testid="link-mobile-community"><Zap size={16} /> Comunidad</Link></div></div>}
      </header>
      <main className="page-enter">{children}</main>
      <footer className="border-t border-border/80 bg-card/40">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div><Logo /><p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">El punto de encuentro para quienes construyen el próximo juego.</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground"><Link href="/community" className="hover:text-foreground" data-testid="link-footer-community">Comunidad</Link><Link href="/terms" className="hover:text-foreground" data-testid="link-footer-terms">Términos</Link><Link href="/privacy" className="hover:text-foreground" data-testid="link-footer-privacy">Privacidad</Link><Link href="/settings" className="hover:text-foreground" data-testid="link-footer-settings">Ajustes</Link></div>
          <p className="mono text-[11px] uppercase tracking-[.16em] text-muted-foreground">Rokito Studios © 2026</p>
        </div>
      </footer>
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
        {navItems.map((item) => <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${location === item.href ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-bottom-${item.label.toLowerCase()}`}><item.icon size={18} />{item.label}</Link>)}
      </nav>
    </div>
  );
}

function SectionHeading({ eyebrow, title, href, action = 'Ver todo' }: { eyebrow?: string; title: string; href?: string; action?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-3"><div>{eyebrow && <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h2 className="text-xl font-extrabold tracking-[-.04em] sm:text-2xl">{title}</h2></div>{href && <Link href={href} className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-primary" data-testid={`link-see-${title.toLowerCase().replace(/\s/g, '-')}`}>{action}<ArrowUpRight size={14} /></Link>}</div>;
}

function ProjectArt({ project, large = false }: { project: Project; large?: boolean }) {
  const Icon = typeIcons[project.type] || Sparkles;
  return project.thumbnailUrl ? <img src={project.thumbnailUrl} alt={project.name} className={`w-full object-cover ${large ? 'h-72 sm:h-96' : 'h-40'}`} data-testid={`img-project-${project.id}`} /> : (
    <div className={`surface-grid relative flex w-full items-end overflow-hidden bg-secondary ${large ? 'h-72 sm:h-96' : 'h-40'}`} data-testid={`art-project-${project.id}`}>
      <div className="absolute -right-5 -top-10 size-36 rounded-full border-[18px] border-primary/15" />
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-background/70 to-transparent" />
      <div className="relative z-10 flex w-full items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary"><Icon size={20} /></span><span className="mono text-[10px] font-medium uppercase tracking-[.15em] text-foreground/70">{typeLabels[project.type] || 'Proyecto'}</span></div>
    </div>
  );
}

function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  const authGate = useAuthGate();
  const auth = useContext(AuthContext);
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();
  const toggle = () => {
    if (!authGate()) return;
    toggleFavorite.mutate({ id: project.id }, {
      onSuccess: (data) => {
        toast({ title: data.favorited ? 'Guardado en tu biblioteca' : 'Quitado de guardados' });
        queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
      },
      onError: () => toast({ title: 'No se pudo actualizar el guardado', variant: 'destructive' }),
    });
  };
  return (
    <article className={`group overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_hsl(222_22%_2%/.28)] ${compact ? 'min-w-[280px]' : ''}`} data-testid={`card-project-${project.id}`}>
      <Link href={`/project/${project.id}`} className="block" data-testid={`link-project-${project.id}`}><div className="relative"><ProjectArt project={project} /><span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">{typeLabels[project.type]}</span><button type="button" onClick={(event) => { event.preventDefault(); toggle(); }} className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg bg-background/80 text-muted-foreground backdrop-blur-md hover:text-primary" aria-label="Guardar proyecto" data-testid={`button-favorite-${project.id}`}><Bookmark size={16} /></button></div></Link>
      <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/project/${project.id}`} className="line-clamp-1 text-sm font-extrabold tracking-[-.02em] hover:text-primary" data-testid={`link-project-title-${project.id}`}>{project.name}</Link><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground" data-testid={`text-project-description-${project.id}`}>{project.description}</p></div>{project.verified && <BadgeCheck className="mt-0.5 shrink-0 text-primary" size={16} />}</div><div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><Link href={`/user/${project.author.username}`} className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid={`link-project-author-${project.id}`}><Avatar user={project.author} size="sm" /><span className="truncate">{project.author.displayName || project.author.username}</span></Link><span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><Eye size={13} />{formatNumber(project.views)}</span></div></div>
    </article>
  );
}

function ProjectRow({ project, onModerate }: { project: Project; onModerate?: (status: 'approved' | 'rejected') => void }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center" data-testid={`row-project-${project.id}`}><div className="flex min-w-0 flex-1 items-center gap-3"><div className="size-12 shrink-0 overflow-hidden rounded-lg"><ProjectArt project={project} /></div><div className="min-w-0"><p className="truncate text-sm font-bold">{project.name}</p><p className="text-xs text-muted-foreground">{project.author.displayName || project.author.username} · {formatDate(project.createdAt)}</p></div></div><div className="flex items-center gap-2 pl-14 sm:pl-0"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${project.status === 'approved' ? 'bg-emerald-400/10 text-emerald-300' : project.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{project.status}</span>{onModerate && <><Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => onModerate('approved')} testId={`button-approve-${project.id}`}><Check size={14} /> Aprobar</Button><Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => onModerate('rejected')} testId={`button-reject-${project.id}`}><X size={14} /> Rechazar</Button></>}</div></div>;
}

function EmptyState({ icon: Icon = PackageOpen, title, description, action, onAction }: { icon?: IconType; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center" data-testid="empty-state"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Icon size={22} /></span><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>{action && onAction && <Button className="mt-5 min-h-9 text-xs" onClick={onAction} testId="button-empty-action">{action}</Button>}</div>;
}

function LoadingGrid() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-border/70 bg-card" data-testid={`skeleton-project-${item}`}><div className="shimmer h-40" /><div className="space-y-3 p-4"><div className="shimmer h-4 w-2/3 rounded" /><div className="shimmer h-3 w-full rounded" /><div className="shimmer h-3 w-1/2 rounded" /></div></div>)}</div>;
}

function HeroSearch({ onSearch }: { onSearch?: (value: string) => void }) {
  const [value, setValue] = useState('');
  const [, setLocation] = useLocation();
  const submit = (event: FormEvent) => { event.preventDefault(); onSearch?.(value); setLocation(`/explore${value ? `?search=${encodeURIComponent(value)}` : ''}`); };
  return <form onSubmit={submit} className="relative flex w-full max-w-xl items-center" data-testid="form-hero-search"><Search className="absolute left-4 text-muted-foreground" size={18} /><input value={value} onChange={(event) => setValue(event.target.value)} className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-28 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" placeholder="Busca juegos, kits, scripts..." aria-label="Buscar proyectos" data-testid="input-hero-search" /><Button type="submit" className="absolute right-2 min-h-10 px-4" testId="button-hero-search">Buscar</Button></form>;
}

function Home() {
  const statsQuery = useGetStats();
  const stats = statsQuery.data;
  const featured = stats?.featured ?? [];
  const recent = stats?.recent ?? [];
  const games = stats?.games ?? [];
  const kits = stats?.kits ?? [];
  return <Shell><div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
    <section className="relative overflow-hidden border-x border-border/60 px-0 pb-16 pt-16 sm:pb-24 sm:pt-24"><div className="pointer-events-none absolute -right-40 -top-48 size-[560px] rounded-full border border-primary/10" /><div className="pointer-events-none absolute -right-24 -top-32 size-[360px] rounded-full border border-primary/10" /><div className="grid items-end gap-12 lg:grid-cols-[1.1fr_.9fr]"><div className="rise-in max-w-3xl"><div className="mb-6 flex items-center gap-2 text-xs font-bold text-primary"><span className="size-2 rounded-full bg-primary" /> Comunidad abierta para creadores</div><h1 className="max-w-3xl text-balance text-5xl font-extrabold leading-[.96] tracking-[-.07em] sm:text-7xl">Construye algo que la gente <span className="text-primary">quiera jugar.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Descubre proyectos de Roblox Studio y Studio Lite hechos por una comunidad que comparte el proceso, no solo el resultado.</p><div className="mt-8"><HeroSearch /></div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Check size={14} className="text-primary" /> Recursos revisados</span><span className="flex items-center gap-2"><Check size={14} className="text-primary" /> Studio + Lite</span><span className="flex items-center gap-2"><Check size={14} className="text-primary" /> Sin ruido</span></div></div><div className="rise-in delay-2 relative hidden min-h-64 overflow-hidden rounded-3xl border border-border bg-card p-6 lg:block"><div className="absolute inset-0 surface-grid opacity-60" /><div className="relative flex h-full flex-col justify-between"><div className="flex items-start justify-between"><span className="mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">/ comunidad / en vivo</span><span className="flex items-center gap-2 text-xs text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300" /> Activa ahora</span></div><div><p className="text-4xl font-extrabold tracking-[-.06em]">{formatNumber(stats?.totalViews)}<span className="text-primary">+</span></p><p className="mt-1 text-sm text-muted-foreground">visitas a recursos compartidos</p></div><div className="flex items-center gap-2"><div className="flex -space-x-2">{[1, 2, 3, 4].map((item) => <span key={item} className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[9px] font-bold">{String.fromCharCode(64 + item)}</span>)}</div><span className="text-xs text-muted-foreground">creadores construyendo hoy</span></div></div></div></div></section>
    <section className="border-x border-border/60 border-t px-0 py-8"><div className="grid grid-cols-2 divide-x divide-border/70 sm:grid-cols-4"><Stat value={stats?.projectCount} label="Proyectos publicados" /><Stat value={stats?.creatorCount} label="Creadores" /><Stat value={stats?.verifiedCount} label="Verificados" /><Stat value={stats?.totalViews} label="Visitas totales" /></div></section>
    <section className="border-x border-border/60 border-t px-0 py-12 sm:py-16"><SectionHeading eyebrow="selección editorial" title="Lo que está sonando" href="/explore" /><div className="flex snap-x gap-4 overflow-x-auto pb-3">{statsQuery.isLoading ? <div className="flex w-full gap-4"><div className="shimmer h-72 min-w-[280px] rounded-2xl" /><div className="shimmer h-72 min-w-[280px] rounded-2xl" /></div> : featured.length ? featured.map((project) => <ProjectCard key={project.id} project={project} compact />) : <div className="w-full"><EmptyState title="La selección se está formando" description="Todavía no hay proyectos destacados. Publica el primero y abre la conversación." action="Publicar proyecto" onAction={() => { window.location.href = `${basePath}/publish`; }} /></div>}</div></section>
    <section className="border-x border-border/60 border-t px-0 py-12 sm:py-16"><SectionHeading eyebrow="recién llegados" title="Últimos proyectos" href="/explore" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{statsQuery.isLoading ? <LoadingGrid /> : recent.length ? recent.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />) : <div className="sm:col-span-2 lg:col-span-3"><EmptyState title="Aún no hay proyectos públicos" description="Cuando la comunidad publique algo nuevo aparecerá aquí." /></div>}</div></section>
    <section className="grid gap-12 border-x border-border/60 border-t px-0 py-12 sm:py-16 lg:grid-cols-2"><div><SectionHeading eyebrow="juega" title="Juegos para probar" href="/games" /><div className="space-y-3">{games.length ? games.slice(0, 3).map((project) => <MiniProject key={project.id} project={project} />) : <EmptyState icon={Gamepad2} title="Todavía no hay juegos" description="Esta lista se actualiza en cuanto haya un juego aprobado." />}</div></div><div><SectionHeading eyebrow="acelera" title="Kits para construir" href="/kits" /><div className="space-y-3">{kits.length ? kits.slice(0, 3).map((project) => <MiniProject key={project.id} project={project} />) : <EmptyState icon={Boxes} title="Todavía no hay kits" description="Comparte un kit para darle una base sólida a otro creador." />}</div></div></section>
    <CommunityBand />
  </div></Shell>;
}

function Stat({ value, label }: { value?: number; label: string }) {
  return <div className="px-4 first:pl-0 last:pr-0 sm:px-7"><p className="text-2xl font-extrabold tracking-[-.05em] sm:text-3xl" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{formatNumber(value)}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:text-xs">{label}</p></div>;
}

function MiniProject({ project }: { project: Project }) {
  return <Link href={`/project/${project.id}`} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-primary/40" data-testid={`mini-project-${project.id}`}><div className="size-12 shrink-0 overflow-hidden rounded-lg"><ProjectArt project={project} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{project.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{project.category} · {project.compatibility === 'both' ? 'Studio + Lite' : project.compatibility}</p></div><ArrowUpRight size={16} className="text-muted-foreground" /></Link>;
}

function CommunityBand() {
  return <section className="border-x border-border/60 border-t px-0 py-14 sm:py-20"><div className="grid gap-8 overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mono text-[10px] uppercase tracking-[.18em] opacity-70">un lugar para volver</p><h2 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-[-.06em] sm:text-5xl">El próximo proyecto de tu equipo puede empezar aquí.</h2></div><div className="flex flex-wrap gap-3"><Link href="/creators" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-foreground px-5 text-sm font-bold text-primary hover:bg-primary-foreground/90" data-testid="link-community-creators">Conocer creadores <Users size={16} /></Link><Link href="/community" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary-foreground/30 px-5 text-sm font-bold hover:bg-primary-foreground/10" data-testid="link-community-learn">Cómo funciona <ArrowUpRight size={16} /></Link></div></div></section>;
}

function ExplorePage({ forcedType }: { forcedType?: string }) {
  const searchParams = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [type, setType] = useState(forcedType || '');
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined, compatibility: compatibility ? compatibility as typeof Compatibility[keyof typeof Compatibility] : undefined, type: type ? type as typeof ProjectType[keyof typeof ProjectType] : undefined, page: 1, pageSize: 18 }), [search, category, compatibility, type]);
  const projectsQuery = useListProjects(params);
  const projects = projectsQuery.data?.items ?? [];
  const title = forcedType === 'game' ? 'Juegos' : forcedType === 'kit' ? 'Kits' : forcedType === 'resource' ? 'Recursos' : 'Explorar proyectos';
  return <Shell><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="flex flex-col gap-8 border-b border-border/80 pb-10 lg:flex-row lg:items-end lg:justify-between"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">biblioteca comunitaria</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Busca algo para usar, estudiar o mejorar. Todo empieza con una idea compartida.</p></div><Link href="/publish" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90" data-testid="link-explore-publish"><Plus size={16} /> Publicar proyecto</Link></div><div className="mt-7 grid gap-3 md:grid-cols-[1fr_170px_170px_170px]"><label className="relative"><Search className="absolute left-3 top-3 text-muted-foreground" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary" placeholder="Buscar por nombre o tag" aria-label="Buscar proyectos" data-testid="input-project-search" /></label><FilterSelect value={type} onChange={setType} label="Tipo" options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} testId="select-project-type" /><FilterSelect value={compatibility} onChange={setCompatibility} label="Compatibilidad" options={[{ value: 'studio', label: 'Studio' }, { value: 'lite', label: 'Studio Lite' }, { value: 'both', label: 'Ambos' }]} testId="select-project-compatibility" /><FilterSelect value={category} onChange={setCategory} label="Categoría" options={[{ value: 'systems', label: 'Sistemas' }, { value: 'building', label: 'Construcción' }, { value: 'ui', label: 'UI / UX' }, { value: 'gameplay', label: 'Gameplay' }]} testId="select-project-category" /></div><div className="mt-10 flex items-center justify-between"><p className="text-sm text-muted-foreground" data-testid="text-project-total">{projectsQuery.isLoading ? 'Buscando...' : `${projectsQuery.data?.total ?? projects.length} resultados`}</p>{projectsQuery.isError && <button className="flex items-center gap-2 text-xs font-bold text-primary" onClick={() => projectsQuery.refetch()} data-testid="button-retry-projects"><RefreshCcw size={14} /> Reintentar</button>}</div><div className="mt-4">{projectsQuery.isLoading ? <LoadingGrid /> : projects.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <EmptyState icon={Search} title="No encontramos coincidencias" description="Prueba con otra búsqueda o quita alguno de los filtros. La biblioteca crece cada semana." action="Limpiar filtros" onAction={() => { setSearch(''); setCategory(''); setCompatibility(''); setType(forcedType || ''); }} />}</div></div></Shell>;
}

function FilterSelect({ value, onChange, label, options, testId }: { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[]; testId: string }) {
  return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-11 w-full appearance-none rounded-xl border border-border bg-card px-3 pr-9 text-sm outline-none focus:border-primary" data-testid={testId}><option value="">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground" size={15} /></div>;
}

function CreatorsPage() {
  const creatorsQuery = useListCreators({ pageSize: 30 });
  const creators = creatorsQuery.data ?? [];
  return <Shell><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="max-w-2xl"><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">personas detrás del código</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">Creadores que <span className="text-primary">comparten</span>.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Perfiles reales, procesos abiertos y recursos que pueden cambiar la forma en que construyes.</p></div><div className="mt-10">{creatorsQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="shimmer h-52 rounded-2xl" />)}</div> : creators.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{creators.map((creator) => <CreatorCard key={creator.id} creator={creator} />)}</div> : <EmptyState icon={Users} title="Aún no hay creadores destacados" description="Los perfiles aparecerán aquí cuando publiquen sus primeros proyectos." />}</div></div></Shell>;
}

function CreatorCard({ creator }: { creator: UserProfile }) {
  return <Link href={`/user/${creator.username}`} className="group rounded-2xl border border-border/80 bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40" data-testid={`card-creator-${creator.username}`}><div className="flex items-start justify-between"><Avatar user={creator} size="lg" /><span className="rounded-lg bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">{formatNumber(creator.projectCount)} proyectos</span></div><p className="mt-5 truncate font-extrabold tracking-[-.02em]">{creator.displayName || creator.username}</p><p className="mt-1 truncate text-xs text-muted-foreground">@{creator.username}</p>{creator.bio && <p className="mt-4 line-clamp-2 text-xs leading-5 text-muted-foreground">{creator.bio}</p>}<div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4 text-[10px] uppercase tracking-wide text-muted-foreground"><span>{creator.gameCount ?? 0} juegos</span><span>{creator.kitCount ?? 0} kits</span>{creator.discordVerified && <span className="ml-auto flex items-center gap-1 text-primary"><BadgeCheck size={13} /> Verificado</span>}</div></Link>;
}

function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const projectQuery = useGetProject(id, { query: { queryKey: getGetProjectQueryKey(id) } });
  const project = projectQuery.data;
  const authGate = useAuthGate();
  const reportProject = useReportProject();
  const favoriteProject = useToggleFavorite();
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>('spam');
  if (projectQuery.isLoading) return <Shell><div className="mx-auto max-w-5xl px-4 py-12"><div className="shimmer h-80 rounded-3xl" /><div className="mt-6 shimmer h-8 w-1/2 rounded" /></div></Shell>;
  if (!project) return <Shell><div className="mx-auto max-w-5xl px-4 py-16"><EmptyState icon={CircleAlert} title="Proyecto no encontrado" description="Puede que haya sido retirado o que el enlace esté incompleto." action="Volver a explorar" onAction={() => { window.location.href = `${basePath}/explore`; }} /></div></Shell>;
  const projectId = project?.id;
  const report = () => {
    if (!authGate() || !projectId) return;
    reportProject.mutate({ id: projectId, data: { reason: reason as typeof ReportInputReason[keyof typeof ReportInputReason] } }, {
      onSuccess: () => toast({ title: 'Gracias por avisarnos', description: 'Revisaremos el reporte.' }),
      onError: () => toast({ title: 'No se pudo enviar el reporte', variant: 'destructive' }),
    });
  };
  return <Shell><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><Link href="/explore" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-explore"><ArrowLeft size={15} /> Volver a explorar</Link><div className="overflow-hidden rounded-3xl border border-border bg-card"><ProjectArt project={project} large /><div className="p-5 sm:p-8"><div className="flex flex-col gap-7 lg:flex-row lg:justify-between"><div className="max-w-2xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">{typeLabels[project.type]}</span><span className="rounded-md bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{project.compatibility === 'both' ? 'Studio + Lite' : project.compatibility}</span>{project.verified && <span className="flex items-center gap-1 text-[10px] font-bold text-primary"><BadgeCheck size={14} /> Verificado</span>}</div><h1 className="mt-4 text-3xl font-extrabold tracking-[-.06em] sm:text-5xl" data-testid="text-project-name">{project.name}</h1><p className="mt-4 text-sm leading-7 text-muted-foreground" data-testid="text-project-full-description">{project.description}</p><div className="mt-5 flex flex-wrap gap-2">{project.tags.map((tag) => <span key={tag} className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground" data-testid={`tag-project-${tag}`}>#{tag}</span>)}</div></div><div className="flex shrink-0 flex-row gap-2 lg:flex-col"><Button onClick={authGate} testId="button-project-favorite"><Bookmark size={16} /> Guardar</Button>{project.downloadUrl && <a href={project.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-bold hover:bg-secondary/80" data-testid="link-project-download"><Download size={16} /> Descargar</a>}{project.robloxUrl && <a href={project.robloxUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-bold hover:bg-secondary/80" data-testid="link-project-roblox"><ExternalLink size={16} /> Ver en Roblox</a>}</div></div><div className="mt-8 grid gap-4 border-t border-border/70 pt-6 sm:grid-cols-3"><div className="flex items-center gap-3"><Avatar user={project.author} /><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Publicado por</p><Link href={`/user/${project.author.username}`} className="text-sm font-bold hover:text-primary" data-testid="link-project-detail-author">{project.author.displayName || project.author.username}</Link></div></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actualizado</p><p className="mt-1 text-sm font-semibold">{formatDate(project.updatedAt || project.createdAt)}</p></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Alcance</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold"><Eye size={14} className="text-primary" /> {formatNumber(project.views)} visitas</p></div></div><div className="mt-6 flex justify-end"><button className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive" onClick={() => setReportOpen(true)} data-testid="button-open-report"><Flag size={14} /> Reportar proyecto</button></div></div></div>{reportOpen && <Modal title="Reportar proyecto" onClose={() => setReportOpen(false)}><p className="text-sm text-muted-foreground">Ayúdanos a mantener la biblioteca útil. Elige un motivo para este reporte.</p><div className="mt-5 space-y-2">{Object.entries(ReportInputReason).map(([value, label]) => <button key={value} onClick={() => setReason(value)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${reason === value ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40'}`} data-testid={`button-report-reason-${value}`}>{label.replace('_', ' ')}{reason === value && <Check size={15} className="text-primary" />}</button>)}</div><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setReportOpen(false)} testId="button-cancel-report">Cancelar</Button><Button variant="danger" onClick={() => { report(); setReportOpen(false); toast({ title: 'Gracias por avisarnos', description: 'Revisaremos el reporte.' }); }} testId="button-submit-report">Enviar reporte</Button></div></Modal>}</div></Shell>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="modal"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold tracking-[-.03em]">{title}</h2><button className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={onClose} aria-label="Cerrar" data-testid="button-close-modal"><X size={18} /></button></div>{children}</div></div>;
}

function UserPage() {
  const { username = '' } = useParams<{ username: string }>();
  const userQuery = useGetUserProfile(username, { query: { queryKey: getGetUserProfileQueryKey(username) } });
  const projectsQuery = useListProjects({ search: username, page: 1, pageSize: 24 });
  const user = userQuery.data;
  if (userQuery.isLoading) return <Shell><div className="mx-auto max-w-5xl px-4 py-12"><div className="shimmer h-52 rounded-3xl" /></div></Shell>;
  if (!user) return <Shell><div className="mx-auto max-w-5xl px-4 py-16"><EmptyState icon={Users} title="Creador no encontrado" description="Comprueba el nombre de usuario e inténtalo de nuevo." /></div></Shell>;
  return <Shell><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8"><div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-primary/10 to-transparent" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar user={user} size="lg" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-extrabold tracking-[-.06em]" data-testid="text-profile-display-name">{user.displayName || user.username}</h1>{user.discordVerified && <BadgeCheck className="text-primary" size={20} />}</div><p className="mt-1 text-sm text-muted-foreground">@{user.username} · Se unió en {formatDate(user.joinedAt)}</p>{user.bio && <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground" data-testid="text-profile-bio">{user.bio}</p>}</div></div><div className="relative mt-8 flex flex-wrap gap-2">{user.websiteUrl && <a href={user.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-bold" data-testid="link-profile-website"><Link2 size={14} /> Web</a>}{user.tiktokUrl && <a href={user.tiktokUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-bold" data-testid="link-profile-tiktok"><ArrowUpRight size={14} /> TikTok</a>}</div></div><div className="mt-10 flex items-end justify-between"><SectionHeading title="Proyectos publicados" /><span className="text-xs text-muted-foreground">{projectsQuery.data?.total ?? 0} total</span></div>{projectsQuery.isLoading ? <LoadingGrid /> : projectsQuery.data?.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projectsQuery.data.items.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <EmptyState title="Este creador aún no publicó proyectos" description="Vuelve pronto para ver lo que está construyendo." />}</div></Shell>;
}

function PublishPage() {
  const authGate = useAuthGate();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: '', description: '', type: 'game', category: '', compatibility: 'both', version: '1.0.0', thumbnailUrl: '', robloxUrl: '', downloadUrl: '', discordUrl: '', tiktokUrl: '', tags: '' });
  const createProject = useCreateProject();
  const discordQuery = useGetDiscordVerificationStatus({ query: { queryKey: getGetDiscordVerificationStatusQueryKey() } });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || form.description.length < 20 || !form.category) { toast({ title: 'Revisa el formulario', description: 'Añade un nombre, categoría y una descripción de al menos 20 caracteres.' }); return; }
    if (!authGate()) return;
    createProject.mutate({ data: { ...form, type: form.type as typeof ProjectType[keyof typeof ProjectType], compatibility: form.compatibility as typeof Compatibility[keyof typeof Compatibility], tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) } }, {
      onSuccess: (project) => {
        toast({ title: 'Proyecto enviado a revisión', description: 'Te avisaremos cuando un moderador lo revise.' });
        setLocation(`/project/${project.id}`);
      },
      onError: () => toast({ title: 'No se pudo publicar el proyecto', description: 'Revisa los datos e inténtalo de nuevo.', variant: 'destructive' }),
    });
  };
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Shell><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><div className="max-w-2xl"><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">comparte lo que sabes</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">Publica tu proyecto.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Una ficha clara ayuda a que la gente encuentre, entienda y use tu trabajo.</p></div><div className="mt-8 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4"><ShieldCheck className="shrink-0 text-primary" size={22} /><div><p className="text-sm font-bold">Publicación con verificación Discord</p><p className="mt-1 text-xs text-muted-foreground">{discordQuery.data?.verified ? `Verificado como ${discordQuery.data.discordName || 'creador'}.` : 'Conecta Discord desde Ajustes para publicar proyectos.'}</p></div><Link href="/settings" className="ml-auto shrink-0 text-xs font-bold text-primary" data-testid="link-publish-settings">Ajustes <ArrowUpRight className="inline" size={13} /></Link></div><form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-5 sm:p-8" data-testid="form-publish-project"><Field label="Nombre del proyecto" required><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ej. Sistema de inventario modular" className="field-input" data-testid="input-publish-name" /></Field><Field label="Descripción" required><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Qué hace, para quién es y qué incluye..." className="field-input min-h-32 resize-y py-3" data-testid="textarea-publish-description" /></Field><div className="grid gap-5 sm:grid-cols-3"><Field label="Tipo"><FilterSelect value={form.type} onChange={(value) => update('type', value)} label="Selecciona tipo" options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} testId="select-publish-type" /></Field><Field label="Categoría" required><input value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Gameplay, UI..." className="field-input" data-testid="input-publish-category" /></Field><Field label="Compatibilidad"><FilterSelect value={form.compatibility} onChange={(value) => update('compatibility', value)} label="Compatibilidad" options={[{ value: 'studio', label: 'Studio' }, { value: 'lite', label: 'Studio Lite' }, { value: 'both', label: 'Ambos' }]} testId="select-publish-compatibility" /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Versión"><input value={form.version} onChange={(event) => update('version', event.target.value)} className="field-input" data-testid="input-publish-version" /></Field><Field label="Tags" hint="Separados por comas"><input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="inventory, lua, ui" className="field-input" data-testid="input-publish-tags" /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="URL de descarga"><input type="url" value={form.downloadUrl} onChange={(event) => update('downloadUrl', event.target.value)} placeholder="https://" className="field-input" data-testid="input-publish-download" /></Field><Field label="URL de Roblox"><input type="url" value={form.robloxUrl} onChange={(event) => update('robloxUrl', event.target.value)} placeholder="https://" className="field-input" data-testid="input-publish-roblox" /></Field><Field label="URL de miniatura"><input type="url" value={form.thumbnailUrl} onChange={(event) => update('thumbnailUrl', event.target.value)} placeholder="https://" className="field-input" data-testid="input-publish-thumbnail" /></Field><Field label="Discord del proyecto"><input type="url" value={form.discordUrl} onChange={(event) => update('discordUrl', event.target.value)} placeholder="https://" className="field-input" data-testid="input-publish-discord" /></Field></div><div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:justify-end"><Link href="/explore" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-secondary" data-testid="link-publish-cancel">Cancelar</Link><Button type="submit" disabled={createProject.isPending} testId="button-submit-publish">{createProject.isPending ? 'Enviando...' : 'Enviar a revisión'} <ArrowUpRight size={16} /></Button></div></form></div></Shell>;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="block text-sm font-bold"><span className="mb-2 flex items-center gap-2">{label}{required && <span className="text-primary">*</span>}{hint && <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>}</span>{children}</label>;
}

function FavoritesPage() {
  const authGate = useAuthGate();
  const favoritesQuery = useListFavorites({ query: { queryKey: getListFavoritesQueryKey() } });
  const favorites = favoritesQuery.data ?? [];
  return <Shell><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="flex items-end justify-between"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">tu biblioteca</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">Guardados.</h1><p className="mt-3 text-sm text-muted-foreground">Proyectos a los que quieres volver.</p></div><Button variant="secondary" onClick={authGate} testId="button-favorites-login"><LockKeyhole size={15} /> Iniciar sesión</Button></div><div className="mt-10">{favoritesQuery.isLoading ? <LoadingGrid /> : favorites.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <EmptyState icon={Bookmark} title="Tu biblioteca está vacía" description="Guarda proyectos desde cualquier ficha para encontrarlos aquí después." action="Explorar proyectos" onAction={() => { window.location.href = `${basePath}/explore`; }} />}</div></div></Shell>;
}

function ProfilePage() {
  const meQuery = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const me = meQuery.data;
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const save = () => { if (!me) return; updateMe.mutate({ data: { bio, username } }, { onSuccess: () => toast({ title: 'Perfil actualizado', description: 'Tus cambios ya están visibles.' }) }); };
  if (meQuery.isLoading) return <Shell><div className="mx-auto max-w-3xl px-4 py-12"><div className="shimmer h-80 rounded-3xl" /></div></Shell>;
  if (!me) return <Shell><div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={LockKeyhole} title="Tu perfil está detrás de una sesión" description="Inicia sesión para ver y editar tu perfil de creador." action="Iniciar sesión" onAction={() => { window.location.href = `${basePath}/sign-in`; }} /></div></Shell>;
  return <Shell><div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">tu espacio</p><h1 className="text-4xl font-extrabold tracking-[-.06em]">Perfil.</h1><div className="mt-8 rounded-3xl border border-border bg-card p-5 sm:p-8"><div className="flex items-center gap-4"><Avatar user={me} size="lg" /><div><p className="font-extrabold">{me.displayName || me.username}</p><p className="text-sm text-muted-foreground">@{me.username}</p></div></div><div className="mt-8 space-y-5"><Field label="Nombre de usuario"><input value={username || me.username} onChange={(event) => setUsername(event.target.value)} className="field-input" data-testid="input-profile-username" /></Field><Field label="Bio"><textarea value={bio || me.bio || ''} onChange={(event) => setBio(event.target.value)} className="field-input min-h-28 py-3" placeholder="Qué construyes..." data-testid="textarea-profile-bio" /></Field><div className="flex justify-end"><Button onClick={save} disabled={updateMe.isPending} testId="button-save-profile">{updateMe.isPending ? 'Guardando...' : 'Guardar cambios'}</Button></div></div></div></div></Shell>;
}

function SettingsPage() {
  const authGate = useAuthGate();
  const discordQuery = useGetDiscordVerificationStatus({ query: { queryKey: getGetDiscordVerificationStatusQueryKey() } });
  const createDiscord = useCreateDiscordVerification();
  const createRoblox = useCreateRobloxLink();
  const confirmRoblox = useConfirmRobloxLink();
  const { toast } = useToast();
  const [discordName, setDiscordName] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [challenge, setChallenge] = useState<{ code: string; expiresAt: string } | null>(null);
  const [robloxChallenge, setRobloxChallenge] = useState<{ code: string; expiresAt: string } | null>(null);
  const beginDiscord = () => {
    if (!discordName || !discordId) { toast({ title: 'Completa los datos de Discord' }); return; }
    if (!authGate()) return;
    createDiscord.mutate({ data: { discordName, discordUserId: discordId } }, {
      onSuccess: (data) => setChallenge({ code: data.code, expiresAt: data.expiresAt }),
      onError: () => toast({ title: 'No se pudo generar el código', variant: 'destructive' }),
    });
  };
  const beginRoblox = () => {
    if (!robloxUsername) { toast({ title: 'Escribe tu usuario de Roblox' }); return; }
    if (!authGate()) return;
    createRoblox.mutate({ data: { robloxUsername } }, {
      onSuccess: (data) => setRobloxChallenge({ code: data.challengeCode, expiresAt: data.expiresAt }),
      onError: () => toast({ title: 'No se pudo generar el desafío', variant: 'destructive' }),
    });
  };
  return <Shell><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">cuenta y conexiones</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">Ajustes.</h1><div className="mt-8 grid gap-5"><section className="rounded-3xl border border-border bg-card p-5 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={20} /></span><div><h2 className="font-extrabold">Verificación de Discord</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Necesaria para publicar y ayuda a mantener la comunidad humana.</p></div><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${discordQuery.data?.verified ? 'bg-emerald-400/10 text-emerald-300' : 'bg-secondary text-muted-foreground'}`}>{discordQuery.data?.verified ? 'Verificado' : 'Pendiente'}</span></div>{!discordQuery.data?.verified && <div className="mt-7 grid gap-3 sm:grid-cols-2"><input value={discordName} onChange={(event) => setDiscordName(event.target.value)} placeholder="Nombre en Discord" className="field-input" data-testid="input-discord-name" /><input value={discordId} onChange={(event) => setDiscordId(event.target.value)} placeholder="ID numérico de Discord" className="field-input" data-testid="input-discord-id" /><Button onClick={beginDiscord} className="sm:col-span-2" disabled={createDiscord.isPending} testId="button-start-discord">{createDiscord.isPending ? 'Generando código...' : 'Generar código de verificación'}</Button></div>}{challenge && <div className="mt-5 rounded-2xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Envía este código al bot de Rokito Studios:</p><p className="mono mt-2 text-2xl font-bold text-primary">{challenge.code}</p><p className="mt-1 text-xs text-muted-foreground">Expira {formatDate(challenge.expiresAt)}</p></div>}</section><section className="rounded-3xl border border-border bg-card p-5 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-foreground"><Gamepad2 size={20} /></span><div><h2 className="font-extrabold">Conectar Roblox</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Vincula tu identidad de Roblox para que otros sepan quién construye.</p></div></div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><input value={robloxUsername} onChange={(event) => setRobloxUsername(event.target.value)} placeholder="Tu nombre de usuario" className="field-input" data-testid="input-roblox-username" /><Button onClick={beginRoblox} disabled={createRoblox.isPending} testId="button-start-roblox">{createRoblox.isPending ? 'Generando...' : 'Generar desafío'}</Button></div>{robloxChallenge && <div className="mt-5 rounded-2xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Coloca este código en tu perfil de Roblox:</p><p className="mono mt-2 text-2xl font-bold text-primary">{robloxChallenge.code}</p><Button variant="secondary" className="mt-4" onClick={() => confirmRoblox.mutate({ data: { challengeCode: robloxChallenge!.code, robloxUserId: '', robloxUsername, displayName: robloxUsername, avatarUrl: 'https://www.roblox.com/favicon.ico' } }, { onSuccess: () => toast({ title: 'Roblox vinculado' }), onError: () => toast({ title: 'No se pudo confirmar el desafío', variant: 'destructive' }) })} disabled={confirmRoblox.isPending} testId="button-confirm-roblox">{confirmRoblox.isPending ? 'Confirmando...' : 'Ya lo añadí'}</Button></div>}</section></div></div></Shell>;
}

function CommunityPage() {
  const items = [{ icon: Search, number: '01', title: 'Descubre', text: 'Explora proyectos filtrando por tipo, categoría y compatibilidad.' }, { icon: Code2, number: '02', title: 'Aprende', text: 'Abre el código, el proceso y las decisiones de otros creadores.' }, { icon: Plus, number: '03', title: 'Comparte', text: 'Publica tu juego, kit o sistema y recibe feedback real.' }];
  return <Shell><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14"><div className="surface-grid rounded-3xl border border-border bg-card p-7 sm:p-12"><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">manifiesto rokito</p><h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-[-.07em] sm:text-7xl">Construir es más divertido cuando no lo haces <span className="text-primary">a solas.</span></h1><p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground">Rokito Studios existe para que el talento de Roblox deje de estar escondido en carpetas privadas. Aquí una idea encuentra a otra.</p></div><section className="py-14 sm:py-20"><SectionHeading eyebrow="el recorrido" title="De la idea al siguiente build" /><div className="grid gap-4 md:grid-cols-3">{items.map((item) => <div key={item.number} className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><span className="mono text-xs text-primary">{item.number}</span><item.icon size={20} className="text-muted-foreground" /></div><h2 className="mt-12 text-xl font-extrabold">{item.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p></div>)}</div></section><section className="border-t border-border py-14 sm:py-20"><div className="grid gap-8 sm:grid-cols-2"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">reglas simples</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-.05em]">Más señal. Menos ruido.</h2></div><ul className="space-y-4 text-sm text-muted-foreground"><li className="flex gap-3"><Check className="shrink-0 text-primary" size={18} /> Da crédito cuando uses o adaptes algo.</li><li className="flex gap-3"><Check className="shrink-0 text-primary" size={18} /> Comparte enlaces que realmente funcionan.</li><li className="flex gap-3"><Check className="shrink-0 text-primary" size={18} /> El feedback útil es específico y respetuoso.</li></ul></div></section></div></Shell>;
}

function AdminPage() {
  const overviewQuery = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const statusQuery = useGetAdminStatus({ query: { queryKey: getGetAdminStatusQueryKey() } });
  const projectsQuery = useListAdminProjects({ status: 'pending', page: 1, pageSize: 20 }, { query: { queryKey: getListAdminProjectsQueryKey({ status: 'pending', page: 1, pageSize: 20 }) } });
  const reportsQuery = useListReports({ query: { queryKey: getListReportsQueryKey() } });
  const moderate = useModerateProject();
  const { toast } = useToast();
  const pending = projectsQuery.data?.items ?? [];
  const moderateProject = (id: number, status: 'approved' | 'rejected') => moderate.mutate({ id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAdminProjectsQueryKey({ status: 'pending', page: 1, pageSize: 20 }) }); toast({ title: status === 'approved' ? 'Proyecto aprobado' : 'Proyecto rechazado' }); } });
  return <Shell><div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><div className="flex flex-col gap-3 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.18em] text-primary">control room</p><h1 className="text-4xl font-extrabold tracking-[-.06em] sm:text-6xl">Moderación.</h1></div><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-300" /> Solo accesible para admins</span></div><div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4"><AdminStat label="Pendientes" value={overviewQuery.data?.pendingProjects} /><AdminStat label="Reportes abiertos" value={overviewQuery.data?.openReports} /><AdminStat label="Usuarios" value={overviewQuery.data?.totalUsers} /><AdminStat label="Verificados" value={overviewQuery.data?.verifiedUsers} /></div><div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_.7fr]"><section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Cola de revisión</h2><span className="text-xs text-muted-foreground">{pending.length} pendientes</span></div>{projectsQuery.isLoading ? <LoadingGrid /> : pending.length ? <div className="space-y-3">{pending.map((project) => <ProjectRow key={project.id} project={project} onModerate={(status) => moderateProject(project.id, status)} />)}</div> : <EmptyState icon={Check} title="Todo limpio" description="No hay proyectos esperando revisión." />}</section><aside className="space-y-5"><section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-extrabold">Estado del sistema</h2><div className="mt-5 space-y-3">{[['API', statusQuery.data?.api], ['Base de datos', statusQuery.data?.database], ['Bot Discord', statusQuery.data?.bot]].map(([label, status]) => <div key={label as string} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="flex items-center gap-2 font-bold"><span className={`size-2 rounded-full ${String(status) === 'connected' ? 'bg-emerald-300' : 'bg-primary'}`} />{status || '—'}</span></div>)}</div></section><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold">Reportes</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{reportsQuery.data?.length ?? 0}</span></div>{reportsQuery.data?.length ? <div className="mt-4 space-y-3">{reportsQuery.data.slice(0, 5).map((report) => <div key={report.id} className="rounded-xl bg-secondary/60 p-3 text-xs"><p className="font-bold">Proyecto #{report.projectId} · {report.reason}</p><p className="mt-1 text-muted-foreground">{formatDate(report.createdAt)}</p></div>)}</div> : <p className="mt-4 text-xs leading-5 text-muted-foreground">No hay reportes abiertos.</p>}</section></aside></div></div></Shell>;
}

function AdminStat({ label, value }: { label: string; value?: number }) { return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-extrabold tracking-[-.05em]">{formatNumber(value)}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p></div>; }

function AuthPage({ signUp = false }: { signUp?: boolean }) {
  if (clerkPublishableKey) return <ClerkAuthPage signUp={signUp} />;
  const [, setLocation] = useLocation();
  const authGate = useAuthGate();
  return <div className="min-h-[100dvh] bg-background"><div className="mx-auto flex min-h-[100dvh] max-w-6xl items-center justify-center px-4 py-10"><div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[.9fr_1.1fr]"><div className="surface-grid hidden min-h-[560px] flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex"><Logo /><div><p className="mono text-[10px] uppercase tracking-[.18em] opacity-70">inmortal studios</p><h1 className="mt-5 text-5xl font-extrabold leading-[.98] tracking-[-.07em]">{signUp ? 'Tu próximo build empieza aquí.' : 'Qué bueno verte de nuevo.'}</h1><p className="mt-5 max-w-sm text-sm leading-6 opacity-80">Una comunidad clara para desarrolladores de Roblox que quieren construir en público.</p></div><p className="text-xs opacity-60">Studio · Studio Lite · Comunidad</p></div><div className="flex min-h-[560px] flex-col justify-center p-6 sm:p-12"><div className="lg:hidden"><Logo /></div><div className="mt-10 lg:mt-0"><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">{signUp ? 'crear cuenta' : 'acceder'}</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-.06em]">{signUp ? 'Únete a la comunidad' : 'Inicia sesión'}</h1><p className="mt-2 text-sm text-muted-foreground">{signUp ? 'Guarda proyectos y comparte los tuyos.' : 'Vuelve a tus proyectos y guardados.'}</p><div className="mt-8 space-y-4"><input className="field-input" placeholder="Email" type="email" aria-label="Email" data-testid="input-auth-email" /><input className="field-input" placeholder="Contraseña" type="password" aria-label="Contraseña" data-testid="input-auth-password" /><Button className="w-full" onClick={() => { authGate(); }} testId="button-auth-submit">{signUp ? 'Crear cuenta' : 'Continuar'} <ArrowUpRight size={16} /></Button></div><div className="my-7 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" /></div><Button variant="secondary" className="w-full" onClick={() => authGate()} testId="button-auth-provider"><Github size={16} /> Continuar con GitHub</Button><p className="mt-7 text-center text-xs text-muted-foreground">{signUp ? '¿Ya tienes cuenta?' : '¿Nuevo por aquí?'} <button className="font-bold text-primary hover:underline" onClick={() => setLocation(signUp ? '/sign-in' : '/sign-up')} data-testid="button-auth-switch">{signUp ? 'Inicia sesión' : 'Crea una cuenta'}</button></p></div></div></div></div></div>;
}

function ClerkAuthPage({ signUp = false }: { signUp?: boolean }) {
  const [, setLocation] = useLocation();
  const auth = useContext(AuthContext);
  useEffect(() => {
    if (auth.isSignedIn) setLocation('/');
  }, [auth.isSignedIn, setLocation]);
  const open = signUp ? auth.openSignUp : auth.openSignIn;
  return <div className="min-h-[100dvh] bg-background"><div className="mx-auto flex min-h-[100dvh] max-w-6xl items-center justify-center px-4 py-10"><div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[.9fr_1.1fr]"><div className="surface-grid hidden min-h-[560px] flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex"><Logo /><div><p className="mono text-[10px] uppercase tracking-[.18em] opacity-70">rokito studios</p><h1 className="mt-5 text-5xl font-extrabold leading-[.98] tracking-[-.07em]">{signUp ? 'Tu próximo build empieza aquí.' : 'Qué bueno verte de nuevo.'}</h1><p className="mt-5 max-w-sm text-sm leading-6 opacity-80">Una comunidad clara para desarrolladores de Roblox que quieren construir en público.</p></div><p className="text-xs opacity-60">Studio · Studio Lite · Comunidad</p></div><div className="flex min-h-[560px] flex-col justify-center p-6 sm:p-12"><div className="lg:hidden"><Logo /></div><div className="mt-10 lg:mt-0"><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">{signUp ? 'crear cuenta' : 'acceder'}</p><h1 className="mt-3 text-3xl font-extrabold tracking-[-.06em]">{signUp ? 'Únete a la comunidad' : 'Inicia sesión'}</h1><p className="mt-2 text-sm text-muted-foreground">Clerk protege tu cuenta y te permite continuar con email o proveedores conectados.</p><Button className="mt-8 w-full" onClick={open} testId="button-auth-submit">{signUp ? 'Crear cuenta' : 'Continuar'} <ArrowUpRight size={16} /></Button><Button variant="secondary" className="mt-3 w-full" onClick={open} testId="button-auth-provider"><Github size={16} /> Abrir acceso seguro</Button><p className="mt-7 text-center text-xs text-muted-foreground">{signUp ? '¿Ya tienes cuenta?' : '¿Nuevo por aquí?'} <button className="font-bold text-primary hover:underline" onClick={() => setLocation(signUp ? '/sign-in' : '/sign-up')} data-testid="button-auth-switch">{signUp ? 'Inicia sesión' : 'Crea una cuenta'}</button></p></div></div></div></div></div>;
}

function LegalPage({ privacy = false }: { privacy?: boolean }) {
  return <Shell><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">inmortal studios</p><h1 className="mt-4 text-4xl font-extrabold tracking-[-.06em]">{privacy ? 'Privacidad' : 'Términos de uso'}</h1><div className="prose prose-invert mt-8 max-w-none prose-headings:tracking-[-.04em] prose-p:text-muted-foreground prose-li:text-muted-foreground"><p>Última actualización: 14 de octubre de 2024.</p><h2>{privacy ? 'Qué información usamos' : 'Usar la plataforma'}</h2><p>{privacy ? 'Usamos la información mínima necesaria para crear tu perfil, mostrar tus proyectos y mantener la comunidad segura. No vendemos datos personales.' : 'Inmortal Studios es una comunidad para compartir recursos de desarrollo. Publica solo contenido que tengas derecho a compartir y respeta las reglas de la plataforma.'}</p><h2>Contenido y responsabilidad</h2><p>Los proyectos pertenecen a sus creadores. Revisamos reportes y moderamos contenido que incumpla las reglas, pero la responsabilidad de cada enlace y recurso corresponde a quien lo publica.</p><h2>Contacto</h2><p>Si encuentras un problema, usa el botón de reporte en la ficha del proyecto o abre una conversación en la comunidad.</p></div></div></Shell>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/explore"><ExplorePage /></Route><Route path="/games"><ExplorePage forcedType="game" /></Route><Route path="/kits"><ExplorePage forcedType="kit" /></Route><Route path="/resources"><ExplorePage forcedType="resource" /></Route><Route path="/creators" component={CreatorsPage} /><Route path="/publish" component={PublishPage} /><Route path="/favorites" component={FavoritesPage} /><Route path="/profile" component={ProfilePage} /><Route path="/settings" component={SettingsPage} /><Route path="/community" component={CommunityPage} /><Route path="/project/:id" component={ProjectDetail} /><Route path="/user/:username" component={UserPage} /><Route path="/admin" component={AdminPage} /><Route path="/sign-in/*?" component={() => <AuthPage />} /><Route path="/sign-up/*?" component={() => <AuthPage signUp />} /><Route path="/terms"><LegalPage /></Route><Route path="/privacy"><LegalPage privacy /></Route><Route component={NotFound} /></Switch>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppContent() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const { openSignIn, openSignUp, signOut } = useClerk();
  useEffect(() => {
    setBaseUrl(apiUrl);
    setAuthTokenGetter(apiUrl ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return <AuthContext.Provider value={{ isSignedIn: Boolean(isSignedIn), openSignIn: () => { void openSignIn(); }, openSignUp: () => { void openSignUp(); }, signOut: () => { void signOut(); } }}>{children}</AuthContext.Provider>;
}

function App() {
  const content = <AppContent />;
  if (!clerkPublishableKey) {
    setBaseUrl(apiUrl);
    return content;
  }
  return <ClerkProvider publishableKey={clerkPublishableKey}><ClerkBridge>{content}</ClerkBridge></ClerkProvider>;
}

export default App;