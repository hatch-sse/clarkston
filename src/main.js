import * as THREE from 'three';
import { Input } from './core/Input.js';
import { createPorsche911 } from './vehicles/Porsche911.js';
import { VehicleController } from './vehicles/VehicleController.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { OSMClarkstonWorld } from './world/OSMClarkstonWorld.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d2e6);
scene.fog = new THREE.Fog(0xb9d2e6, 500, 1800);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x52614d, 1.7));

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(180, 260, 120);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200),
  new THREE.MeshStandardMaterial({ color: 0x6c9961 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const statusEl = document.querySelector('#status');
const mini = document.querySelector('#minimap');
const miniCtx = mini?.getContext('2d');

modeEl.textContent = 'Driving';
areaEl.textContent = 'Clarkston OSM';
statusEl.textContent = 'Loading real Clarkston OpenStreetMap data...';

const world = new OSMClarkstonWorld(scene);
world.load()
  .then(({ roadCount, buildingCount }) => {
    statusEl.textContent = `OSM ENGINE BUILD: ${roadCount} roads and ${buildingCount} buildings loaded`;
  })
  .catch(error => {
    console.error(error);
    statusEl.textContent = 'OSM failed to load. Refresh in a minute.';
  });

const car = createPorsche911();
car.position.set(0, 0, 0);
scene.add(car);

const input = new Input();
const vehicle = new VehicleController(car, input);
const chaseCamera = new ChaseCamera(camera, car);
const clock = new THREE.Clock();

function drawMiniMap() {
  if (!miniCtx) return;
  const size = mini.width;
  miniCtx.clearRect(0, 0, size, size);
  miniCtx.fillStyle = 'rgba(8, 12, 16, 0.9)';
  miniCtx.fillRect(0, 0, size, size);
  miniCtx.save();
  miniCtx.translate(size / 2, size / 2);
  miniCtx.scale(0.16, 0.16);
  miniCtx.translate(-car.position.x, -car.position.z);

  for (const road of world.roads) {
    miniCtx.strokeStyle = road.main ? '#f5d76e' : '#eeeeee';
    miniCtx.lineWidth = road.main ? 14 : 7;
    miniCtx.beginPath();
    road.points.forEach((p, index) => {
      if (index === 0) miniCtx.moveTo(p.x, p.y);
      else miniCtx.lineTo(p.x, p.y);
    });
    miniCtx.stroke();
  }

  miniCtx.fillStyle = '#a99b82';
  for (const building of world.buildings) {
    miniCtx.beginPath();
    building.forEach((p, index) => {
      if (index === 0) miniCtx.moveTo(p.x, p.y);
      else miniCtx.lineTo(p.x, p.y);
    });
    miniCtx.closePath();
    miniCtx.fill();
  }

  miniCtx.fillStyle = '#ff3333';
  miniCtx.beginPath();
  miniCtx.arc(car.position.x, car.position.z, 16, 0, Math.PI * 2);
  miniCtx.fill();
  miniCtx.restore();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);

  const previousPosition = car.position.clone();
  vehicle.update(delta);

  if (world.collides(car.position, 3.2)) {
    car.position.copy(previousPosition);
    vehicle.speed *= -0.25;
  }

  chaseCamera.update(delta);
  speedEl.textContent = Math.round(Math.abs(vehicle.speed) * 1.2);
  drawMiniMap();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
