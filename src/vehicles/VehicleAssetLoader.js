import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';
import { createPorsche911 } from './Porsche911.js';

const HIGH_DETAIL_CAR_URL = 'https://threejs.org/examples/models/gltf/ferrari.glb';

export async function createRealisticVehicle() {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(HIGH_DETAIL_CAR_URL);
    const car = gltf.scene;

    car.name = 'High detail sports car placeholder';
    car.scale.set(0.9, 0.9, 0.9);
    car.rotation.y = Math.PI;

    const box = new THREE.Box3().setFromObject(car);
    const centre = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(centre);
    box.getSize(size);

    car.position.sub(centre);
    car.position.y += size.y / 2;

    car.traverse(obj => {
      if (!obj.isMesh) return;

      obj.castShadow = true;
      obj.receiveShadow = true;

      if (obj.material) {
        obj.material.envMapIntensity = 1.15;
        obj.material.needsUpdate = true;
      }
    });

    return car;
  } catch (error) {
    console.warn('High-detail car failed to load. Falling back to procedural car.', error);
    return createPorsche911();
  }
}
