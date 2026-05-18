import * as THREE from 'three';

const canvas = document.querySelector('#game');
const statusEl = document.querySelector('#status');

// ---------- UI ----------
const dash = document.createElement('div');
dash.id = 'dash';
dash.innerHTML = `<div><b>Mode</b> <span id="mode">Walking</span></div><div><b>Speed</b> <span id="speed">0</span> mph</div><div><b>Area</b> <span id="area">Clarkston Toll</span></div><div class="mission">Mission: find the red car, press <b>E</b>, then drive round Clarkston Toll.</div>`;
document.body.appendChild(dash);

const mini = document.createElement('canvas');
mini.id = 'minimap';
mini.width = 220;
mini.height = 220;
document.body.appendChild(mini);
const miniCtx = mini.getContext('2d');
const modeEl = document.querySelector('#mode');
const speedEl = document.querySelector('#speed');
const areaEl = document.querySelector('#area');

// ---------- Three setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d5ea);
scene.fog = new THREE.Fog(0xb9d5ea, 650, 1850);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 4000);

const sun = new THREE.DirectionalLight(0xfff2d0, 2.5);
sun.position.set(280, 520, 260);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -1000;
sun.shadow.camera.right = 1000;
sun.shadow.camera.top = 1000;
sun.shadow.camera.bottom = -1000;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 1400;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdff5ff, 0x56634e, 1.65));

const world = new THREE.Group();
scene.add(world);

const roadsForMap = [];
const roadPaths = [];
const buildingsForMap = [];
const labelsForMap = [];
const npcCars = [];
const pedestrians = [];

const textureLoader = new THREE.TextureLoader();
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f985f'; ctx.fillRect(0,0,c.width,c.height);
  for (let i=0;i<9000;i++) {
    const g = 80 + Math.random()*60;
    ctx.fillStyle = `rgba(${g},${120+Math.random()*50},${g*.55},0.08)`;
    ctx.fillRect(Math.random()*1024, Math.random()*1024, 2+Math.random()*8, 2+Math.random()*8);
  }
  for (let i=0;i<90;i++) {
    ctx.fillStyle = 'rgba(90,120,80,0.14)';
    ctx.beginPath(); ctx.ellipse(Math.random()*1024, Math.random()*1024, 30+Math.random()*90, 10+Math.random()*30, Math.random()*Math.PI, 0, Math.PI*2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8,8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const materials = {
  grass: new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 }),
  park: new THREE.MeshStandardMaterial({ color: 0x75aa63, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x2f3438, roughness: 0.92 }),
  mainRoad: new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.9 }),
  pavement: new THREE.MeshStandardMaterial({ color: 0xb8b4a9, roughness: 1 }),
  marking: new THREE.MeshBasicMaterial({ color: 0xf0e8ce }),
  yellow: new THREE.MeshBasicMaterial({ color: 0xd7b936 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x191c1e, roughness: 0.8 }),
  building: new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.92 }),
  shop: new THREE.MeshStandardMaterial({ color: 0xd3c0a1, roughness: 0.86 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x7b7468, roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x263544, roughness: 0.18, metalness: 0.05 }),
  player: new THREE.MeshStandardMaterial({ color: 0x2559ff, roughness: 0.55 }),
  car: new THREE.MeshStandardMaterial({ color: 0xc92727, roughness: 0.45 }),
  npcCar: new THREE.MeshStandardMaterial({ color: 0x2e75b6, roughness: 0.45 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6c4524, roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x2f7d3d, roughness: 1 }),
  person: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 })
};

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1900, 1900, 40, 40), materials.grass);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

// ---------- Geo projection ----------
const origin = { lat: 55.7899, lon: -4.2757 };
const scale = 111320;
function project(lat, lon) {
  const x = (lon - origin.lon) * scale * Math.cos(origin.lat * Math.PI / 180);
  const z = -(lat - origin.lat) * scale;
  return new THREE.Vector2(x, z);
}

function vec3From2(p, y=0) { return new THREE.Vector3(p.x, y, p.y); }

// ---------- Map objects ----------
function addLabel(text, x, z) {
  const c = document.createElement('canvas');
  c.width = 700; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.roundRect?.(0, 0, c.width, c.height, 28) || ctx.fillRect(0,0,c.width,c.height);
  ctx.fill();
  ctx.fillStyle = '#1d252b';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width/2, c.height/2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.position.set(x, 42, z);
  sprite.scale.set(78, 18, 1);
  world.add(sprite);
  labelsForMap.push({ text, x, z });
}

