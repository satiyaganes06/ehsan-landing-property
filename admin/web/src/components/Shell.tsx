import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV: Array<{ to: string; label: string; need?: [string, string] }> = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects', need: ['project', 'read'] },
  { to: '/events', label: 'Events', need: ['event', 'read'] },
  { to: '/awards', label: 'Awards', need: ['award', 'read'] },
  { to: '/testimonials', label: 'Testimonials', need: ['testimonial', 'read'] },
  { to: '/blocks', label: 'Page text', need: ['block', 'read'] },
  { to: '/media', label: 'Media library', need: ['media', 'read'] },
  { to: '/enquiries', label: 'Enquiries', need: ['enquiry', 'read'] },
  { to: '/users', label: 'Users & roles', need: ['user', 'read'] },
];

export function Shell() {
  const { me, can, logout } = useAuth();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'var(--sidebar-w) 1fr', minHeight: '100vh' }}>
      <aside style={{ borderRight: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem 1.25rem 1rem' }}>
          <p className="mono dimmer" style={{ fontSize: '.5625rem', letterSpacing: '.2em', textTransform: 'uppercase' }}>Ehsan Plant &amp; Property</p>
          <h1 style={{ fontSize: '1.25rem', marginTop: '.3rem' }}>Admin</h1>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '0 .75rem', gap: '.15rem' }}>
          {NAV.filter((n) => !n.need || can(...n.need)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              style={({ isActive }) => ({
                padding: '.55rem .75rem', borderRadius: 3, fontSize: '.8125rem', fontWeight: 500,
                color: isActive ? 'var(--ink)' : 'var(--dim)', background: isActive ? 'var(--panel-2)' : 'transparent',
              })}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem 1.25rem', borderTop: '1px solid var(--line)' }}>
          <p style={{ fontSize: '.8125rem', fontWeight: 500 }}>{me?.name}</p>
          <p className="dimmer" style={{ fontSize: '.75rem' }}>{me?.roles.join(', ')}</p>
          <button className="btn btn--sm btn--ghost" style={{ marginTop: '.5rem', width: '100%' }} onClick={() => logout()}>Sign out</button>
        </div>
      </aside>
      <main style={{ padding: '2rem 2.5rem', maxWidth: '80rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
