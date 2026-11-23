/* =====================================================================
   CIRCULA — Data & Simulation Engine Core
   Faithful port of data models, logistics, and multi-agent simulation
   from curcula.html (Predictrix-SLIIT)
   ===================================================================== */

export function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const R = rng(20261120);

export const TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

/**
 * Red Blood Cell (RBC) ABO/RhD compatibility table.
 * Governed by cellular compatibility: recipient plasma antibodies must not react with donor RBC antigens.
 * O- is universal RBC donor; AB+ is universal RBC recipient.
 */
export const COMPAT_RBC = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': TYPES.slice(),
};

/**
 * Platelet (PLT) ABO/RhD compatibility table.
 * Clinical standard (AABB / BSH guidelines): ABO-identical transfusion is first-line standard.
 * RhD-negative recipients should receive RhD-negative platelets to prevent anti-D alloimmunization.
 * RhD-positive recipients can safely receive RhD-positive or RhD-negative units.
 * 
 * NOTE ON DOMAIN VALIDATION: Cross-ABO platelet transfusions (e.g. group AB universal plasma platelets,
 * or volume-reduced / low-titer screened units) require institutional laboratory titer validation
 * and are intentionally not assumed without clinical protocol approval.
 */
export const COMPAT_PLT = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-'],
  'A+': ['A+', 'A-'],
  'B-': ['B-'],
  'B+': ['B+', 'B-'],
  'AB-': ['AB-'],
  'AB+': ['AB+', 'AB-'],
};

/**
 * SCOPE NOTE ON PLASMA (FFP / Cryoprecipitate):
 * Fresh Frozen Plasma (FFP) operates on reverse compatibility (AB is universal donor, O is universal recipient).
 * FFP is explicitly outside the current implementation scope per Phase 4 specifications.
 */

/**
 * Component-specific compatibility resolver.
 */
export function getCompatibleTypes(comp, recipientType) {
  if (comp === 'PLT') {
    return COMPAT_PLT[recipientType] || [recipientType];
  }
  return COMPAT_RBC[recipientType] || [recipientType];
}

// Backward-compatible alias for existing code referencing RBC matrix
export const COMPAT = COMPAT_RBC;

/**
 * ABO / RhD blood group frequency distribution for the simulated population.
 * 
 * SOURCE & ASSUMPTION NOTICE:
 * Proposal.docx mentions "published ABO/RhD frequencies for South Asia" (§06), but does
 * not cite a specific study or reference table in the document bibliography (§[1]-[9]).
 * 
 * While these values reflect general South Asian / Sri Lankan demographic distributions
 * (prominence of group B and O, low RhD-negative prevalence ~5-7% total):
 *   O+ (34%), B+ (26%), A+ (22%), AB+ (7%), B- (4%), O- (3%), A- (2%), AB- (2%) [Sum: 100%]
 * they are NOT supported by an exact published citation in the repository or proposal.
 * 
 * CLASSIFICATION: Simulation assumptions. They must not be cited as verified published statistics
 * until formally calibrated against a specific public dataset (e.g., National Blood Transfusion
 * Service Sri Lanka annual statistical report).
 */
export const W = {
  'O+': 0.34,
  'A+': 0.22,
  'B+': 0.26,
  'AB+': 0.07,
  'O-': 0.03,
  'A-': 0.02,
  'B-': 0.04,
  'AB-': 0.02,
};

export const COMP = {
  RBC: 'Red cells',
  PLT: 'Platelets',
};

export const BANKS = [
  { id: 'b1', name: 'Central', x: 300, y: 190, size: 1.5 },
  { id: 'b2', name: 'Northgate', x: 255, y: 58, size: 1 },
  { id: 'b3', name: 'Lakeside', x: 88, y: 108, size: 0.9 },
  { id: 'b4', name: 'Harbour', x: 525, y: 305, size: 1 },
  { id: 'b5', name: 'Eastfield', x: 545, y: 140, size: 0.9 },
  { id: 'b6', name: 'Westhill', x: 76, y: 275, size: 0.8 },
  { id: 'b7', name: 'Riverside', x: 440, y: 76, size: 1 },
  { id: 'b8', name: 'Southpoint', x: 300, y: 342, size: 0.42 },
];

export const HOSP = [
  { id: 'h1', name: "Northside Children's", short: 'Northside', x: 196, y: 122 },
  { id: 'h2', name: 'Harbour Maternity', short: 'Harbour Mat.', x: 455, y: 334 },
  { id: 'h3', name: 'Eastgate Trauma', short: 'Eastgate', x: 572, y: 222 },
  { id: 'h4', name: 'City General', short: 'City General', x: 368, y: 238 },
  { id: 'h5', name: 'Lakeview Cancer Centre', short: 'Lakeview', x: 132, y: 196 },
  { id: 'h6', name: "St. Mary's", short: "St. Mary's", x: 196, y: 318 },
];

