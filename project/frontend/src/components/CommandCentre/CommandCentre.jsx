import {
  fmt,
  hosp,
  bank,
  COMP,
  TYPES,
  awaitingRequests,
  openRequests,
  activeDeliveries,
  netState,
  allLots,
  netTotal,
  reason,
} from '../../data';
import LiveMap from '../shared/LiveMap';
import './CommandCentre.css';
import Helix from '../shared/Helix';

function QCard({ req, onApprove, onOpenCase }) {
  const o = req.plan?.options?.[req.choice] || req.plan?.options?.[0];
  const warnCheck = req.checks?.find((c) => c.k === 'warn');

  return (
    <div className="qcard">
      <div className="top">
        <span className={`pill u-${req.urg}`}>{req.urg}</span>
        <span className="mono">
          {req.id} · {fmt(req.created)}
        </span>
      </div>
      <b>{hosp(req.hosp).name}</b>
      <div className="need">
        {req.type}{' '}
        <small>
          {COMP[req.comp].toLowerCase()} × {req.units} · {req.pat.toLowerCase()}
        </small>
      </div>
      <div className="why">
        {o
          ? `Plan: ${bank(o.bank).name} · ${reason(o, req)}`
          : `No stock can cover it. Call ${req.donorPlan?.contact || 0} donors.`}
      </div>
      {warnCheck && (
        <div className="why" style={{ color: 'var(--urg)' }}>
          ⚠ {warnCheck.t}
        </div>
      )}
      <div className="row">
        <button
          type="button"
          className="btn pri sm"
          onClick={() => onApprove(req.id)}
          data-k={`qa-${req.id}`}
        >
          {o ? 'Approve & dispatch' : 'Approve donor call'}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => onOpenCase(req.id)}
          data-k={`qo-${req.id}`}
        >
          Review
        </button>
      </div>
    </div>
  );
}

