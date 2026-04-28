// 서울 중심
const SEOUL_CENTER = [126.9780, 37.5665];   // [lng, lat]
const SEOUL_LEAFLET = [37.5665, 126.9780];  // [lat, lng]
const SEOUL_BBOX = { minLng: 126.75, maxLng: 127.20, minLat: 37.40, maxLat: 37.72 };

// 타일
const DARK_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const DARK_LABEL = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

function seeded(seed){ return function(){ seed = (seed*9301+49297)%233280; return seed/233280; }; }

// Leaflet 기본 지도 생성
function initMap(id, opts={}) {
  const map = L.map(id, {
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.25,
    ...opts,
  }).setView(opts.center || SEOUL_LEAFLET, opts.zoom || 11);
  L.tileLayer(DARK_TILE, { subdomains: 'abcd' }).addTo(map);
  return map;
}

// 실데이터 로더
async function loadDeliveries(){
  const r = await fetch('data.json');
  return r.json();
}

// lng,lat → lat,lng 변환
const ll = p => [p[1], p[0]];

// 두 점 사이 Bezier 곡선 점 배열 (지도 위 아치)
function bezierArc(a, b, height=0.25, steps=30) {
  // a,b: [lng,lat], height: 1=직선 거리 비례
  const mx = (a[0]+b[0])/2, my = (a[1]+b[1])/2;
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const dist = Math.sqrt(dx*dx + dy*dy);
  // 수직 방향 오프셋
  const nx = -dy/dist, ny = dx/dist;
  const cx = mx + nx*dist*height;
  const cy = my + ny*dist*height;
  const pts = [];
  for (let i=0;i<=steps;i++){
    const t = i/steps, mt = 1-t;
    const x = mt*mt*a[0] + 2*mt*t*cx + t*t*b[0];
    const y = mt*mt*a[1] + 2*mt*t*cy + t*t*b[1];
    pts.push([y, x]);
  }
  return pts;
}
