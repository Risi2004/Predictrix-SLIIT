import { NavLink } from 'react-router-dom';
import { NAVS, ICON, VIEW_PATHS } from '../../data';

export default function Sidebar({ role, awaitingCount }) {
  const navItems = NAVS[role] || [];

  return (
    <aside className="side">
      <div className="logo">
        <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E9EBEF" />
              <stop offset="0.55" stopColor="#7C828E" />
              <stop offset="1" stopColor="#111317" />
            </linearGradient>
          </defs>
          <circle cx="15" cy="15" r="14" fill="none" stroke="#111317" />
          <path
            d="M15 5 C 19 11, 22 14, 22 18 A 7 7 0 0 1 8 18 C 8 14, 11 11, 15 5 Z"
            fill="url(#lg)"
          />
        </svg>
        <span>SERA</span>
      </div>

      <nav className="nav" id="nav" aria-label="Sections">
        {navItems.map(([viewKey, label]) => {
          const showBadge = viewKey === 'requests' && awaitingCount > 0;
          const route = VIEW_PATHS[viewKey];

          if (!route) return null;

          return (
            <NavLink
              key={viewKey}
              to={route}
              className={({ isActive }) => (isActive ? 'on' : '')}
              data-id={viewKey}
              data-k={`nav-${viewKey}`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: ICON[viewKey] || '' }}
              />
              {label}
              {showBadge && <span className="badge">{awaitingCount}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="foot">
        <span className="mono">Demo region</span>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          Every hospital, bank, donor and number here is simulated.
        </span>
      </div>
    </aside>
  );
}
