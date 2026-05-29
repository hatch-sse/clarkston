import { CLARKSTON_ROAD_ROWS } from './data/clarkstonRoads.js?v=20260529f';
import { Input } from './core/Input.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const minimap = document.querySelector('#minimap');
const mini = minimap?.getContext('2d');
const statusEl = document.querySelector('#status');
const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const timerEl = document.querySelector('#timer');
const bestEl = document.querySelector('#best');
const missionEl = document.querySelector('#mission');
const splashEl = document.querySelector('#splash');
const loadingTextEl = document.querySelector('#loading-text');
const loadingBarEl = document.querySelector('#loading-bar');
const input = new Input();

const world = { width: 5960, height: 4220 };
const camera = { x: 0, y: 0 };
const map = { roads: [], buildings: [], labels: [], junctions: [] };
const player = { x: 0, y: 0, angle: -Math.PI / 2, radius: 7 };
let vehicles = [];
let activeVehicle = null;
let mode = 'driving';
let lastTime = performance.now();
let checkpointIndex = 0;
let raceStarted = false;
let raceStart = 0;
let bestTime = Number(localStorage.getItem('innesDriverBest') || 0) || null;

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

function hideSplash() {
  splashEl?.classList.add('hidden');
  setTimeout(() => splashEl?.remove(), 420);
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function rand(seed) {
  const value = Math.sin(seed * 917.73) * 10000;
  return value - Math.floor(value);
}

function roadWidth(highway) {
  if (highway === 'primary') return 50;
  if (highway === 'secondary') return 44;
  if (highway === 'tertiary') return 38;
  if (highway === 'service') return 22;
  if (['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway)) return 5;
  return 30;
}

function boundsOf(points) {
  return {
    left: Math.min(...points.map(point => point.x)),
    right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)),
    bottom: Math.max(...points.map(point => point.y))
  };
}

function expand(bounds, amount) {
  return { left: bounds.left - amount, right: bounds.right + amount, top: bounds.top - amount, bottom: bounds.bottom + amount };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function addLabel(label, x, y) {
  if (!label || map.labels.some(item => item.label === label && Math.hypot(item.x - x, item.y - y) < 130)) return;
  map.labels.push({ label, x, y });
}

function parseRoads() {
  let id = 0;
  map.roads = CLARKSTON_ROAD_ROWS.split(';').map(row => {
    const [name = '', highway = '', pointText = ''] = row.split('|');
    const points = pointText.split(' ').map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!highway || points.length < 2) return null;
    const foot = ['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway);
    const main = ['primary', 'secondary', 'tertiary', 'trunk'].includes(highway);
    const road = { id: id++, name, highway, points, foot, main, width: roadWidth(highway), bounds: boundsOf(points) };
    if (name && main) addLabel(name, points[Math.floor(points.length / 2)].x, points[Math.floor(points.length / 2)].y);
    return road;
  }).filter(Boolean);
  buildJunctions();
}

function buildJunctions() {
  const endpoints = [];
  for (const road of map.roads.filter(road => !road.foot)) {
    endpoints.push({ ...road.points[0], width: road.width, name: road.name });
    endpoints.push({ ...road.points[road.points.length - 1], width: road.width, name: road.name });
  }
  const clusters = [];
  for (const point of endpoints) {
    let cluster = clusters.find(item => Math.hypot(item.x - point.x, item.y - point.y) < 46);
    if (!cluster) {
      cluster = { x: point.x, y: point.y, count: 0, width: 0, toll: false };
      clusters.push(cluster);
    }
    cluster.x = (cluster.x * cluster.count + point.x) / (cluster.count + 1);
    cluster.y = (cluster.y * cluster.count + point.y) / (cluster.count + 1);
    cluster.count += 1;
    cluster.width = Math.max(cluster.width, point.width);
    cluster.toll = cluster.toll || /roundabout|toll/i.test(point.name || '');
  }
  map.junctions = clusters
    .filter(cluster => cluster.count >= 3 || cluster.toll)
    .map(cluster => ({ ...cluster, radius: Math.min(46, Math.max(22, cluster.width * 0.58 + cluster.count * 2)) }));
}

function orientedRect(cx, cy, angle, width, depth) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const hw = width / 2;
  const hd = depth / 2;
  return [
    { x: cx - dx * hw - nx * hd, y: cy - dy * hw - ny * hd },
    { x: cx + dx * hw - nx * hd, y: cy + dy * hw - ny * hd },
    { x: cx + dx * hw + nx * hd, y: cy + dy * hw + ny * hd },
    { x: cx - dx * hw + nx * hd, y: cy - dy * hw + ny * hd }
  ];
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function nearestRoad(x, y, roads = map.roads.filter(road => !road.foot)) {
  let best = { road: null, distance: Infinity, segment: 0 };
  for (const road of roads) {
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const distance = distanceToSegment(x, y, road.points[i], road.points[i + 1]);
      if (distance < best.distance) best = { road, distance, segment: i };
    }
  }
  return best;
}

function isOnRoad(x, y, padding = 16) {
  const nearest = nearestRoad(x, y);
  return Boolean(nearest.road && nearest.distance <= nearest.road.width / 2 + padding);
}

function makeBuildings() {
  const taken = [];
  map.buildings = [];
  const roads = map.roads.filter(road => !road.foot && road.highway !== 'trunk');
  for (let r = 0; r < roads.length && map.buildings.length < 2600; r += 1) {
    const road = roads[r];
    for (let i = 0; i < road.points.length - 1 && map.buildings.length < 2600; i += 1) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 54) continue;
      const ux = (b.x - a.x) / length;
      const uy = (b.y - a.y) / length;
      const nx = -uy;
      const ny = ux;
      const angle = Math.atan2(uy, ux);
      const step = road.main ? 88 : road.width > 28 ? 58 : 50;
      for (let d = 34; d < length - 28 && map.buildings.length < 2600; d += step) {
        for (const side of [-1, 1]) {
          if (map.buildings.length >= 2600) break;
          const seed = r * 997 + i * 43 + Math.round(d) + side * 23;
          const width = 17 + rand(seed) * (road.main ? 22 : 16);
          const depth = 15 + rand(seed + 5) * (road.main ? 18 : 15);
          const setback = road.width / 2 + depth / 2 + (road.main ? 30 : 16) + rand(seed + 9) * 11;
          const cx = a.x + ux * d + nx * side * setback;
          const cy = a.y + uy * d + ny * side * setback;
          if (nearJunction(cx, cy, 54)) continue;
          if (isOnRoad(cx, cy, 24)) continue;
          const points = orientedRect(cx, cy, angle, width, depth);
          const bounds = boundsOf(points);
          if (bounds.left < 20 || bounds.top < 20 || bounds.right > world.width - 20 || bounds.bottom > world.height - 20) continue;
          if (taken.some(item => rectsOverlap(expand(bounds, 7), item))) continue;
          taken.push(bounds);
          map.buildings.push({ points, bounds, color: rand(seed + 20) > 0.86 ? '#bda56f' : '#8e7963' });
        }
      }
    }
  }
}