export const REGISTRY = {
  'O+': 1240,
  'A+': 812,
  'B+': 930,
  'AB+': 214,
  'O-': 96,
  'A-': 61,
  'B-': 118,
  'AB-': 22,
};

export const bank = (id) => BANKS.find((b) => b.id === id) || { id, name: id, x: 0, y: 0 };
export const hosp = (id) => HOSP.find((h) => h.id === id) || { id, name: id, short: id, x: 0, y: 0 };
export const travel = (a, b) => Math.max(4, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / 22) + 1);

export const fmt = (m) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

export const fmtH = (h) => (h < 48 ? Math.max(1, Math.round(h)) + ' h' : Math.round(h / 24) + ' days');

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const ICON = {
  command: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  requests: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  inventory: '<path d="M12 3c3.5 5 6 8 6 11a6 6 0 01-12 0c0-3 2.5-6 6-11z"/>',
  deliveries: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  donors: '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12M8 7h8M8 17h8"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  log: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  newreq: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  mine: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>',
};

export const NAVS = {
  officer: [
    ['command', 'Command centre'],
    ['requests', 'Requests'],
    ['inventory', 'Inventory'],
    ['deliveries', 'Deliveries'],
    ['donors', 'Donors'],
    ['reports', 'Reports'],
    ['log', 'Activity log'],
  ],
  hospital: [
    ['newreq', 'New request'],
    ['mine', 'My requests'],
  ],
};

export const VIEW_PATHS = {
  command: '/command-centre',
  requests: '/requests',
  inventory: '/inventory',
  deliveries: '/deliveries',
  donors: '/donors',
  reports: '/reports',
  log: '/activity-log',
  newreq: '/hospital/new-request',
  mine: '/hospital/my-requests',
};

export const TITLES = {
  command: 'Command centre',
  requests: 'Requests',
  inventory: 'Inventory',
  deliveries: 'Deliveries',
  donors: 'Donors',
  reports: 'Reports',
  log: 'Activity log',
  newreq: 'New request',
  mine: 'My requests',
};

export const STATUS = {
  received: 'Received',
  matching: 'Matching',
  sourcing: 'Sourcing',
  routing: 'Routing',
  checking: 'Checking',
  awaiting: 'Awaiting approval',
  enroute: 'En route',
  delivered: 'Delivered',
  rejected: 'Rejected',
  donors: 'Calling donors',
};

export const BUSY = ['received', 'matching', 'sourcing', 'routing', 'checking', 'donors'];

export const lots = (stock, b, c, t) => (stock[b] && stock[b][c] && stock[b][c][t]) || [];
export const total = (stock, b, c, t) => lots(stock, b, c, t).reduce((a, l) => a + l.u, 0);
export const netTotal = (stock, c, t) => BANKS.reduce((a, b) => a + total(stock, b.id, c, t), 0);

export function allLots(stock) {
  const o = [];
  BANKS.forEach((b) =>
    ['RBC', 'PLT'].forEach((c) =>
      TYPES.forEach((t) =>
        lots(stock, b.id, c, t).forEach((l) => {
          if (l.u > 0) o.push({ b: b.id, c, t, l });
        })
      )
    )
  );
  return o;
}

export const openRequests = (requests) => requests.filter((r) => !['delivered', 'rejected'].includes(r.status));
export const awaitingRequests = (requests) => requests.filter((r) => r.status === 'awaiting');
export const activeDeliveries = (deliveries) => deliveries.filter((d) => d.left > 0);

export const netState = (requests) => {
  const c = openRequests(requests).filter((r) => r.urg === 'Critical').length;
  const a = awaitingRequests(requests).length;
  return c > 2 || a > 4 ? 'Surge' : c || a > 1 ? 'Elevated' : 'Stable';
};

export const bpm = (requests) =>
  Math.min(132, 58 + openRequests(requests).filter((r) => r.urg === 'Critical').length * 14 + awaitingRequests(requests).length * 4);

