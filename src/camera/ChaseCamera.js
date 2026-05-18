import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
    this.offset = new THREE.Vector3(0, 5, -11);
    this.lookOffset = new THREE.Vector3(0, 2, 8);
    this.position = new THREE.Vector3();
    this.look = new THREE.Vector3();
  }

  update(delta) {
    const desiredPosition = this.offset.clone()
      .applyQuaternion(this.target.quaternion)
      .add(this.target.position);

    const desiredLook = this.lookOffset.clone()
      .applyQuaternion(this.target.quaternion)
      .add(this.target.position);

    const smoothing = 1 - Math.pow(0.001, delta);

    this.position.lerp(desiredPosition, smoothing);
    this.look.lerp(desiredLook, smoothing);

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
  }
}
