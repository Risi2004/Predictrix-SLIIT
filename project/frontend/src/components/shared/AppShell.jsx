import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { awaitingRequests } from '../../data';

export default function AppShell({
  state,
  onChangeScenario,
  onToggleLive,
  onSignOut,
  drawer,
  routeContext,
  children,
}) {
  const awaitingCount = awaitingRequests(state.requests).length;

  return (
    <div id="app">
      <Sidebar
        role={state.role}
        awaitingCount={awaitingCount}
      />

      <div>
        <Header
          role={state.role}
          activeView={state.view}
          clock={state.clock}
          live={state.live}
          scenario={state.scenario}
          onChangeScenario={onChangeScenario}
          onToggleLive={onToggleLive}
          onSignOut={onSignOut}
        />

        <main id="view">
          {children ?? <Outlet context={routeContext} />}
        </main>
      </div>

      {/* Slide-over Drawer Scrim and Container for Phase 5 */}
      {drawer || (
        <>
          <div id="scrim" hidden data-act="close" />
          <aside id="drawer" hidden aria-label="Case details" />
        </>
      )}

      {/* Persistent 3D canvas park for Phase 7 */}
      <div hidden id="canvas-park">
        <canvas id="cv-heart-sm" />
        <canvas id="cv-dna" />
      </div>
    </div>
  );
}