export function parseMsg(m) {
  const f = {};
  const s = m.toLowerCase();
  const t = m.match(/\b(AB|A|B|O)\s*(\+|-|−|pos(?:itive)?|neg(?:ative)?)/i);
  if (t) {
    const sign = /^[+]|pos/i.test(t[2]) ? '+' : '-';
    f.type = t[1].toUpperCase() + sign;
  }
  const u = s.match(/(\d+)\s*(units?|bags?|pints?)/) || s.match(/need\s*(\d+)/);
  if (u) f.units = Math.min(12, +u[1]);
  if (/platelet|plt/.test(s)) f.comp = 'PLT';
  else if (/red cell|rbc|blood|packed/.test(s)) f.comp = 'RBC';
  if (/critical|now|immediately|stat|dropping|bleeding|emergency/.test(s)) f.urg = 'Critical';
  else if (/urgent|asap|within the hour|soon/.test(s)) f.urg = 'Urgent';
  else if (/routine|tomorrow|planned|scheduled/.test(s)) f.urg = 'Routine';
  if (/child|year|baby|infant|paediatric|pediatric|kid/.test(s)) f.pat = 'Child';
  else if (/mother|pregnan|deliver|maternity|postpartum/.test(s)) f.pat = 'Maternity';
  else if (/adult|man|woman/.test(s)) f.pat = 'Adult';
  return f;
}

export function analyse(req, stock) {
  const h = hosp(req.hosp);
  const opts = [];
  const compatibleTypes = getCompatibleTypes(req.comp, req.type);
  BANKS.forEach((b) =>
    compatibleTypes.forEach((dt) => {
      const eta = travel(b, h);
      const ok = lots(stock, b.id, req.comp, dt).filter((l) => l.u > 0 && l.exp * 60 > eta + 90);
      const avail = ok.reduce((a, l) => a + l.u, 0);
      if (!avail) return;
      const soon = Math.min(...ok.map((l) => l.exp));
      let score = (req.urg === 'Critical' ? 2 : 1) * eta + (dt === req.type ? 0 : 10) - (soon < 24 ? 20 : soon < 72 ? 10 : 0);
      if (req.comp === 'RBC' && dt === 'O-' && req.type !== 'O-') score += 18;
      opts.push({ bank: b.id, dt, avail, eta, soon, score });
    })
  );
  const offering = new Set(opts.map((o) => o.bank)).size;
  const full = opts.filter((o) => o.avail >= req.units).sort((a, b) => a.score - b.score);
  const seen = new Set();
  const top = [];
  for (const o of full) {
    if (seen.has(o.bank)) continue;
    seen.add(o.bank);
    top.push(o);
    if (top.length === 3) break;
  }
  return { options: top, offering };
}

export function reason(o, req) {
  const p = [o.dt === req.type ? 'Exact match' : 'Compatible ' + o.dt];
  if (o.soon < 72) p.push('units expire in ' + fmtH(o.soon) + ', so they get used');
  p.push(o.eta + ' min away');
  return p.join(' · ');
}

export function audit(req, allRequests) {
  const c = [{ k: 'ok', t: 'Blood types checked against the compatibility rules' }];
  const dup = allRequests.find(
    (r) =>
      r !== req &&
      r.hosp === req.hosp &&
      r.type === req.type &&
      r.comp === req.comp &&
      !['delivered', 'rejected'].includes(r.status) &&
      Math.abs(r.created - req.created) < 90
  );
  if (dup) {
    c.push({ k: 'warn', t: 'Possible duplicate of ' + dup.id + ' from the same ward' });
    req.dupOf = dup.id;
  }
  if (req.units > 6 && req.urg !== 'Critical') c.push({ k: 'warn', t: 'Larger than this ward usually asks for' });
  if (req.pat === 'Child' || req.pat === 'Maternity' || req.urg === 'Critical') {
    c.push({
      k: 'info',
      t: 'Priority raised: ' + (req.pat === 'Child' ? 'child patient' : req.pat === 'Maternity' ? 'maternity case' : 'critical case'),
    });
  }
  if (!req.plan.options.length) c.push({ k: 'warn', t: 'No bank can cover this from stock' });
  return c;
}

/**
 * Proposes inter-bank stock rebalancing moves for near-expiry units.
 * 
 * DOMAIN SCOPE & LIMITATION:
 * Currently implements Red Blood Cell (RBC) rebalancing only.
 * Platelet (PLT) inter-bank rebalancing is omitted because:
 * 1. Platelets have an ultra-short shelf life (5-7 days) and require continuous
 *    agitation (20-24°C) in specialized temperature-controlled agitators during transport.
 * 2. In the approved Phase 1 proposal, near-expiry platelets are prioritized for direct
 *    urgent hospital ward dispatch rather than inter-bank redistribution.
 * 3. Specific operational parameters (e.g. minimum hours before expiry vs. transit degradation
 *    risk, destination demand quotas) are not defined in the Phase 1 specification.
 * Rather than inventing unverified clinical thresholds, platelet rebalancing is documented
 * as a limitation requiring domain validation before Phase 5.
 */
