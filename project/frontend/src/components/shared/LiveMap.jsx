import { activeDeliveries, BANKS, bez, HOSP, openRequests, total, TYPES } from '../../data';

const ROADS = [
  'M10 70 Q 300 30 590 96',
  'M20 214 Q 300 250 590 168',
  'M150 10 Q 170 200 196 370',
  'M396 10 Q 430 200 420 370',
  'M560 20 Q 400 160 290 250',
  'M30 330 Q 250 300 590 340',
];

export default function LiveMap({ requests, deliveries, stock }) {
  const active = activeDeliveries(deliveries);
  const crit = new Set(openRequests(requests).filter((request) => request.urg === 'Critical').map((request) => request.hosp));

  return (
    <svg
      viewBox="0 0 600 370"
      role="img"
      aria-label={`Demo map of 8 blood banks, 6 hospitals and ${active.length} deliveries on the road`}
    >
      <defs>
        <radialGradient id="mg" cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#ECECEA" />
        </radialGradient>
        <linearGradient id="sv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A606B" />
          <stop offset="1" stopColor="#111317" />
        </linearGradient>
      </defs>

      <rect width="600" height="370" fill="url(#mg)" />

      <g stroke="#E3E4E7" strokeWidth="9" fill="none" strokeLinecap="round">
        {ROADS.map((path, index) => <path key={`road-bg-${index}`} d={path} />)}
      </g>
      <g stroke="#CDD0D6" strokeWidth="1" fill="none">
        {ROADS.map((path, index) => <path key={`road-${index}`} d={path} />)}
      </g>

      {active.map((delivery) => {
        const route = bez(delivery);
        const point = route.at(1 - delivery.left / delivery.eta);
        return (
          <g key={`del-${delivery.id}`}>
            <path
              className="route"
              d={`M${route.a.x} ${route.a.y} Q ${route.c.x} ${route.c.y} ${route.b.x} ${route.b.y}`}
              fill="none"
              stroke={delivery.toKind === 'h' ? '#111317' : '#8A909B'}
              strokeWidth="2.4"
            />
            <circle
              data-rider={delivery.id}
              cx={point.x.toFixed(1)}
              cy={point.y.toFixed(1)}
              r="5.5"
              fill="#FFFFFF"
              stroke="#111317"
              strokeWidth="2.5"
            />
          </g>
        );
      })}

      {HOSP.map((hospital) => {
        const isCritical = crit.has(hospital.id);
        const alignEnd = hospital.x > 480;
        return (
          <g key={`hosp-${hospital.id}`}>
            {isCritical && (
              <rect
                className="ping"
                x={hospital.x - 7}
                y={hospital.y - 7}
                width="14"
                height="14"
                rx="3"
                fill="#A3203A"
              />
            )}
            <rect
              x={hospital.x - 7}
              y={hospital.y - 7}
              width="14"
              height="14"
              rx="3"
              fill={isCritical ? '#A3203A' : '#FFFFFF'}
              stroke="#111317"
              strokeWidth="1.5"
            />
            <text
              x={alignEnd ? hospital.x - 11 : hospital.x + 11}
              textAnchor={alignEnd ? 'end' : 'start'}
              y={hospital.y + 4}
              fontFamily="IBM Plex Mono,monospace"
              fontSize="10"
              fill="#3A3E46"
            >
              {hospital.short.toUpperCase()}
            </text>
          </g>
        );
      })}

      {BANKS.map((bloodBank) => {
        const low = TYPES.reduce((sum, type) => sum + total(stock, bloodBank.id, 'RBC', type), 0) < 70;
        const alignEnd = bloodBank.x > 480;
        return (
          <g key={`bank-${bloodBank.id}`}>
            <circle
              cx={bloodBank.x}
              cy={bloodBank.y}
              r={8}
              fill="url(#sv)"
              stroke={low ? '#A3203A' : '#FFFFFF'}
              strokeWidth={low ? 2.5 : 2}
            />
            <text
              x={alignEnd ? bloodBank.x - 12 : bloodBank.x + 12}
              textAnchor={alignEnd ? 'end' : 'start'}
              y={bloodBank.y - 8}
              fontFamily="IBM Plex Mono,monospace"
              fontSize="10"
              fill={low ? 'var(--crit)' : '#9A95A8'}
            >
              {bloodBank.name.toUpperCase()}
              {low ? ' · LOW' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
