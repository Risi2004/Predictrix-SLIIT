import { useState } from 'react';
import { hosp, COMP, STATUS, BUSY, fmt } from '../../data';
import './RequestsManagement.css';

const FILTERS = {
  all: () => true,
  awaiting: (r) => r.status === 'awaiting',
  progress: (r) => BUSY.includes(r.status),
  enroute: (r) => r.status === 'enroute',
  delivered: (r) => r.status === 'delivered',
  rejected: (r) => r.status === 'rejected',
};

const LABELS = {
  all: 'All',
  awaiting: 'Awaiting approval',
  progress: 'In progress',
  enroute: 'En route',
  delivered: 'Delivered',
  rejected: 'Rejected',
};

export default function RequestsManagement({ state, onOpenCase }) {
  const [filter, setFilter] = useState('all');

  const rows = state.requests.filter(FILTERS[filter] || FILTERS.all);

  return (
    <div className="requests-management">
      <div className="hello">
        <div>
          <div className="mono">{state.requests.length} requests tonight</div>
          <h1>
            Every request, <em>one place.</em>
          </h1>
        </div>
      </div>

      <section className="card">
        <div className="chips">
          {Object.keys(FILTERS).map((k) => (
            <button
              key={k}
              type="button"
              className={`chip ${filter === k ? 'on' : ''}`}
              onClick={() => setFilter(k)}
              data-k={`f-${k}`}
            >
              {LABELS[k]}
              <span className="c">{state.requests.filter(FILTERS[k]).length}</span>
            </button>
          ))}
        </div>

        <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Case</th>
                <th>Hospital</th>
                <th>Need</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Received</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onOpenCase(r.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="id">{r.id}</td>
                    <td>{hosp(r.hosp).name}</td>
                    <td className="need">
                      <b>
                        {r.units} × {r.type}
                      </b>{' '}
                      {COMP[r.comp]?.toLowerCase()}
                    </td>
                    <td>
                      <span className={`pill u-${r.urg}`}>{r.urg}</span>
                    </td>
                    <td>
                      <span
                        className={`pill st ${r.status} ${
                          BUSY.includes(r.status) ? 'busy' : ''
                        }`}
                      >
                        {STATUS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="mono">{fmt(r.created)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCase(r.id);
                        }}
                        data-k={`ro-${r.id}`}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="empty">No requests here.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
