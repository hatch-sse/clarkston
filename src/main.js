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
  x: 420,
  y: 1240,
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

const roadSegments = [
  { x: 230, y: 760, w: 2140, h: 170, name: 'Busby Road' },
  { x: 880, y: 190, w: 170, h: 1350, name: 'Clarkston Road' },
  { x: 340, y: 1130, w: 1480, h: 150, name: 'High Street' },
  { x: 1560, y: 420, w: 150, h: 1050, name: 'Station Road' },
  { x: 500, y: 340, w: 910, h: 120, name: 'Mearns Road' },
  { x: 1750, y: 1030, w: 520, h: 120, name: 'Eastwoodmains' }
];

const checkpoints = [
  { x: 420, y: 1160, label: 'Start' },
  { x: 940, y: 840, label: 'Toll' },
  { x: 1640, y: 840, label: 'Station' },
  { x: 1680, y: 1130, label: 'Shops' },
  { x: 940, y: 1150, label: 'Finish' }
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

function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.x - padding && x <= rect.x + rect.w + padding && y >= rect.y - padding && y <= rect.y + rect.h + padding;
}

function isOnRoad(x, y) {
  return roadSegments.some(road => pointInRect(x, y, road, 28));
}

function addBuilding(x, y, w, h, label = '') {
  if (roadSegments.some(road => rectsOverlap({ x, y, w, h }, road))) return;
  buildings.push({ x, y, w, h, label, color: label ? '#cbb88d' : '#8c7460' });
}

function buildCity() {
  const shopNames = ['MORRISONS', 'GREGGS', 'PHARMACY', 'CAFE', 'BARBER', 'BANK', 'STATION', 'NEWS'];
  for (let i = 0; i < shopNames.length; i += 1) {
    addBuilding(560 + i * 180, 620, 116, 96, shopNames[i]);
    addBuilding(560 + i * 180, 940, 116, 96, shopNames[(i + 3) % shopNames.length]);
  }

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      addBuilding(145 + col * 210, 145 + row * 245, 86 + rand(row * 20 + col) * 38, 82, '');
      addBuilding(1850 + col * 90, 290 + row * 245, 58, 78, '');
    }
  }

  for (let i = 0; i < 90; i += 1) {
    const x = 80 + rand(i) * (world.width - 160);
    const y = 80 + rand(i + 100) * (world.height - 160);
    if (!isOnRoad(x, y)) props.push({ x, y, r: 10 + rand(i + 200) * 8, type: 'tree' });
  }

  traffic.push(
    { x: 620, y: 802, angle: 0, speed: 95, path: roadSegments[0], color: '#2d74b8' },
    { x: 1240, y: 887, angle: Math.PI, speed: 80, path: roadSegments[0], color: '#b83f2d' },
    { x: 956, y: 430, angle: Math.PI / 2, speed: 70, path: roadSegments[1], color: '#d1d5db' },
    { x: 1634, y: 1240, angle: -Math.PI / 2, speed: 78, path: roadSegments[3], color: '#1f2937' }
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

function resetRace(resetCar = false) {
  currentCheckpoint = 0;
  raceStarted = false;
  raceFinished = false;
  elapsed = 0;
  timerEl.textContent = formatTime(null);
  missionEl.textContent = 'Drive the 4x4 through the green start marker.';
  statusEl.textContent = 'Top-down sprint ready.';

  if (resetCar) {
    jeep.x = 420;
    jeep.y = 1240;
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
  const steer = input.axis('d', 'a') + input.axis('arrowright', 'arrowleft');
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
    car.x += Math.cos(car.angle) * car.speed * delta;
    car.y += Math.sin(car.angle) * car.speed * delta;

    if (!pointInRect(car.x, car.y, car.path, 16)) {
      car.angle += Math.PI;
      car.x = Math.max(car.path.x + 20, Math.min(car.x, car.path.x + car.path.w - 20));
      car.y = Math.max(car.path.y + 20, Math.min(car.y, car.path.y + car.path.h - 20));
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

  for (const road of roadSegments) {
    ctx.fillStyle = '#2e3338';
    ctx.fillRect(road.x, road.y, road.w, road.h);
    ctx.strokeStyle = '#d8bb38';
    ctx.lineWidth = 4;
    ctx.strokeRect(road.x + 12, road.y + 12, road.w - 24, road.h - 24);
    ctx.strokeStyle = '#e8e2ce';
    ctx.setLineDash([28, 28]);
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (road.w > road.h) {
      ctx.moveTo(road.x + 30, road.y + road.h / 2);
      ctx.lineTo(road.x + road.w - 30, road.y + road.h / 2);
    } else {
      ctx.moveTo(road.x + road.w / 2, road.y + 30);
      ctx.lineTo(road.x + road.w / 2, road.y + road.h - 30);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

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
  miniCtx.fillStyle = '#46515c';
  for (const road of roadSegments) {
    miniCtx.fillRect(road.x * sx, road.y * sy, road.w * sx, road.h * sy);
  }

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