export function computeMoves(stock, dismissed) {
  const out = [];
  BANKS.forEach((b) =>
    TYPES.forEach((t) =>
      lots(stock, b.id, 'RBC', t).forEach((l) => {
        if (l.u < 2 || l.exp > 96 || (dismissed && dismissed.has(l.id))) return;
        let best = null;
        BANKS.forEach((c) => {
          if (c.id === b.id) return;
          const tot = total(stock, c.id, 'RBC', t);
          if (tot < 14 && (!best || tot < best.tot)) best = { c, tot };
        });
        if (best) out.push({ id: 'M' + l.id, lot: l, from: b.id, to: best.c.id, type: t, units: l.u, exp: l.exp, tot: best.tot });
      })
    )
  );
  return out.sort((a, b) => a.exp - b.exp).slice(0, 5);
}

export function bez(d) {
  const a = bank(d.from);
  const b = d.toKind === 'h' ? hosp(d.to) : bank(d.to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const c = { x: mx - (dy / L) * L * 0.18, y: my + (dx / L) * L * 0.18 };
  return {
    a,
    b,
    c,
    at(t) {
      const u = 1 - t;
      return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    },
  };
}

let globalLotSeq = 0;

export function createInitialState() {
  let lotSeq = 0;
  const stock = {};

  BANKS.forEach((b) => {
    stock[b.id] = { RBC: {}, PLT: {} };
    TYPES.forEach((t) => {
      ['RBC', 'PLT'].forEach((c) => {
        const base = (c === 'RBC' ? 150 : 30) * b.size;
        let n = Math.round(base * W[t] * (0.55 + R() * 0.9));
        const lotsArr = [];
        while (n > 0) {
          const u = Math.min(n, 2 + Math.floor(R() * 7));
          n -= u;
          lotsArr.push({ id: ++lotSeq, u, exp: c === 'RBC' ? 20 + R() * 880 : 8 + R() * 110 });
        }
        stock[b.id][c][t] = lotsArr;
      });
    });
  });

  stock.b7.PLT['O+'].push({ id: ++lotSeq, u: 3, exp: 19 });
  stock.b2.PLT['O+'].forEach((l) => (l.exp = Math.max(l.exp, 90)));
  globalLotSeq = lotSeq;

  const requests = [];
  const deliveries = [];
  const campaigns = [];
  const logEntries = [];
  const dismissed = new Set();
  let seq = 189;
  let dseq = 40;
  let cseq = 11;
  const clock = 130;

  const stats = {
    received: 0,
    approvals: [],
    delivered: 0,
    deliveryMins: [],
    nearSaved: 0,
    expired: 0,
    incompat: 0,
    donorCalls: 0,
    unneeded: 0,
    dupes: 0,
    rejected: 0,
  };

  const addLog = (req, actor, text, time) => {
    const tVal = time !== undefined ? time : clock;
    logEntries.unshift({ t: tVal, actor, text, ref: req ? req.id : null });
    if (req) req.timeline.push({ t: tVal, actor, text });
  };

  const mkRequest = (f, minsAgo, src) => {
    const id = 'R-' + String(++seq).padStart(4, '0');
    const r = {
      id,
      hosp: f.hosp || 'h1',
      type: f.type,
      comp: f.comp,
      units: +f.units,
      urg: f.urg,
      pat: f.pat,
      msg: f.msg || '',
      source: src || 'Ward message',
      created: clock - minsAgo,
      status: 'received',
      timeline: [],
      plan: { options: [], offering: 0 },
      checks: [],
      choice: 0,
    };
    requests.unshift(r);
    stats.received++;

    // Process pipeline
    r.status = 'received';
    addLog(r, 'Orchestrator', 'Opened case ' + r.id + ' for ' + hosp(r.hosp).short + '.', r.created);
    r.status = 'matching';
    addLog(r, 'Request Agent', 'Read the request: ' + r.units + ' × ' + r.type + ' ' + COMP[r.comp].toLowerCase() + ', ' + r.urg.toLowerCase() + '.', r.created);
    r.plan = analyse(r, stock);
    r.status = 'sourcing';
    addLog(r, 'Bank Agents', r.plan.offering + ' of 8 banks can offer compatible units.', r.created);
    const o = r.plan.options[0];
    r.status = 'routing';
    addLog(r, 'Logistics Agent', o ? 'Best route: ' + bank(o.bank).name + ' → ' + hosp(r.hosp).short + ', ' + o.eta + ' min.' : 'No bank can cover the full request.', r.created);
    r.checks = audit(r, requests);
    r.status = 'checking';
    const wCount = r.checks.filter((c) => c.k === 'warn').length;
    addLog(r, 'Auditor Agent', wCount ? wCount + ' issue' + (wCount > 1 ? 's' : '') + ' flagged for the officer.' : 'All checks passed.', r.created);
    r.status = 'awaiting';
    r.choice = 0;
    if (r.plan.options.length) {
      addLog(r, 'Orchestrator', 'Plan sent to the officer for approval.', r.created);
    } else {
      const n = Math.min(REGISTRY[r.type], r.units * 4);
      r.donorPlan = { contact: n };
      addLog(r, 'Donor Agent', 'Proposes calling ' + n + ' eligible ' + r.type + ' donors nearby.', r.created);
    }
    r.timeline.forEach((t) => (t.t = r.created + 1));
    return r;
  };

  // Seed baseline requests (identical to curcula.html)
  const r0 = mkRequest({ hosp: 'h4', type: 'B+', comp: 'RBC', units: 4, urg: 'Routine', pat: 'Adult', msg: 'Planned surgery tomorrow 8am. 4 units B+.' }, 70, 'Ward message');
  r0.choice = 0;
  const o0 = r0.plan.options[0];
  const d0 = {
    id: 'D-' + String(++dseq).padStart(3, '0'),
    req: r0.id,
    from: o0 ? o0.bank : 'b1',
    toKind: 'h',
    to: r0.hosp,
    units: r0.units,
    type: o0 ? o0.dt : 'B+',
    comp: r0.comp,
    eta: o0 ? o0.eta : 12,
    left: 0,
    rider: 'Rider 2',
    start: clock - 70,
  };
  deliveries.unshift(d0);
  r0.delivery = d0.id;
  r0.status = 'delivered';
  stats.delivered++;
  stats.deliveryMins.push(d0.eta);
  addLog(r0, 'Officer', 'Approved ' + r0.units + ' × ' + d0.type + ' from ' + bank(d0.from).name + '.', clock - 68);
  addLog(r0, 'Logistics Agent', 'Delivered to City General.', clock - 55);

  const r1 = mkRequest({ hosp: 'h3', type: 'A+', comp: 'RBC', units: 2, urg: 'Urgent', pat: 'Adult', msg: 'Road accident patient stable, need 2 A+ within the hour.' }, 14, 'Ward message');
  r1.choice = 0;
  const o1 = r1.plan.options[0];
  const d1 = {
    id: 'D-' + String(++dseq).padStart(3, '0'),
    req: r1.id,
    from: o1 ? o1.bank : 'b1',
    toKind: 'h',
    to: r1.hosp,
    units: r1.units,
    type: o1 ? o1.dt : 'A+',
    comp: r1.comp,
    eta: o1 ? o1.eta : 15,
    left: Math.ceil((o1 ? o1.eta : 15) * 0.6),
    rider: 'Rider 4',
    start: clock - 12,
  };
  deliveries.unshift(d1);
  r1.delivery = d1.id;
  r1.status = 'enroute';
  addLog(r1, 'Officer', 'Approved ' + r1.units + ' × ' + d1.type + ' from ' + bank(d1.from).name + '.', clock - 12);
  addLog(r1, 'Logistics Agent', d1.rider + ' dispatched. Arrives in ' + d1.eta + ' min.', clock - 12);

  mkRequest({ hosp: 'h2', type: 'O-', comp: 'RBC', units: 3, urg: 'Urgent', pat: 'Maternity', msg: 'Postpartum bleeding, mother stable for now. 3 units O− please.' }, 4, 'Ward message');
  mkRequest({ hosp: 'h1', type: 'O+', comp: 'PLT', units: 2, urg: 'Critical', pat: 'Child', msg: 'Child, 7 years, severe dengue, platelets dropping fast. Need 2 units O+.' }, 0, 'Ward message');

  logEntries.forEach((l) => {
    if (l.t > clock) l.t = clock;
  });

  const moves = computeMoves(stock, dismissed);

  return {
    role: null,
    view: 'command',
    clock,
    live: true,
    scenario: 'normal',
    stock,
    requests,
    deliveries,
    campaigns,
    moves,
    dismissed,
    log: logEntries,
    openCase: null,
    reqFilter: 'all',
    invComp: 'RBC',
    logActor: 'all',
    rejectReason: 'Not needed any more',
    seq,
    dseq,
    cseq,
    form: { type: 'O+', comp: 'RBC', units: 2, urg: 'Urgent', pat: 'Child', msg: '' },
    camp: { type: 'O-', units: 4 },
    stats,
    lotSeq: globalLotSeq,
  };
}

export { globalLotSeq };
