import { Input } from './core/Input.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const statusEl = document.querySelector('#status');
const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const timerEl = document.querySelector('#timer');
const bestEl = document.querySelector('#best');
const missionEl = document.querySelector('#mission');
const mini = document.querySelector('#minimap');
const miniCtx = mini?.getContext('2d');
const splashEl = document.querySelector('#splash');
const loadingTextEl = document.querySelector('#loading-text');
const loadingBarEl = document.querySelector('#loading-bar');

const input = new Input();
const METRES_PER_DEGREE = 111320;
const BOUNDS = { south: 55.7785, west: -4.3025, north: 55.8008, east: -4.2460 };
const MID_LAT = (BOUNDS.south + BOUNDS.north) / 2;
const SCALE = 1.34;
const PADDING = 220;
const lonMetres = (BOUNDS.east - BOUNDS.west) * METRES_PER_DEGREE * Math.cos(MID_LAT * Math.PI / 180);
const latMetres = (BOUNDS.north - BOUNDS.south) * METRES_PER_DEGREE;
const world = {
  width: Math.round(lonMetres * SCALE + PADDING * 2),
  height: Math.round(latMetres * SCALE + PADDING * 2)
};
const camera = { x: 0, y: 0 };
const keys = { best: 'clarkstonTopDownBest' };

const map = {
  roads: [],
  rails: [],
  buildings: [],
  labels: [],
  loaded: false,
  source: 'Loading OpenStreetMap...'
};

const player = {
  x: 0,
  y: 0,
  angle: -Math.PI / 2,
  speed: 0,
  radius: 7
};

let vehicles = [];
let activeVehicle = null;
let mode = 'driving';
let currentCheckpoint = 0;
let raceStarted = false;
let raceFinished = false;
let startTime = 0;
let elapsed = 0;
let lastTime = performance.now();

const checkpoints = [
  { lat: 55.7857, lon: -4.2764, label: 'Clarkston Toll' },
  { lat: 55.7892, lon: -4.2769, label: 'Busby Road' },
  { lat: 55.7906, lon: -4.2831, label: 'Clarkston Road' },
  { lat: 55.7852, lon: -4.2663, label: 'Eastwoodmains Road' },
  { lat: 55.7821, lon: -4.2806, label: 'Mearns Road' }
].map(point => ({ ...project(point.lat, point.lon), label: point.label }));

function project(lat, lon) {
  return {
    x: PADDING + (lon - BOUNDS.west) * METRES_PER_DEGREE * Math.cos(MID_LAT * Math.PI / 180) * SCALE,
    y: PADDING + (BOUNDS.north - lat) * METRES_PER_DEGREE * SCALE
  };
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setLoading(progress, text) {
  if (loadingBarEl) loadingBarEl.style.width = `${Math.max(4, Math.min(100, progress))}%`;
  if (loadingTextEl) loadingTextEl.textContent = text;
}

function hideSplash() {
  if (!splashEl) return;
  splashEl.classList.add('hidden');
  setTimeout(() => splashEl.remove(), 500);
}

function rand(seed) {
  const value = Math.sin(seed * 999.91) * 10000;
  return value - Math.floor(value);
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function closestPointOnSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return { x: a.x, y: a.y, angle: 0 };
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return { x: a.x + t * dx, y: a.y + t * dy, angle: Math.atan2(dy, dx) };
}

function nearestRoad(x, y, roads = map.roads) {
  let best = { road: null, distance: Infinity, segmentIndex: 0 };
  for (const road of roads) {
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const distance = distanceToSegment(x, y, road.points[i], road.points[i + 1]);
      if (distance < best.distance) best = { road, distance, segmentIndex: i };
    }
  }
  return best;
}