function segment(a, b, width, height, material, y = 0.05, cast = false) {
  const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  if (len < 0.35) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, len), material);
  mesh.position.set(mid.x, y, mid.y);
  mesh.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
  mesh.receiveShadow = true;
  mesh.castShadow = cast;
  world.add(mesh);
  return mesh;
}

function addRoad(points, tags) {
  const highway = tags.highway || '';
  const main = ['primary', 'secondary', 'tertiary', 'trunk'].includes(highway);
  const residential = ['residential', 'unclassified', 'service', 'living_street'].includes(highway);
  const foot = ['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway);
  const width = main ? 12 : residential ? 7.2 : foot ? 2.2 : 5.5;
  const mat = main ? materials.mainRoad : materials.road;
  roadsForMap.push({ points, main, foot, name: tags.name || '' });
  if (!foot) roadPaths.push({ points, width, main });

  for (let i=0; i<points.length-1; i++) {
    const a = points[i], b = points[i+1];
    if (!foot) {
      segment(a, b, width + 5.6, 0.035, materials.pavement, 0.035);
      segment(a, b, width, 0.075, mat, 0.08);
      // white centre markings on larger roads
      if (main && a.distanceTo(b) > 18) {
        const dir = new THREE.Vector2().subVectors(b, a).normalize();
        const len = a.distanceTo(b);
        for (let d=8; d<len-8; d+=24) {
          const p1 = a.clone().addScaledVector(dir, d);
          const p2 = a.clone().addScaledVector(dir, Math.min(d+10, len));
          segment(p1, p2, 0.45, 0.035, materials.marking, 0.13);
        }
      }
      // yellow-ish kerb lines
      if (main) {
        const perp = new THREE.Vector2(-(b.y-a.y), b.x-a.x).normalize().multiplyScalar(width/2 - .7);
        segment(a.clone().add(perp), b.clone().add(perp), .25, .025, materials.yellow, 0.14);
        segment(a.clone().sub(perp), b.clone().sub(perp), .25, .025, materials.yellow, 0.14);
      }
    } else {
      segment(a, b, width, 0.05, materials.pavement, 0.12);
    }
  }
}

function addRail(points) {
  roadsForMap.push({ points, rail: true });
  for (let i=0; i<points.length-1; i++) {
    const a = points[i], b = points[i+1];
    segment(a, b, 4, 0.06, materials.rail, 0.10);
    const perp = new THREE.Vector2(-(b.y-a.y), b.x-a.x).normalize().multiplyScalar(1.4);
    segment(a.clone().add(perp), b.clone().add(perp), .32, .08, materials.marking, 0.18);
    segment(a.clone().sub(perp), b.clone().sub(perp), .32, .08, materials.marking, 0.18);
  }
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i=1; i<points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return shape;
}

function polygonCentroid(points) {
  let x=0,z=0;
  points.forEach(p => { x += p.x; z += p.y; });
  return { x: x/points.length, z: z/points.length };
}

function addBuilding(points, tags) {
  if (points.length < 3) return;
  const h = Number(tags.height) || (Number(tags['building:levels']) * 3.1) || (tags.shop ? 7 : 7 + Math.random()*8);
  const geometry = new THREE.ExtrudeGeometry(polygonShape(points), { depth: h, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.16, bevelSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, (tags.shop || tags.amenity) ? materials.shop : materials.building);
  mesh.castShadow = true; mesh.receiveShadow = true;
  world.add(mesh);

  const c = polygonCentroid(points);
  buildingsForMap.push({ points, x: c.x, z: c.z });

  // Simple roof slab and occasional shop front/window strip.
  const minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x));
  const minZ = Math.min(...points.map(p=>p.y)), maxZ = Math.max(...points.map(p=>p.y));
  const w = Math.max(2, maxX-minX), d = Math.max(2, maxZ-minZ);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w*0.94, 0.28, d*0.94), materials.roof);
  roof.position.set(c.x, h + 0.16, c.z); roof.castShadow = true; world.add(roof);
  if (w > 8 && d > 8 && Math.random() > 0.35) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w*.7, 14), 1.1, 0.2), materials.glass);
    win.position.set(c.x, 3.2, minZ - .12); world.add(win);
  }
}