function nearJunction(x, y, padding = 0) {
  return map.junctions.some(junction => Math.hypot(x - junction.x, y - junction.y) < junction.radius + padding);
}

function closestPoint(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return { x: a.x, y: a.y, angle: 0 };
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return { x: a.x + t * dx, y: a.y + t * dy, angle: Math.atan2(dy, dx) };
}

function snapToRoad(x, y) {
  const nearest = nearestRoad(x, y);
  if (!nearest.road) return { x, y, angle: -Math.PI / 2 };
  const a = nearest.road.points[nearest.segment];
  const b = nearest.road.points[nearest.segment + 1];
  const centre = closestPoint(x, y, a, b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / length, y: -dx / length };
  const offset = Math.min(nearest.road.width * 0.23, 11);
  return { x: centre.x + normal.x * offset, y: centre.y + normal.y * offset, angle: centre.angle };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function collidesWithBuilding(x, y) {
  return map.buildings.some(building => pointInPolygon({ x, y }, building.points));
}

function createVehicle(x, y, angle, color, name, playerOwned = false) {
  return { x, y, angle, color, name, playerOwned, speed: 0, width: playerOwned ? 16 : 15, length: playerOwned ? 27 : 24, maxSpeed: playerOwned ? 540 : 420 };
}

function placeVehicles() {
  vehicles = [];
  const start = snapToRoad(2400, 2140);
  vehicles.push(createVehicle(start.x, start.y, start.angle, '#3f8a43', '4x4 Jeep', true));
  let made = 0;
  for (const road of map.roads.filter(road => !road.foot && road.width >= 30)) {
    for (let i = 0; i < road.points.length - 1 && made < 48; i += 1) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 160) continue;
      const ux = (b.x - a.x) / length;
      const uy = (b.y - a.y) / length;
      const normal = { x: -uy, y: ux };
      const angle = Math.atan2(uy, ux);
      for (let d = 75; d < length - 50 && made < 48; d += 240) {
        const x = a.x + ux * d + normal.x * road.width * 0.28;
        const y = a.y + uy * d + normal.y * road.width * 0.28;
        if (collidesWithBuilding(x, y) || nearJunction(x, y, 26)) continue;
        vehicles.push(createVehicle(x, y, angle, made % 4 ? '#8f432f' : '#2d72bb', made % 4 ? 'Parked Car' : 'Estate Car'));
        made += 1;
      }
    }
  }
  activeVehicle = vehicles[0];
}

