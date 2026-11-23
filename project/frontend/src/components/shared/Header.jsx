import { TITLES, fmt } from '../../data';

export default function Header({
  role,
  activeView,
  clock,
  live,
  scenario,
  onChangeScenario,
  onToggleLive,
  onSignOut,
}) {
  const crumb =
    role === 'officer'
      ? 'Blood Bank Officer'
      : "Northside Children’s · Ward 4B";

  const pageTitle = TITLES[activeView] || 'Command centre';

  return (
    <header className="bar">
      <div className="ttl">
        <span className="mono" id="crumb">{crumb}</span>
        <b id="pagetitle">{pageTitle}</b>
      </div>

      <span className={`clock ${!live ? 'paused' : ''}`} id="clockwrap">
        <i />
        <span id="clock">{fmt(clock)}</span>
      </span>

      {role === 'officer' && (
        <select
          className="sel"
          id="scenario"
          aria-label="Scenario"
          data-k="scn"
          value={scenario}
          onChange={(e) => onChangeScenario(e.target.value)}
        >
          <option value="normal">Scenario · Normal night</option>
          <option value="dengue">Scenario · Dengue surge</option>
          <option value="accident">Scenario · Mass-casualty accident</option>
        </select>
      )}

      <button
        type="button"
        className="toggle"
        id="live"
        aria-pressed={live}
        onClick={onToggleLive}
        data-k="live"
      >
        <span className="sw" />
        Live feed
      </button>

      <button
        type="button"
        className="btn sm"
        onClick={onSignOut}
        data-k="out"
      >
        Sign out
      </button>
    </header>
  );
}