function addTree(x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38*s, 0.55*s, 4.8*s, 7), materials.trunk);
  trunk.position.set(x, 2.4*s, z); trunk.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(3.8*s, 1), materials.leaves);
  leaves.position.set(x, 7.5*s, z); leaves.castShadow = true;
  world.add(trunk, leaves);
}

function addLamp(x,z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,8,8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  pole.position.set(x,4,z); pole.castShadow = true;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.45,12,8), new THREE.MeshBasicMaterial({ color: 0xffedb0 }));
  lamp.position.set(x,8.1,z);
  world.add(pole,lamp);
}

function addStreetFurniture() {
  // Deterministic-looking rows of trees/lights along road paths.
  let made = 0;
  for (const r of roadPaths) {
    for (let i=0; i<r.points.length-1 && made < 240; i++) {
      const a = r.points[i], b = r.points[i+1];
      const len = a.distanceTo(b);
      if (len < 35) continue;
      const dir = new THREE.Vector2().subVectors(b,a).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x).multiplyScalar((r.width/2)+5.8);
      for (let d=18; d<len; d+=55) {
        const base = a.clone().addScaledVector(dir,d);
        const side = (made % 2 === 0) ? 1 : -1;
        if (made % 3 !== 0) addTree(base.x + perp.x*side, base.y + perp.y*side, .55 + Math.random()*.28);
        else addLamp(base.x + perp.x*side, base.y + perp.y*side);
        made++;
      }
    }
  }
}

// ---------- Vehicles and pedestrians ----------
function createCar(col=0x2e75b6) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6,1.4,7.8), new THREE.MeshStandardMaterial({ color: col, roughness: .45 }));
  body.position.y = 1.1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.5,1.25,3.1), materials.glass);
  cabin.position.set(0,2.05,-.6);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const x of [-2.25,2.25]) for (const z of [-2.6,2.6]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.42,16), wheelMat);
    w.rotation.z = Math.PI/2; w.position.set(x,.52,z); g.add(w);
  }
  g.add(body,cabin); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return g;
}

function spawnTraffic() {
  const palette = [0x2e75b6,0x222222,0xf2f2f2,0x1b8a5a,0xd09b2c,0x8844aa];
  for (let i=0; i<Math.min(18, roadPaths.length); i++) {
    const path = roadPaths[i % roadPaths.length].points;
    if (path.length < 2) continue;
    const g = createCar(palette[i % palette.length]);
    g.userData = { path, seg: 0, t: Math.random(), speed: 7 + Math.random()*8, offset: (i%2 ? -1 : 1) * 2.1 };
    npcCars.push(g); scene.add(g);
  }
}

function createPedestrian() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.55,1.55,3,8), materials.person);
  body.position.y = 1.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42,12,8), new THREE.MeshStandardMaterial({ color: 0xd7aa78 }));
  head.position.y = 2.8;
  g.add(body,head); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return g;
}

function spawnPedestrians() {
  for (let i=0; i<32; i++) {
    const r = roadPaths[Math.floor(Math.random()*roadPaths.length)];
    if (!r) continue;
    const g = createPedestrian();
    g.userData = { path: r.points, seg: 0, t: Math.random(), speed: 1.3 + Math.random()*1.2, offset: (Math.random()>.5?1:-1) * (r.width/2 + 3.2) };
    pedestrians.push(g); scene.add(g);
  }
}

function moveAlongPath(obj, dt, walking=false) {
  const u = obj.userData;
  if (!u.path || u.path.length < 2) return;
  let a = u.path[u.seg], b = u.path[u.seg+1];
  let len = Math.max(1, a.distanceTo(b));
  u.t += (u.speed * dt) / len;
  if (u.t >= 1) {
    u.t = 0; u.seg++;
    if (u.seg >= u.path.length-1) { u.seg = 0; if (Math.random()>.5) u.path.reverse(); }
    a = u.path[u.seg]; b = u.path[u.seg+1]; len = Math.max(1, a.distanceTo(b));
  }
  const pos = a.clone().lerp(b, u.t);
  const dir = new THREE.Vector2().subVectors(b,a).normalize();
  const perp = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(u.offset || 0);
  obj.position.set(pos.x + perp.x, 0, pos.y + perp.y);
  obj.rotation.y = Math.atan2(dir.x, dir.y);
  if (walking) obj.position.y = Math.abs(Math.sin(performance.now()/260 + u.t*8)) * .08;
}

