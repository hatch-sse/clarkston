import { CLARKSTON_ROAD_ROWS } from './data/clarkstonRoads.js?v=20260529h';
import { Input } from './core/Input.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const minimap = $('#minimap');
const mini = minimap?.getContext('2d');
const statusEl = $('#status');
const speedEl = $('#speed');
const modeEl = $('#mode');
const areaEl = $('#area');
const timerEl = $('#timer');
const bestEl = $('#best');
const missionEl = $('#mission');
const splashEl = $('#splash');
const loadingTextEl = $('#loading-text');
const loadingBarEl = $('#loading-bar');
const input = new Input();

const BOUNDS = { south: 55.7785, west: -4.3025, north: 55.8008, east: -4.2460 };
const METRES = 111320;
const MID_LAT = (BOUNDS.south + BOUNDS.north) / 2;
const SCALE = 1.34;
const PAD = 220;
const world = {
  width: Math.round((BOUNDS.east - BOUNDS.west) * METRES * Math.cos(MID_LAT * Math.PI / 180) * SCALE + PAD * 2),
  height: Math.round((BOUNDS.north - BOUNDS.south) * METRES * SCALE + PAD * 2)
};

const camera = { x: 0, y: 0, zoom: 1.16, targetZoom: 1.16 };
const map = { roads: [], buildings: [], rails: [], greens: [], water: [], pois: [], labels: [], junctions: [], trees: [] };
const player = { x: 0, y: 0, angle: -Math.PI / 2, radius: 5.5, walkTime: 0, moving: false };
const trains = [];
let vehicles = [];
let activeVehicle = null;
let mode = 'driving';
let lastTime = performance.now();
let checkpointIndex = 0;
let raceStarted = false;
let raceStart = 0;
let bestTime = Number(localStorage.getItem('innesDriverBest') || 0) || null;
let handbrakePulse = 0;
let audio = null;

const carTypes = [
  { name: '4x4 Jeep', color: '#3f8a43', roof: '#203828', width: 12, length: 21, maxSpeed: 455, accel: 390, brake: 520, turn: 2.45, drag: .962, engine: 92 },
  { name: 'Mini Hatch', color: '#2d72bb', roof: '#dbeafe', width: 10, length: 18, maxSpeed: 500, accel: 455, brake: 560, turn: 3.15, drag: .958, engine: 132 },
  { name: 'Estate Car', color: '#8f432f', roof: '#1f2937', width: 11, length: 23, maxSpeed: 470, accel: 355, brake: 510, turn: 2.55, drag: .966, engine: 108 },
  { name: 'Taxi', color: '#d0a02d', roof: '#111827', width: 11, length: 22, maxSpeed: 440, accel: 345, brake: 500, turn: 2.42, drag: .968, engine: 116 },
  { name: 'Sports Coupe', color: '#b82732', roof: '#111827', width: 10, length: 20, maxSpeed: 610, accel: 560, brake: 610, turn: 3.0, drag: .955, engine: 168 }
];

const checkpoints = [
  { x: 2273, y: 1787, label: 'Clarkston Toll' },
  { x: 2545, y: 2092, label: 'Busby Road' },
  { x: 2522, y: 2593, label: 'Greenwood Road' },
  { x: 3059, y: 2896, label: 'Main Street' },
  { x: 2028, y: 1999, label: 'Mearns Road' }
];

