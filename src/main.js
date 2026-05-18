import * as THREE from 'three';
import { Input } from './core/Input.js';
import { createPorsche911 } from './vehicles/Porsche911.js';
import { VehicleController } from './vehicles/VehicleController.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { BusbyRoadSlice } from './world/BusbyRoadSlice.js';
import { applyRendererFX, addAtmosphere } from './rendering/RendererFX.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d2e6);
scene.fog = new THREE.FogExp2(0xb9d2e6, 0.0018);

applyRendererFX(renderer, scene);
addAtmosphere(scene);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 4000);

const hemi = new THREE.HemisphereLight(0xe8f7ff, 0x4f5c46, 1.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1cf, 3.2);
sun.position.set(-120, 260, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 420;
sun.shadow.camera.bottom = -420;
scene.add(sun);

const bounce = new THREE.DirectionalLight(0x9fc6ff, 0.45);
bounce.position.set(120, 80, -150);
scene.add(bounce);

const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const statusEl = document.querySelector('#status');
const mini = document.querySelector('#minimap');
const miniCtx = mini?.getContext('2d');

modeEl.textContent = 'Driving';
areaEl.textContent = 'Busby Road';
statusEl.textContent = 'Loading Busby Road high street...';

const world = new BusbyRoadSlice(scene);
world.load().then(({ buildingCount }) => {
  statusEl.textContent = `BUSBY ROAD BUILD: ${buildingCount} detailed buildings loaded`;
});

const car = createPorsche911();
car.position.set(0, 0.1, -250);
scene.add(car);

const input = new Input();
const vehicle = new VehicleController(car, input);
const chaseCamera = new ChaseCamera(camera, car);
const clock = new THREE.Clock();

function drawMiniMap() {
  if (!miniCtx) return;

  const size = mini.width;
  miniCtx.clearRect(0, 0, size, size);

  const bg = miniCtx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#0b1014');
  bg.addColorStop(1, '#1a232c');
  miniCtx.fillStyle = bg;
  miniCtx.fillRect(0, 0, size, size);

  miniCtx.save();
  miniCtx.translate(size / 2, size / 2);
  miniCtx.scale(0.26, 0.26);
  miniCtx.translate(-car.position.x, -car.position.z);

  miniCtx.strokeStyle = '#f5d76e';
  miniCtx.lineWidth = 18;
  miniCtx.beginPath();
  miniCtx.moveTo(0, -350);
  miniCtx.lineTo(0, 350);
  miniCtx.stroke();

  miniCtx.fillStyle = '#a99b82';
  for (const mesh of world.buildings) {
    miniCtx.fillRect(mesh.position.x - 8, mesh.position.z - 8, 16, 16);
  }

  miniCtx.fillStyle = '#ff3838';
  miniCtx.beginPath();
  miniCtx.arc(car.position.x, car.position.z, 13, 0, Math.PI * 2);
  miniCtx.fill();

  miniCtx.restore();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);

  const previousPosition = car.position.clone();
  vehicle.update(delta);

  car.position.y = world.getHeight(car.position.x, car.position.z) + 0.1;

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
