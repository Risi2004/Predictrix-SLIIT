import { useState } from 'react';
import { hosp, bank, COMP, STATUS, BUSY, fmt, reason } from '../../data';
import './CaseReviewDrawer.css';

const STEP_MAP = {
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

const STEPS = ['Received', 'Matched', 'Sourced', 'Routed', 'Checked', 'Approved', 'Delivered'];

const REJECT_REASONS = [
  'Not needed any more',
  'Duplicate request',
  'Patient moved hospital',
  'Wrong details, ward will resend',
];

export default function CaseReviewDrawer({
  openCaseId,
  state,
  onClose,
  onApprove,
  onReject,
  onChooseOption,
  onOpenCase,
}) {
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);

  if (!openCaseId) {
    return (
      <>
        <div id="scrim" hidden data-act="close" />
        <aside id="drawer" hidden aria-label="Case details" />
      </>
    );
  }

  const r = state.requests.find((x) => x.id === openCaseId);
  if (!r) {
    return (
      <>
        <div id="scrim" hidden data-act="close" />
        <aside id="drawer" hidden aria-label="Case details" />
      </>
    );
  }

  const isOfficer = state.role === 'officer';
  const delivery = state.deliveries.find((x) => x.id === r.delivery);
  const currentStep = STEP_MAP[r.status] ?? 0;
  const options = r.plan?.options || [];
  const chosenOption = options[r.choice ?? 0] || options[0];

  return (
    <>
      <div id="scrim" onClick={onClose} data-act="close" />
      <aside id="drawer" aria-label="Case details">
        {/* Drawer Header */}
        <div className="dhead">
          <div>
            <div className="mono">
              {r.id} · received {fmt(r.created)} · {r.source}
            </div>
            <h2>{hosp(r.hosp).name}</h2>
            <div className="row" style={{ marginTop: '8px' }}>
              <span className={`pill u-${r.urg}`}>{r.urg}</span>
              <span
                className={`pill st ${r.status} ${
                  BUSY.includes(r.status) ? 'busy' : ''
                }`}
              >
                {!isOfficer && r.status === 'awaiting'
                  ? 'With the officer'
                  : STATUS[r.status] || r.status}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="x-btn"
            onClick={onClose}
            aria-label="Close"
            data-k="close"
          >
            ✕
          </button>
        </div>

        {/* Message bubble */}
        {r.msg && <div className="bubble">“{r.msg}”</div>}

        {/* Clinical facts */}
        <div className="facts">
          <div>
            <span className="mono">Type</span>
            <b>{r.type}</b>
          </div>
          <div>
            <span className="mono">Component</span>
            <b>{COMP[r.comp]}</b>
          </div>
          <div>
            <span className="mono">Units</span>
            <b>{r.units}</b>
          </div>
          <div>
            <span className="mono">Patient</span>
            <b>{r.pat}</b>
          </div>
        </div>

        {/* Workflow Stepper */}
        <div className="stepper">
          {STEPS.map((s, k) => (
            <div
              key={s}
              className={k < currentStep ? 'done' : k === currentStep ? 'cur' : ''}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Agent Safety Checks */}
        {r.checks && r.checks.length > 0 && (
          <div>
            <div className="mono" style={{ marginBottom: '8px' }}>
              Checks
            </div>
            <div className="checks">
              {r.checks.map((c, i) => (
                <span key={i}>
                  <span
                    className="i"
                    style={{
                      color:
                        c.k === 'ok'
                          ? 'var(--ok)'
                          : c.k === 'warn'
                          ? 'var(--urg)'
                          : 'var(--purple2)',
                    }}
                  >
                    {c.k === 'ok' ? '✓' : c.k === 'warn' ? '!' : '↑'}
                  </span>
                  {c.t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Officer Approval Gate */}
        {r.status === 'awaiting' && isOfficer && (
          <>
            {options.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <div className="mono">Choose a plan</div>
                {options.map((o, i) => (
                  <label
                    key={`${o.bank}-${o.dt}-${i}`}
                    className={`opt ${r.choice === i ? 'on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="opt"
                      checked={r.choice === i}
                      onChange={() => onChooseOption(r.id, i)}
                      data-k={`op-${i}`}
                    />
                    <span>
                      <b>
                        {bank(o.bank).name} · {r.units} × {o.dt}
                      </b>
                      <br />
                      <span style={{ fontSize: '13px', color: 'var(--silver)' }}>
                        {reason(o, r)}
                      </span>
                      {i === 0 && (
                        <>
                          <br />
                          <span className="mono" style={{ color: 'var(--purple2)' }}>
                            Recommended
                          </span>
                        </>
                      )}
                    </span>
                    <span className="eta">
                      {o.eta}
                      <small>MIN</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="gate">
                <b style={{ color: 'var(--chrome)' }}>
                  No bank holds enough {r.type} {COMP[r.comp]?.toLowerCase()}.
                </b>
                <span style={{ fontSize: '14px' }}>
                  Proposed: contact {r.donorPlan ? r.donorPlan.contact : 0} eligible{' '}
                  {r.type} donors nearby.
                </span>
              </div>
            )}

            <div className="gate">
              <p style={{ color: 'var(--chrome)' }}>
                {options.length > 0 && chosenOption
                  ? `Send ${r.units} × ${chosenOption.dt} from ${
                      bank(chosenOption.bank).name
                    }? Arrives in ${chosenOption.eta} min.`
                  : 'Approve the donor call?'}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="btn pri"
                  onClick={() => onApprove(r.id)}
                  data-k="dap"
                >
                  {options.length > 0 ? 'Approve & dispatch' : 'Approve donor call'}
                </button>
                <select
                  className="sel"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  aria-label="Reason to reject"
                  data-k="rr"
                >
                  {REJECT_REASONS.map((reasonText) => (
                    <option key={reasonText} value={reasonText}>
                      {reasonText}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => onReject(r.id, rejectReason)}
                  data-k="drj"
                >
                  Reject
                </button>
              </div>
            </div>
          </>
        )}

        {/* Hospital Awaiting Info */}
        {r.status === 'awaiting' && !isOfficer && (
          <div className="gate">
            <p>The plan is with the duty officer for approval.</p>
          </div>
        )}

        {/* Live Delivery Progress */}
        {delivery && (
          <div className="gate">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ color: 'var(--chrome)' }}>
                {delivery.rider} · {bank(delivery.from).name} →{' '}
                {delivery.toKind === 'h'
                  ? hosp(delivery.to).short
                  : bank(delivery.to).name}
              </b>
              <span className="mono">
                {delivery.left > 0 ? `${delivery.left} min` : 'arrived'}
              </span>
            </div>
            <div className="prog">
              <i
                style={{
                  width: `${
                    (1 - Math.max(0, delivery.left) / delivery.eta) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Case Record Timeline */}
        <div>
          <div className="mono" style={{ marginBottom: '6px' }}>
            Case record
          </div>
          <ul className="loglist">
            {r.timeline
              .slice()
              .reverse()
              .map((t, idx) => (
                <li key={`${t.t}-${idx}`}>
                  <span className="t">{fmt(t.t)}</span>
                  <span
                    className={`a ${
                      t.actor === 'Officer' || t.actor === 'Hospital' ? 'off' : ''
                    }`}
                  >
                    {t.actor}
                  </span>
                  <span className="x">
                    {t.text}
                    {t.ref && (
                      <>
                        {' '}
                        <a
                          tabIndex={0}
                          role="button"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => onOpenCase && onOpenCase(t.ref)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenCase && onOpenCase(t.ref);
                            }
                          }}
                        >
                          {t.ref}
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
