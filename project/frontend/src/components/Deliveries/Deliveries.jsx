import { activeDeliveries, COMP, bank, hosp } from '../../data';
import LiveMap from '../shared/LiveMap';
import './Deliveries.css';

function DeliveryCard({ delivery, onOpenCase }) {
  const isHospital = delivery.toKind === 'h';
  const destination = isHospital
    ? hosp(delivery.to)?.name
    : `${bank(delivery.to)?.name} (transfer)`;

  const progressPct =
    delivery.eta > 0
      ? (1 - Math.max(0, delivery.left) / delivery.eta) * 100
      : 100;

  return (
    <div className="qcard">
      <div className="top">
        <b>
          {delivery.id} · {delivery.rider}
        </b>
        <span className="mono">
          {delivery.left > 0 ? `${delivery.left} min` : 'arrived'}
        </span>
      </div>
      <div className="why">
        {delivery.units} × {delivery.type} {COMP[delivery.comp]?.toLowerCase()} ·{' '}
        {bank(delivery.from)?.name} → {destination}
        {delivery.req && (
          <>
            {' '}
            ·{' '}
            <a
              tabIndex={0}
              role="button"
              style={{
                color: 'var(--chrome)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => onOpenCase(delivery.req)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenCase(delivery.req);
                }
              }}
              data-k={`dl-${delivery.id}`}
            >
              {delivery.req}
            </a>
          </>
        )}
      </div>
      <div className="prog">
        <i style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

export default function Deliveries({ state, onOpenCase }) {
  const active = activeDeliveries(state.deliveries);
  const done = state.deliveries.filter((d) => d.left <= 0);

  return (
    <div className="deliveries-view">
      <div className="hello">
        <div>
          <div className="mono">{active.length} on the road</div>
          <h1>
            Units <em>in motion.</em>
          </h1>
        </div>
      </div>

      <div className="g-side">
        {/* Map Section */}
        <section className="card">
          <div className="map">
            <LiveMap
              requests={state.requests}
              deliveries={state.deliveries}
              stock={state.stock}
            />
          </div>
        </section>

        {/* Deliveries Column */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Active Deliveries */}
          <section className="card">
            <header>
              <h2>On the road</h2>
            </header>
            {active.length > 0 ? (
              active.map((d) => (
                <DeliveryCard
                  key={d.id}
                  delivery={d}
                  onOpenCase={onOpenCase}
                />
              ))
            ) : (
              <div className="empty">No deliveries right now.</div>
            )}
          </section>

          {/* Completed Deliveries */}
          <section className="card">
            <header>
              <h2>Completed</h2>
              <span className="mono">{done.length}</span>
            </header>
            {done.length > 0 ? (
              done.slice(0, 6).map((d) => (
                <DeliveryCard
                  key={d.id}
                  delivery={d}
                  onOpenCase={onOpenCase}
                />
              ))
            ) : (
              <div className="empty">None yet tonight.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