function updateVehicle(vehicle, delta) {
  const throttle = input.down('w', 'arrowup');
  const brake = input.down('s', 'arrowdown');
  const steer = input.axis('a', 'd') + input.axis('arrowleft', 'arrowright');
  const boost = input.down('shift');
  if (throttle) vehicle.speed += 430 * (boost ? 1.35 : 1) * delta;
  if (brake) vehicle.speed -= 540 * delta;
  if (!throttle && !brake) vehicle.speed *= Math.pow(0.965, delta * 60);
  vehicle.speed = Math.max(-190, Math.min(vehicle.speed, vehicle.maxSpeed * (boost ? 1.15 : 1)));
  vehicle.angle += steer * 2.75 * Math.min(1, Math.abs(vehicle.speed) / 155) * Math.sign(vehicle.speed || 1) * delta;
  const nextX = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * delta;
  const nextY = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * delta;
  if (!isOnRoad(nextX, nextY, 30) || collidesWithBuilding(nextX, nextY)) {
    vehicle.speed *= -0.22;
    return;
  }
  vehicle.x = nextX;
  vehicle.y = nextY;
}

function updateWalker(delta) {
  const xAxis = input.axis('a', 'd') + input.axis('arrowleft', 'arrowright');
  const yAxis = input.axis('w', 's') + input.axis('arrowup', 'arrowdown');
  const length = Math.hypot(xAxis, yAxis);
  if (!length) return;
  const speed = input.down('shift') ? 210 : 125;
  const dx = (xAxis / length) * speed * delta;
  const dy = (yAxis / length) * speed * delta;
  const x = player.x + dx;
  const y = player.y + dy;
  player.angle = Math.atan2(dy, dx);
  if (!collidesWithBuilding(x, y)) {
    player.x = Math.max(20, Math.min(world.width - 20, x));
    player.y = Math.max(20, Math.min(world.height - 20, y));
  }
}

