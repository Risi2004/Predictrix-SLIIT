// Thin client for the SERA backend (FastAPI). Vite proxies /api to http://localhost:8000.
const BASE = import.meta.env.VITE_API_BASE || '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data && data.detail ? (typeof data.detail === 'string' ? data.detail : 'Invalid input') : res.statusText;
    throw new Error(detail);
  }
  return data;
}

export const api = {
  state: (since) => call('GET', `/api/state?since=${since || 0}`),
  submitRequest: (payload) => call('POST', '/api/requests', payload),
  parse: (msg) => call('POST', '/api/parse', { msg }),
  approve: (id) => call('POST', `/api/cases/${id}/approve`),
  reject: (id, reason) => call('POST', `/api/cases/${id}/reject`, { reason }),
  choose: (id, index) => call('POST', `/api/cases/${id}/choose`, { index }),
  approveMove: (id) => call('POST', `/api/moves/${id}/approve`),
  dismissMove: (id) => call('POST', `/api/moves/${id}/dismiss`),
  prepareCampaign: (type, units) => call('POST', '/api/campaigns', { type, units }),
  approveCampaign: (id) => call('POST', `/api/campaigns/${id}/approve`),
  cancelCampaign: (id) => call('POST', `/api/campaigns/${id}/cancel`),
  scenario: (scenario) => call('POST', '/api/sim/scenario', { scenario }),
  toggleLive: () => call('POST', '/api/sim/live'),
};
