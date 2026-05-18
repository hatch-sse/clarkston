import * as THREE from 'three';

const canvas = document.querySelector('#game');
const statusEl = document.querySelector('#status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd8ec);
scene.fog = new THREE.Fog(0xbfd8ec, 450, 1500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 3500);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(260, 420, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -800;
sun.shadow.camera.right = 800;
sun.shadow.camera.top = 800;
sun.shadow.camera.bottom = -800;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x53664f, 1.8));

const world = new THREE.Group();
scene.add(world);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x6f9b62, roughness: 1 }),
  park: new THREE.MeshStandardMaterial({ color: 0x7fb66c, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x30363b, roughness: 0.95 }),
  mainRoad: new THREE.MeshStandardMaterial({ color: 0x252a2f, roughness: 0.95 }),
  pavement: new THREE.MeshStandardMaterial({ color: 0xa7a7a0, roughness: 1 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: 0.8 }),
  building: new THREE.MeshStandardMaterial({ color: 0xc0b69f, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x827a6b, roughness: 1 }),
  shop: new THREE.MeshStandardMaterial({ color: 0xd7c7aa, roughness: 0.8 }),
  player: new THREE.MeshStandardMaterial({ color: 0x2559ff, roughness: 0.6 }),
  car: new THREE.MeshStandardMaterial({ color: 0xcc2626, roughness: 0.45 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6c4524, roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x2f7d3d, roughness: 1 })
};

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), materials.grass);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

const origin = { lat: 55.7899, lon: -4.2757 };
const scale = 111320;
function project(lat, lon) {
  const x = (lon - origin.lon) * scale * Math.cos(origin.lat * Math.PI / 180);
  const z = -(lat - origin.lat) * scale;
  return new THREE.Vector2(x, z);
}

function addLabel(text, x, z) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#202020';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.position.set(x, 32, z);
  sprite.scale.set(58, 14, 1);
  world.add(sprite);
}

function segment(a, b, width, height, material, y = 0.05) {
  const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  if (len < 0.2) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, len), material);
  mesh.position.set(mid.x, y, mid.y);
  mesh.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  world.add(mesh);
}

function addRoad(points, tags) {
  const highway = tags.highway || '';
  const main = ['primary', 'secondary', 'tertiary', 'trunk'].includes(highway);
  const residential = ['residential', 'unclassified', 'service', 'living_street'].includes(highway);
  const foot = ['footway', 'path', 'cycleway', 'pedestrian'].includes(highway);
  const width = main ? 11 : residential ? 7 : foot ? 2.2 : 5;
  const mat = main ? materials.mainRoad : materials.road;
  for (let i = 0; i < points.length - 1; i++) {
    if (!foot) segment(points[i], points[i + 1], width + 4, 0.04, materials.pavement, 0.04);
    segment(points[i], points[i + 1], width, 0.08, foot ? materials.pavement : mat, 0.08);
  }
}

function addRail(points) {
  for (let i = 0; i < points.length - 1; i++) {
    segment(points[i], points[i + 1], 3.2, 0.08, materials.rail, 0.09);
  }
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return shape;
}

function addBuilding(points, tags) {
  if (points.length < 3) return;
  const height = Number(tags.height) || (Number(tags['building:levels']) * 3.2) || (tags.shop ? 7 : 9 + Math.random() * 8);
  const geometry = new THREE.ExtrudeGeometry(polygonShape(points), { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, tags.shop ? materials.shop : materials.building);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
}

function addTree(x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.7 * s, 5 * s, 7), materials.trunk);
  trunk.position.set(x, 2.5 * s, z);
  trunk.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.8 * s, 9 * s, 8), materials.leaves);
  leaves.position.set(x, 9 * s, z);
  leaves.castShadow = true;
  world.add(trunk, leaves);
}

function addFallbackClarkston() {
  const roads = [
    [[-430,-210],[480,255]], [[-95,360],[85,-390]], [[-520,88],[520,-130]],
    [[-435,315],[465,-350]], [[-250,-300],[180,200]], [[-510,-360],[560,220]]
  ];
  roads.forEach((r, i) => addRoad(r.map(p => new THREE.Vector2(p[0], p[1])), { highway: i < 4 ? 'secondary' : 'residential' }));
  for (let i = 0; i < 70; i++) {
    const x = (Math.random() - 0.5) * 780;
    const z = (Math.random() - 0.5) * 780;
    const w = 10 + Math.random() * 18;
    const d = 10 + Math.random() * 24;
    addBuilding([
      new THREE.Vector2(x-w, z-d), new THREE.Vector2(x+w, z-d),
      new THREE.Vector2(x+w, z+d), new THREE.Vector2(x-w, z+d)
    ], {});
  }
  for (let i = 0; i < 90; i++) addTree((Math.random()-0.5)*780, (Math.random()-0.5)*780, 0.7 + Math.random()*0.5);
  addLabel('Clarkston Toll', 0, -20);
  addLabel('Clarkston Station', -210, 120);
}