function updateModeSwitch() {
  if (!input.justPressed('e')) return;
  if (mode === 'driving' && activeVehicle) {
    activeVehicle.speed = 0;
    player.x = activeVehicle.x - Math.sin(activeVehicle.angle) * 34;
    player.y = activeVehicle.y + Math.cos(activeVehicle.angle) * 34;
    player.angle = activeVehicle.angle;
    activeVehicle = null;
    mode = 'walking';
    missionEl.textContent = 'On foot. Walk to a parked car and press E.';
    return;
  }
  let nearest = null;
  let best = Infinity;
  for (const vehicle of vehicles) {
    const distance = Math.hypot(player.x - vehicle.x, player.y - vehicle.y);
    if (distance < best) {
      best = distance;
      nearest = vehicle;
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

function updateRace() {
  if (mode !== 'driving' || !activeVehicle) return;
  const checkpoint = checkpoints[checkpointIndex];
  if (Math.hypot(activeVehicle.x - checkpoint.x, activeVehicle.y - checkpoint.y) > 70) return;
  if (checkpointIndex === 0) {
    raceStarted = true;
    raceStart = performance.now();
  }
  checkpointIndex += 1;
  if (checkpointIndex >= checkpoints.length) {
    const time = (performance.now() - raceStart) / 1000;
    raceStarted = false;
    timerEl.textContent = `${time.toFixed(2)}s`;
    if (!bestTime || time < bestTime) {
      bestTime = time;
      localStorage.setItem('innesDriverBest', String(time));
      bestEl.textContent = `${time.toFixed(2)}s`;
    }
    checkpointIndex = 0;
    missionEl.textContent = 'Finished. Press Space to restart.';
  } else {
    missionEl.textContent = `Next marker: ${checkpoints[checkpointIndex].label}`;
  }
}

function updateCamera() {
  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  camera.x += (target.x - window.innerWidth / 2 - camera.x) * 0.15;
  camera.y += (target.y - window.innerHeight / 2 - camera.y) * 0.15;
  camera.x = Math.max(0, Math.min(world.width - window.innerWidth, camera.x));
  camera.y = Math.max(0, Math.min(world.height - window.innerHeight, camera.y));
}

function visible(bounds, pad = 90) {
  return bounds.right > camera.x - pad && bounds.left < camera.x + window.innerWidth + pad && bounds.bottom > camera.y - pad && bounds.top < camera.y + window.innerHeight + pad;
}

function drawPolyline(points, color, width, dashed = false, dash = []) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.restore();
}

function drawRoadMarkings(road) {
  if (road.width < 38 || /roundabout|toll/i.test(road.name || '')) return;
  ctx.save();
  ctx.strokeStyle = '#f3f0e8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([20, 34]);
  for (let i = 0; i < road.points.length - 1; i += 1) {
    const a = road.points[i];
    const b = road.points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 125) continue;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    const start = { x: a.x + ux * 42, y: a.y + uy * 42 };
    const end = { x: b.x - ux * 42, y: b.y - uy * 42 };
    if (nearJunction(start.x, start.y, 12) || nearJunction(end.x, end.y, 12)) continue;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJunctionIslands() {
  for (const junction of map.junctions) {
    if (!visible({ left: junction.x - junction.radius, right: junction.x + junction.radius, top: junction.y - junction.radius, bottom: junction.y + junction.radius }, 120)) continue;
    ctx.fillStyle = '#687f5c';
    ctx.strokeStyle = '#d8d2b8';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(junction.x, junction.y, junction.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawMap() {
  ctx.fillStyle = '#687f5c';
  ctx.fillRect(0, 0, world.width, world.height);
  for (let i = 0; i < 44; i += 1) {
    ctx.fillStyle = i % 2 ? '#708a63' : '#617a57';
    ctx.beginPath();
    ctx.arc(80 + rand(i) * (world.width - 160), 80 + rand(i + 80) * (world.height - 160), 18 + rand(i + 22) * 44, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const building of map.buildings) {
    if (!visible(building.bounds)) continue;
    ctx.save();
    ctx.translate(5, 6);
    ctx.fillStyle = '#3e3732';
    drawPolygon(building.points);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = building.color;
    drawPolygon(building.points);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18, 23, 28, .42)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const road of map.roads.filter(road => road.foot)) if (visible(road.bounds)) drawPolyline(road.points, 'rgba(225,219,196,.18)', 2);
  const roads = map.roads.filter(road => !road.foot);
  for (const road of roads) if (visible(road.bounds, 140)) drawPolyline(road.points, '#d8d2b8', road.width + 10);
  for (const road of roads) if (visible(road.bounds, 140)) drawPolyline(road.points, '#222b37', road.width);
  drawJunctionIslands();
  for (const road of roads) if (visible(road.bounds, 140)) drawRoadMarkings(road);
  drawLabels();
}

function drawPolygon(points) {
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
}

function drawLabels() {
  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const labels = map.labels
    .filter(item => item.x > camera.x - 40 && item.x < camera.x + window.innerWidth + 40 && item.y > camera.y - 40 && item.y < camera.y + window.innerHeight + 40)
    .map(item => ({ ...item, distance: Math.hypot(item.x - target.x, item.y - target.y) }))
    .filter(item => item.distance < 430)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  for (const item of labels) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const width = Math.min(110, ctx.measureText(item.label).width + 8);
    ctx.fillStyle = 'rgba(246,248,250,.68)';
    ctx.fillRect(item.x - width / 2, item.y - 15, width, 12);
    ctx.fillStyle = '#172033';
    ctx.fillText(item.label, item.x, item.y - 6, width - 6);
  }
}

function drawCheckpoint(point, index) {
  const active = index === checkpointIndex;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = active ? '#69ff7e' : '#a9bad3';
  ctx.fillStyle = active ? 'rgba(105,255,126,.18)' : 'rgba(169,186,211,.1)';
  ctx.lineWidth = active ? 7 : 4;
  ctx.beginPath();
  ctx.arc(0, 0, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(index + 1), 0, 6);
  ctx.restore();
}

function drawVehicle(vehicle, active) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-vehicle.width / 2 - 2, -vehicle.length / 2 + 4, vehicle.width + 4, vehicle.length + 3);
  ctx.fillStyle = vehicle.color;
  ctx.fillRect(-vehicle.width / 2, -vehicle.length / 2, vehicle.width, vehicle.length);
  ctx.fillStyle = vehicle.playerOwned ? '#1f3d2d' : '#111827';
  ctx.fillRect(-vehicle.width * .34, -vehicle.length * .22, vehicle.width * .68, vehicle.length * .34);
  ctx.fillStyle = '#a8bacb';
  ctx.fillRect(-vehicle.width * .31, -vehicle.length * .43, vehicle.width * .62, vehicle.length * .16);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-vehicle.width / 2 - 2, -vehicle.length * .35, 4, 7);
  ctx.fillRect(vehicle.width / 2 - 2, -vehicle.length * .35, 4, 7);
  ctx.fillRect(-vehicle.width / 2 - 2, vehicle.length * .18, 4, 7);
  ctx.fillRect(vehicle.width / 2 - 2, vehicle.length * .18, 4, 7);
  if (vehicle.playerOwned) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-vehicle.width * .42, vehicle.length * .35, vehicle.width * .84, 5);
  }
  if (active) {
    ctx.strokeStyle = '#45ff7b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-vehicle.width / 2 - 4, -vehicle.length / 2 - 4, vehicle.width + 8, vehicle.length + 8);
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.arc(3, 4, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMiniMap() {
  if (!mini) return;
  mini.clearRect(0, 0, minimap.width, minimap.height);
  mini.fillStyle = '#101820';
  mini.fillRect(0, 0, minimap.width, minimap.height);
  const sx = minimap.width / world.width;
  const sy = minimap.height / world.height;
  mini.strokeStyle = '#46515c';
  mini.lineCap = 'round';
  for (const road of map.roads.filter(road => !road.foot)) {
    mini.lineWidth = Math.max(1, road.width * sx);
    mini.beginPath();
    road.points.forEach((point, index) => index ? mini.lineTo(point.x * sx, point.y * sy) : mini.moveTo(point.x * sx, point.y * sy));
    mini.stroke();
  }
  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  mini.fillStyle = '#45ff7b';
  mini.beginPath();
  mini.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2);
  mini.fill();
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

function resetRace() {
  checkpointIndex = 0;
  raceStarted = false;
  missionEl.textContent = 'Drive through the green marker. Press E to get out or enter nearby cars.';
}

function tick(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  if (input.justPressed('r') || input.justPressed(' ')) resetRace();
  updateModeSwitch();
  if (mode === 'driving' && activeVehicle) updateVehicle(activeVehicle, delta);
  if (mode === 'walking') updateWalker(delta);
  updateRace();
  updateCamera();
  if (raceStarted) timerEl.textContent = `${((performance.now() - raceStart) / 1000).toFixed(2)}s`;
  const target = mode === 'driving' && activeVehicle ? activeVehicle : player;
  const nearest = nearestRoad(target.x, target.y);
  areaEl.textContent = nearest.road?.name || 'Clarkston';
  speedEl.textContent = mode === 'driving' && activeVehicle ? Math.round(Math.abs(activeVehicle.speed) / 7.2) : 0;
  modeEl.textContent = mode === 'driving' && activeVehicle ? activeVehicle.name : 'On foot';
  drawScene();
  drawMiniMap();
  input.endFrame();
  requestAnimationFrame(tick);
}

function boot() {
  resize();
  setLoading(18, 'Reading bundled Clarkston streets...');
  parseRoads();
  setLoading(52, 'Adding houses and parked cars...');
  makeBuildings();
  placeVehicles();
  bestEl.textContent = bestTime ? `${bestTime.toFixed(2)}s` : '--.--';
  statusEl.textContent = `${map.roads.length} roads and ${map.buildings.length} buildings loaded from the bundled Clarkston map`;
  setLoading(100, 'Ready');
  setTimeout(hideSplash, 250);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
boot();