function StockBars({ stock }) {
  const tots = TYPES.map((t) => netTotal(stock, 'RBC', t));
  const mx = Math.max(...tots, 1);

  return (
    <div className="bars">
      {TYPES.map((t, i) => {
        const pct = Math.max(4, (tots[i] / mx) * 100);
        const low = tots[i] < 30;
        return (
          <div key={t} className="bar2">
            <div className="tr">
              <div className={`fl ${low ? 'low' : ''}`} style={{ height: `${pct}%` }} />
            </div>
            <b>{t}</b>
            <span>{tots[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function LogList({ items, onOpenCase }) {
  if (!items.length) {
    return <div className="empty">Nothing yet.</div>;
  }

  return (
    <ul className="loglist">
      {items.map((l, idx) => (
        <li key={`${l.t}-${idx}`}>
          <span className="t">{fmt(l.t)}</span>
          <span className={`a ${l.actor === 'Officer' || l.actor === 'Hospital' ? 'off' : ''}`}>
            {l.actor}
          </span>
          <span className="x">
            {l.text}
            {l.ref && (
              <>
                {' '}
                <a
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => onOpenCase && onOpenCase(l.ref)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenCase && onOpenCase(l.ref);
                    }
                  }}
                  data-k={`lg-${l.ref}-${l.t}`}
                >
                  {l.ref}
                </a>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CommandCentre({ state, onNavigate, onOpenCase, onApprove }) {
  const awaiting = awaitingRequests(state.requests);
  const openReqs = openRequests(state.requests);
  const criticalCount = openReqs.filter((r) => r.urg === 'Critical').length;
  const expUnits = allLots(state.stock)
    .filter((x) => x.l.exp < 72)
    .reduce((acc, x) => acc + x.l.u, 0);
  const activeDels = activeDeliveries(state.deliveries);


  return (
    <div className="command-centre">
      {/* Welcome Banner */}
      <div className="hello">
        <div>
          <div className="mono">Night shift · Demo region · {fmt(state.clock)}</div>
          <h1>
            The network is{' '}
            <em>
              {awaiting.length
                ? `${awaiting.length} decision${awaiting.length > 1 ? 's' : ''} away`
                : 'steady'}
              .
            </em>
          </h1>
        </div>
        <p>Requests are matched, sourced and routed for you. Nothing moves until you approve it.</p>
      </div>

      {/* KPI Tiles */}
      <div className="kpis">
        <div className="kpi hot">
          <span className="mono">Waiting for you</span>
          <div className="n">{awaiting.length}</div>
          <small>plans ready to approve</small>
        </div>
        <div className="kpi">
          <span className="mono">Open requests</span>
          <div className="n">{openReqs.length}</div>
          <small>{criticalCount} critical</small>
        </div>
        <div className="kpi">
          <span className="mono">Expiring &lt; 72 h</span>
          <div className="n">{expUnits}</div>
          <small>units across 8 banks</small>
        </div>
        <div className="kpi">
          <span className="mono">On the road</span>
          <div className="n">{activeDels.length}</div>
          <small>deliveries and transfers</small>
        </div>
      </div>

      {/* Primary Command Grid */}
      <div className="g-cmd">
        {/* Waiting Plans Column */}
        <section className="card">
          <header>
            <h2>Waiting for you</h2>
            <span className="mono">
              {awaiting.length} plan{awaiting.length === 1 ? '' : 's'}
            </span>
          </header>
          {awaiting.length ? (
            <>
              {awaiting.slice(0, 3).map((r) => (
                <QCard
                  key={r.id}
                  req={r}
                  onApprove={onApprove}
                  onOpenCase={onOpenCase}
                />
              ))}
              {awaiting.length > 3 && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => onNavigate('requests')}
                  data-k="more"
                >
                  See all {awaiting.length}
                </button>
              )}
            </>
          ) : (
            <div className="empty">All clear. New plans appear here the moment they are ready.</div>
          )}
        </section>

        {/* Live Network Map */}
        <section className="card">
          <header>
            <h2>Live network</h2>
            <div className="legend">
              <span>
                <i style={{ background: '#111317', borderRadius: '50%' }} />
                Bank
              </span>
              <span>
                <i style={{ background: '#fff', border: '1.5px solid #111317', borderRadius: '2px' }} />
                Hospital
              </span>
              <span>
                <i style={{ background: '#A3203A', borderRadius: '2px' }} />
                Critical
              </span>
            </div>
          </header>
          <div className="map">
            <LiveMap
              requests={state.requests}
              deliveries={state.deliveries}
              stock={state.stock}
            />
          </div>
          {activeDels.slice(0, 2).map((d) => (
            <div key={d.id} style={{ display: 'grid', gap: '6px' }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: '13px' }}>
                <span>
                  {d.rider} · {bank(d.from).name} →{' '}
                  {d.toKind === 'h' ? hosp(d.to).short : bank(d.to).name}
                </span>
                <span className="mono">{d.left} min</span>
              </div>
              <div className="prog">
                <i style={{ width: `${(1 - d.left / d.eta) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>

        {/* Pulse & Network Status */}
        <section className="card pulse">
          <header>
            <h2>Network state</h2>
            <span className="mono">sequence active</span>
          </header>
          <div className="slot" data-slot="pulse"><Helix camz={4.8} tilt={-0.35} /></div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <span className="mono">Status</span>
            <span className="bpm" id="bpm">
              {netState(state.requests)}
            </span>
          </div>
          <svg className="ecg" viewBox="0 0 300 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 20 H80 L90 20 L96 6 L104 32 L110 20 H170 L178 14 L186 20 H300" />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Stable, elevated or surge, from open critical requests and pending decisions.
          </p>
        </section>
      </div>

      {/* Two-Column Summary Grid */}
      <div className="g-two">
        <section className="card">
          <header>
            <h2>Red-cell stock</h2>
            <button
              type="button"
              className="btn sm"
              onClick={() => onNavigate('inventory')}
              data-k="toinv"
            >
              Open inventory
            </button>
          </header>
          <StockBars stock={state.stock} />
        </section>

        <section className="card">
          <header>
            <h2>Latest activity</h2>
            <button
              type="button"
              className="btn sm"
              onClick={() => onNavigate('log')}
              data-k="tolog"
            >
              Full log
            </button>
          </header>
          <LogList items={state.log.slice(0, 6)} onOpenCase={onOpenCase} />
        </section>
      </div>
    </div>
  );
}
