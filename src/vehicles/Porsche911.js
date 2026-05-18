import * as THREE from 'three';

function createBodyShape(width, depth, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  const w = width;
  const d = depth;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + d - radius);
  shape.quadraticCurveTo(x + w, y + d, x + w - radius, y + d);
  shape.lineTo(x + radius, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function roundedBody(width, height, depth, radius, material) {
  const geometry = new THREE.ExtrudeGeometry(createBodyShape(width, depth, radius), {
    depth: height,
    bevelEnabled: true,
    bevelSize: radius * 0.32,
    bevelThickness: radius * 0.32,
    bevelSegments: 8,
    curveSegments: 16
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -height / 2);

  return new THREE.Mesh(geometry, material);
}

export function createPorsche911() {
  const group = new THREE.Group();

  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xd8dbdc,
    roughness: 0.12,
    metalness: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    reflectivity: 1
  });

  const trim = new THREE.MeshStandardMaterial({
    color: 0x111214,
    roughness: 0.45,
    metalness: 0.35
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x12283b,
    roughness: 0.02,
    metalness: 0.08,
    transmission: 0.25,
    transparent: true,
    opacity: 0.72
  });

  const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x090909,
    roughness: 0.96
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    metalness: 0.9,
    roughness: 0.18
  });

  const redLight = new THREE.MeshBasicMaterial({ color: 0xff2c38 });
  const headlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff7d8,
    emissive: 0xffe8a0,
    emissiveIntensity: 0.5,
    roughness: 0.08,
    transmission: 0.4
  });

  // Main shell
  const body = roundedBody(4.7, 1.0, 8.1, 0.65, silver);
  body.position.y = 1.02;
  group.add(body);

  // Front sculpt
  const nose = roundedBody(4.35, 0.42, 2.9, 0.5, silver);
  nose.position.set(0, 1.42, 2.7);
  nose.rotation.x = -0.12;
  group.add(nose);

  // Rear haunch
  const rear = roundedBody(4.7, 0.78, 2.7, 0.55, silver);
  rear.position.set(0, 1.56, -2.8);
  rear.rotation.x = 0.07;
  group.add(rear);

  // Cabin
  const cabin = roundedBody(3.15, 1.18, 3.2, 0.38, glass);
  cabin.position.set(0, 2.02, -0.2);
  cabin.scale.set(1, 1, 0.92);
  group.add(cabin);

  // Windscreen
  const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.45), glass);
  windscreen.position.set(0, 2.15, 1.55);
  windscreen.rotation.x = -0.62;
  group.add(windscreen);

  // Rear window
  const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.25), glass);
  rearWindow.position.set(0, 2.2, -1.85);
  rearWindow.rotation.x = 0.56;
  group.add(rearWindow);

  // Side skirts
  for (const x of [-2.05, 2.05]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 5.6), trim);
    skirt.position.set(x, 0.62, 0);
    group.add(skirt);
  }

  // Rear bumper
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.52, 0.5), trim);
  rearBumper.position.set(0, 0.86, -4.15);
  group.add(rearBumper);

  // Front splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 0.35), trim);
  splitter.position.set(0, 0.58, 4.08);
  group.add(splitter);

  // Full-width light bar
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.09, 0.08), redLight);
  lightBar.position.set(0, 1.52, -4.02);
  group.add(lightBar);

  // Headlights
  for (const x of [-1.45, 1.45]) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32), headlightMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, 1.48, 3.92);
    group.add(housing);
  }

  // Wing mirrors
  for (const x of [-2.15, 2.15]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.32), trim);
    arm.position.set(x, 1.82, 1.05);
    group.add(arm);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.42), silver);
    mirror.position.set(x, 1.82, 1.3);
    group.add(mirror);
  }

  // Exhausts
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x303030,
    metalness: 0.95,
    roughness: 0.14
  });

  for (const x of [-1.45, 1.45]) {
    const exhaust = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 12, 32), exhaustMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x, 0.66, -4.24);
    group.add(exhaust);
  }

  // Wheels
  for (const x of [-2.22, 2.22]) {
    for (const z of [-2.7, 2.55]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.54, 40), tyreMat);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(x, 0.65, z);
      group.add(tyre);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.56, 32), wheelMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x, 0.65, z);
      group.add(rim);

      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.58), wheelMat);
        spoke.position.set(x + Math.sign(x) * 0.02, 0.65, z);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (Math.PI * 2 / 5) * i;
        group.add(spoke);
      }
    }
  }

  // Porsche-style rear grille
  for (let i = -10; i <= 10; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.0), trim);
    slat.position.set(i * 0.16, 1.92, -2.7);
    group.add(slat);
  }

  // Number plate
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xd7b300 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.38, 0.04), plateMat);
  plate.position.set(0, 1.0, -4.28);
  group.add(plate);

  group.scale.set(1.08, 1.02, 1.08);

  group.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}
