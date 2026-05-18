import * as THREE from 'three';

export class VehicleController {
  constructor(vehicle, input) {
    this.vehicle = vehicle;
    this.input = input;
    this.speed = 0;
    this.maxSpeed = 85;
    this.reverseSpeed = -28;
  }

  update(delta) {
    const throttle = this.input.down('w', 'arrowup') ? 1 : 0;
    const brake = this.input.down('s', 'arrowdown') ? 1 : 0;
    const steer = this.input.axis('d', 'a') + this.input.axis('arrowright', 'arrowleft');
    const boost = this.input.down('shift');

    const acceleration = boost ? 72 : 44;

    if (throttle) this.speed += acceleration * delta;
    if (brake) this.speed -= acceleration * delta;

    this.speed *= 0.972;
    this.speed = THREE.MathUtils.clamp(this.speed, this.reverseSpeed, boost ? this.maxSpeed : 58);

    if (Math.abs(this.speed) > 0.25) {
      this.vehicle.rotation.y += steer * delta * 1.6 * Math.sign(this.speed);
    }

    const forward = new THREE.Vector3(
      Math.sin(this.vehicle.rotation.y),
      0,
      Math.cos(this.vehicle.rotation.y)
    );

    this.vehicle.position.addScaledVector(forward, this.speed * delta);
  }
}
