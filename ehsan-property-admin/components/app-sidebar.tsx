'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, CalendarDays, ChevronsUpDown, Images, Inbox, LayoutDashboard,
  LogOut, Monitor, Moon, Quote, ScrollText, Sun, Trophy, Type, Users,
} from 'lucide-react';

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton,
  SidebarMenuItem, SidebarRail,
} from '@/components/animate-ui/components/radix/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { primaryRole, roleLabel, type Action, type Resource } from '@/lib/permissions';
import type { DashboardSummary } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: [Resource, Action];
  /** Only this item shows a count; keeps the nav from becoming a scoreboard. */
  badge?: 'enquiries';
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Content',
    items: [
      { href: '/projects', label: 'Projects', icon: Building2, need: ['project', 'read'] },
      { href: '/events', label: 'Events', icon: CalendarDays, need: ['event', 'read'] },
      { href: '/awards', label: 'Awards', icon: Trophy, need: ['award', 'read'] },
      { href: '/testimonials', label: 'Testimonials', icon: Quote, need: ['testimonial', 'read'] },
      { href: '/content', label: 'Page text', icon: Type, need: ['block', 'read'] },
      { href: '/media', label: 'Media', icon: Images, need: ['media', 'read'] },
    ],
  },
  {
    group: 'Operations',
    items: [
      { href: '/enquiries', label: 'Enquiries', icon: Inbox, need: ['enquiry', 'read'], badge: 'enquiries' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/users', label: 'Users & roles', icon: Users, need: ['user', 'read'] },
      { href: '/audit', label: 'Activity log', icon: ScrollText, need: ['audit', 'read'] },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { me, can, signOut } = useSession();
  const { theme, setTheme } = useTheme();

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary'),
    enabled: can('enquiry', 'read'),
    staleTime: 60_000,
  });

  const unread = summary?.enquiries.unread ?? 0;
  const role = me ? primaryRole(me.roles) : undefined;
  const initials = (me?.name ?? '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span
            className="bg-brass flex size-7 shrink-0 items-center justify-center rounded-md font-display text-sm text-[#12110d]"
            aria-hidden
          >
            E
          </span>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">Ehsan</span>
            <span className="text-sidebar-foreground/55 truncate text-xs">Plant &amp; Property</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map(({ group, items }) => {
          const visible = items.filter((item) => !item.need || can(...item.need));
          if (visible.length === 0) return null;

          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarMenu>
                {visible.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} prefetch>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge === 'enquiries' && unread > 0 ? (
                        <SidebarMenuBadge className="bg-brass text-[#12110d]">{unread}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <span className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium">
                    {initials || '—'}
                  </span>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{me?.name ?? 'Loading…'}</span>
                    <span className="text-sidebar-foreground/55 truncate text-xs">
                      {role ? roleLabel(role) : ''}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium">{me?.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">{me?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  Appearance
                </DropdownMenuLabel>
                {(
                  [
                    ['light', 'Light', Sun],
                    ['dark', 'Dark', Moon],
                    ['system', 'System', Monitor],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                    <Icon className="size-4" />
                    {label}
                    {theme === value ? <span className="bg-brass ml-auto size-1.5 rounded-full" /> : null}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
