import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/shared/AppShell';
import Toasts from './components/shared/Toasts';
import AuthPage from './pages/AuthPage/AuthPage';
import CommandCentrePage from './pages/CommandCentre/CommandCentrePage';
import RequestsPage from './pages/Requests/RequestsPage';
import InventoryPage from './pages/Inventory/InventoryPage';
import DeliveriesPage from './pages/Deliveries/DeliveriesPage';
import DonorsPage from './pages/Donors/DonorsPage';
import ReportsPage from './pages/Reports/ReportsPage';
import ActivityLogPage from './pages/ActivityLog/ActivityLogPage';
import NewRequestPage from './pages/Hospital/NewRequest/NewRequestPage';
import MyRequestsPage from './pages/Hospital/MyRequests/MyRequestsPage';
import CaseReviewDrawer from './components/shared/CaseReviewDrawer';
import {
  createInitialState,
  BANKS,
  HOSP,
  TYPES,
  COMP,
  REGISTRY,
  W,
  R,
  lots,
  bank,
  hosp,
  travel,
  analyse,
  audit,
  computeMoves,
  parseMsg,
  VIEW_PATHS,
} from './data';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState(() => {
    const initialState = createInitialState();
    const savedRole = window.sessionStorage.getItem('circula.demoRole');

    if (savedRole === 'officer' || savedRole === 'hospital') {
      initialState.role = savedRole;
      initialState.view = savedRole === 'officer' ? 'command' : 'newreq';
    }

    return initialState;
  });
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    if (state.openCase) {
      setState((prev) => ({ ...prev, openCase: null }));
    }
  }

  const addToast = useCallback((kind, title, text) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [{ id, kind, title, text }, ...prev].slice(0, 3));
  }, []);

  const handleDismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Role selection
  const handleSelectRole = useCallback(
    (role) => {
      window.sessionStorage.setItem('circula.demoRole', role);
      setState((prev) => ({
        ...prev,
        role,
        view: role === 'officer' ? 'command' : 'newreq',
        openCase: null,
      }));
      window.scrollTo(0, 0);
      addToast(
        'ok',
        role === 'officer' ? 'Officer Command Centre' : 'Hospital Ward 4B',
        role === 'officer' ? 'Reviewing live regional blood network.' : 'Connected to blood network.'
      );
      if (role === 'officer') {
        navigate('/command-centre');
      } else {
        navigate('/hospital/new-request');
      }
    },
    [addToast, navigate]
  );

  // Sign out
  const handleSignOut = useCallback(() => {
    window.sessionStorage.removeItem('circula.demoRole');
    setState((prev) => ({
      ...prev,
      role: null,
      openCase: null,
    }));
    window.scrollTo(0, 0);
    navigate('/', { replace: true });
  }, [navigate]);

  // View navigation
  const handleSelectView = useCallback((view) => {
    setState((prev) => ({
      ...prev,
      view,
      openCase: null,
    }));
    if (VIEW_PATHS[view]) navigate(VIEW_PATHS[view]);
    window.scrollTo(0, 0);
  }, [navigate]);

  // Scenario toggle
  const handleChangeScenario = useCallback(
    (scenario) => {
      setState((prev) => ({
        ...prev,
        scenario,
      }));
      const titles = {
        normal: 'Normal night',
        dengue: 'Dengue surge',
        accident: 'Mass-casualty accident',
      };
      addToast('', 'Scenario changed', `${titles[scenario] || scenario}. New requests will follow this pattern.`);
    },
    [addToast]
  );

  // Live feed toggle
  const handleToggleLive = useCallback(() => {
    setState((prev) => ({
      ...prev,
      live: !prev.live,
    }));
  }, []);

  const handleUpdateRequestForm = useCallback((field, value) => {
    setState((prev) => ({
      ...prev,
      form: { ...prev.form, [field]: value },
    }));
  }, []);

  const handleParseRequestMessage = useCallback(() => {
    const parsed = parseMsg(stateRef.current.form.msg || '');
    setState((prev) => ({
      ...prev,
      form: { ...prev.form, ...parsed },
    }));

    if (!parsed.type) {
      addToast('', 'Blood type not found', 'Add the blood type, for example “O+”.');
      return;
    }

    addToast('ok', 'Message read', 'Check the fields, then send.');
  }, [addToast]);

  const handleSubmitRequest = useCallback(() => {
    const draft = stateRef.current.form;
    if (!draft.type || !(Number(draft.units) > 0)) {
      addToast('crit', 'Missing details', 'Choose a blood type and number of units.');
      return;
    }

    const units = Math.max(1, Math.min(12, Number(draft.units)));
    const id = 'R-' + String(stateRef.current.seq + 1).padStart(4, '0');
    const requestForm = { ...draft, units };

    setState((prev) => {
      const request = {
        id,
        hosp: 'h1',
        type: requestForm.type,
        comp: requestForm.comp,
        units: requestForm.units,
        urg: requestForm.urg,
        pat: requestForm.pat,
        msg: requestForm.msg || '',
        source: 'Ward form',
        created: prev.clock,
        status: 'received',
        timeline: [{ t: prev.clock, actor: 'Hospital', text: 'Ward 4B sent the request.' }],
        plan: { options: [], offering: 0 },
        checks: [],
        choice: 0,
      };

      return {
        ...prev,
        seq: prev.seq + 1,
        requests: [request, ...prev.requests],
        stats: { ...prev.stats, received: prev.stats.received + 1 },
        log: [
          { t: prev.clock, actor: 'Hospital', text: 'Ward 4B sent the request.', ref: id },
          ...prev.log,
        ],
        form: { ...prev.form, msg: '' },
      };
    });

    // Match the prototype's visible request pipeline, updating the shared case
    // so the officer and ward see the same statuses, checks, and case record.
    const pipeline = [
      (request) => {
        request.status = 'received';
        return ['Orchestrator', `Opened case ${request.id} for ${hosp(request.hosp).short}.`];
      },
      (request) => {
        request.status = 'matching';
        return [
          'Request Agent',
          `Read the request: ${request.units} × ${request.type} ${COMP[request.comp].toLowerCase()}, ${request.urg.toLowerCase()}.`,
        ];
      },
      (request, current) => {
        request.plan = analyse(request, current.stock);
        request.status = 'sourcing';
        return ['Bank Agents', `${request.plan.offering} of 8 banks can offer compatible units.`];
      },
      (request) => {
        request.status = 'routing';
        const option = request.plan.options[0];
        return [
          'Logistics Agent',
          option
            ? `Best route: ${bank(option.bank).name} → ${hosp(request.hosp).short}, ${option.eta} min.`
            : 'No bank can cover the full request.',
        ];
      },
      (request, current, requests) => {
        request.status = 'checking';
        request.checks = audit(request, requests);
        const warnings = request.checks.filter((check) => check.k === 'warn').length;
        return [
          'Auditor Agent',
          warnings
            ? `${warnings} issue${warnings > 1 ? 's' : ''} flagged for the officer.`
            : 'All checks passed.',
        ];
      },
      (request) => {
        request.status = 'awaiting';
        request.choice = 0;
        if (!request.plan.options.length) {
          const contact = Math.min(REGISTRY[request.type], request.units * 4);
          request.donorPlan = { contact };
          return ['Donor Agent', `Proposes calling ${contact} eligible ${request.type} donors nearby.`];
        }
        return ['Orchestrator', 'Plan sent to the officer for approval.'];
      },
    ];

    pipeline.forEach((runStep, index) => {
      window.setTimeout(() => {
        setState((prev) => {
          const requestIndex = prev.requests.findIndex((request) => request.id === id);
          if (requestIndex === -1) return prev;

          const request = {
            ...prev.requests[requestIndex],
            timeline: [...prev.requests[requestIndex].timeline],
            checks: [...prev.requests[requestIndex].checks],
          };
          const requests = [...prev.requests];
          requests[requestIndex] = request;
          const [actor, text] = runStep(request, prev, requests);
          const entry = { t: prev.clock, actor, text, ref: id };
          request.timeline.push({ t: prev.clock, actor, text });

          const stats =
            index === 4 && request.dupOf
              ? { ...prev.stats, dupes: prev.stats.dupes + 1 }
              : prev.stats;

          if (index === pipeline.length - 1 && prev.role === 'officer') {
            addToast(
              request.urg === 'Critical' ? 'crit' : '',
              `Needs your approval · ${request.id}`,
              `${request.units} × ${request.type} ${COMP[request.comp].toLowerCase()} for ${hosp(request.hosp).short}`
            );
          }

          return {
            ...prev,
            requests,
            stats,
            log: [entry, ...prev.log],
          };
        });
      }, index * 850);
    });

    addToast('ok', `Request sent · ${id}`, 'You can follow it live here.');
    navigate('/hospital/my-requests');
    window.scrollTo(0, 0);
  }, [addToast, navigate]);

  // Case Drawer handlers
  const handleOpenCase = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      openCase: id,
    }));
  }, []);

  const handleCloseCase = useCallback(() => {
    setState((prev) => ({
      ...prev,
      openCase: null,
    }));
  }, []);

  const handleChooseOption = useCallback((id, optionIndex) => {
    setState((prev) => {
      const reqIdx = prev.requests.findIndex((r) => r.id === id);
      if (reqIdx === -1) return prev;
      const newRequests = [...prev.requests];
      newRequests[reqIdx] = { ...newRequests[reqIdx], choice: optionIndex };
      return {
        ...prev,
        requests: newRequests,
      };
    });
  }, []);

  const handleRejectRequest = useCallback(
    (id, reasonText) => {
      setState((prev) => {
        const reqIdx = prev.requests.findIndex((r) => r.id === id);
        if (reqIdx === -1 || prev.requests[reqIdx].status !== 'awaiting') return prev;

        const r = { ...prev.requests[reqIdx] };
        r.status = 'rejected';
        r.timeline = [
          ...r.timeline,
          { t: prev.clock, actor: 'Officer', text: `Rejected: ${reasonText}.` },
        ];
        const newRequests = [...prev.requests];
        newRequests[reqIdx] = r;

        const newLog = [
          { t: prev.clock, actor: 'Officer', text: `Rejected: ${reasonText}.`, ref: r.id },
          ...prev.log,
        ];
        const newStats = { ...prev.stats, rejected: prev.stats.rejected + 1 };

        addToast('', `Request closed · ${r.id}`, reasonText);
        return {
          ...prev,
          requests: newRequests,
          log: newLog,
          stats: newStats,
          openCase: null,
        };
      });
    },
    [addToast]
  );

  // Officer request approval handler
  const handleApproveRequest = useCallback(
    (id) => {
      setState((prev) => {
        const reqIdx = prev.requests.findIndex((r) => r.id === id);
        if (reqIdx === -1 || prev.requests[reqIdx].status !== 'awaiting') return prev;

        const r = { ...prev.requests[reqIdx] };
        const newRequests = [...prev.requests];
        const newLog = [...prev.log];
        const newStats = { ...prev.stats };
        let nextDseq = prev.dseq;
        let nextCseq = prev.cseq;

        // If no stock options exist, launch donor campaign
        if (!r.plan.options.length) {
          nextCseq++;
          const campId = 'C-' + String(nextCseq).padStart(3, '0');
          const contactCount = r.donorPlan ? r.donorPlan.contact : 0;
          const campaign = {
            id: campId,
            type: r.type,
            comp: r.comp || 'RBC',
            units: r.units,
            contact: contactCount,
            confirmed: 0,
            status: 'calling',
            req: r.id,
            created: prev.clock,
            warn: null,
          };
          r.status = 'donors';
          newStats.donorCalls++;
          newLog.unshift({
            t: prev.clock,
            actor: 'Officer',
            text: `Approved a donor call for ${r.type}.`,
            ref: r.id,
          });
          newLog.unshift({
            t: prev.clock,
            actor: 'Donor Agent',
            text: `Contacting ${contactCount} eligible ${r.type} donors (${campId}).`,
            ref: r.id,
          });
          newRequests[reqIdx] = r;
          addToast('ok', 'Donor call approved', `Calling ${contactCount} eligible ${r.type} donors.`);
          return {
            ...prev,
            cseq: nextCseq,
            requests: newRequests,
            campaigns: [campaign, ...prev.campaigns],
            stats: newStats,
            log: newLog,
          };
        }

        const o = r.plan.options[r.choice] || r.plan.options[0];
        const bankLots = lots(prev.stock, o.bank, r.comp, o.dt)
          .filter((l) => l.u > 0)
          .sort((a, b) => a.exp - b.exp);
        const availTotal = bankLots.reduce((acc, l) => acc + l.u, 0);

        if (availTotal < r.units) {
          r.plan = analyse(r, prev.stock);
          r.choice = 0;
          newRequests[reqIdx] = r;
          addToast('', 'Stock changed', `The plan for ${r.id} was refreshed. Please review it again.`);
          return {
            ...prev,
            requests: newRequests,
          };
        }

        // Deduct units from stock (clone stock)
        const nextStock = {};
        BANKS.forEach((b) => {
          nextStock[b.id] = { RBC: {}, PLT: {} };
          ['RBC', 'PLT'].forEach((c) => {
            TYPES.forEach((t) => {
              const src = lots(prev.stock, b.id, c, t);
              if (b.id === o.bank && c === r.comp && t === o.dt) {
                let need = r.units;
                const updated = [];
                for (const l of src) {
                  if (need > 0 && l.u > 0) {
                    const take = Math.min(l.u, need);
                    const rem = l.u - take;
                    need -= take;
                    if (l.exp < 72) newStats.nearSaved += take;
                    if (rem > 0 || l.exp > 0) updated.push({ ...l, u: rem });
                  } else {
                    updated.push({ ...l });
                  }
                }
                nextStock[b.id][c][t] = updated;
              } else {
                nextStock[b.id][c][t] = src.map((l) => ({ ...l }));
              }
            });
          });
        });

        newStats.approvals = [...newStats.approvals, prev.clock - r.created];

        // Create delivery
        nextDseq++;
        const dId = 'D-' + String(nextDseq).padStart(3, '0');
        const riderName = 'Rider ' + (1 + Math.floor(R() * 6));
        const delivery = {
          id: dId,
          req: r.id,
          from: o.bank,
          toKind: 'h',
          to: r.hosp,
          units: r.units,
          type: o.dt,
          comp: r.comp,
          eta: o.eta,
          left: o.eta,
          rider: riderName,
          start: prev.clock,
        };

        r.delivery = dId;
        r.status = 'enroute';
        r.source_bank = o.bank;
        newRequests[reqIdx] = r;

        const approveText = `Approved ${r.units} × ${o.dt} from ${bank(o.bank).name}.`;
        const dispatchText = `${riderName} dispatched. Arrives in ${o.eta} min.`;
        newLog.unshift({ t: prev.clock, actor: 'Officer', text: approveText, ref: r.id });
        newLog.unshift({ t: prev.clock, actor: 'Logistics Agent', text: dispatchText, ref: r.id });
        r.timeline.push({ t: prev.clock, actor: 'Officer', text: approveText });
        r.timeline.push({ t: prev.clock, actor: 'Logistics Agent', text: dispatchText });

        addToast(
          'ok',
          `Dispatched · ${r.id}`,
          `${riderName} is on the way from ${bank(o.bank).name}. ETA ${o.eta} min.`
        );

        const newMoves = computeMoves(nextStock, prev.dismissed);

        return {
          ...prev,
          dseq: nextDseq,
          stock: nextStock,
          deliveries: [delivery, ...prev.deliveries],
          requests: newRequests,
          moves: newMoves,
          stats: newStats,
          log: newLog,
        };
      });
    },
    [addToast]
  );

  // Suggested move handlers
  const handleApproveMove = useCallback(
    (moveId) => {
      setState((prev) => {
        const m = prev.moves.find((x) => x.id === moveId);
        if (!m || m.lot.u < 1) return prev;

        const units = m.lot.u;
        const exp = m.lot.exp;

        // Deduct from source lot in stock
        const nextStock = {};
        BANKS.forEach((b) => {
          nextStock[b.id] = { RBC: {}, PLT: {} };
          ['RBC', 'PLT'].forEach((c) => {
            TYPES.forEach((t) => {
              const src = lots(prev.stock, b.id, c, t);
              if (b.id === m.from && c === 'RBC' && t === m.type) {
                nextStock[b.id][c][t] = src.map((l) =>
                  l.id === m.lot.id ? { ...l, u: 0 } : { ...l }
                );
              } else {
                nextStock[b.id][c][t] = src.map((l) => ({ ...l }));
              }
            });
          });
        });

        const eta = travel(bank(m.from), bank(m.to));
        const nextDseq = prev.dseq + 1;
        const dId = 'D-' + String(nextDseq).padStart(3, '0');
        const riderName = 'Rider ' + (1 + Math.floor(R() * 6));
        const delivery = {
          id: dId,
          req: null,
          from: m.from,
          toKind: 'b',
          to: m.to,
          units,
          type: m.type,
          comp: 'RBC',
          eta,
          left: eta,
          rider: riderName,
          start: prev.clock,
          lot: { u: units, exp },
        };

        const newStats = { ...prev.stats, nearSaved: prev.stats.nearSaved + units };
        const newLog = [
          {
            t: prev.clock,
            actor: 'Officer',
            text: `Approved moving ${units} × ${m.type} from ${bank(m.from).name} to ${
              bank(m.to).name
            } before they expire.`,
            ref: null,
          },
          ...prev.log,
        ];

        addToast(
          'ok',
          'Transfer approved',
          `${units} × ${m.type} heading to ${bank(m.to).name}. ETA ${eta} min.`
        );
        const newMoves = computeMoves(nextStock, prev.dismissed);

        return {
          ...prev,
          dseq: nextDseq,
          stock: nextStock,
          deliveries: [delivery, ...prev.deliveries],
          moves: newMoves,
          stats: newStats,
          log: newLog,
        };
      });
    },
    [addToast]
  );

  const handleDismissMove = useCallback((moveId) => {
    setState((prev) => {
      const m = prev.moves.find((x) => x.id === moveId);
      if (!m) return prev;
      const nextDismissed = new Set(prev.dismissed);
      nextDismissed.add(m.lot.id);
      const newLog = [
        {
          t: prev.clock,
          actor: 'Officer',
          text: `Dismissed a suggested move of ${m.units} × ${m.type}.`,
          ref: null,
        },
        ...prev.log,
      ];
      const newMoves = computeMoves(prev.stock, nextDismissed);
      return {
        ...prev,
        dismissed: nextDismissed,
        moves: newMoves,
        log: newLog,
      };
    });
  }, []);

  // Donor campaign handlers
  const handleApproveCampaign = useCallback(
    (id) => {
      setState((prev) => {
        const cIdx = prev.campaigns.findIndex((x) => x.id === id);
        if (cIdx === -1 || prev.campaigns[cIdx].status !== 'awaiting') return prev;

        const c = { ...prev.campaigns[cIdx], status: 'calling' };
        const newCampaigns = [...prev.campaigns];
        newCampaigns[cIdx] = c;

        const newStats = { ...prev.stats, donorCalls: prev.stats.donorCalls + 1 };
        if (c.warn) newStats.unneeded++;

        const newLog = [
          {
            t: prev.clock,
            actor: 'Donor Agent',
            text: `Contacting ${c.contact} eligible ${c.type} donors.`,
            ref: null,
          },
          {
            t: prev.clock,
            actor: 'Officer',
            text: `Approved donor call ${c.id}.`,
            ref: null,
          },
          ...prev.log,
        ];

        addToast('ok', 'Donor call started', `${c.contact} ${c.type} donors are being contacted.`);
        return {
          ...prev,
          campaigns: newCampaigns,
          stats: newStats,
          log: newLog,
        };
      });
    },
    [addToast]
  );

  const handleCancelCampaign = useCallback((id) => {
    setState((prev) => {
      const c = prev.campaigns.find((x) => x.id === id);
      if (!c) return prev;
      const newCampaigns = prev.campaigns.filter((x) => x.id !== id);
      const newLog = [
        {
          t: prev.clock,
          actor: 'Officer',
          text: `Cancelled donor call ${c.id}.`,
          ref: null,
        },
        ...prev.log,
      ];
      return {
        ...prev,
        campaigns: newCampaigns,
        log: newLog,
      };
    });
  }, []);

  const handlePrepareCampaign = useCallback(
    ({ type, units, pending, warn }) => {
      setState((prev) => {
        const nextCseq = prev.cseq + 1;
        const cId = 'C-' + String(nextCseq).padStart(3, '0');
        const contact = Math.min(REGISTRY[type], units * 4);
        const c = {
          id: cId,
          type,
          comp: 'RBC',
          units,
          contact,
          confirmed: 0,
          status: pending ? 'awaiting' : 'calling',
          req: null,
          created: prev.clock,
          warn: warn || null,
        };

        const newLog = [...prev.log];
        if (c.status === 'calling') {
          newLog.unshift({
            t: prev.clock,
            actor: 'Donor Agent',
            text: `Contacting ${contact} eligible ${type} donors (${cId}).`,
            ref: null,
          });
        } else {
          newLog.unshift({
            t: prev.clock,
            actor: 'Donor Agent',
            text: `Prepared donor call for ${units} × ${type} (${cId}).`,
            ref: null,
          });
        }

        addToast('', 'Prepared donor call', 'Review and approve it to start contacting donors.');

        return {
          ...prev,
          cseq: nextCseq,
          campaigns: [c, ...prev.campaigns],
          log: newLog,
        };
      });
    },
    [addToast]
  );

  // Clock & Simulation Tick Effect (every 1300ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.live) return;

      setState((prev) => {
        const nextClock = prev.clock + 1;
        const newStats = { ...prev.stats };
        const newLog = [...prev.log];
        const newDeliveries = prev.deliveries.map((d) => ({ ...d }));
        const newRequests = prev.requests.map((r) => ({ ...r, timeline: [...r.timeline] }));
        const newCampaigns = prev.campaigns.map((c) => ({ ...c }));
        let nextLotSeq = prev.lotSeq;

        // Clone stock shallowly per bank
        const nextStock = {};
        BANKS.forEach((b) => {
          nextStock[b.id] = { RBC: {}, PLT: {} };
          ['RBC', 'PLT'].forEach((c) => {
            TYPES.forEach((t) => {
              const srcLots = lots(prev.stock, b.id, c, t);
              const updatedLots = [];
              for (let i = 0; i < srcLots.length; i++) {
                const l = { ...srcLots[i], exp: srcLots[i].exp - 1 / 60 };
                if (l.exp <= 0 && l.u > 0) {
                  newStats.expired += l.u;
                  newLog.unshift({
                    t: nextClock,
                    actor: 'Bank Agents',
                    text: `${l.u} × ${t} ${COMP[c].toLowerCase()} expired at ${b.name}.`,
                    ref: null,
                  });
                  l.u = 0;
                }
                if (l.u > 0 || l.exp > 0) {
                  updatedLots.push(l);
                }
              }
              nextStock[b.id][c][t] = updatedLots;
            });
          });
        });

        // Update deliveries
        newDeliveries.forEach((d) => {
          if (d.left <= 0) return;
          d.left--;
          if (d.left <= 0) {
            if (d.toKind === 'h') {
              const reqIdx = newRequests.findIndex((x) => x.id === d.req);
              if (reqIdx !== -1) {
                const r = newRequests[reqIdx];
                r.status = 'delivered';
                r.deliveredAt = nextClock;
                newStats.delivered++;
                newStats.deliveryMins = [...newStats.deliveryMins, d.eta];
                const text = `${d.units} × ${d.type} delivered to ${hosp(d.to).short}.`;
                newLog.unshift({ t: nextClock, actor: 'Logistics Agent', text, ref: r.id });
                r.timeline.push({ t: nextClock, actor: 'Logistics Agent', text });
                addToast('ok', `Delivered · ${r.id}`, `${d.units} units reached ${hosp(d.to).name}.`);
              }
            } else {
              // Bank transfer delivery
              nextLotSeq++;
              nextStock[d.to].RBC[d.type].push({ id: nextLotSeq, u: d.lot.u, exp: d.lot.exp });
              const text = `${d.units} × ${d.type} arrived at ${bank(d.to).name}.`;
              newLog.unshift({ t: nextClock, actor: 'Logistics Agent', text, ref: null });
            }
          }
        });

        // Update campaigns
        newCampaigns.forEach((c) => {
          if (c.status !== 'calling') return;
          if (R() < 0.5) c.confirmed++;
          if (c.confirmed >= c.units) {
            c.status = 'complete';
            nextLotSeq++;
            nextStock.b1[c.comp][c.type].push({
              id: nextLotSeq,
              u: c.units,
              exp: c.comp === 'RBC' ? 840 : 120,
            });
            const text = `${c.units} ${c.type} donors confirmed and collected at Central (${c.id}).`;
            newLog.unshift({ t: nextClock, actor: 'Donor Agent', text, ref: null });
            addToast('ok', 'Donors came through', `${c.units} units of ${c.type} added at Central.`);
            if (c.req) {
              const reqIdx = newRequests.findIndex((x) => x.id === c.req);
              if (reqIdx !== -1 && newRequests[reqIdx].status === 'donors') {
                newRequests[reqIdx].donorPlan = null;
                // Re-process request with newly arrived stock
                newRequests[reqIdx].plan = analyse(newRequests[reqIdx], nextStock);
                newRequests[reqIdx].status = 'awaiting';
              }
            }
          }
        });

        // Periodic move re-computation
        let updatedMoves = prev.moves;
        if (nextClock % 30 === 0) {
          updatedMoves = computeMoves(nextStock, prev.dismissed);
        }

        return {
          ...prev,
          clock: nextClock,
          stock: nextStock,
          deliveries: newDeliveries,
          requests: newRequests,
          campaigns: newCampaigns,
          moves: updatedMoves,
          log: newLog,
          stats: newStats,
          lotSeq: nextLotSeq,
        };
      });
    }, 1300);

    return () => clearInterval(interval);
  }, [addToast]);

  // Scenario Request Generator Effect
  useEffect(() => {
    const s = state.scenario;
    const intervalTime = s === 'dengue' ? 16000 : s === 'accident' ? 10000 : 30000;

    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.live || !cur.role) return;

      setState((prev) => {
        let f;
        const openReqs = prev.requests.filter((r) => !['delivered', 'rejected'].includes(r.status));
        if (openReqs.length && R() < 0.1) {
          const o = openReqs[Math.floor(R() * openReqs.length)];
          f = { hosp: o.hosp, type: o.type, comp: o.comp, units: o.units, urg: o.urg, pat: o.pat };
        } else {
          const wpick = () => {
            let x = R();
            let acc = 0;
            for (const t of TYPES) {
              acc += W[t];
              if (x < acc) return t;
            }
            return 'O+';
          };
          const h = HOSP[Math.floor(R() * HOSP.length)];
          const comp = R() < (prev.scenario === 'dengue' ? 0.7 : 0.25) ? 'PLT' : 'RBC';
          const urg = R() < (prev.scenario === 'normal' ? 0.2 : 0.5) ? 'Critical' : R() < 0.5 ? 'Urgent' : 'Routine';
          const pat = h.id === 'h1' ? 'Child' : h.id === 'h2' ? 'Maternity' : R() < 0.2 ? 'Child' : 'Adult';
          f = {
            hosp: h.id,
            type: wpick(),
            comp,
            units: comp === 'PLT' ? 1 + Math.floor(R() * 2) : 1 + Math.floor(R() * 4),
            urg,
            pat,
          };
          if (prev.scenario === 'accident' && R() < 0.75) {
            f = {
              hosp: 'h3',
              type: R() < 0.5 ? 'O-' : 'O+',
              comp: 'RBC',
              units: 2 + Math.floor(R() * 4),
              urg: 'Critical',
              pat: 'Adult',
            };
          }
        }
        f.msg = `${f.pat === 'Child' ? 'Child' : 'Patient'}, ${
          f.urg === 'Critical' ? 'needs it now' : f.urg === 'Urgent' ? 'needed within the hour' : 'for tomorrow morning'
        }. ${f.units} units ${f.type} ${COMP[f.comp].toLowerCase()}.`;

        const newSeq = prev.seq + 1;
        const id = 'R-' + String(newSeq).padStart(4, '0');
        const r = {
          id,
          hosp: f.hosp,
          type: f.type,
          comp: f.comp,
          units: f.units,
          urg: f.urg,
          pat: f.pat,
          msg: f.msg,
          source: 'Ward message',
          created: prev.clock,
          status: 'awaiting',
          timeline: [],
          plan: { options: [], offering: 0 },
          checks: [],
          choice: 0,
        };

        const newRequests = [r, ...prev.requests];
        const newStats = { ...prev.stats, received: prev.stats.received + 1 };
        const newLog = [...prev.log];

        r.plan = analyse(r, prev.stock);
        r.checks = audit(r, newRequests);

        newLog.unshift({ t: prev.clock, actor: 'Orchestrator', text: `Opened case ${r.id} for ${hosp(r.hosp).short}.`, ref: r.id });
        newLog.unshift({
          t: prev.clock,
          actor: 'Request Agent',
          text: `Read the request: ${r.units} × ${r.type} ${COMP[r.comp].toLowerCase()}, ${r.urg.toLowerCase()}.`,
          ref: r.id,
        });
        newLog.unshift({
          t: prev.clock,
          actor: 'Bank Agents',
          text: `${r.plan.offering} of 8 banks can offer compatible units.`,
          ref: r.id,
        });

        if (r.plan.options.length) {
          const o = r.plan.options[0];
          newLog.unshift({
            t: prev.clock,
            actor: 'Logistics Agent',
            text: `Best route: ${bank(o.bank).name} → ${hosp(r.hosp).short}, ${o.eta} min.`,
            ref: r.id,
          });
          newLog.unshift({ t: prev.clock, actor: 'Orchestrator', text: 'Plan sent to the officer for approval.', ref: r.id });
        } else {
          const n = Math.min(REGISTRY[r.type], r.units * 4);
          r.donorPlan = { contact: n };
          newLog.unshift({
            t: prev.clock,
            actor: 'Donor Agent',
            text: `Proposes calling ${n} eligible ${r.type} donors nearby.`,
            ref: r.id,
          });
        }

        if (prev.role === 'officer') {
          addToast(r.urg === 'Critical' ? 'crit' : '', `Needs your approval · ${r.id}`, `${r.units} × ${r.type} ${COMP[r.comp].toLowerCase()} for ${hosp(r.hosp).short}`);
        }

        return {
          ...prev,
          seq: newSeq,
          requests: newRequests,
          stats: newStats,
          log: newLog,
        };
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [state.scenario, addToast]);

  const activeView = Object.entries(VIEW_PATHS).find(([, path]) => path === location.pathname)?.[0] || state.view;
  const routedState = { ...state, view: activeView };
  const routeContext = {
    state: routedState,
    onNavigate: handleSelectView,
    onUpdateRequestForm: handleUpdateRequestForm,
    onParseRequestMessage: handleParseRequestMessage,
    onSubmitRequest: handleSubmitRequest,
    onOpenCase: handleOpenCase,
    onApproveRequest: handleApproveRequest,
    onRejectRequest: handleRejectRequest,
    onChooseOption: handleChooseOption,
    onApproveMove: handleApproveMove,
    onDismissMove: handleDismissMove,
    onApproveCampaign: handleApproveCampaign,
    onCancelCampaign: handleCancelCampaign,
    onPrepareCampaign: handlePrepareCampaign,
  };

  return (
    <>
      <Routes>
        {/* Role Selection / Sign-in */}
        <Route
          path="/"
          element={
            state.role ? (
              <Navigate to={state.role === 'officer' ? '/command-centre' : '/hospital/new-request'} replace />
            ) : (
              <AuthPage onSelectRole={handleSelectRole} />
            )
          }
        />
        <Route path="/sign-in" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/sign-up" element={<Navigate to="/" replace />} />
        <Route
          path="/app"
          element={
            <Navigate
              to={state.role === 'officer' ? '/command-centre' : state.role === 'hospital' ? '/hospital/new-request' : '/'}
              replace
            />
          }
        />

        {/* Protected Officer Application Views */}
        <Route
          element={
            state.role === 'officer' ? (
              <AppShell
                state={routedState}
                routeContext={routeContext}
                onChangeScenario={handleChangeScenario}
                onToggleLive={handleToggleLive}
                onSignOut={handleSignOut}
                drawer={
                  <CaseReviewDrawer
                    openCaseId={state.openCase}
                    state={state}
                    onClose={handleCloseCase}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                    onChooseOption={handleChooseOption}
                    onOpenCase={handleOpenCase}
                  />
                }
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route path="/command-centre" element={<CommandCentrePage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/donors" element={<DonorsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/activity-log" element={<ActivityLogPage />} />
        </Route>

        {/* Protected Hospital Ward Application Views */}
        <Route
          element={
            state.role === 'hospital' ? (
              <AppShell
                state={routedState}
                routeContext={routeContext}
                onToggleLive={handleToggleLive}
                onSignOut={handleSignOut}
                drawer={
                  <CaseReviewDrawer
                    openCaseId={state.openCase}
                    state={state}
                    onClose={handleCloseCase}
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                    onChooseOption={handleChooseOption}
                    onOpenCase={handleOpenCase}
                  />
                }
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route path="/hospital" element={<Navigate to="/hospital/new-request" replace />} />
          <Route path="/hospital/new-request" element={<NewRequestPage />} />
          <Route path="/hospital/my-requests" element={<MyRequestsPage />} />
        </Route>

        {/* 404 / Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toasts toasts={toasts} onDismissToast={handleDismissToast} />
    </>
  );
}
