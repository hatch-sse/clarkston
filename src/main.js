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

const input = new Input();
const world = { width: 2600, height: 1800 };
const camera = { x: 0, y: 0 };
const keys = {
  best: 'clarkstonTopDownBest'
};

const jeep = {
  x: 1300,
  y: 1180,
  angle: -Math.PI / 2,
  speed: 0,
  width: 42,
  length: 68,
  maxSpeed: 540,
  reverseSpeed: -210,
  acceleration: 420,
  brakePower: 520,
  drag: 0.965,
  turnRate: 2.7
};

const toll = { x: 1300, y: 900, radius: 88 };
const roadPaths = [
  { name: 'Busby Road', width: 118, main: true, points: [{ x: 1220, y: 80 }, { x: 1260, y: 440 }, { x: 1300, y: 900 }, { x: 1290, y: 1280 }, { x: 1340, y: 1720 }] },
  { name: 'Clarkston Road', width: 96, main: true, points: [{ x: 1300, y: 900 }, { x: 1080, y: 720 }, { x: 840, y: 520 }, { x: 580, y: 320 }, { x: 320, y: 140 }] },
  { name: 'Mearns Road', width: 92, main: true, points: [{ x: 1300, y: 900 }, { x: 1120, y: 1040 }, { x: 900, y: 1180 }, { x: 650, y: 1330 }, { x: 360, y: 1500 }] },
  { name: 'Eastwoodmains Road', width: 96, main: true, points: [{ x: 1300, y: 900 }, { x: 1540, y: 880 }, { x: 1840, y: 830 }, { x: 2160, y: 760 }, { x: 2480, y: 700 }] },
  { name: 'Eaglesham Road', width: 88, main: true, points: [{ x: 1300, y: 900 }, { x: 1480, y: 1080 }, { x: 1660, y: 1300 }, { x: 1900, y: 1600 }] },
  { name: 'Sheddens Road', width: 76, points: [{ x: 1300, y: 900 }, { x: 1100, y: 860 }, { x: 820, y: 830 }, { x: 540, y: 780 }] },
  { name: 'Station Road', width: 72, points: [{ x: 1500, y: 885 }, { x: 1570, y: 690 }, { x: 1650, y: 500 }] },
  { name: 'Seres Road', width: 64, points: [{ x: 1260, y: 540 }, { x: 1060, y: 460 }, { x: 820, y: 420 }] }
];

const checkpoints = [
  { x: 1300, y: 1040, label: 'Start' },
  { x: 1300, y: 900, label: 'Clarkston Toll' },
  { x: 1645, y: 520, label: 'Station' },
  { x: 1840, y: 830, label: 'Eastwoodmains' },
  { x: 1120, y: 1040, label: 'Mearns Road' }
];

const buildings = [];
const props = [];
const traffic = [];
let currentCheckpoint = 0;
let raceStarted = false;
let raceFinished = false;
let startTime = 0;
let elapsed = 0;
let lastTime = performance.now();

function rand(seed) {
  const value = Math.sin(seed * 999.91) * 10000;
  return value - Math.floor(value);
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(px - x, py - y);
}

function nearestRoad(x, y) {
  let best = { road: null, distance: Infinity };
  for (const road of roadPaths) {
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const distance = distanceToSegment(x, y, road.points[i], road.points[i + 1]);
      if (distance < best.distance) best = { road, distance };
    }
  }
  const tollDistance = Math.hypot(x - toll.x, y - toll.y);
  if (tollDistance < best.distance) best = { road: { name: 'Clarkston Toll', width: toll.radius * 2 }, distance: tollDistance };
  return best;
}

function isOnRoad(x, y) {
  const closest = nearestRoad(x, y);
  return closest.road && closest.distance <= closest.road.width / 2 + 18;
}

function rectNearRoad(rect, padding = 32) {
  const samples = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  ];
  return samples.some(point => {
    const closest = nearestRoad(point.x, point.y);
    return closest.road && closest.distance <= closest.road.width / 2 + padding;
  });
}

function addBuilding(x, y, w, h, label = '') {
  if (rectNearRoad({ x, y, w, h })) return;
  buildings.push({ x, y, w, h, label, color: label ? '#cbb88d' : '#8c7460' });
}

