import { COMP, TYPES } from '../../../data';
import './NewRequest.css';

const COMPONENTS = ['RBC', 'PLT'];
const URGENCIES = ['Critical', 'Urgent', 'Routine'];
const PATIENTS = ['Child', 'Adult', 'Maternity'];

export default function NewRequest({ state, onUpdateRequestForm, onParseRequestMessage, onSubmitRequest }) {
  const form = state.form || { type: 'O+', comp: 'RBC', units: 2, urg: 'Urgent', pat: 'Child', msg: '' };

  return (
    <div className="ward-new-request">
      <div className="hello">
        <div>
          <div className="mono">Northside Children’s · Ward 4B</div>
          <h1>
            Ask for blood <em>in one message.</em>
          </h1>
        </div>
        <p>Type it the way you would say it, or fill the fields. The blood bank is notified instantly.</p>
      </div>

      <div className="g-two">
        <section className="card">
          <header>
            <h2>New request</h2>
          </header>

          <form
            className="ward-submit-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRequest();
            }}
          >
            <div className="fld">
              <label htmlFor="ward-message">Message</label>
              <textarea
                id="ward-message"
                value={form.msg}
                onChange={(event) => onUpdateRequestForm('msg', event.target.value)}
                placeholder="e.g. Child, 7 years, severe dengue, platelets dropping fast. Need 2 units O+ now."
              />
            </div>

            <div className="row ward-parser-row">
              <button type="button" className="btn silver sm" onClick={onParseRequestMessage}>
                Read my message
              </button>
              <span>Fills the fields below. Check them before sending.</span>
            </div>

            <div className="fld">
              <span className="ward-field-label">Blood type</span>
              <div className="typegrid" role="group" aria-label="Blood type">
                {TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={form.type === type ? 'on' : ''}
                    aria-pressed={form.type === type}
                    onClick={() => onUpdateRequestForm('type', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="form">
              <div className="fld">
                <span className="ward-field-label">Component</span>
                <div className="seg" role="group" aria-label="Blood component">
                  {COMPONENTS.map((component) => (
                    <button
                      key={component}
                      type="button"
                      className={form.comp === component ? 'on' : ''}
                      aria-pressed={form.comp === component}
                      onClick={() => onUpdateRequestForm('comp', component)}
                    >
                      {COMP[component]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld">
                <label htmlFor="ward-units">Units</label>
                <input
                  id="ward-units"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={form.units}
                  onChange={(event) => onUpdateRequestForm('units', event.target.value)}
                />
              </div>

              <div className="fld">
                <span className="ward-field-label">Urgency</span>
                <div className="seg" role="group" aria-label="Urgency">
                  {URGENCIES.map((urgency) => (
                    <button
                      key={urgency}
                      type="button"
                      className={form.urg === urgency ? 'on' : ''}
                      aria-pressed={form.urg === urgency}
                      onClick={() => onUpdateRequestForm('urg', urgency)}
                    >
                      {urgency}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld">
                <span className="ward-field-label">Patient</span>
                <div className="seg" role="group" aria-label="Patient type">
                  {PATIENTS.map((patient) => (
                    <button
                      key={patient}
                      type="button"
                      className={form.pat === patient ? 'on' : ''}
                      aria-pressed={form.pat === patient}
                      onClick={() => onUpdateRequestForm('pat', patient)}
                    >
                      {patient}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="btn pri ward-submit-button">
              Send request
            </button>
          </form>
        </section>

        <section className="card">
          <header>
            <h2>What happens next</h2>
          </header>
          <ul className="loglist ward-next-steps">
            <li>
              <span className="t">1</span>
              <span className="a">Matched</span>
              <span className="x">Your message becomes a clear need, checked for blood-type safety.</span>
            </li>
            <li>
              <span className="t">2</span>
              <span className="a">Sourced</span>
              <span className="x">The nearest banks with compatible units are found.</span>
            </li>
            <li>
              <span className="t">3</span>
              <span className="a">Approved</span>
              <span className="x">The duty officer approves the plan.</span>
            </li>
            <li>
              <span className="t">4</span>
              <span className="a">Delivered</span>
              <span className="x">A rider brings it. Track it live under My requests.</span>
            </li>
          </ul>
          <p className="ward-demo-note">Demo functionality · requests and delivery updates are simulated in this session.</p>
        </section>
      </div>
    </div>
  );
}