function setLoading(progress, text) {
  if (loadingBarEl) loadingBarEl.style.width = `${Math.max(4, Math.min(100, progress))}%`;
  if (loadingTextEl) loadingTextEl.textContent = text;
}
function hideSplash() { splashEl?.classList.add('hidden'); setTimeout(() => splashEl?.remove(), 420); }
function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
function rand(seed) { const v = Math.sin(seed * 917.73) * 10000; return v - Math.floor(v); }
function project(lat, lon) {
  return {
    x: Math.round(PAD + (lon - BOUNDS.west) * METRES * Math.cos(MID_LAT * Math.PI / 180) * SCALE),
    y: Math.round(PAD + (BOUNDS.north - lat) * METRES * SCALE)
  };
}
function boundsOf(points) {
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}
function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: Math.round(x / points.length), y: Math.round(y / points.length) };
}
function area(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return Math.abs(total) / 2;
}
function roadWidth(highway) {
  if (highway === 'primary') return 50;
  if (highway === 'secondary') return 44;
  if (highway === 'tertiary') return 38;
  if (highway === 'service') return 22;
  if (['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway)) return 5;
  return 30;
}
function addLabel(label, x, y, kind = 'road') {
  if (!label || map.labels.some(item => item.label === label && Math.hypot(item.x - x, item.y - y) < 120)) return;
  map.labels.push({ label, x, y, kind });
}
function parsePointList(text = '') {
  return text.split(' ').map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
}
function parseRoads() {
  let id = 0;
  map.roads = CLARKSTON_ROAD_ROWS.split(';').map(row => {
    const [name = '', highway = '', pointText = ''] = row.split('|');
    const points = parsePointList(pointText);
    if (!highway || points.length < 2) return null;
    const foot = ['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway);
    const main = ['primary', 'secondary', 'tertiary', 'trunk'].includes(highway);
    const road = { id: id++, name, highway, points, foot, main, width: roadWidth(highway), bounds: boundsOf(points) };
    if (name && main) addLabel(name, points[Math.floor(points.length / 2)].x, points[Math.floor(points.length / 2)].y);
    return road;
  }).filter(Boolean);
}
function buildJunctions() {
  const endpoints = [];
  for (const road of map.roads.filter(r => !r.foot)) {
    endpoints.push({ ...road.points[0], width: road.width, name: road.name });
    endpoints.push({ ...road.points[road.points.length - 1], width: road.width, name: road.name });
  }
  const clusters = [];
  for (const p of endpoints) {
    let c = clusters.find(item => Math.hypot(item.x - p.x, item.y - p.y) < 46);
    if (!c) { c = { x: p.x, y: p.y, count: 0, width: 0, roundabout: false }; clusters.push(c); }
    c.x = (c.x * c.count + p.x) / (c.count + 1);
    c.y = (c.y * c.count + p.y) / (c.count + 1);
    c.count += 1;
    c.width = Math.max(c.width, p.width);
    c.roundabout = c.roundabout || /roundabout/i.test(p.name || '');
  }
  map.junctions = clusters
    .filter(c => c.count >= 3)
    .map(c => ({ ...c, radius: Math.min(46, Math.max(20, c.width * .5 + c.count * 1.5)) }));
}
function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}
function nearestRoad(x, y, roads = map.roads.filter(r => !r.foot)) {
  let best = { road: null, distance: Infinity, segment: 0 };
  for (const road of roads) for (let i = 0; i < road.points.length - 1; i++) {
    const distance = distanceToSegment(x, y, road.points[i], road.points[i + 1]);
    if (distance < best.distance) best = { road, distance, segment: i };
  }
  return best;
}
function isOnRoad(x, y, padding = 16) { const n = nearestRoad(x, y); return Boolean(n.road && n.distance <= n.road.width / 2 + padding); }
function nearJunction(x, y, padding = 0) { return map.junctions.some(j => Math.hypot(x - j.x, y - j.y) < j.radius + padding); }
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i++) {
    const a = polygon[i], b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

async function loadOsmFeatures() {
  const cacheKey = 'innesDriverOsmFeatures-v5';
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}
  const cols = 8, rows = 7, all = new Map(), jobs = [];
  let done = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) jobs.push({ x, y });
  const workers = Array.from({ length: 5 }, async () => {
    while (jobs.length) {
      const job = jobs.shift();
      const west = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * job.x) / cols;
      const east = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * (job.x + 1)) / cols;
      const south = BOUNDS.south + ((BOUNDS.north - BOUNDS.south) * job.y) / rows;
      const north = BOUNDS.south + ((BOUNDS.north - BOUNDS.south) * (job.y + 1)) / rows;
      try {
        const tile = await fetchOsmTile(west, south, east, north);
        for (const el of tile) all.set(`${el.type}/${el.id}`, el);
      } catch (error) {
        console.warn('OSM tile skipped', error);
      }
      done += 1;
      setLoading(20 + Math.round((done / (cols * rows)) * 45), `Loading detailed Clarkston map ${done}/${cols * rows}...`);
    }
  });
  await Promise.all(workers);
  const features = compactOsm([...all.values()]);
  try { localStorage.setItem(cacheKey, JSON.stringify(features)); } catch {}
  return features;
}
async function fetchOsmTile(west, south, east, north) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${west},${south},${east},${north}`, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`OSM ${res.status}`);
  const xml = await res.text();
  if (xml.includes('too many nodes')) throw new Error('OSM tile too large');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  for (const n of doc.querySelectorAll('node')) out.push({ type: 'node', id: Number(n.getAttribute('id')), lat: Number(n.getAttribute('lat')), lon: Number(n.getAttribute('lon')), tags: xmlTags(n) });
  for (const w of doc.querySelectorAll('way')) out.push({ type: 'way', id: Number(w.getAttribute('id')), nodes: [...w.querySelectorAll('nd')].map(nd => Number(nd.getAttribute('ref'))), tags: xmlTags(w) });
  return out;
}
function xmlTags(el) { const tags = {}; for (const t of el.querySelectorAll('tag')) tags[t.getAttribute('k')] = t.getAttribute('v'); return tags; }
function compactOsm(elements) {
  const nodes = new Map(), features = { buildings: [], rails: [], greens: [], water: [], pois: [] }, seenPoi = new Set();
  for (const el of elements) if (el.type === 'node') nodes.set(el.id, el);
  const pointsFor = way => (way.nodes || []).map(id => nodes.get(id)).filter(Boolean).map(n => project(n.lat, n.lon));
  const closed = way => way.nodes?.length > 3 && way.nodes[0] === way.nodes[way.nodes.length - 1];
  const addPoi = (name, kind, x, y) => {
    if (!name) return;
    const key = `${name}|${x >> 4}|${y >> 4}`;
    if (seenPoi.has(key)) return;
    seenPoi.add(key); features.pois.push({ name, kind, x, y });
  };
  for (const el of elements) {
    const t = el.tags || {};
    if (el.type === 'node' && (t.shop || t.amenity || t.office || t.tourism || t.healthcare || t.leisure)) {
      const p = project(el.lat, el.lon); addPoi(t.name || t.brand || t.operator || '', t.shop || t.amenity || t.office || t.tourism || t.healthcare || t.leisure, p.x, p.y);
    }
    if (el.type !== 'way') continue;
    const pts = pointsFor(el);
    if (pts.length < 2) continue;
    if (t.building && closed(el)) { const poly = pts.slice(0, -1); if (poly.length >= 3 && area(poly) > 8) features.buildings.push(poly); }
    if (t.railway) features.rails.push({ kind: t.railway, name: t.name || '', points: pts });
    const green = t.leisure || t.landuse || (t.natural === 'wood' ? 'wood' : '');
    if (green && closed(el) && ['park','playground','pitch','recreation_ground','garden','grass','village_green','wood','forest','allotments','cemetery','school'].includes(green)) {
      const poly = pts.slice(0, -1); if (poly.length >= 3 && area(poly) > 150) features.greens.push({ kind: green, name: t.name || '', points: poly });
    }
    if (t.natural === 'water' || t.water || t.waterway) features.water.push({ kind: t.waterway || t.water || t.natural, name: t.name || '', points: closed(el) ? pts.slice(0, -1) : pts });
    if (t.shop || t.amenity || t.office || t.tourism || t.healthcare || t.leisure) {
      const c = centroid(pts); addPoi(t.name || t.brand || t.operator || '', t.shop || t.amenity || t.office || t.tourism || t.healthcare || t.leisure, c.x, c.y);
    }
  }
  return features;
}
function applyFeatures(features) {
  map.buildings = (features.buildings || []).map((points, i) => ({ points, bounds: boundsOf(points), color: rand(i) > .93 ? '#bda56f' : '#8e7963' }));
  map.rails = (features.rails || []).map(item => ({ ...item, bounds: boundsOf(item.points) }));
  map.greens = (features.greens || []).map(item => ({ ...item, bounds: boundsOf(item.points) }));
  map.water = (features.water || []).map(item => ({ ...item, bounds: boundsOf(item.points) }));
  map.pois = features.pois || [];
  for (const g of map.greens) if (g.name) { const c = centroid(g.points); addLabel(g.name, c.x, c.y, 'green'); }
  for (const p of map.pois) addLabel(p.name, p.x, p.y, 'poi');
  makeTrees();
}
function makeTrees() {
  map.trees = [];
  let seed = 1;
  for (const g of map.greens) {
    if (!['park','garden','wood','forest','recreation_ground','grass','playground'].includes(g.kind)) continue;
    const b = g.bounds;
    const count = Math.min(90, Math.max(4, Math.round(((b.right - b.left) * (b.bottom - b.top)) / 17000)));
    for (let i = 0; i < count; i++) {
      const x = b.left + rand(seed++) * (b.right - b.left), y = b.top + rand(seed++) * (b.bottom - b.top);
      if (pointInPolygon({ x, y }, g.points) && !isOnRoad(x, y, 20)) map.trees.push({ x, y, r: 4 + rand(seed++) * 4 });
    }
  }
}
function makeFallbackBuildings() {
  map.buildings = [];
  let made = 0;
  for (const road of map.roads.filter(r => !r.foot && ['residential','unclassified','living_street','service'].includes(r.highway))) {
    for (let i = 0; i < road.points.length - 1 && made < 1000; i++) {
      const a = road.points[i], b = road.points[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 70) continue;
      const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, nx = -uy, ny = ux, angle = Math.atan2(uy, ux);
      for (let d = 32; d < length - 28 && made < 1000; d += 68) for (const side of [-1, 1]) {
        const seed = made + i * 17, w = 18 + rand(seed) * 18, h = 16 + rand(seed + 3) * 16, setback = road.width / 2 + h / 2 + 17;
        const cx = a.x + ux * d + nx * side * setback, cy = a.y + uy * d + ny * side * setback;
        if (isOnRoad(cx, cy, 24)) continue;
        const points = orientedRect(cx, cy, angle, w, h);
        map.buildings.push({ points, bounds: boundsOf(points), color: '#8e7963' }); made++;
      }
    }
  }
}
function orientedRect(cx, cy, angle, w, h) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, hw = w / 2, hh = h / 2;
  return [{ x: cx - dx*hw - nx*hh, y: cy - dy*hw - ny*hh }, { x: cx + dx*hw - nx*hh, y: cy + dy*hw - ny*hh }, { x: cx + dx*hw + nx*hh, y: cy + dy*hw + ny*hh }, { x: cx - dx*hw + nx*hh, y: cy - dy*hw + ny*hh }];
}
function closestPoint(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return { x: a.x, y: a.y, angle: 0 };
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return { x: a.x + t * dx, y: a.y + t * dy, angle: Math.atan2(dy, dx) };
}
function snapToRoad(x, y) {
  const n = nearestRoad(x, y); if (!n.road) return { x, y, angle: -Math.PI / 2 };
  const a = n.road.points[n.segment], b = n.road.points[n.segment + 1], c = closestPoint(x, y, a, b);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, normal = { x: dy / len, y: -dx / len }, offset = Math.min(n.road.width * .23, 11);
  return { x: c.x + normal.x * offset, y: c.y + normal.y * offset, angle: c.angle };
}
function collidesWithBuilding(x, y) { return map.buildings.some(b => pointInPolygon({ x, y }, b.points)); }
function createVehicle(x, y, angle, typeIndex = 0, playerOwned = false) {
  const type = carTypes[typeIndex % carTypes.length];
  return { ...type, x, y, angle, typeIndex, playerOwned, speed: 0, grip: 1 };
}
function placeVehicles() {
  vehicles = [];
  const start = snapToRoad(2400, 2140);
  vehicles.push(createVehicle(start.x, start.y, start.angle, 0, true));
  let made = 0;
  for (const road of map.roads.filter(r => !r.foot && r.width >= 30)) for (let i = 0; i < road.points.length - 1 && made < 56; i++) {
    const a = road.points[i], b = road.points[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 160) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, normal = { x: -uy, y: ux }, angle = Math.atan2(uy, ux);
    for (let d = 75; d < length - 50 && made < 56; d += 220) {
      const x = a.x + ux * d + normal.x * road.width * .28, y = a.y + uy * d + normal.y * road.width * .28;
      if (collidesWithBuilding(x, y) || nearJunction(x, y, 26)) continue;
      vehicles.push(createVehicle(x, y, angle, 1 + made));
      made++;
    }
  }
}
function updateVehicle(v, delta) {
  const throttle = input.down('w','arrowup'), brake = input.down('s','arrowdown'), handbrake = input.down(' '), steer = input.axis('a','d') + input.axis('arrowleft','arrowright'), boost = input.down('shift');
  if (throttle) v.speed += v.accel * (boost ? 1.25 : 1) * delta;
  if (brake) v.speed -= v.brake * delta;
  if (handbrake) {
    v.speed *= Math.pow(.88, delta * 60);
    v.angle += steer * 4.2 * Math.min(1, Math.abs(v.speed) / 180) * delta;
    v.grip = Math.max(.55, v.grip - delta * 2.6);
    handbrakePulse = Math.max(handbrakePulse, .32);
  } else {
    v.grip += (1 - v.grip) * Math.min(1, delta * 5);
  }
  if (!throttle && !brake && !handbrake) v.speed *= Math.pow(v.drag, delta * 60);
  v.speed = Math.max(-165, Math.min(v.speed, v.maxSpeed * (boost ? 1.1 : 1)));
  v.angle += steer * v.turn * v.grip * Math.min(1, Math.abs(v.speed) / 155) * Math.sign(v.speed || 1) * delta;
  const x = v.x + Math.cos(v.angle) * v.speed * delta, y = v.y + Math.sin(v.angle) * v.speed * delta;
  if (!isOnRoad(x, y, 25) || collidesWithBuilding(x, y)) { v.speed *= -.22; return; }
  v.x = x; v.y = y;
}
function updateWalker(delta) {
  const xAxis = input.axis('a','d') + input.axis('arrowleft','arrowright'), yAxis = input.axis('w','s') + input.axis('arrowup','arrowdown'), len = Math.hypot(xAxis, yAxis);
  player.moving = len > 0;
  if (!len) return;
  const speed = input.down('shift') ? 210 : 125, dx = xAxis / len * speed * delta, dy = yAxis / len * speed * delta, x = player.x + dx, y = player.y + dy;
  player.angle = Math.atan2(dy, dx);
  player.walkTime += delta * (input.down('shift') ? 13 : 8);
  if (!collidesWithBuilding(x, y)) { player.x = Math.max(20, Math.min(world.width - 20, x)); player.y = Math.max(20, Math.min(world.height - 20, y)); }
}
function updateModeSwitch() {
  if (!input.justPressed('e')) return;
  startAudio();
  if (mode === 'driving' && activeVehicle) {
    activeVehicle.speed = 0;
    player.x = activeVehicle.x - Math.sin(activeVehicle.angle) * 26;
    player.y = activeVehicle.y + Math.cos(activeVehicle.angle) * 26;
    player.angle = activeVehicle.angle;
    activeVehicle = null; mode = 'walking';
    missionEl.textContent = 'On foot. Walk to a parked car and press E.';
    return;
  }
  let nearest = null, best = Infinity;
  for (const v of vehicles) { const d = Math.hypot(player.x - v.x, player.y - v.y); if (d < best) { best = d; nearest = v; } }
  if (nearest && best < 58) { activeVehicle = nearest; activeVehicle.speed = 0; mode = 'driving'; missionEl.textContent = `Driving ${nearest.name}. Press E to get out.`; }
  else missionEl.textContent = 'Move closer to a parked car, then press E.';
}
function updateRace() {
  if (mode !== 'driving' || !activeVehicle) return;
  const cp = checkpoints[checkpointIndex];
  if (Math.hypot(activeVehicle.x - cp.x, activeVehicle.y - cp.y) > 70) return;
  if (checkpointIndex === 0) { raceStarted = true; raceStart = performance.now(); }
  checkpointIndex++;
  if (checkpointIndex >= checkpoints.length) {
    const time = (performance.now() - raceStart) / 1000;
    raceStarted = false; timerEl.textContent = `${time.toFixed(2)}s`;
    if (!bestTime || time < bestTime) { bestTime = time; localStorage.setItem('innesDriverBest', String(time)); bestEl.textContent = `${time.toFixed(2)}s`; }
    checkpointIndex = 0; missionEl.textContent = 'Finished. Press R to restart.';
  } else missionEl.textContent = `Next marker: ${checkpoints[checkpointIndex].label}`;
}
function updateCamera() {
  const t = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const speed = activeVehicle ? Math.abs(activeVehicle.speed) : 0;
  camera.targetZoom = mode === 'driving' ? Math.max(.74, Math.min(1.18, 1.17 - speed / 980)) : 1.23;
  camera.zoom += (camera.targetZoom - camera.zoom) * .045;
  const viewW = window.innerWidth / camera.zoom, viewH = window.innerHeight / camera.zoom;
  camera.x += (t.x - viewW / 2 - camera.x) * .15;
  camera.y += (t.y - viewH / 2 - camera.y) * .15;
  camera.x = Math.max(0, Math.min(world.width - viewW, camera.x));
  camera.y = Math.max(0, Math.min(world.height - viewH, camera.y));
}
function visible(b, pad = 90) {
  const w = window.innerWidth / camera.zoom, h = window.innerHeight / camera.zoom;
  return b.right > camera.x - pad && b.left < camera.x + w + pad && b.bottom > camera.y - pad && b.top < camera.y + h + pad;
}
function drawPolyline(points, color, width, dashed = false, dash = []) {
  if (points.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dashed) ctx.setLineDash(dash);
  ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke(); ctx.restore();
}
function drawPolygon(points) { ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); }
function drawRoadMarkings(road) {
  if (road.width < 38 || /roundabout|toll/i.test(road.name || '')) return;
  ctx.save(); ctx.strokeStyle = '#f3f0e8'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.setLineDash([20,34]);
  for (let i=0;i<road.points.length-1;i++) {
    const a=road.points[i], b=road.points[i+1], len=Math.hypot(b.x-a.x,b.y-a.y);
    if (len < 125) continue;
    const ux=(b.x-a.x)/len, uy=(b.y-a.y)/len, s={x:a.x+ux*42,y:a.y+uy*42}, e={x:b.x-ux*42,y:b.y-uy*42};
    if (nearJunction(s.x,s.y,12)||nearJunction(e.x,e.y,12)) continue;
    ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(e.x,e.y); ctx.stroke();
  }
  ctx.restore();
}
function drawMap() {
  ctx.fillStyle = '#687f5c'; ctx.fillRect(0,0,world.width,world.height);
  for (const g of map.greens) if (visible(g.bounds)) { ctx.fillStyle = g.kind === 'playground' ? '#91aa69' : g.kind === 'pitch' ? '#789b64' : '#5f855c'; drawPolygon(g.points); ctx.fill(); }
  for (const w of map.water) if (visible(w.bounds)) drawPolyline(w.points, '#4f8faa', w.kind === 'water' ? 12 : 5);
  for (const t of map.trees) if (t.x > camera.x-30 && t.x < camera.x+window.innerWidth/camera.zoom+30 && t.y > camera.y-30 && t.y < camera.y+window.innerHeight/camera.zoom+30) { ctx.fillStyle='#315f3a'; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.fill(); }
  for (const b of map.buildings) if (visible(b.bounds)) { ctx.save(); ctx.translate(4,5); ctx.fillStyle='#3e3732'; drawPolygon(b.points); ctx.fill(); ctx.restore(); ctx.fillStyle=b.color || '#8e7963'; drawPolygon(b.points); ctx.fill(); ctx.strokeStyle='rgba(18,23,28,.38)'; ctx.lineWidth=1; ctx.stroke(); }
  for (const r of map.rails) if (visible(r.bounds)) { drawPolyline(r.points,'#171b20',8); drawPolyline(r.points,'#c9d1d9',3,true,[18,16]); }
  for (const r of map.roads.filter(r=>r.foot)) if (visible(r.bounds)) drawPolyline(r.points,'rgba(225,219,196,.18)',2);
  const roads = map.roads.filter(r=>!r.foot);
  for (const r of roads) if (visible(r.bounds,140)) drawPolyline(r.points,'#d8d2b8',r.width+10);
  for (const r of roads) if (visible(r.bounds,140)) drawPolyline(r.points,'#222b37',r.width);
  for (const r of roads) if (visible(r.bounds,140)) drawRoadMarkings(r);
  drawLabels();
}
function drawLabels() {
  const t = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const viewW = window.innerWidth / camera.zoom, viewH = window.innerHeight / camera.zoom;
  const labels = map.labels.filter(i => i.x > camera.x-40 && i.x < camera.x+viewW+40 && i.y > camera.y-40 && i.y < camera.y+viewH+40)
    .map(i => ({...i,distance:Math.hypot(i.x-t.x,i.y-t.y)})).filter(i => i.kind === 'poi' ? i.distance < 250 : i.distance < 420)
    .sort((a,b)=>(a.kind==='poi'?-80:0)+a.distance-b.distance).slice(0,12);
  for (const i of labels) {
    ctx.font = i.kind === 'poi' ? 'bold 9px system-ui, sans-serif' : 'bold 10px system-ui, sans-serif'; ctx.textAlign='center';
    const w=Math.min(118,ctx.measureText(i.label).width+8);
    ctx.fillStyle=i.kind==='poi'?'rgba(12,18,24,.62)':'rgba(246,248,250,.68)'; ctx.fillRect(i.x-w/2,i.y-15,w,12);
    ctx.fillStyle=i.kind==='poi'?'#f8fafc':'#172033'; ctx.fillText(i.label,i.x,i.y-6,w-6);
  }
}
function drawCheckpoint(p, index) {
  const active = index === checkpointIndex;
  ctx.save(); ctx.translate(p.x,p.y); ctx.strokeStyle=active?'#69ff7e':'#a9bad3'; ctx.fillStyle=active?'rgba(105,255,126,.18)':'rgba(169,186,211,.1)'; ctx.lineWidth=active?7:4;
  ctx.beginPath(); ctx.arc(0,0,66,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='bold 18px system-ui, sans-serif'; ctx.textAlign='center'; ctx.fillText(String(index+1),0,6); ctx.restore();
}
function drawVehicle(v, active) {
  ctx.save(); ctx.translate(v.x,v.y); ctx.rotate(v.angle+Math.PI/2);
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fillRect(-v.width/2-1.5,-v.length/2+3,v.width+3,v.length+3);
  ctx.fillStyle=v.color; roundRect(-v.width/2,-v.length/2,v.width,v.length,2); ctx.fill();
  ctx.fillStyle=v.roof; ctx.fillRect(-v.width*.34,-v.length*.2,v.width*.68,v.length*.32);
  ctx.fillStyle='#a8bacb'; ctx.fillRect(-v.width*.3,-v.length*.43,v.width*.6,v.length*.13);
  ctx.fillStyle='#f8fafc'; ctx.fillRect(-v.width*.42,v.length*.35,v.width*.84,3);
  ctx.fillStyle='#111827';
  ctx.fillRect(-v.width/2-1,-v.length*.34,3,5); ctx.fillRect(v.width/2-2,-v.length*.34,3,5); ctx.fillRect(-v.width/2-1,v.length*.2,3,5); ctx.fillRect(v.width/2-2,v.length*.2,3,5);
  if (v.name === 'Taxi') { ctx.fillStyle='#f8fafc'; ctx.fillRect(-3,-2,6,4); }
  if (active) { ctx.strokeStyle='#45ff7b'; ctx.lineWidth=1.7; ctx.strokeRect(-v.width/2-3,-v.length/2-3,v.width+6,v.length+6); }
  ctx.restore();
}
function roundRect(x,y,w,h,r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); }
function drawPlayer() {
  const stride = player.moving ? Math.sin(player.walkTime) : 0;
  ctx.save(); ctx.translate(player.x,player.y); ctx.rotate(player.angle + Math.PI/2);
  ctx.strokeStyle='#111827'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-2,1); ctx.lineTo(-5,7 + stride*2); ctx.moveTo(2,1); ctx.lineTo(5,7 - stride*2); ctx.moveTo(-3,-3); ctx.lineTo(-7,-6 - stride*2); ctx.moveTo(3,-3); ctx.lineTo(7,-6 + stride*2); ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(2,3,5.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2563eb'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f1c27d'; ctx.beginPath(); ctx.arc(0,-5,3.2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawTrain(train) {
  const p = trainPosition(train);
  if (!p) return;
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
  for (let i=0;i<3;i++) { ctx.fillStyle=i===0?'#b91c1c':'#374151'; ctx.fillRect(-24 - i*34,-7,28,14); ctx.fillStyle='#dbeafe'; ctx.fillRect(-20 - i*34,-5,7,4); ctx.fillRect(-9 - i*34,-5,7,4); }
  ctx.restore();
}
function trainPosition(train) {
  const line = train.line;
  if (!line || line.points.length < 2) return null;
  let d = train.progress % train.length;
  for (let i=0;i<line.points.length-1;i++) {
    const a=line.points[i], b=line.points[i+1], len=Math.hypot(b.x-a.x,b.y-a.y);
    if (d <= len) { const t=d/len; return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, angle:Math.atan2(b.y-a.y,b.x-a.x) }; }
    d -= len;
  }
  return null;
}
function drawMiniMap() {
  if (!mini) return; mini.clearRect(0,0,minimap.width,minimap.height); mini.fillStyle='#101820'; mini.fillRect(0,0,minimap.width,minimap.height);
  const sx=minimap.width/world.width, sy=minimap.height/world.height; mini.strokeStyle='#46515c'; mini.lineCap='round';
  for (const r of map.roads.filter(r=>!r.foot)) { mini.lineWidth=Math.max(1,r.width*sx); mini.beginPath(); r.points.forEach((p,i)=>i?mini.lineTo(p.x*sx,p.y*sy):mini.moveTo(p.x*sx,p.y*sy)); mini.stroke(); }
  const t=mode==='driving'&&activeVehicle?activeVehicle:player; mini.fillStyle='#45ff7b'; mini.beginPath(); mini.arc(t.x*sx,t.y*sy,5,0,Math.PI*2); mini.fill();
}
function drawScene() {
  ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
  ctx.save(); ctx.scale(camera.zoom,camera.zoom); ctx.translate(-camera.x,-camera.y);
  drawMap(); checkpoints.forEach(drawCheckpoint); trains.forEach(drawTrain); for (const v of vehicles) drawVehicle(v,v===activeVehicle); if (mode==='walking') drawPlayer();
  ctx.restore();
}
function resetRace() { checkpointIndex=0; raceStarted=false; missionEl.textContent='Drive through the green marker. Press E to get out or enter nearby cars.'; }
function updateTrains(delta) { for (const train of trains) train.progress += train.speed * delta; }
function setupTrains() {
  trains.length = 0;
  const lines = map.rails.filter(r => r.points.length > 2);
  for (let i=0;i<Math.min(3, lines.length);i++) {
    const length = lineLength(lines[i]);
    trains.push({ line: lines[i], length, progress: rand(i+9)*length, speed: 95 + rand(i+4)*55 });
  }
}
function lineLength(line) { let total=0; for (let i=0;i<line.points.length-1;i++) total += Math.hypot(line.points[i+1].x-line.points[i].x,line.points[i+1].y-line.points[i].y); return total || 1; }
function startAudio() {
  if (audio) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const context = new AudioCtx();
  const master = context.createGain(); master.gain.value = .18; master.connect(context.destination);
  const engine = context.createOscillator(), engineGain = context.createGain(), filter = context.createBiquadFilter();
  engine.type = 'sawtooth'; engine.frequency.value = 90; filter.type='lowpass'; filter.frequency.value=420; engineGain.gain.value=0;
  engine.connect(filter); filter.connect(engineGain); engineGain.connect(master); engine.start();
  const skid = context.createOscillator(), skidGain = context.createGain();
  skid.type='triangle'; skid.frequency.value=90; skidGain.gain.value=0; skid.connect(skidGain); skidGain.connect(master); skid.start();
  audio = { context, engine, engineGain, filter, skidGain };
}
function updateAudio(delta) {
  if (!audio) return;
  if (audio.context.state === 'suspended') audio.context.resume();
  const speed = activeVehicle ? Math.abs(activeVehicle.speed) : 0, base = activeVehicle?.engine || 100;
  const targetGain = mode === 'driving' && activeVehicle ? .035 + Math.min(.13, speed / 3600) : .006;
  audio.engine.frequency.setTargetAtTime(base + speed * .42, audio.context.currentTime, .06);
  audio.filter.frequency.setTargetAtTime(360 + speed * 2.1, audio.context.currentTime, .08);
  audio.engineGain.gain.setTargetAtTime(targetGain, audio.context.currentTime, .08);
  handbrakePulse = Math.max(0, handbrakePulse - delta);
  audio.skidGain.gain.setTargetAtTime(handbrakePulse, audio.context.currentTime, .03);
}
function tick(now) {
  const delta=Math.min((now-lastTime)/1000,.033); lastTime=now;
  if (input.down('w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ')) startAudio();
  if (input.justPressed('r')) resetRace();
  updateModeSwitch(); if (mode==='driving'&&activeVehicle) updateVehicle(activeVehicle,delta); if (mode==='walking') updateWalker(delta);
  updateRace(); updateCamera(); updateTrains(delta); updateAudio(delta);
  if (raceStarted) timerEl.textContent=`${((performance.now()-raceStart)/1000).toFixed(2)}s`;
  const target=mode==='driving'&&activeVehicle?activeVehicle:player, n=nearestRoad(target.x,target.y);
  areaEl.textContent=n.road?.name||'Clarkston'; speedEl.textContent=mode==='driving'&&activeVehicle?Math.round(Math.abs(activeVehicle.speed)/7.2):0; modeEl.textContent=mode==='driving'&&activeVehicle?activeVehicle.name:'On foot';
  drawScene(); drawMiniMap(); input.endFrame(); requestAnimationFrame(tick);
}
async function boot() {
  resize(); setLoading(12,'Reading bundled Clarkston streets...'); parseRoads(); buildJunctions();
  try { const features = await loadOsmFeatures(); applyFeatures(features); }
  catch (error) { console.warn('Detailed OSM features unavailable', error); setLoading(70,'Using built-in fallback buildings...'); makeFallbackBuildings(); }
  setupTrains(); placeVehicles(); bestEl.textContent=bestTime?`${bestTime.toFixed(2)}s`:'--.--';
  statusEl.textContent=`${map.roads.length} roads, ${map.buildings.length} buildings, ${map.rails.length} railway lines, ${map.greens.length} green/play areas and ${map.pois.length} named places loaded`;
  setLoading(100,'Ready'); setTimeout(hideSplash,250); requestAnimationFrame(tick);
}
window.addEventListener('resize', resize);
boot();