function buildCity() {
  [
    [1125, 770, 118, 82, 'MORRISONS'],
    [1410, 785, 98, 72, 'GREGGS'],
    [1135, 930, 96, 72, 'PHARMACY'],
    [1395, 965, 96, 72, 'CAFE'],
    [1220, 690, 82, 72, 'BANK'],
    [1510, 610, 112, 84, 'STATION'],
    [980, 930, 90, 74, 'BARBER'],
    [1505, 930, 96, 74, 'NEWS'],
    [1010, 1115, 104, 76, 'SHOPS'],
    [1650, 730, 120, 82, 'OPTICIAN']
  ].forEach(([x, y, w, h, label]) => buildings.push({ x, y, w, h, label, color: '#cbb88d' }));

  [
    [1080, 250], [930, 365], [730, 470], [520, 590],
    [520, 1250], [700, 1410], [950, 1320], [1100, 1245],
    [1520, 1110], [1660, 1200], [1810, 1370], [1980, 1480],
    [1760, 620], [1940, 690], [2140, 600], [2320, 560],
    [1040, 570], [880, 640], [700, 720], [560, 900]
  ].forEach(([x, y], index) => addBuilding(x, y, 86 + rand(index) * 40, 72 + rand(index + 20) * 32, ''));

  for (let i = 0; i < 90; i += 1) {
    const x = 80 + rand(i) * (world.width - 160);
    const y = 80 + rand(i + 100) * (world.height - 160);
    if (!isOnRoad(x, y)) props.push({ x, y, r: 10 + rand(i + 200) * 8, type: 'tree' });
  }

  traffic.push(
    makeTrafficCar(roadPaths[0], 1, 90, '#2d74b8'),
    makeTrafficCar(roadPaths[1], -1, 78, '#b83f2d'),
    makeTrafficCar(roadPaths[3], 1, 82, '#d1d5db'),
    makeTrafficCar(roadPaths[4], -1, 74, '#1f2937')
  );
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

function makeTrafficCar(road, direction, speed, color) {
  const segmentIndex = direction > 0 ? 0 : road.points.length - 1;
  const point = road.points[segmentIndex];
  return { x: point.x, y: point.y, angle: 0, speed, road, direction, segmentIndex, color };
}

function resetRace(resetCar = false) {
  currentCheckpoint = 0;
  raceStarted = false;
  raceFinished = false;
  elapsed = 0;
  timerEl.textContent = formatTime(null);
  missionEl.textContent = 'Drive the 4x4 through the green start marker.';
  statusEl.textContent = 'Top-down sprint ready.';

  if (resetCar) {
    jeep.x = 1300;
    jeep.y = 1180;
    jeep.angle = -Math.PI / 2;
    jeep.speed = 0;
  }
}

function getJeepBounds(x = jeep.x, y = jeep.y) {
  return {
    x: x - jeep.width * 0.45,
    y: y - jeep.length * 0.45,
    w: jeep.width * 0.9,
    h: jeep.length * 0.9
  };
}

function collidesWithWorld(x, y) {
  const bounds = getJeepBounds(x, y);
  if (x < 40 || y < 40 || x > world.width - 40 || y > world.height - 40) return true;
  if (!isOnRoad(x, y)) return true;
  return buildings.some(building => rectsOverlap(bounds, building));
}

function updateJeep(delta) {
  const throttle = input.down('w', 'arrowup');
  const brake = input.down('s', 'arrowdown');
  const steer = input.axis('a', 'd') + input.axis('arrowleft', 'arrowright');
  const boost = input.down('shift');

  if (throttle) jeep.speed += jeep.acceleration * (boost ? 1.35 : 1) * delta;
  if (brake) jeep.speed -= jeep.brakePower * delta;
  if (!throttle && !brake) jeep.speed *= Math.pow(jeep.drag, delta * 60);

  jeep.speed = Math.max(jeep.reverseSpeed, Math.min(jeep.speed, boost ? jeep.maxSpeed * 1.2 : jeep.maxSpeed));

  const turnStrength = Math.min(1, Math.abs(jeep.speed) / 180);
  jeep.angle += steer * jeep.turnRate * turnStrength * Math.sign(jeep.speed || 1) * delta;

  const nextX = jeep.x + Math.cos(jeep.angle) * jeep.speed * delta;
  const nextY = jeep.y + Math.sin(jeep.angle) * jeep.speed * delta;

  if (collidesWithWorld(nextX, nextY)) {
    jeep.speed *= -0.28;
    return;
  }

  jeep.x = nextX;
  jeep.y = nextY;
}

function updateTraffic(delta) {
  for (const car of traffic) {
    const targetIndex = car.segmentIndex + car.direction;
    const target = car.road.points[targetIndex];
    if (!target) {
      car.direction *= -1;
      car.segmentIndex += car.direction;
      continue;
    }

    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const distance = Math.hypot(dx, dy);
    car.angle = Math.atan2(dy, dx);

    if (distance < 8) {
      car.segmentIndex = targetIndex;
    } else {
      const step = Math.min(distance, car.speed * delta);
      car.x += (dx / distance) * step;
      car.y += (dy / distance) * step;
    }

    if (Math.hypot(car.x - jeep.x, car.y - jeep.y) < 48) {
      jeep.speed *= -0.35;
    }
  }
}

function updateRace() {
  if (raceFinished) return;

  const checkpoint = checkpoints[currentCheckpoint];
  const distance = Math.hypot(jeep.x - checkpoint.x, jeep.y - checkpoint.y);
  if (distance > 58) return;

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
    missionEl.textContent = newBest ? 'New best time. Space to restart.' : 'Finished. Space to restart.';
    statusEl.textContent = `Finished in ${formatTime(elapsed)}.`;
    return;
  }

  missionEl.textContent = `Next marker: ${checkpoints[currentCheckpoint].label}`;
}