function snapToRoad(x, y) {
  const closest = nearestRoad(x, y, map.roads.filter(road => !road.foot));
  if (!closest.road) return { x, y, angle: -Math.PI / 2 };
  const a = closest.road.points[closest.segmentIndex];
  const b = closest.road.points[closest.segmentIndex + 1];
  const centre = closestPointOnSegment(x, y, a, b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / length, y: -dx / length };
  const laneOffset = Math.min(closest.road.width * 0.23, 11);
  return { x: centre.x + normal.x * laneOffset, y: centre.y + normal.y * laneOffset, angle: centre.angle };
}

function isOnRoad(x, y, padding = 14) {
  const closest = nearestRoad(x, y, map.roads.filter(road => !road.foot));
  return Boolean(closest.road && closest.distance <= closest.road.width / 2 + padding);
}

function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

function lineSegmentsIntersect(a, b, c, d) {
  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function buildingOverlapsRoad(points) {
  const centre = polygonCentroid(points);
  if (isOnRoad(centre.x, centre.y, -4)) return true;

  for (const road of map.roads.filter(road => !road.foot)) {
    for (let r = 0; r < road.points.length - 1; r += 1) {
      const a = road.points[r];
      const b = road.points[r + 1];
      if (pointInPolygon(a, points) || pointInPolygon(b, points)) return true;
      for (let i = 0; i < points.length; i += 1) {
        if (lineSegmentsIntersect(points[i], points[(i + 1) % points.length], a, b)) return true;
        if (distanceToSegment(points[i], a, b).distance < road.width * 0.42) return true;
      }
    }
  }
  return false;
}

function collidesWithBuilding(x, y) {
  return map.buildings.some(building => pointInPolygon({ x, y }, building.points));
}

function getRoadWidth(highway) {
  if (['primary', 'secondary'].includes(highway)) return 58;
  if (['tertiary', 'trunk'].includes(highway)) return 52;
  if (['residential', 'unclassified', 'living_street'].includes(highway)) return 42;
  if (['service'].includes(highway)) return 30;
  if (['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway)) return 5;
  return 38;
}

function labelFromTags(tags = {}) {
  return tags.name || tags.brand || tags.operator || tags['addr:housename'] || '';
}

function isBusiness(tags = {}) {
  return Boolean(tags.shop || tags.amenity || tags.office || tags.tourism || tags.healthcare || tags.craft || tags.leisure);
}

function labelKind(tags = {}) {
  if (tags.shop) return tags.shop;
  if (tags.amenity) return tags.amenity;
  if (tags.office) return tags.office;
  if (tags.tourism) return tags.tourism;
  if (tags.healthcare) return tags.healthcare;
  if (tags.leisure) return tags.leisure;
  return '';
}

function addLabel(label, x, y, kind = '', important = false) {
  if (!label || label.length < 2) return;
  const duplicate = map.labels.some(item => item.label === label && Math.hypot(item.x - x, item.y - y) < 42);
  if (!duplicate) map.labels.push({ label, x, y, kind, important });
}

function buildOverpassQuery() {
  const bbox = `${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}`;
  return `
    [out:json][timeout:28];
    (
      way["highway"](${bbox});
      way["railway"](${bbox});
      way["building"](${bbox});
      relation["building"](${bbox});
      node["shop"](${bbox}); way["shop"](${bbox});
      node["amenity"](${bbox}); way["amenity"](${bbox});
      node["office"](${bbox}); way["office"](${bbox});
      node["tourism"](${bbox}); way["tourism"](${bbox});
      node["healthcare"](${bbox}); way["healthcare"](${bbox});
      node["craft"](${bbox}); way["craft"](${bbox});
      node["leisure"](${bbox}); way["leisure"](${bbox});
    );
    out body center;
    >;
    out skel qt;
  `;
}

async function fetchOSM() {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const body = buildOverpassQuery();
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: body }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`OpenStreetMap endpoint returned ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error('OpenStreetMap endpoint did not return JSON');
      return response.json();
    } catch (error) {
      console.warn('OpenStreetMap endpoint unavailable', endpoint, error);
    }
  }
  return fetchOSMMapTiles();
}

async function fetchOSMMapTiles() {
  const elements = new Map();
  const cols = 3;
  const rows = 2;
  const requests = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const west = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * col) / cols;
      const east = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * (col + 1)) / cols;
      const south = BOUNDS.south + ((BOUNDS.north - BOUNDS.south) * row) / rows;
      const north = BOUNDS.south + ((BOUNDS.north - BOUNDS.south) * (row + 1)) / rows;
      requests.push(fetchOSMTile(west, south, east, north));
    }
  }

  const tiles = await Promise.all(requests);
  for (const tile of tiles) {
    for (const element of tile) elements.set(`${element.type}/${element.id}`, element);
  }

  if (!elements.size) throw new Error('OpenStreetMap data is unavailable');
  return { elements: [...elements.values()] };
}

async function fetchOSMTile(west, south, east, north) {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${west},${south},${east},${north}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`OSM map tile returned ${response.status}`);

  const xmlText = await response.text();
  if (xmlText.includes('too many nodes')) throw new Error('OSM map tile is too large');

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('OSM map tile XML could not be parsed');

  const elements = [];
  for (const node of doc.querySelectorAll('node')) {
    elements.push({
      type: 'node',
      id: Number(node.getAttribute('id')),
      lat: Number(node.getAttribute('lat')),
      lon: Number(node.getAttribute('lon')),
      tags: readXMLTags(node)
    });
  }

  for (const way of doc.querySelectorAll('way')) {
    elements.push({
      type: 'way',
      id: Number(way.getAttribute('id')),
      nodes: [...way.querySelectorAll('nd')].map(nd => Number(nd.getAttribute('ref'))),
      tags: readXMLTags(way)
    });
  }

  return elements;
}

function readXMLTags(element) {
  const tags = {};
  for (const tag of element.querySelectorAll('tag')) {
    tags[tag.getAttribute('k')] = tag.getAttribute('v');
  }
  return tags;
}

function parseOSM(data) {
  const nodes = new Map();
  const ways = [];
  map.roads = [];
  map.rails = [];
  map.buildings = [];
  map.labels = [];

  for (const item of data.elements) {
    if (item.type === 'node') {
      const point = project(item.lat, item.lon);
      nodes.set(item.id, point);
      if (isBusiness(item.tags)) addLabel(labelFromTags(item.tags), point.x, point.y, labelKind(item.tags), true);
    } else if (item.type === 'way') {
      ways.push(item);
    }
  }

  for (const way of ways) {
    const tags = way.tags || {};
    const points = (way.nodes || []).map(id => nodes.get(id)).filter(Boolean);
    if (points.length < 2) continue;

    if (tags.highway) {
      const foot = ['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(tags.highway);
      map.roads.push({
        points,
        name: tags.name || '',
        width: getRoadWidth(tags.highway),
        main: ['primary', 'secondary', 'tertiary', 'trunk'].includes(tags.highway),
        foot
      });
    }

    if (tags.railway) map.rails.push({ points, name: tags.name || '' });
  }

  for (const way of ways) {
    const tags = way.tags || {};
    const points = (way.nodes || []).map(id => nodes.get(id)).filter(Boolean);
    if (points.length < 3) continue;
    const closed = way.nodes?.[0] === way.nodes?.[way.nodes.length - 1];
    const centre = way.center ? project(way.center.lat, way.center.lon) : polygonCentroid(points);
    const label = labelFromTags(tags);

    if (tags.building && closed && polygonArea(points) > 90 && !buildingOverlapsRoad(points)) {
      map.buildings.push({
        points,
        label,
        business: isBusiness(tags),
        color: isBusiness(tags) ? '#c9b17d' : '#8d7964',
        bounds: getBounds(points)
      });
    }

    if (isBusiness(tags)) addLabel(label, centre.x, centre.y, labelKind(tags), true);
  }

  for (const road of map.roads) {
    if (road.name && road.main) {
      const point = road.points[Math.floor(road.points.length / 2)];
      addLabel(road.name, point.x, point.y, 'road', false);
    }
  }

  map.loaded = true;
  map.source = `${map.roads.length} roads, ${map.buildings.length} buildings and ${map.labels.filter(label => label.important).length} named places from OpenStreetMap`;
}

function getBounds(points) {
  return {
    left: Math.min(...points.map(point => point.x)),
    right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)),
    bottom: Math.max(...points.map(point => point.y))
  };
}

function buildFallbackMap() {
  const road = (name, width, main, coords) => ({
    name,
    width,
    main,
    foot: false,
    points: coords.map(([lat, lon]) => project(lat, lon))
  });
  map.roads = [
    road('Busby Road', 46, true, [[55.7994, -4.2788], [55.7925, -4.2776], [55.7857, -4.2764], [55.7800, -4.2762]]),
    road('Clarkston Road', 40, true, [[55.7857, -4.2764], [55.7899, -4.2854], [55.7939, -4.2935]]),
    road('Mearns Road', 38, true, [[55.7857, -4.2764], [55.7834, -4.2842], [55.7812, -4.2944]]),
    road('Eastwoodmains Road', 40, true, [[55.7857, -4.2764], [55.7866, -4.2672], [55.7876, -4.2578]]),
    road('Eaglesham Road', 36, true, [[55.7857, -4.2764], [55.7826, -4.2702], [55.7792, -4.2631]]),
    road('Sheddens Road', 30, false, [[55.7857, -4.2764], [55.7864, -4.2848], [55.7868, -4.2920]]),
    road('Flenders Road', 28, false, [[55.7835, -4.2852], [55.7791, -4.2920]]),
    road('Seres Road', 26, false, [[55.7907, -4.2765], [55.7910, -4.2870]])
  ];
  map.rails = [{ points: [[55.7990, -4.2690], [55.7915, -4.2660], [55.7820, -4.2640]].map(([lat, lon]) => project(lat, lon)) }];
  map.buildings = [];
  map.labels = [];
  for (const roadItem of map.roads) {
    const point = roadItem.points[Math.floor(roadItem.points.length / 2)];
    addLabel(roadItem.name, point.x, point.y, 'road', false);
  }
  map.source = 'Fallback Clarkston map. OpenStreetMap live data could not be loaded.';
}

function createParkedVehicles() {
  vehicles = [];
  const startPoint = project(55.7842, -4.2763);
  const start = snapToRoad(startPoint.x, startPoint.y);
  vehicles.push(createVehicle(start.x, start.y, start.angle, '#3f7f3f', '4x4 Jeep', true));

  let made = 0;
  for (const road of map.roads.filter(item => !item.foot && item.width > 24)) {
    for (let i = 0; i < road.points.length - 1 && made < 34; i += 1) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 130) continue;
      const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
      const normal = { x: -dir.y, y: dir.x };
      for (let d = 70; d < length - 40 && made < 34; d += 210) {
        const side = 1;
        const x = a.x + dir.x * d + normal.x * side * Math.max(8, road.width * 0.32);
        const y = a.y + dir.y * d + normal.y * side * Math.max(8, road.width * 0.32);
        if (collidesWithBuilding(x, y)) continue;
        vehicles.push(createVehicle(x, y, Math.atan2(dir.y, dir.x), made % 5 === 0 ? '#2d74b8' : '#8f3f2d', made % 5 === 0 ? 'Estate Car' : 'Parked Car', false));
        made += 1;
      }
    }
  }

  activeVehicle = vehicles[0];
  mode = 'driving';
  resetRace(false);
}

function createVehicle(x, y, angle, color, name, playerOwned) {
  return {
    x,
    y,
    angle,
    color,
    name,
    playerOwned,
    speed: 0,
    width: playerOwned ? 16 : 15,
    length: playerOwned ? 27 : 24,
    maxSpeed: playerOwned ? 540 : 430,
    reverseSpeed: -190,
    acceleration: playerOwned ? 420 : 360,
    brakePower: 520,
    drag: 0.965,
    turnRate: playerOwned ? 2.7 : 2.45
  };
}

function resetRace(resetCar = false) {
  currentCheckpoint = 0;
  raceStarted = false;
  raceFinished = false;
  elapsed = 0;
  timerEl.textContent = formatTime(null);
  missionEl.textContent = 'Drive through the green marker. Press E to get out or enter nearby cars.';
  statusEl.textContent = map.source;
  if (resetCar && vehicles[0]) {
    const startPoint = project(55.7842, -4.2763);
    const start = snapToRoad(startPoint.x, startPoint.y);
    Object.assign(vehicles[0], { x: start.x, y: start.y, angle: start.angle, speed: 0 });
    activeVehicle = vehicles[0];
    mode = 'driving';
  }
}

function formatTime(seconds) {
  return seconds ? `${seconds.toFixed(2)}s` : '--.--';
}

function readBest() {
  const stored = Number(localStorage.getItem(keys.best));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

function saveBest(time) {
  const best = readBest();
  if (!best || time < best) {
    localStorage.setItem(keys.best, String(time));
    return true;
  }
  return false;
}

function updateVehicle(vehicle, delta) {
  const throttle = input.down('w', 'arrowup');
  const brake = input.down('s', 'arrowdown');
  const steer = input.axis('a', 'd') + input.axis('arrowleft', 'arrowright');
  const boost = input.down('shift');

  if (throttle) vehicle.speed += vehicle.acceleration * (boost ? 1.35 : 1) * delta;
  if (brake) vehicle.speed -= vehicle.brakePower * delta;
  if (!throttle && !brake) vehicle.speed *= Math.pow(vehicle.drag, delta * 60);

  vehicle.speed = Math.max(vehicle.reverseSpeed, Math.min(vehicle.speed, boost ? vehicle.maxSpeed * 1.15 : vehicle.maxSpeed));
  const turnStrength = Math.min(1, Math.abs(vehicle.speed) / 160);
  vehicle.angle += steer * vehicle.turnRate * turnStrength * Math.sign(vehicle.speed || 1) * delta;

  const nextX = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * delta;
  const nextY = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * delta;
  const lane = leftLaneTarget(nextX, nextY, vehicle.angle);
  if (!isOnRoad(nextX, nextY, 32) || lane.distance > 42 || collidesWithBuilding(nextX, nextY)) {
    vehicle.speed *= -0.25;
    return;
  }
  vehicle.x = nextX;
  vehicle.y = nextY;
}

function leftLaneTarget(x, y, angle = 0) {
  const closest = nearestRoad(x, y, map.roads.filter(road => !road.foot));
  if (!closest.road) return { x, y, distance: Infinity };
  const a = closest.road.points[closest.segmentIndex];
  const b = closest.road.points[closest.segmentIndex + 1];
  const centre = closestPointOnSegment(x, y, a, b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const roadDir = { x: dx / length, y: dy / length };
  const heading = { x: Math.cos(angle), y: Math.sin(angle) };
  const direction = heading.x * roadDir.x + heading.y * roadDir.y < 0 ? -1 : 1;
  const normal = { x: roadDir.y * direction, y: -roadDir.x * direction };
  const laneOffset = Math.min(closest.road.width * 0.23, 11);
  const lanePoint = { x: centre.x + normal.x * laneOffset, y: centre.y + normal.y * laneOffset };
  return { ...lanePoint, distance: Math.hypot(x - lanePoint.x, y - lanePoint.y) };
}

function updateWalker(delta) {
  const xAxis = input.axis('a', 'd') + input.axis('arrowleft', 'arrowright');
  const yAxis = input.axis('w', 's') + input.axis('arrowup', 'arrowdown');
  const length = Math.hypot(xAxis, yAxis);
  const speed = input.down('shift') ? 210 : 125;
  if (length > 0) {
    const dx = (xAxis / length) * speed * delta;
    const dy = (yAxis / length) * speed * delta;
    const nextX = player.x + dx;
    const nextY = player.y + dy;
    player.angle = Math.atan2(dy, dx);
    if (!collidesWithBuilding(nextX, nextY)) {
      player.x = Math.max(24, Math.min(world.width - 24, nextX));
      player.y = Math.max(24, Math.min(world.height - 24, nextY));
    }
  }
}

function exitVehicle() {
  if (!activeVehicle) return;
  activeVehicle.speed = 0;
  player.x = activeVehicle.x - Math.sin(activeVehicle.angle) * 34;
  player.y = activeVehicle.y + Math.cos(activeVehicle.angle) * 34;
  player.angle = activeVehicle.angle;
  activeVehicle = null;
  mode = 'walking';
  missionEl.textContent = 'On foot. Walk to a parked car and press E to get in.';
}

function enterNearestVehicle() {
  let nearest = null;
  let best = Infinity;
  for (const vehicle of vehicles) {
    const distance = Math.hypot(player.x - vehicle.x, player.y - vehicle.y);
    if (distance < best) {
      nearest = vehicle;
      best = distance;
    }
  }
  if (nearest && best < 72) {
    activeVehicle = nearest;
    activeVehicle.speed = 0;
    mode = 'driving';
    missionEl.textContent = `Driving ${nearest.name}. Press E to get out.`;
  } else {
    missionEl.textContent = 'Move closer to a parked car, then press E.';
  }
}

function updateModeSwitch() {
  if (!input.justPressed('e')) return;
  if (mode === 'driving') exitVehicle();
  else enterNearestVehicle();
}

function updateRace() {
  if (raceFinished || mode !== 'driving' || !activeVehicle) return;
  const checkpoint = checkpoints[currentCheckpoint];
  const distance = Math.hypot(activeVehicle.x - checkpoint.x, activeVehicle.y - checkpoint.y);
  if (distance > 68) return;

  if (currentCheckpoint === 0) {
    raceStarted = true;
    startTime = performance.now();
    statusEl.textContent = 'Sprint started.';
  }

  currentCheckpoint += 1;
  if (currentCheckpoint >= checkpoints.length) {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = formatTime(elapsed);
    raceFinished = true;
    raceStarted = false;
    const newBest = saveBest(elapsed);
    bestEl.textContent = formatTime(readBest());
    missionEl.textContent = newBest ? 'New best time. Press Space to restart.' : 'Finished. Press Space to restart.';
    statusEl.textContent = `Finished in ${formatTime(elapsed)}.`;
    return;
  }

  missionEl.textContent = `Next marker: ${checkpoints[currentCheckpoint].label}`;
}

function updateCamera() {
  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  camera.x += (target.x - viewW / 2 - camera.x) * 0.14;
  camera.y += (target.y - viewH / 2 - camera.y) * 0.14;
  camera.x = Math.max(0, Math.min(camera.x, world.width - viewW));
  camera.y = Math.max(0, Math.min(camera.y, world.height - viewH));
}

function drawMap() {
  const visible = {
    left: camera.x - 90,
    right: camera.x + window.innerWidth + 90,
    top: camera.y - 90,
    bottom: camera.y + window.innerHeight + 90
  };

  ctx.fillStyle = '#647f58';
  ctx.fillRect(0, 0, world.width, world.height);

  for (let i = 0; i < 36; i += 1) {
    ctx.fillStyle = i % 2 ? '#6b8760' : '#5f7a57';
    ctx.beginPath();
    ctx.arc(80 + rand(i) * (world.width - 160), 80 + rand(i + 60) * (world.height - 160), 20 + rand(i + 20) * 48, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const rail of map.rails) drawPolyline(rail.points, '#1d2126', 8, false);
  for (const rail of map.rails) drawPolyline(rail.points, '#bfc4ca', 3, true, [18, 18]);

  for (const building of map.buildings) {
    if (building.bounds.right < visible.left || building.bounds.left > visible.right || building.bounds.bottom < visible.top || building.bounds.top > visible.bottom) continue;
    drawBuilding(building);
  }

  for (const road of map.roads.filter(item => item.foot)) drawPolyline(road.points, 'rgba(224, 219, 196, .22)', 2, false);

  for (const road of map.roads.filter(item => !item.foot)) {
    drawPolyline(road.points, '#d8d1b8', road.width + 18, false);
    drawPolyline(road.points, '#222b37', road.width, false);
    drawLaneMarkings(road);
  }
  drawLabels();
}

function drawPolyline(points, color, width, dashed, dash = []) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawLaneMarkings(road) {
  if (road.width < 34) return;
  ctx.save();
  ctx.strokeStyle = '#f2f0e8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([20, 34]);
  ctx.beginPath();
  road.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawBuilding(building) {
  ctx.save();
  ctx.fillStyle = '#403832';
  ctx.translate(5, 6);
  drawPolygon(building.points);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = building.color;
  drawPolygon(building.points);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 26, 32, .38)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPolygon(points) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function drawLabels() {
  const focus = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const visible = {
    left: camera.x - 60,
    right: camera.x + window.innerWidth + 60,
    top: camera.y - 60,
    bottom: camera.y + window.innerHeight + 60
  };
  const labels = map.labels
    .filter(item => item.x > visible.left && item.x < visible.right && item.y > visible.top && item.y < visible.bottom)
    .map(item => ({ ...item, distance: Math.hypot(item.x - focus.x, item.y - focus.y) }))
    .filter(item => item.important ? item.distance < 280 : item.distance < 420)
    .sort((a, b) => a.distance - b.distance);

  for (const item of labels.slice(0, 10)) {
    const important = item.important;
    ctx.font = important ? 'bold 9px system-ui, sans-serif' : 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const width = Math.min(96, ctx.measureText(item.label).width + 8);
    ctx.fillStyle = important ? 'rgba(12, 18, 24, .58)' : 'rgba(248, 250, 252, .62)';
    ctx.fillRect(item.x - width / 2, item.y - 15, width, 12);
    ctx.fillStyle = important ? '#f8fafc' : '#172033';
    ctx.fillText(item.label, item.x, item.y - 6, width - 6);
  }
}

function drawCheckpoint(checkpoint, index) {
  if (raceFinished && index >= currentCheckpoint) return;
  const active = index === currentCheckpoint;
  ctx.save();
  ctx.translate(checkpoint.x, checkpoint.y);
  ctx.strokeStyle = active ? '#45ff7b' : '#94a3b8';
  ctx.fillStyle = active ? 'rgba(69, 255, 123, 0.18)' : 'rgba(148, 163, 184, 0.10)';
  ctx.lineWidth = active ? 7 : 4;
  ctx.beginPath();
  ctx.arc(0, 0, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${index + 1}`, 0, 6);
  ctx.restore();
}

function drawVehicle(vehicle, isActive) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle + Math.PI / 2);

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(-vehicle.width / 2 - 2, -vehicle.length / 2 + 3, vehicle.width + 4, vehicle.length + 3);
  ctx.fillStyle = vehicle.color;
  ctx.fillRect(-vehicle.width / 2, -vehicle.length / 2, vehicle.width, vehicle.length);
  ctx.fillStyle = vehicle.playerOwned ? '#1f3d2d' : '#111827';
  ctx.fillRect(-vehicle.width * 0.34, -vehicle.length * 0.22, vehicle.width * 0.68, vehicle.length * 0.34);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-vehicle.width * 0.31, -vehicle.length * 0.43, vehicle.width * 0.62, vehicle.length * 0.16);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-vehicle.width / 2 - 2, -vehicle.length * 0.35, 4, 7);
  ctx.fillRect(vehicle.width / 2 - 2, -vehicle.length * 0.35, 4, 7);
  ctx.fillRect(-vehicle.width / 2 - 2, vehicle.length * 0.18, 4, 7);
  ctx.fillRect(vehicle.width / 2 - 2, vehicle.length * 0.18, 4, 7);

  if (vehicle.playerOwned) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-vehicle.width * 0.42, vehicle.length * 0.35, vehicle.width * 0.84, 5);
  }

  if (isActive) {
    ctx.strokeStyle = '#45ff7b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-vehicle.width / 2 - 4, -vehicle.length / 2 - 4, vehicle.width + 8, vehicle.length + 8);
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.arc(3, 4, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-4, -player.radius - 3, 8, 8);
  ctx.restore();
}

