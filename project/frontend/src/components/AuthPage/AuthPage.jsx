import './AuthPage.css';
import Helix from '../shared/Helix';

export default function AuthPage({ onSelectRole }) {
  return (
    <div id="signin">
      <div className="si-left" id="si-stage">
        <svg
          className="si-deco"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g fill="none" stroke="#C3C6CD" strokeWidth="1" strokeDasharray="3 5">
            <circle cx="420" cy="300" r="190" />
            <circle cx="600" cy="640" r="250" />
          </g>
          <g stroke="#C3C6CD" strokeWidth="1" fill="none">
            <path d="M60 880 H940" />
            <path d="M700 470 V560 H940" />
            <path d="M110 360 V450 H300" />
          </g>
          <g fill="none" stroke="#B7BAC2">
            <circle cx="350" cy="190" r="26" />
            <circle cx="640" cy="420" r="20" />
            <circle cx="330" cy="760" r="30" />
          </g>
        </svg>
        <Helix camz={6.6} hx={-0.05} tilt={-0.2} scale={1} style={{ zIndex: 1 }} />
        <div className="si-rule"></div>

        <div className="ann ann-intro">
          <p>Each request follows a fixed sequence: understood, matched, sourced, routed, checked and approved. Every step is logged.</p>
        </div>

        <div className="ann ann-specimen">
          <b>Specimen name:</b>
          <span>SERA Core</span>
          <b>Classification:</b>
          <span>Blood network coordination</span>
          <b>Structure:</b>
          <span>Multi-agent · human approved</span>
          <b>State:</b>
          <span>Active</span>
        </div>

        <div className="ann ann-status">
          <b>Status:</b>
          <span>Network active — stable</span>
          <b>Mission:</b>
          <span>No patient waits for blood that already exists</span>
          <b>Objective:</b>
          <span>Use every unit before it expires</span>
        </div>

        <div className="ann ann-tagline">
          supply chain · bank to bedside
        </div>

        <div className="dirs">
          <div className="h">
            Coordination core<br />Request sequence
          </div>
          <div className="h directives-title">
            Core directives // sequence_01
          </div>
          <div className="d">
            <b>[REQ.READ]</b>Message understood → type / component / urgency
          </div>
          <div className="d">
            <b>[ABO.CHECK]</b>Compatibility by rule → never by guess
          </div>
          <div className="d">
            <b>[STOCK.SCAN]</b>Banks offer units → soonest-expiring first
          </div>
          <div className="d">
            <b>[ROUTE.PLAN]</b>Rider assigned → minutes, not hours
          </div>
          <div className="d">
            <b>[AUDIT.RUN]</b>Duplicates flagged → children first
          </div>
          <div className="d">
            <b>[HUMAN.GATE]</b>Officer approves → nothing moves without it
          </div>
        </div>
      </div>

      <div className="si-panel">
        <div className="wordmark">SERA</div>
        <h1>
          No patient should wait for blood that <em>already exists.</em>
        </h1>
        <p className="auth-copy">
          The blood network’s command system.{' '}
          <b className="auth-copy-strong">Choose a role to enter.</b>
        </p>

        <div className="auth-role-list">
          <button
            type="button"
            className="rolecard main"
            onClick={() => onSelectRole('officer')}
            data-k="si-off"
          >
            <span className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                <path d="M8.5 12l2.5 2.5 4.5-5" />
              </svg>
            </span>
            <span>
              <b>Blood Bank Officer</b>
              <span>Command centre · approves every action</span>
            </span>
            <span className="mono">Enter →</span>
          </button>

          <button
            type="button"
            className="rolecard"
            onClick={() => onSelectRole('hospital')}
            data-k="si-hos"
          >
            <span className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111317" strokeWidth="1.5" strokeLinecap="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </span>
            <span>
              <b>Hospital ward</b>
              <span>Northside Children’s · Ward 4B</span>
            </span>
            <span className="mono auth-enter">Enter →</span>
          </button>
        </div>

        <div className="mono">Innodata AI Catalyst ’26 · demo region · all data simulated</div>
      </div>
    </div>
  );
}
