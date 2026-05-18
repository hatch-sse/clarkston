import * as THREE from 'three';

export function createPorsche911() {
  const group = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({
    color: 0xc61f26,
    roughness: 0.32,
    metalness: 0.08
  });

  const glass = new THREE.MeshStandardMaterial({
    color: 0x1c2b3d,
    roughness: 0.15,
    metalness: 0.15
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.05, 7.6),
    paint
  );
  body.position.y = 1.05;

  const bonnet = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 0.45, 2.4),
    paint
  );
  bonnet.position.set(0, 1.45, 2.25);
  bonnet.rotation.x = -0.08;

  const rear = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 0.75, 2.2),
    paint
  );
  rear.position.set(0, 1.55, -2.55);
  rear.rotation.x = 0.06;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.3, 2.3),
    glass
  );
  cabin.position.set(0, 2.0, -0.4);

  group.add(body, bonnet, rear, cabin);

  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  for (const x of [-2.1, 2.1]) {
    for (const z of [-2.5, 2.5]) {
      const tyre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.45, 20),
        tyreMat
      );

      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(x, 0.6, z);
      group.add(tyre);
    }
  }

  group.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}
