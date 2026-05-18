import * as THREE from 'three';
import { Input } from './core/Input.js';
import { createPorsche911 } from './vehicles/Porsche911.js';
import { VehicleController } from './vehicles/VehicleController.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { BusbyRoadSlice } from './world/BusbyRoadSlice.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d2e6);
scene.fog = new THREE.Fog(0xb9d2e6, 280, 850);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 4000);

scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x52614d, 1.55));

const sun = new THREE.DirectionalLight(0xfff2d0, 2.7);
sun.position.set(-120, 260, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 420;
sun.shadow.camera.bottom = -420;
scene.add(sun);

const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const statusEl = document.querySelector('#status');
const mini = document.querySelector('#minimap');
const miniCtx = mini?.getContext('2d');

modeEl.textContent = 'Driving';
areaEl.textContent = 'Busby Road';
statusEl.textContent = 'Loading hand-built Busby Road high street...';

const world = new BusbyRoadSlice(scene);
world.load().then(({ buildingCount }) => {
  statusEl.textContent = `BUSBY ROAD BUILD: high street slice loaded with ${buildingCount} buildings`;
});

const car = createPorsche911();
car.position.set(0, 0.1, -250);
car.rotation.y = 0;
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

  miniCtx.fillStyle = '#ff3333';
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

  // Keep the car visually grounded on the sloped Busby Road slice.
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
