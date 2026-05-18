import * as THREE from 'three';

const canvas = document.querySelector('#game');
const statusEl = document.querySelector('#status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89b7d4);
scene.fog = new THREE.Fog(0x89b7d4, 350, 1100);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(180, 300, 160);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfefff, 0x445544, 1.5));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshStandardMaterial({ color: 0x5f8e58, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const roadMat = new THREE.MeshStandardMaterial({ color: 0x33383d });
const mainRoadMat = new THREE.MeshStandardMaterial({ color: 0x252a2f });
const buildingMat = new THREE.MeshStandardMaterial({ color: 0xb9a990 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x202020 });

const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e') toggleVehicle();
  if (e.key.toLowerCase() === 'r') resetPlayer();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(1.2, 3.2, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x2357ff })
);
player.position.set(0, 2.6, 0);
scene.add(player);

const car = new THREE.Mesh(
  new THREE.BoxGeometry(5, 2, 9),
  new THREE.MeshStandardMaterial({ color: 0xcc2222 })
);
car.position.set(12, 1, 22);
scene.add(car);

let inCar = false;
let carSpeed = 0;
let heading = 0;

function toggleVehicle() {
  const distance = player.position.distanceTo(car.position);
  if (!inCar && distance < 12) {
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
  car.position.set(12, 1, 22);
}

function road(a, b, width, material) {
  const av = new THREE.Vector2(a[0], a[1]);
  const bv = new THREE.Vector2(b[0], b[1]);
  const mid = new THREE.Vector2().addVectors(av, bv).multiplyScalar(0.5);
  const len = av.distanceTo(bv);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, len), material);
  mesh.position.set(mid.x, 0.05, mid.y);
  mesh.rotation.y = Math.atan2(bv.x - av.x, bv.y - av.y);
  scene.add(mesh);
}

road([-430,-210],[480,255],8,mainRoadMat);
road([-95,360],[85,-390],7,mainRoadMat);
road([-520,88],[520,-130],7,mainRoadMat);
road([-435,315],[465,-350],7,mainRoadMat);
road([-250,-300],[180,200],5,roadMat);
road([-520,-330],[535,200],2,railMat);

function building(x,z,w,d,h=10) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w,h,d),
    buildingMat
  );
  mesh.position.set(x,h/2,z);
  scene.add(mesh);
}

building(0,0,28,18,12);
building(45,-45,34,18,10);
building(-210,98,34,20,14);
building(185,-82,36,20,12);
building(70,145,28,18,11);

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  const forward = keys.has('w') || keys.has('arrowup');
  const back = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const boost = keys.has('shift');

  if (inCar) {
    const accel = boost ? 42 : 26;
    if (forward) carSpeed += accel * dt;
    if (back) carSpeed -= accel * dt;
    carSpeed *= 0.975;

    if (left) car.rotation.y += dt * 1.8;
    if (right) car.rotation.y -= dt * 1.8;

    const dir = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    car.position.addScaledVector(dir, carSpeed * dt);
  } else {
    if (left) heading += dt * 2.6;
    if (right) heading -= dt * 2.6;

    const speed = boost ? 18 : 9;
    let move = 0;
    if (forward) move += 1;
    if (back) move -= 1;

    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    player.position.addScaledVector(dir, move * speed * dt);
    player.rotation.y = heading;
  }

  const target = inCar ? car.position : player.position;
  const cam = new THREE.Vector3(
    target.x + 18,
    target.y + 12,
    target.z + 18
  );

  camera.position.lerp(cam, 0.08);
  camera.lookAt(target.x, target.y + 3, target.z);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