async function loadOSM() {
  statusEl.textContent = 'Loading real Clarkston roads and buildings…';
  const query = `[out:json][timeout:25];(
    way["highway"](55.7830,-4.2885,55.7975,-4.2590);
    way["building"](55.7830,-4.2885,55.7975,-4.2590);
    way["railway"](55.7830,-4.2885,55.7975,-4.2590);
    way["leisure"="park"](55.7830,-4.2885,55.7975,-4.2590);
  );out body;>;out skel qt;`;
  const urls = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ];
  let data = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { method: 'POST', body: query, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response');
      data = await res.json();
      break;
    } catch (err) {
      console.warn('OSM fetch failed:', url, err);
    }
  }
  if (!data) throw new Error('OSM unavailable');

  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, project(el.lat, el.lon));
  }

  let roads = 0, buildings = 0;
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const pts = el.nodes.map(id => nodes.get(id)).filter(Boolean);
    if (pts.length < 2) continue;
    const tags = el.tags || {};
    if (tags.highway) { addRoad(pts, tags); roads++; }
    if (tags.railway) addRail(pts);
    if (tags.building) { addBuilding(pts, tags); buildings++; }
  }

  // Add streetside trees for visual depth. These are decorative, not OSM-sourced.
  for (let i = 0; i < 130; i++) {
    addTree((Math.random() - 0.5) * 1100, (Math.random() - 0.5) * 900, 0.55 + Math.random() * 0.35);
  }

  addLabel('Clarkston Toll', 6, -8);
  addLabel('Clarkston Station', -205, 160);
  addLabel('Busby Road', 125, -190);
  statusEl.textContent = `Loaded ${roads} roads and ${buildings} buildings from OpenStreetMap`;
}

const player = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.2, 4, 10), materials.player);
player.position.set(0, 2.6, 0);
player.castShadow = true;
scene.add(player);

const car = new THREE.Group();
const carBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 8.4), materials.car);
carBody.position.y = 1.2;
const carCabin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 3.4), new THREE.MeshStandardMaterial({ color: 0x202833, roughness: 0.2 }));
carCabin.position.set(0, 2.2, -0.7);
car.add(carBody, carCabin);
car.position.set(14, 0, 20);
car.traverse(o => { if (o.isMesh) o.castShadow = true; });
scene.add(car);

let inCar = false;
let carSpeed = 0;
let heading = 0;
let cameraYaw = Math.PI / 4;
let cameraPitch = 0.42;

const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e') toggleVehicle();
  if (e.key.toLowerCase() === 'r') resetPlayer();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('click', () => canvas.requestPointerLock?.());
window.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  cameraYaw -= e.movementX * 0.003;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + e.movementY * 0.002, 0.18, 0.9);
});

function toggleVehicle() {
  const distance = player.position.distanceTo(car.position);
  if (!inCar && distance < 11) {
    inCar = true;
    player.visible = false;
    statusEl.textContent = 'Driving mode';
  } else if (inCar) {
    inCar = false;
    player.visible = true;
    player.position.copy(car.position).add(new THREE.Vector3(7, 2.6, 0));
    statusEl.textContent = 'Walking mode';
  }
}

function resetPlayer() {
  player.position.set(0, 2.6, 0);
  car.position.set(14, 0, 20);
  car.rotation.y = 0;
  carSpeed = 0;
}

loadOSM().catch(err => {
  console.warn(err);
  addFallbackClarkston();
  statusEl.textContent = 'Using fallback map — OpenStreetMap server did not respond';
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const forward = keys.has('w') || keys.has('arrowup');
  const back = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const boost = keys.has('shift');

  if (inCar) {
    const accel = boost ? 64 : 40;
    if (forward) carSpeed += accel * dt;
    if (back) carSpeed -= accel * dt;
    carSpeed *= 0.97;
    if (Math.abs(carSpeed) > 0.4) {
      if (left) car.rotation.y += dt * 1.55 * Math.sign(carSpeed);
      if (right) car.rotation.y -= dt * 1.55 * Math.sign(carSpeed);
    }
    const dir = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    car.position.addScaledVector(dir, carSpeed * dt);
  } else {
    if (left) heading += dt * 2.6;
    if (right) heading -= dt * 2.6;
    const speed = boost ? 20 : 10;
    const move = (forward ? 1 : 0) - (back ? 1 : 0);
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    player.position.addScaledVector(dir, move * speed * dt);
    player.rotation.y = heading;
  }

  const target = inCar ? car.position.clone().add(new THREE.Vector3(0, 2.5, 0)) : player.position.clone().add(new THREE.Vector3(0, 2.8, 0));
  const dist = inCar ? 34 : 18;
  const cam = new THREE.Vector3(
    target.x + Math.sin(cameraYaw) * dist,
    target.y + Math.sin(cameraPitch) * dist,
    target.z + Math.cos(cameraYaw) * dist
  );
  camera.position.lerp(cam, 0.09);
  camera.lookAt(target);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
