import { useState, useEffect } from 'react';
import { REGISTRY, TYPES, COMP, netTotal } from '../../data';
import './DonorManagement.css';

export default function DonorManagement({
  state,
  onApproveCampaign,
  onCancelCampaign,
  onPrepareCampaign,
}) {
  const [campType, setCampType] = useState('O-');
  const [campUnits, setCampUnits] = useState(4);

  // Mount 3D DNA canvas if available
  useEffect(() => {
    const slot = document.querySelector('[data-slot="dna"]');
    const canvas = document.getElementById('cv-dna');
    const park = document.getElementById('canvas-park');
    if (slot && canvas && canvas.parentNode !== slot) {
      slot.appendChild(canvas);
    }
    return () => {
      if (park && canvas && canvas.parentNode !== park) {
        park.appendChild(canvas);
      }
    };
  }, []);

  const totalRegistered = Object.values(REGISTRY).reduce((a, b) => a + b, 0);
  const maxRegistry = Math.max(...Object.values(REGISTRY));
  const haveStock = netTotal(state.stock, 'RBC', campType);
  const runningCalls = state.campaigns.filter((c) => c.status === 'calling').length;
  const isUnneeded = haveStock >= campUnits * 3;

  const handlePrepare = () => {
    const u = Math.max(1, Math.min(20, Number(campUnits) || 1));
    const warn =
      haveStock >= u * 3
        ? `The network already holds ${haveStock} units of ${campType}. Calling donors may be unnecessary.`
        : null;
    onPrepareCampaign({
      type: campType,
      units: u,
      pending: true,
      warn,
    });
  };

  return (
    <div className="donor-management">
      {/* Hero Card */}
      <section className="card dna-hero">
        <div className="txt">
          <div className="mono">Donor network · consented registry</div>
          <h1>
            The last resort, <em>done right.</em>
          </h1>
          <p style={{ color: 'var(--silver)' }}>
            Donors are called only when stock can’t cover a need, and only the right
            few people nearby. Every call needs your approval.
          </p>
          <div className="row" style={{ gap: '28px', marginTop: '6px' }}>
            <div>
              <div
                className="serif"
                style={{ fontSize: '38px', color: 'var(--chrome)', lineHeight: 1 }}
              >
                {totalRegistered.toLocaleString()}
              </div>
              <span className="mono">registered</span>
            </div>
            <div>
              <div
                className="serif"
                style={{ fontSize: '38px', color: 'var(--chrome)', lineHeight: 1 }}
              >
                {runningCalls}
              </div>
              <span className="mono">calls running</span>
            </div>
            <div>
              <div
                className="serif"
                style={{ fontSize: '38px', color: 'var(--chrome)', lineHeight: 1 }}
              >
                {state.stats.unneeded}
              </div>
              <span className="mono">unneeded calls</span>
            </div>
          </div>
        </div>
        <div className="slot" data-slot="dna" />
      </section>

      {/* Main Grid: Calls List + Planning & Registry */}
      <div className="g-side">
        {/* Donor Calls Section */}
        <section className="card">
          <header>
            <h2>Donor calls</h2>
            <span className="mono">{state.campaigns.length}</span>
          </header>
          {state.campaigns.length > 0 ? (
            state.campaigns.map((c) => {
              const statusClass =
                c.status === 'complete'
                  ? 'delivered'
                  : c.status === 'awaiting'
                  ? 'awaiting'
                  : 'busy';
              const statusLabel =
                c.status === 'complete'
                  ? 'Complete'
                  : c.status === 'awaiting'
                  ? 'Awaiting approval'
                  : 'Calling';
              const pct = Math.min(100, (c.confirmed / c.units) * 100);

              return (
                <div key={c.id} className="qcard">
                  <div className="top">
                    <b>
                      {c.id} · {c.type} {COMP[c.comp]?.toLowerCase()}
                    </b>
                    <span className={`pill st ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="why">
                    {c.contact} donors contacted for {c.units} units
                    {c.req ? ` · for ${c.req}` : ''}. {c.confirmed} confirmed.
                  </div>
                  {c.warn && (
                    <div className="why" style={{ color: 'var(--urg)' }}>
                      ⚠ {c.warn}
                    </div>
                  )}
                  <div className="meter">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  {c.status === 'awaiting' && (
                    <div className="row">
                      <button
                        type="button"
                        className="btn pri sm"
                        onClick={() => onApproveCampaign(c.id)}
                        data-k={`co-${c.id}`}
                      >
                        Approve call
                      </button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => onCancelCampaign(c.id)}
                        data-k={`cn-${c.id}`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty">
              No donor calls tonight. That usually means stock is doing its job.
            </div>
          )}
        </section>

        {/* Planning & Registry Column */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Plan a donor call */}
          <section className="card">
            <header>
              <h2>Plan a donor call</h2>
            </header>
            <div className="fld">
              <label>Blood type</label>
              <div className="typegrid">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={campType === t ? 'on' : ''}
                    onClick={() => setCampType(t)}
                    data-k={`ct-${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="fld">
              <label htmlFor="cu">Units needed</label>
              <input
                id="cu"
                type="number"
                min="1"
                max="20"
                value={campUnits}
                onChange={(e) => setCampUnits(e.target.value)}
                data-f="camp.units"
              />
            </div>
            <p
              style={{
                fontSize: '13px',
                color: isUnneeded ? 'var(--urg)' : 'var(--muted)',
                margin: '8px 0 16px',
              }}
            >
              {isUnneeded
                ? `⚠ The network already holds ${haveStock} units of ${campType}. A call may not be needed.`
                : `Network holds ${haveStock} units of ${campType}. ${REGISTRY[campType]} eligible donors registered.`}
            </p>
            <button
              type="button"
              className="btn pri"
              onClick={handlePrepare}
              data-k="cnew"
            >
              Prepare call for approval
            </button>
          </section>

          {/* Registry by type */}
          <section className="card">
            <header>
              <h2>Registry by type</h2>
            </header>
            <div className="typecards">
              {TYPES.map((t) => (
                <div key={t} className="tc">
                  <span className="t">{t}</span>
                  <small>{REGISTRY[t]} donors</small>
                  <div className="meter">
                    <i style={{ width: `${(REGISTRY[t] / maxRegistry) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
