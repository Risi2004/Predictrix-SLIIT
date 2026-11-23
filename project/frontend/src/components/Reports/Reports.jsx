import './Reports.css';

const CONTESTANTS = [
  ['A', 'CIRCULA', 'Agents + officer'],
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
          <span className="mono">waiting for the benchmark run</span>
        </header>
        <p style={{ color: 'var(--silver)', maxWidth: '70ch' }}>
          The same six scenarios run against four contestants. The results fill in
          here after the test runs; nothing below is a result yet.
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
              <div className="slotbar" />
              <span className="mono">not run yet</span>
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
