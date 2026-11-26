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
import { createInitialState, VIEW_PATHS } from './data';
import { api } from './api';
import './App.css';

// The backend (FastAPI + agents) owns the blood network. These fields come from GET /api/state;
// everything else in `state` (role, view, open case, filters, form drafts) is UI-only.
const SERVER_FIELDS = ['clock', 'live', 'scenario', 'stock', 'requests', 'deliveries', 'campaigns', 'moves', 'log', 'stats', 'seq'];
const POLL_MS = 1000;

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState(() => {
    const initialState = createInitialState();
    initialState.connected = false;
    const savedRole = window.sessionStorage.getItem('sera.demoRole');
    if (savedRole === 'officer' || savedRole === 'hospital') {
      initialState.role = savedRole;
      initialState.view = savedRole === 'officer' ? 'command' : 'newreq';
    }
    return initialState;
  });
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const stateRef = useRef(state);
  const eventSeqRef = useRef(0);
  const offlineToastRef = useRef(false);

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

  // ---------------------------------------------------------------- live sync with the backend
  const refresh = useCallback(async () => {
    try {
      const snap = await api.state(eventSeqRef.current);
      const first = eventSeqRef.current === 0;
      eventSeqRef.current = snap.eventSeq;
      setState((prev) => {
        const next = { ...prev, connected: true };
        SERVER_FIELDS.forEach((k) => {
          next[k] = snap[k];
        });
        return next;
      });
      offlineToastRef.current = false;
      if (!first) {
        const role = stateRef.current.role;
        (snap.events || []).forEach((e) => {
          if (role && (e.role === 'all' || e.role === role)) addToast(e.kind, e.title, e.text);
        });
      }
    } catch {
      setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
      if (!offlineToastRef.current) {
        offlineToastRef.current = true;
        addToast('crit', 'Backend not reachable', 'Start it with: python main.py serve');
      }
    }
  }, [addToast]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const act = useCallback(
    async (fn, okToast) => {
      try {
        const out = await fn();
        if (okToast) addToast(...okToast);
        await refresh();
        return out;
      } catch (err) {
        addToast('crit', 'Action failed', err.message);
        return null;
      }
    },
    [addToast, refresh]
  );

  // ---------------------------------------------------------------- roles & navigation (UI only)
  const handleSelectRole = useCallback(
    (role) => {
      window.sessionStorage.setItem('sera.demoRole', role);
      setState((prev) => ({ ...prev, role, view: role === 'officer' ? 'command' : 'newreq', openCase: null }));
      window.scrollTo(0, 0);
      addToast(
        'ok',
        role === 'officer' ? 'Officer Command Centre' : 'Hospital Ward 4B',
        role === 'officer' ? 'Reviewing live regional blood network.' : 'Connected to blood network.'
      );
      navigate(role === 'officer' ? '/command-centre' : '/hospital/new-request');
    },
    [addToast, navigate]
  );

  const handleSignOut = useCallback(() => {
    window.sessionStorage.removeItem('sera.demoRole');
    setState((prev) => ({ ...prev, role: null, openCase: null }));
    window.scrollTo(0, 0);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleSelectView = useCallback(
    (view) => {
      setState((prev) => ({ ...prev, view, openCase: null }));
      if (VIEW_PATHS[view]) navigate(VIEW_PATHS[view]);
      window.scrollTo(0, 0);
    },
    [navigate]
  );

  // ---------------------------------------------------------------- simulation controls
  const handleChangeScenario = useCallback(
    (scenario) => {
      const titles = {
        normal: 'Normal night',
        dengue: 'Dengue surge',
        accident: 'Mass-casualty accident',
        stockout: 'Bank stock-out',
        duplicates: 'Inflated or duplicate requests',
        missing: 'Missing or late data',
      };
      setState((prev) => ({ ...prev, scenario }));
      act(() => api.scenario(scenario), ['', 'Scenario changed', `${titles[scenario] || scenario}. New requests will follow this pattern.`]);
    },
    [act]
  );

  const handleToggleLive = useCallback(() => {
    act(() => api.toggleLive());
  }, [act]);

  // ---------------------------------------------------------------- hospital ward
  const handleUpdateRequestForm = useCallback((field, value) => {
    setState((prev) => ({ ...prev, form: { ...prev.form, [field]: value } }));
  }, []);

  const handleParseRequestMessage = useCallback(async () => {
    const msg = stateRef.current.form.msg || '';
    const out = await act(() => api.parse(msg));
    if (!out) return;
    setState((prev) => ({ ...prev, form: { ...prev.form, ...out.fields } }));
    if (!out.fields.type) {
      addToast('', 'Blood type not found', 'Add the blood type, for example “O+”.');
      return;
    }
    addToast('ok', 'Message read', `Check the fields, then send. (${out.fallback ? 'rule parser' : 'Request Agent'}, confidence ${Math.round(out.confidence * 100)}%)`);
  }, [act, addToast]);

  const handleSubmitRequest = useCallback(async () => {
    const draft = stateRef.current.form;
    if (!draft.type || !(Number(draft.units) > 0)) {
      addToast('crit', 'Missing details', 'Choose a blood type and number of units.');
      return;
    }
    const units = Math.max(1, Math.min(12, Number(draft.units)));
    const out = await act(() =>
      api.submitRequest({ hosp: 'h1', type: draft.type, comp: draft.comp, units, urg: draft.urg, pat: draft.pat, msg: draft.msg || '', source: 'Ward form' })
    );
    if (!out) return;
    setState((prev) => ({ ...prev, form: { ...prev.form, msg: '' } }));
    addToast('ok', `Request sent · ${out.id}`, 'You can follow it live here.');
    navigate('/hospital/my-requests');
    window.scrollTo(0, 0);
  }, [act, addToast, navigate]);

  // ---------------------------------------------------------------- officer: cases
  const handleOpenCase = useCallback((id) => {
    setState((prev) => ({ ...prev, openCase: id }));
  }, []);

  const handleCloseCase = useCallback(() => {
    setState((prev) => ({ ...prev, openCase: null }));
  }, []);

  const handleChooseOption = useCallback(
    (id, optionIndex) => {
      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((r) => (r.id === id ? { ...r, choice: optionIndex } : r)),
      }));
      act(() => api.choose(id, optionIndex));
    },
    [act]
  );

  const handleRejectRequest = useCallback(
    (id, reasonText) => {
      setState((prev) => ({ ...prev, openCase: null }));
      act(() => api.reject(id, reasonText));
    },
    [act]
  );

  const handleApproveRequest = useCallback(
    (id) => {
      act(() => api.approve(id));
    },
    [act]
  );

  // ---------------------------------------------------------------- officer: transfers & donors
  const handleApproveMove = useCallback((moveId) => act(() => api.approveMove(moveId)), [act]);
  const handleDismissMove = useCallback((moveId) => act(() => api.dismissMove(moveId)), [act]);
  const handleApproveCampaign = useCallback((id) => act(() => api.approveCampaign(id)), [act]);
  const handleCancelCampaign = useCallback((id) => act(() => api.cancelCampaign(id)), [act]);
  const handlePrepareCampaign = useCallback(({ type, units }) => act(() => api.prepareCampaign(type, Number(units))), [act]);

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