// ---------- Fallback and OSM loading ----------
function addFallbackClarkston() {
  const roads = [
    [[-430,-210],[480,255]], [[-95,360],[85,-390]], [[-520,88],[520,-130]],
    [[-435,315],[465,-350]], [[-250,-300],[180,200]], [[-510,-360],[560,220]]
  ];
  roads.forEach((r, i) => addRoad(r.map(p => new THREE.Vector2(p[0], p[1])), { highway: i < 4 ? 'secondary' : 'residential' }));
  for (let i=0;i<115;i++) {
    const x=(Math.random()-.5)*820, z=(Math.random()-.5)*820, w=8+Math.random()*20, d=8+Math.random()*24;
    addBuilding([new THREE.Vector2(x-w,z-d),new THREE.Vector2(x+w,z-d),new THREE.Vector2(x+w,z+d),new THREE.Vector2(x-w,z+d)], {});
  }
  addStreetFurniture(); spawnTraffic(); spawnPedestrians();
  addLabel('Clarkston Toll', 0, -20); addLabel('Clarkston Station', -210, 120); addLabel('Busby Road', 140, -190);
}

async function loadOSM() {
  statusEl.textContent = 'Loading next-level Clarkston map…';
  const query = `[out:json][timeout:25];(
    way["highway"](55.7830,-4.2885,55.7975,-4.2590);
    way["building"](55.7830,-4.2885,55.7975,-4.2590);
    way["railway"](55.7830,-4.2885,55.7975,-4.2590);
    way["leisure"="park"](55.7830,-4.2885,55.7975,-4.2590);
    way["landuse"](55.7830,-4.2885,55.7975,-4.2590);
  );out body;>;out skel qt;`;
  const urls = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.openstreetmap.ru/api/interpreter'];
  let data = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      const res = await fetch(url, { method: 'POST', body: query, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response');
      data = await res.json(); break;
    } catch (e) { console.warn('OSM fetch failed:', url, e); }
  }
  if (!data) throw new Error('OSM unavailable');
  const nodes = new Map();
  for (const el of data.elements) if (el.type === 'node') nodes.set(el.id, project(el.lat, el.lon));

  let roads=0, buildings=0;
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const pts = el.nodes.map(id=>nodes.get(id)).filter(Boolean);
    if (pts.length < 2) continue;
    const tags = el.tags || {};
    if (tags.highway) { addRoad(pts, tags); roads++; }
    else if (tags.railway) addRail(pts);
    else if (tags.building) { addBuilding(pts, tags); buildings++; }
  }
  addStreetFurniture(); spawnTraffic(); spawnPedestrians();
  addLabel('Clarkston Toll', 6, -8); addLabel('Clarkston Station', -205, 160); addLabel('Busby Road', 125, -190); addLabel('Eastwood Toll', 330, 95);
  statusEl.textContent = `Next-level prototype: ${roads} roads, ${buildings} buildings, traffic, pedestrians and minimap`;
}

// ---------- Player and car ----------
const player = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 3.1, 5, 12), materials.player);
player.position.set(0, 2.55, 0); player.castShadow = true; scene.add(player);

const car = createCar(0xcc2626);
car.position.set(14, 0, 20); scene.add(car);

let inCar = false, carSpeed = 0, heading = 0;
let cameraYaw = Math.PI/4, cameraPitch = 0.42;

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
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + e.movementY * 0.002, 0.16, 0.95);
});

function toggleVehicle() {
  const distance = player.position.distanceTo(car.position);
  if (!inCar && distance < 11) { inCar = true; player.visible = false; modeEl.textContent = 'Driving'; statusEl.textContent = 'Driving mode — explore Clarkston'; }
  else if (inCar) { inCar = false; player.visible = true; player.position.copy(car.position).add(new THREE.Vector3(7,2.55,0)); modeEl.textContent = 'Walking'; statusEl.textContent = 'Walking mode'; }
}
function resetPlayer() { player.position.set(0,2.55,0); car.position.set(14,0,20); car.rotation.y=0; carSpeed=0; }