function updateCamera() {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  camera.x += (jeep.x - viewW / 2 - camera.x) * 0.14;
  camera.y += (jeep.y - viewH / 2 - camera.y) * 0.14;
  camera.x = Math.max(0, Math.min(camera.x, world.width - viewW));
  camera.y = Math.max(0, Math.min(camera.y, world.height - viewH));
}

function drawWorld() {
  ctx.fillStyle = '#5f8f62';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = '#4d7c55';
  for (let i = 0; i < 45; i += 1) {
    ctx.beginPath();
    ctx.arc(70 + rand(i) * world.width, 60 + rand(i + 50) * world.height, 35 + rand(i + 80) * 70, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#1d2126';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(1730, 80);
  ctx.bezierCurveTo(1760, 520, 1690, 970, 1760, 1720);
  ctx.stroke();
  ctx.strokeStyle = '#bfc4ca';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1714, 80);
  ctx.bezierCurveTo(1744, 520, 1674, 970, 1744, 1720);
  ctx.moveTo(1746, 80);
  ctx.bezierCurveTo(1776, 520, 1706, 970, 1776, 1720);
  ctx.stroke();

  for (const road of roadPaths) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#b8b4a9';
    ctx.lineWidth = road.width + 26;
    ctx.beginPath();
    road.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.strokeStyle = road.main ? '#292f35' : '#343a40';
    ctx.lineWidth = road.width;
    ctx.beginPath();
    road.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.strokeStyle = road.main ? '#e8e2ce' : '#aeb6bf';
    ctx.setLineDash(road.main ? [28, 30] : [18, 26]);
    ctx.lineWidth = road.main ? 5 : 3;
    ctx.beginPath();
    road.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';

  ctx.fillStyle = '#292f35';
  ctx.beginPath();
  ctx.arc(toll.x, toll.y, toll.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8e2ce';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(toll.x, toll.y, toll.radius - 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#3f7c4d';
  ctx.beginPath();
  ctx.arc(toll.x, toll.y, 34, 0, Math.PI * 2);
  ctx.fill();

  for (const building of buildings) {
    ctx.fillStyle = '#443b35';
    ctx.fillRect(building.x + 8, building.y + 8, building.w, building.h);
    ctx.fillStyle = building.color;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.fillStyle = '#2b3440';
    ctx.fillRect(building.x + 10, building.y + 12, building.w - 20, 10);
    if (building.label) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(building.x + 8, building.y + building.h - 28, building.w - 16, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(building.label, building.x + building.w / 2, building.y + building.h - 13);
    }
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Clarkston Toll', toll.x, toll.y - 118);
  ctx.font = 'bold 18px system-ui, sans-serif';
  for (const road of roadPaths.filter(path => path.main)) {
    const point = road.points[Math.floor(road.points.length / 2)];
    ctx.fillText(road.name, point.x, point.y - 18);
  }

  for (const prop of props) {
    ctx.fillStyle = '#315f32';
    ctx.beginPath();
    ctx.arc(prop.x + 4, prop.y + 5, prop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3924';
    ctx.fillRect(prop.x - 3, prop.y - 3, 6, 8);
    ctx.fillStyle = '#2f8a42';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCheckpoint(checkpoint, index) {
  const active = index === currentCheckpoint;
  const cleared = index < currentCheckpoint;
  ctx.save();
  ctx.translate(checkpoint.x, checkpoint.y);
  ctx.strokeStyle = active ? '#45ff7b' : cleared ? '#7c8795' : '#334155';
  ctx.fillStyle = active ? 'rgba(69, 255, 123, 0.18)' : 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = active ? 7 : 4;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? '#f8fafc' : '#cbd5e1';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${index + 1}`, 0, 6);
  ctx.restore();
}

function drawVehicle(x, y, angle, color, scale = 1, isJeep = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(-23, -31, 46, 70);

  ctx.fillStyle = color;
  ctx.fillRect(-21, -34, 42, 68);
  ctx.fillStyle = isJeep ? '#1f3d2d' : '#111827';
  ctx.fillRect(-15, -18, 30, 26);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-13, -31, 26, 11);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-27, -27, 8, 16);
  ctx.fillRect(19, -27, 8, 16);
  ctx.fillRect(-27, 13, 8, 16);
  ctx.fillRect(19, 13, 8, 16);

  if (isJeep) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-18, 25, 36, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, 34, 20, 10);
  }

  ctx.restore();
}

function drawScene() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawWorld();
  checkpoints.forEach(drawCheckpoint);
  for (const car of traffic) drawVehicle(car.x, car.y, car.angle, car.color, 0.72);
  drawVehicle(jeep.x, jeep.y, jeep.angle, '#3f7f3f', 1, true);

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
  for (const road of roadPaths) {
    miniCtx.strokeStyle = '#46515c';
    miniCtx.lineWidth = Math.max(3, road.width * sx);
    miniCtx.lineCap = 'round';
    miniCtx.lineJoin = 'round';
    miniCtx.beginPath();
    road.points.forEach((point, index) => {
      if (index === 0) miniCtx.moveTo(point.x * sx, point.y * sy);
      else miniCtx.lineTo(point.x * sx, point.y * sy);
    });
    miniCtx.stroke();
  }

  miniCtx.fillStyle = '#53606b';
  miniCtx.beginPath();
  miniCtx.arc(toll.x * sx, toll.y * sy, toll.radius * sx, 0, Math.PI * 2);
  miniCtx.fill();

  checkpoints.forEach((checkpoint, index) => {
    miniCtx.fillStyle = index === currentCheckpoint ? '#45ff7b' : '#94a3b8';
    miniCtx.beginPath();
    miniCtx.arc(checkpoint.x * sx, checkpoint.y * sy, index === currentCheckpoint ? 5 : 3, 0, Math.PI * 2);
    miniCtx.fill();
  });

  miniCtx.fillStyle = '#f87171';
  miniCtx.beginPath();
  miniCtx.arc(jeep.x * sx, jeep.y * sy, 5, 0, Math.PI * 2);
  miniCtx.fill();
}

function tick(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (input.justPressed('r')) resetRace(true);
  if (input.justPressed(' ')) resetRace(true);

  updateJeep(delta);
  updateTraffic(delta);
  updateRace();
  updateCamera();

  if (raceStarted) {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = formatTime(elapsed);
  }

  speedEl.textContent = Math.round(Math.abs(jeep.speed) / 7.2);
  modeEl.textContent = '4x4 Jeep';
  areaEl.textContent = isOnRoad(jeep.x, jeep.y) ? 'Clarkston Streets' : 'Off road';

  drawScene();
  drawMiniMap();
  input.endFrame();
  requestAnimationFrame(tick);
}

buildCity();
resize();
bestEl.textContent = formatTime(readBest());
resetRace(true);
window.addEventListener('resize', resize);
requestAnimationFrame(tick);