function drawScene() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawMap();
  checkpoints.forEach(drawCheckpoint);
  for (const vehicle of vehicles) drawVehicle(vehicle, vehicle === activeVehicle);
  if (mode === 'walking') drawPlayer();
  ctx.restore();
}

function drawMiniMap() {
  if (!miniCtx) return;
  const w = mini.width;
  const h = mini.height;
  miniCtx.clearRect(0, 0, w, h);
  miniCtx.fillStyle = '#101820';
  miniCtx.fillRect(0, 0, w, h);

  const sx = w / world.width;
  const sy = h / world.height;
  for (const road of map.roads.filter(item => !item.foot)) {
    miniCtx.strokeStyle = '#46515c';
    miniCtx.lineWidth = Math.max(2, road.width * sx);
    miniCtx.lineCap = 'round';
    miniCtx.beginPath();
    road.points.forEach((point, index) => {
      if (index === 0) miniCtx.moveTo(point.x * sx, point.y * sy);
      else miniCtx.lineTo(point.x * sx, point.y * sy);
    });
    miniCtx.stroke();
  }

  checkpoints.forEach((checkpoint, index) => {
    miniCtx.fillStyle = index === currentCheckpoint ? '#45ff7b' : '#94a3b8';
    miniCtx.beginPath();
    miniCtx.arc(checkpoint.x * sx, checkpoint.y * sy, index === currentCheckpoint ? 5 : 3, 0, Math.PI * 2);
    miniCtx.fill();
  });

  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  miniCtx.fillStyle = mode === 'driving' ? '#f87171' : '#60a5fa';
  miniCtx.beginPath();
  miniCtx.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2);
  miniCtx.fill();
}

