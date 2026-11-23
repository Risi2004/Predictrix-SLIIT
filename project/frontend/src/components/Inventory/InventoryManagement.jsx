import { useState } from 'react';
import { COMP, BANKS, TYPES, total, netTotal, allLots, fmtH, bank } from '../../data';
import './InventoryManagement.css';

export default function InventoryManagement({ state, onApproveMove, onDismissMove }) {
  const [comp, setComp] = useState('RBC');

  const expLots = allLots(state.stock)
    .filter((x) => x.l.exp < 72)
    .sort((a, b) => a.l.exp - b.l.exp);

  const maxVal = Math.max(
    1,
    ...BANKS.flatMap((b) => TYPES.map((t) => total(state.stock, b.id, comp, t)))
  );

  const totalExpiringUnits = expLots.reduce((acc, x) => acc + x.l.u, 0);

  return (
    <div className="inventory-management">
      <div className="hello">
        <div>
          <div className="mono">8 banks · live stock</div>
          <h1>
            What we hold, <em>and what&apos;s about to expire.</em>
          </h1>
        </div>
        <div className="seg">
          {['RBC', 'PLT'].map((k) => (
            <button
              key={k}
              type="button"
              className={comp === k ? 'on' : ''}
              onClick={() => setComp(k)}
              data-k={`c-${k}`}
            >
              {COMP[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="g-side">
        {/* Heatmap Section */}
        <section className="card">
          <header>
            <h2>{COMP[comp]} by bank</h2>
            <span className="mono">units</span>
          </header>
          <div className="scroll">
            <table className="tbl heat">
              <thead>
                <tr>
                  <th>Bank</th>
                  {TYPES.map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {BANKS.map((b) => {
                  let rowSum = 0;
                  return (
                    <tr key={b.id}>
                      <td style={{ color: 'var(--chrome)' }}>{b.name}</td>
                      {TYPES.map((t) => {
                        const v = total(state.stock, b.id, comp, t);
                        rowSum += v;
                        const alpha = v / maxVal;
                        const low = v < (comp === 'RBC' ? 4 : 2);
                        return (
                          <td
                            key={t}
                            className="c"
                            style={{
                              background: low
                                ? 'rgba(255,107,138,.16)'
                                : `rgba(155,107,255,${(alpha * 0.55).toFixed(2)})`,
                              color: low ? 'var(--crit)' : undefined,
                            }}
                          >
                            {v}
                          </td>
                        );
                      })}
                      <td className="c">{rowSum}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Network</td>
                  {TYPES.map((t) => (
                    <td key={t}>{netTotal(state.stock, comp, t)}</td>
                  ))}
                  <td>
                    {TYPES.reduce((acc, t) => acc + netTotal(state.stock, comp, t), 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px' }}>
            Red cells are running low. Darker means more stock.
          </p>
        </section>

        {/* Side Column: Suggested Moves + Expiry Watch */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Suggested Moves Card */}
          <section className="card">
            <header>
              <h2>Suggested moves</h2>
              <span className="mono">{state.moves.length}</span>
            </header>
            {state.moves.length > 0 ? (
              state.moves.map((m) => (
                <div key={m.id} className="qcard">
                  <div className="top">
                    <b>
                      {m.units} × {m.type}
                    </b>
                    <span className="mono" style={{ color: 'var(--urg)' }}>
                      expires in {fmtH(m.exp)}
                    </span>
                  </div>
                  <div className="why">
                    {bank(m.from).name} → {bank(m.to).name}, which holds only {m.tot}{' '}
                    unit{m.tot === 1 ? '' : 's'} of {m.type}. Moving them now means
                    they get used.
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn pri sm"
                      onClick={() => onApproveMove(m.id)}
                      data-k={`mo-${m.id}`}
                    >
                      Approve transfer
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => onDismissMove(m.id)}
                      data-k={`mn-${m.id}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">No moves needed right now.</div>
            )}
          </section>

          {/* Expiring Lots Card */}
          <section className="card">
            <header>
              <h2>Expiring within 72 h</h2>
              <span className="mono">{totalExpiringUnits} units</span>
            </header>
            {expLots.length > 0 ? (
              <ul className="loglist">
                {expLots.slice(0, 8).map((x, idx) => (
                  <li key={`${x.b}-${x.t}-${x.l.id}-${idx}`}>
                    <span className="t">{fmtH(x.l.exp)}</span>
                    <span className="a">{bank(x.b).name}</span>
                    <span className="x">
                      {x.l.u} × {x.t} {COMP[x.c]?.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">Nothing close to expiry.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
