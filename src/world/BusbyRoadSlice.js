import * as THREE from 'three';

function makeLabel(text, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addBox(scene, x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export class BusbyRoadSlice {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.roads = [];
    this.buildings = [];

    this.mat = {
      grass: new THREE.MeshStandardMaterial({ color: 0x6e9d62, roughness: 1 }),
      road: new THREE.MeshPhysicalMaterial({ color: 0x171c20, roughness: 0.28, metalness: 0.04, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
      pavement: new THREE.MeshStandardMaterial({ color: 0xb9b5aa, roughness: 0.9 }),
      kerb: new THREE.MeshStandardMaterial({ color: 0x8f8b83, roughness: 0.85 }),
      sandstone: new THREE.MeshStandardMaterial({ color: 0xa89270, roughness: 0.95 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x8b6049, roughness: 0.95 }),
      slate: new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x14283a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.7 }),
      hedge: new THREE.MeshStandardMaterial({ color: 0x2f7138, roughness: 1 }),
      bark: new THREE.MeshStandardMaterial({ color: 0x5a3921, roughness: 1 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x2f7d3d, roughness: 1 }),
      white: new THREE.MeshBasicMaterial({ color: 0xf2eee1 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xe0bd3a }),
      black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),
      red: new THREE.MeshStandardMaterial({ color: 0x9b111e, roughness: 0.45 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x234f8a, roughness: 0.45 }),
      silver: new THREE.MeshStandardMaterial({ color: 0xbfc5c7, roughness: 0.35, metalness: 0.3 })
    };
  }

  getHeight(x, z) {
    return -z * 0.035 + Math.sin(x * 0.02) * 0.3;
  }

  addCollider(mesh) {
    mesh.updateMatrixWorld(true);
    this.colliders.push(new THREE.Box3().setFromObject(mesh).expandByScalar(0.5));
  }

  async load() {
    this.addGround();
    this.addRoad();
    this.addHighStreet();
    this.addResidentialRows();
    this.addDetails();
    this.addParkedCars();
    this.addTrees();
    this.addGiveWayAndJunction();
    return { roadCount: 1, buildingCount: this.buildings.length };
  }

  addGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 760), this.mat.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  addRoad() {
    const road = addBox(this.scene, 0, 0.02, 0, 20, 0.08, 700, this.mat.road);
    road.rotation.x = 0.035;
    this.roads.push({ points: [new THREE.Vector2(0, -350), new THREE.Vector2(0, 350)], main: true });

    for (const x of [-13.5, 13.5]) addBox(this.scene, x, 0.05, 0, 6, 0.08, 700, this.mat.pavement).rotation.x = 0.035;
    for (const x of [-10.2, 10.2]) addBox(this.scene, x, 0.13, 0, 0.45, 0.18, 700, this.mat.kerb).rotation.x = 0.035;
    for (const x of [-8.8, 8.8]) addBox(this.scene, x, 0.19, 0, 0.25, 0.03, 700, this.mat.yellow).rotation.x = 0.035;
    for (let z = -320; z < 320; z += 34) addBox(this.scene, 0, 0.2, z, 0.38, 0.03, 13, this.mat.white).rotation.x = 0.035;

    // Subtle wet patches/reflections on the carriageway.
    for (let z = -300; z < 320; z += 42) {
      const patch = addBox(this.scene, (Math.random() - 0.5) * 7, 0.225, z, 5 + Math.random() * 5, 0.01, 7 + Math.random() * 8, this.mat.black);
      patch.material = new THREE.MeshPhysicalMaterial({ color: 0x0d1114, roughness: 0.08, metalness: 0.02, clearcoat: 1, transparent: true, opacity: 0.35 });
    }
  }

  addShop(x, z, w, name, colour) {
    const b = addBox(this.scene, x, 0, z, w, 11, 15, this.mat.sandstone);
    this.addCollider(b);
    this.buildings.push(b);
    addBox(this.scene, x, 11, z, w + 1, 2, 16, this.mat.slate);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 16), 3), new THREE.MeshBasicMaterial({ map: makeLabel(name, colour) }));
    sign.position.set(x, 5.8, z - Math.sign(z || 1) * 7.7);
    sign.rotation.y = z < 0 ? Math.PI : 0;
    this.scene.add(sign);

    for (let i = -1; i <= 1; i++) addBox(this.scene, x + i * 4, 2.4, z - Math.sign(z || 1) * 7.8, 2.5, 3.2, 0.25, this.mat.glass);

    // Doors, awnings and small shop depth.
    addBox(this.scene, x, 0.25, z - Math.sign(z || 1) * 7.95, 2.2, 4.2, 0.2, this.mat.black);
    addBox(this.scene, x, 4.9, z - Math.sign(z || 1) * 8.15, w - 2, 0.35, 1.1, this.mat.slate);
  }

  addHighStreet() {
    const left = -29;
    const right = 29;
    const names = ['CAFE', 'PHARMACY', 'BAKERY', 'NEWS', 'OPTICIAN', 'BARBER'];
    const colours = ['#5b3415', '#1f5e8c', '#7c2d12', '#7f1d1d', '#1e3a8a', '#111111'];
    for (let i = 0; i < names.length; i++) {
      this.addShop(left, -120 + i * 34, 18 + (i % 2) * 4, names[i], colours[i]);
      this.addShop(right, -118 + i * 34, 18 + ((i + 1) % 2) * 4, names[(i + 2) % names.length], colours[(i + 2) % colours.length]);
    }
  }

  addResidentialRows() {
    for (const side of [-1, 1]) {
      const x = side * 32;
      for (let z = 120; z < 330; z += 26) {
        const house = addBox(this.scene, x, 0, z, 14, 9.5, 15, this.mat.brick);
        this.addCollider(house);
        this.buildings.push(house);
        addBox(this.scene, x, 9.5, z, 15, 3, 16, this.mat.slate);
        addBox(this.scene, x - 3, 3, z - side * 7.7, 2.4, 3, 0.2, this.mat.glass);
        addBox(this.scene, x + 3, 3, z - side * 7.7, 2.4, 3, 0.2, this.mat.glass);
        addBox(this.scene, x, 0.2, z - side * 9.5, 10, 1.4, 1.0, this.mat.hedge);
      }
    }
  }

  addDetails() {
    for (let z = -330; z < 340; z += 34) {
      addBox(this.scene, -20, 0, z, 2.2, 2.1, 22, this.mat.hedge);
      addBox(this.scene, 20, 0, z + 12, 2.2, 2.1, 22, this.mat.hedge);
    }

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.25, roughness: 0.6 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4 });
    for (let z = -300; z < 330; z += 58) {
      for (const x of [-12, 12]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 10), poleMat);
        pole.position.set(x, 4, z);
        pole.castShadow = true;
        this.scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), lampMat);
        lamp.position.set(x, 8.2, z + 1.2);
        this.scene.add(lamp);
      }
    }
  }

  addParkedCars() {
    const colours = [this.mat.blue, this.mat.silver, this.mat.red, this.mat.black];
    let i = 0;
    for (const side of [-1, 1]) {
      for (let z = -250; z <= 260; z += 95) {
        const mat = colours[i++ % colours.length];
        const car = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 7.2), mat);
        body.position.set(side * 6.7, 0.8, z);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 2.8), this.mat.glass);
        cabin.position.set(side * 6.7, 1.9, z - 0.4);
        car.add(body, cabin);
        car.rotation.y = side < 0 ? Math.PI : 0;
        car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.scene.add(car);
      }
    }
  }

  addTrees() {
    for (const side of [-1, 1]) {
      for (let z = -280; z < 330; z += 78) {
        const x = side * (17 + Math.random() * 3);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.6, 8), this.mat.bark);
        trunk.position.set(x, 2.3, z);
        trunk.castShadow = true;
        this.scene.add(trunk);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 2), this.mat.leaves);
        leaves.position.set(x, 6.5, z);
        leaves.castShadow = true;
        this.scene.add(leaves);
      }
    }
  }

  addGiveWayAndJunction() {
    for (let i = 0; i < 3; i++) addBox(this.scene, -3 + i * 3, 0.24, -158, 1.8, 0.03, 0.4, this.mat.white);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sign = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.5, 3), signMat);
    sign.rotation.z = Math.PI;
    sign.position.set(-7.5, 4.4, -165);
    this.scene.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), this.mat.black);
    pole.position.set(-7.5, 2, -165);
    this.scene.add(pole);
  }

  collides(position, radius = 3) {
    const box = new THREE.Box3(new THREE.Vector3(position.x - radius, 0, position.z - radius), new THREE.Vector3(position.x + radius, 8, position.z + radius));
    return this.colliders.some(c => c.intersectsBox(box));
  }
}
