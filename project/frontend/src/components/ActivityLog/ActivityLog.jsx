import { useState, useMemo } from 'react';
import { fmt } from '../../data';
import './ActivityLog.css';

/**
 * ActivityLog – Step 7 of Phase 5 Officer Domain Views.
 *
 * Renders the full audit trail of all simulation events.
 * Filter chips let the officer narrow by actor type.
 * Clicking a request-ID link opens the Case Review Drawer.
 */
export default function ActivityLog({ state, onOpenCase }) {
  const { log = [], logActor: initialActor = 'all' } = state;

  // Local filter state (mirrors prototype's S.logActor)
  const [actor, setActor] = useState(initialActor);

  // Build unique actor list (always include "all" first)
  const actors = useMemo(() => {
    const unique = [...new Set(log.map((l) => l.actor))];
    return ['all', ...unique];
  }, [log]);

  // Filter log entries
  const items = useMemo(
    () => (actor === 'all' ? log : log.filter((l) => l.actor === actor)),
    [log, actor]
  );

  // Max 120 entries displayed (matches prototype)
  const visible = items.slice(0, 120);

  function handleRefClick(e, ref) {
    e.preventDefault();
    if (ref && onOpenCase) onOpenCase(ref);
  }

  // Actor label → CSS modifier class
  function actorClass(a) {
    return a === 'Officer' || a === 'Hospital' ? 'off' : '';
  }

  return (
    <div className="activity-log">
      {/* Hello banner */}
      <div className="hello">
        <div>
          <div className="mono">{log.length} entries · This session · computed live</div>
          <h1>
            Every step, <em>on the record.</em>
          </h1>
        </div>
        <p>
          A live trace of every agent action, officer decision, and system event in this simulation
          session.
        </p>
      </div>

      {/* Filter chips */}
      <div className="chips al-chips" role="group" aria-label="Filter by actor">
        {actors.map((a) => (
          <button
            key={a}
            className={`chip${actor === a ? ' active' : ''}`}
            onClick={() => setActor(a)}
            aria-pressed={actor === a}
          >
            {a === 'all' ? 'Everyone' : a}
          </button>
        ))}
      </div>

      {/* Log card */}
      <section className="card al-card">
        {visible.length === 0 ? (
          <div className="al-empty">
            {log.length === 0
              ? 'No activity yet — events will appear as the simulation runs.'
              : `No entries for "${actor === 'all' ? 'everyone' : actor}" yet.`}
          </div>
        ) : (
          <ul className="loglist">
            {visible.map((l, i) => (
              <li key={`${l.ref || 'x'}-${l.t}-${i}`}>
                <span className="t">{fmt(l.t)}</span>
                <span className={`a ${actorClass(l.actor)}`}>{l.actor}</span>
                <span className="x">
                  {l.text}
                  {l.ref && (
                    <>
                      {' '}
                      <a
                        href="#"
                        onClick={(e) => handleRefClick(e, l.ref)}
                        tabIndex={0}
                        className="al-ref"
                        title={`Open case ${l.ref}`}
                      >
                        {l.ref}
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {items.length > 120 && (
          <div className="al-overflow mono">
            Showing 120 of {items.length} entries
          </div>
        )}
      </section>
    </div>
  );
}
