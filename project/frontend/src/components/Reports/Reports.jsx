import { useEffect, useState } from 'react';
import './Reports.css';

const CONTESTANTS = [
  ['A', 'SERA', 'Agents + officer'],
  ['B', 'Single agent', 'Same model and tools'],
  ['C', 'Rules only', 'Nearest bank first'],
  ['D', 'Human team', 'Coordinators'],
  ['★', 'Reference', 'Optimal solver'],
];

const BENCHMARK_SCENARIOS = [
  'Normal month',
  'Dengue surge',
  'Mass-casualty accident',
  'Bank stock-out',
  'Inflated or duplicate requests',
  'Missing or late data',
];

export default function Reports({ state }) {
  const [bench, setBench] = useState(null);
  useEffect(() => {
    fetch('/api/benchmark/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBench(d && d.rows && d.rows.length ? d : null))
      .catch(() => setBench(null));
  }, []);
  const summary = (letter) => {
    if (!bench) return null;
    const rows = bench.rows.filter((r) => r.contestant.startsWith(letter));
    if (!rows.length) return null;
    const avg = (k) => {
      const v = rows.map((r) => r[k]).filter((n) => typeof n === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const maxNear = Math.max(1, ...bench.rows.map((r) => (typeof r.near_expiry_used === 'number' ? r.near_expiry_used : 0)));
    const near = avg('near_expiry_used');
    const parts = [];
    if (avg('unmet_urgent_pct') !== null) parts.push(`unmet ${avg('unmet_urgent_pct').toFixed(1)}%`);
    if (avg('units_expired') !== null) parts.push(`expired ${avg('units_expired').toFixed(1)}`);
    if (avg('median_fill_min') !== null) parts.push(`${avg('median_fill_min').toFixed(0)} min`);
    if (avg('cost_usd')) parts.push(`$${avg('cost_usd').toFixed(3)}`);
    return { text: parts.join(' · '), bar: near === null ? 0 : Math.round((near / maxNear) * 100) };
  };

  const st = state.stats || {};
  const avg = (arr) =>
    arr && arr.length
      ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length)
      : '—';

  const tiles = [
    ['Requests received', st.received ?? 0],
    ['Delivered', st.delivered ?? 0],
    ['Avg minutes to approval', avg(st.approvals)],
    ['Avg delivery minutes', avg(st.deliveryMins)],
    ['Near-expiry units used', st.nearSaved ?? 0],
    ['Units expired', st.expired ?? 0],
    ['Incompatible matches', st.incompat ?? 0],
    ['Duplicates caught', st.dupes ?? 0],
    ['Donor calls', st.donorCalls ?? 0],
    ['Unneeded donor calls', st.unneeded ?? 0],
  ];

  return (
    <div className="reports-view">
      <div className="hello">
        <div>
          <div className="mono">This session · computed live</div>
          <h1>
            How tonight <em>is going.</em>
          </h1>
        </div>
        <p>
          These numbers come from the simulation running in this page, not from a
          real network.
        </p>
      </div>

      {/* KPI Tiles */}
      <div
        className="kpis"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        {tiles.map(([label, val], idx) => (
          <div key={label} className={`kpi ${idx === 6 ? 'hot' : ''}`}>
            <span className="mono">{label}</span>
            <div className="n" style={{ fontSize: '40px' }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Benchmark Section */}
      <section className="card">
        <header>
          <h2>Benchmark</h2>
          <span className="mono">{bench ? `latest run · ${bench.run_id}` : 'waiting for the benchmark run'}</span>
        </header>
        <p style={{ color: 'var(--silver)', maxWidth: '70ch' }}>
          {bench
            ? 'Averages over all scenarios and seeds from the latest run of python main.py benchmark (simulated data). Bar = units used before expiry.'
            : 'The same six scenarios run against four contestants. The results fill in here after the test runs; nothing below is a result yet.'}
        </p>

        <div className="bench">
          {CONTESTANTS.map((x) => (
            <div key={x[0]} className="r">
              <span>
                <b>
                  {x[0]} · {x[1]}
                </b>
                <br />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {x[2]}
                </span>
              </span>
              {summary(x[0]) ? (
                <>
                  <div className="slotbar" style={{ borderStyle: 'solid', background: `linear-gradient(90deg, var(--chrome) ${summary(x[0]).bar}%, transparent ${summary(x[0]).bar}%)` }} />
                  <span className="mono">{summary(x[0]).text}</span>
                </>
              ) : (
                <>
                  <div className="slotbar" />
                  <span className="mono">{x[0] === 'D' ? 'see human study' : 'not run yet'}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="chips">
          {BENCHMARK_SCENARIOS.map((s) => (
            <span key={s} className="chip" style={{ cursor: 'default' }}>
              {s}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
