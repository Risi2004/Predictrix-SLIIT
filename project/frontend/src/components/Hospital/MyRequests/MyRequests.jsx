import { bank, BUSY, COMP, STATUS } from '../../../data';
import './MyRequests.css';

const STEPS = ['Received', 'Matched', 'Sourced', 'Routed', 'Checked', 'Approved', 'Delivered'];
const STEP_INDEX = {
  received: 0,
  matching: 1,
  sourcing: 2,
  routing: 3,
  checking: 4,
  awaiting: 5,
  donors: 5,
  enroute: 6,
  delivered: 7,
  rejected: 5,
};

function RequestProgress({ request }) {
  const stepIndex = STEP_INDEX[request.status] ?? 0;

  return (
    <div className="ward-stepper-scroll" aria-label={`Request progress: ${STATUS[request.status] || request.status}`}>
      <div className="stepper ward-stepper">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={index < stepIndex ? 'done' : index === stepIndex ? 'cur' : ''}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestCard({ request, delivery, onOpenCase }) {
  const progress = delivery?.eta
    ? Math.min(100, (1 - Math.max(0, delivery.left) / delivery.eta) * 100)
    : 0;
  const statusText = STATUS[request.status] || request.status;

  return (
    <section className="card ward-request-card">
      <header>
        <div className="row">
          <span className={`pill u-${request.urg}`}>{request.urg}</span>
          <h2>
            {request.units} × {request.type} {COMP[request.comp]?.toLowerCase()}
          </h2>
        </div>
        <div className="row ward-request-actions">
          <span className={`pill st ${request.status} ${BUSY.includes(request.status) ? 'busy' : ''}`}>
            {statusText}
          </span>
          <button
            type="button"
            className="btn sm"
            onClick={() => onOpenCase(request.id)}
            aria-label={`Details for request ${request.id}`}
          >
            Details
          </button>
        </div>
      </header>

      <RequestProgress request={request} />

      {delivery && (
        <div className="ward-delivery-progress">
          <div className="row ward-delivery-summary">
            <span>
              {delivery.rider} from {bank(delivery.from).name}
            </span>
            <span className="mono" aria-live="polite">
              {delivery.left > 0 ? `${delivery.left} min` : 'arrived'}
            </span>
          </div>
          <div
            className="prog"
            role="progressbar"
            aria-label={`Delivery progress for ${request.id}`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(progress)}
          >
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

export default function MyRequests({ state, onNavigate, onOpenCase }) {
  const requests = state.requests.filter((request) => request.hosp === 'h1');

  return (
    <div className="ward-my-requests">
      <div className="hello">
        <div>
          <div className="mono">Northside Children’s · Ward 4B</div>
          <h1>
            Your requests, <em>live.</em>
          </h1>
        </div>
        <button type="button" className="btn pri" onClick={() => onNavigate('newreq')}>
          New request
        </button>
      </div>

      <div className="ward-request-list">
        {requests.length ? (
          requests.map((request) => {
            const delivery = state.deliveries.find((item) => item.id === request.delivery);
            return (
              <RequestCard
                key={request.id}
                request={request}
                delivery={delivery}
                onOpenCase={onOpenCase}
              />
            );
          })
        ) : (
          <div className="empty">No requests yet.</div>
        )}
      </div>
    </div>
  );
}
