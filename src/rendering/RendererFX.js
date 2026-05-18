import * as THREE from 'three';

export function applyRendererFX(renderer, scene) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  scene.environment = makeEnvironmentTexture(renderer);
}

function makeEnvironmentTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#d9ecff');
  sky.addColorStop(0.55, '#8fb5d4');
  sky.addColorStop(1, '#4c5a62');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * canvas.width, 35 + Math.random() * 80, 40 + Math.random() * 90, 8 + Math.random() * 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function addAtmosphere(scene) {
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xb9d2e6,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  scene.add(haze);
}
