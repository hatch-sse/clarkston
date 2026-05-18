import * as THREE from 'three';

export function createRoadGrid(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let i = -8; i <= 8; i++) {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.1, 400),
      roadMat
    );

    road.position.set(i * 30, 0, 0);
    road.receiveShadow = true;
    scene.add(road);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 400),
      lineMat
    );

    line.position.set(i * 30, 0.06, 0);
    scene.add(line);
  }

  for (let i = -8; i <= 8; i++) {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(400, 0.1, 12),
      roadMat
    );

    road.position.set(0, 0.01, i * 30);
    road.receiveShadow = true;
    scene.add(road);
  }
}
