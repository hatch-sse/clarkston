import * as THREE from 'three';
import { Input } from './core/Input.js';
import { createPorsche911 } from './vehicles/Porsche911.js';
import { VehicleController } from './vehicles/VehicleController.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { createRoadGrid } from './world/RoadGrid.js';

const canvas = document.querySelector('#game');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d2e6);
scene.fog = new THREE.Fog(0xb9d2e6, 120, 900);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  4000
);

scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x52614d, 1.7));

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(180, 260, 120);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshStandardMaterial({ color: 0x6c9961 })
);

ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

createRoadGrid(scene);

const car = createPorsche911();
car.position.set(0, 0, 0);
scene.add(car);

const input = new Input();
const vehicle = new VehicleController(car, input);
const chaseCamera = new ChaseCamera(camera, car);

const speedEl = document.querySelector('#speed');
const modeEl = document.querySelector('#mode');
const areaEl = document.querySelector('#area');
const statusEl = document.querySelector('#status');

modeEl.textContent = 'Driving';
areaEl.textContent = 'Clarkston Prototype';
statusEl.textContent = 'Mini open-world engine active';

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);

  vehicle.update(delta);
  chaseCamera.update(delta);

  speedEl.textContent = Math.round(Math.abs(vehicle.speed) * 1.2);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