function updateArea(pos) {
  const dToll = Math.hypot(pos.x-6,pos.z+8), dStation = Math.hypot(pos.x+205,pos.z-160), dBusby = Math.hypot(pos.x-125,pos.z+190);
  areaEl.textContent = dStation < 140 ? 'Clarkston Station' : dBusby < 180 ? 'Busby Road' : dToll < 180 ? 'Clarkston Toll' : 'Greater Clarkston';
}

function drawMinimap(target) {
  const s = mini.width, range = 520;
  miniCtx.clearRect(0,0,s,s);
  miniCtx.fillStyle = 'rgba(16,22,24,.86)'; miniCtx.fillRect(0,0,s,s);
  miniCtx.save(); miniCtx.translate(s/2,s/2); miniCtx.scale(s/range, s/range); miniCtx.translate(-target.x, -target.z);
  miniCtx.lineCap = 'round';
  for (const r of roadsForMap) {
    miniCtx.strokeStyle = r.rail ? '#999' : r.main ? '#f7d85b' : r.foot ? '#aaa' : '#e8e8e8';
    miniCtx.lineWidth = r.rail ? 3 : r.main ? 5 : 2.5;
    miniCtx.beginPath(); r.points.forEach((p,i)=> i ? miniCtx.lineTo(p.x,p.y) : miniCtx.moveTo(p.x,p.y)); miniCtx.stroke();
  }
  miniCtx.fillStyle = '#9d8f76';
  for (const b of buildingsForMap.slice(0,450)) { miniCtx.fillRect(b.x-1.5,b.z-1.5,3,3); }
  miniCtx.fillStyle = '#ff3333'; miniCtx.beginPath(); miniCtx.arc(car.position.x, car.position.z, 7, 0, Math.PI*2); miniCtx.fill();
  miniCtx.fillStyle = '#3377ff'; miniCtx.beginPath(); miniCtx.arc(player.position.x, player.position.z, 6, 0, Math.PI*2); miniCtx.fill();
  miniCtx.restore();
  miniCtx.strokeStyle = 'rgba(255,255,255,.55)'; miniCtx.lineWidth = 2; miniCtx.strokeRect(1,1,s-2,s-2);
}

loadOSM().catch(err => { console.warn(err); addFallbackClarkston(); statusEl.textContent = 'Using enhanced fallback map — OpenStreetMap server did not respond'; });

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const forward = keys.has('w') || keys.has('arrowup');
  const back = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const boost = keys.has('shift');

  if (inCar) {
    const accel = boost ? 72 : 43;
    if (forward) carSpeed += accel*dt;
    if (back) carSpeed -= accel*dt;
    carSpeed *= 0.972;
    carSpeed = THREE.MathUtils.clamp(carSpeed, -35, boost ? 82 : 58);
    if (Math.abs(carSpeed) > .4) {
      if (left) car.rotation.y += dt * 1.45 * Math.sign(carSpeed);
      if (right) car.rotation.y -= dt * 1.45 * Math.sign(carSpeed);
    }
    const dir = new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));
    car.position.addScaledVector(dir, carSpeed*dt);
  } else {
    if (left) heading += dt*2.65;
    if (right) heading -= dt*2.65;
    const speed = boost ? 20 : 9.5;
    const move = (forward?1:0) - (back?1:0);
    const dir = new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
    player.position.addScaledVector(dir, move*speed*dt);
    player.rotation.y = heading;
  }

  npcCars.forEach(c => moveAlongPath(c, dt, false));
  pedestrians.forEach(p => moveAlongPath(p, dt, true));

  const targetObj = inCar ? car : player;
  const target = targetObj.position.clone().add(new THREE.Vector3(0, inCar ? 2.5 : 2.8, 0));
  const dist = inCar ? 36 : 18;
  const cam = new THREE.Vector3(target.x + Math.sin(cameraYaw)*dist, target.y + Math.sin(cameraPitch)*dist, target.z + Math.cos(cameraYaw)*dist);
  camera.position.lerp(cam, .085); camera.lookAt(target);

  speedEl.textContent = String(Math.max(0, Math.round(Math.abs(carSpeed) * 1.25)));
  updateArea(targetObj.position);
  drawMinimap(targetObj.position);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