function tick(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (input.justPressed('r') || input.justPressed(' ')) resetRace(true);
  updateModeSwitch();

  if (mode === 'driving' && activeVehicle) updateVehicle(activeVehicle, delta);
  if (mode === 'walking') updateWalker(delta);
  updateRace();
  updateCamera();

  if (raceStarted) {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = formatTime(elapsed);
  }

  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  speedEl.textContent = mode === 'driving' && activeVehicle ? Math.round(Math.abs(activeVehicle.speed) / 7.2) : 0;
  modeEl.textContent = mode === 'driving' && activeVehicle ? activeVehicle.name : 'On foot';
  const nearest = nearestRoad(target.x, target.y);
  areaEl.textContent = nearest.road?.name || 'Clarkston';

  drawScene();
  drawMiniMap();
  input.endFrame();
  requestAnimationFrame(tick);
}

async function boot() {
  resize();
  bestEl.textContent = formatTime(readBest());
  setLoading(10, 'Preparing Innes Driver...');
  statusEl.textContent = 'Loading current Clarkston map data...';
  try {
    setLoading(30, 'Loading Clarkston roads and buildings...');
    const data = await fetchOSM();
    setLoading(65, 'Drawing roads, shops and landmarks...');
    parseOSM(data);
  } catch (error) {
    console.warn(error);
    setLoading(65, 'Using backup Clarkston map...');
    buildFallbackMap();
  }
  setLoading(84, 'Placing vehicles...');
  createParkedVehicles();
  statusEl.textContent = map.source;
  setLoading(100, 'Ready');
  setTimeout(hideSplash, 300);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
boot();
