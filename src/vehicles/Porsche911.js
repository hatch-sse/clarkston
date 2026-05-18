import * as THREE from 'three';

function roundedBox(width, height, depth, radius, material) {
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

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: radius * 0.35,
    bevelThickness: radius * 0.35,
    bevelSegments: 4
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -height / 2);

  return new THREE.Mesh(geometry, material);
}

export function createPorsche911() {
  const group = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xcfd3d5,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  });

  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 0.28, metalness: 0.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0f2232, roughness: 0.03, metalness: 0.1, transmission: 0.15, transparent: true, opacity: 0.72 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.9 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0xd7d7d7, metalness: 0.8, roughness: 0.25 });
  const redLight = new THREE.MeshBasicMaterial({ color: 0xff1f2f });
  const whiteLight = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xd8b100 });

  const body = roundedBox(4.65, 1.05, 7.9, 0.55, paint);
  body.position.y = 1.05;
  group.add(body);

  const nose = roundedBox(4.25, 0.48, 2.55, 0.48, paint);
  nose.position.set(0, 1.48, 2.45);
  nose.rotation.x = -0.08;
  group.add(nose);

  const rearDeck = roundedBox(4.65, 0.72, 2.45, 0.5, paint);
  rearDeck.position.set(0, 1.55, -2.65);
  rearDeck.rotation.x = 0.06;
  group.add(rearDeck);

  const cabin = roundedBox(3.35, 1.28, 2.35, 0.38, glass);
  cabin.position.set(0, 2.02, -0.45);
  cabin.scale.set(0.95, 1, 1);
  group.add(cabin);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.08, 1.0), glass);
  rearWindow.position.set(0, 2.25, -1.75);
  rearWindow.rotation.x = 0.42;
  group.add(rearWindow);

  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.08, 0.08), redLight);
  lightBar.position.set(0, 1.48, -4.04);
  group.add(lightBar);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.55, 0.42), darkPaint);
  rearBumper.position.set(0, 0.85, -4.04);
  group.add(rearBumper);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.06), plateMat);
  plate.position.set(0, 1.05, -4.28);
  group.add(plate);

  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
  for (const x of [-1.55, 1.55]) {
    const exhaust = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 10, 24), exhaustMat);
    exhaust.position.set(x, 0.62, -4.28);
    exhaust.rotation.x = Math.PI / 2;
    group.add(exhaust);
  }

  for (const x of [-1.45, 1.45]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12), whiteLight);
    head.position.set(x, 1.45, 3.98);
    head.scale.z = 0.25;
    group.add(head);
  }

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.58), paint);
  spoiler.position.set(0, 2.05, -3.95);
  group.add(spoiler);

  for (const x of [-2.28, 2.28]) {
    for (const z of [-2.65, 2.55]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.5, 32), rubber);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(x, 0.62, z);
      group.add(tyre);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.54, 24), alloy);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.62, z);
      group.add(wheel);

      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.62), alloy);
        spoke.position.set(x + Math.sign(x) * 0.02, 0.62, z);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (Math.PI * 2 / 5) * i;
        group.add(spoke);
      }
    }
  }

  group.scale.set(1.08, 1.0, 1.08);

  group.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}
