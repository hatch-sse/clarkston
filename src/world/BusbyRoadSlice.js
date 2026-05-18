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
      road: new THREE.MeshPhysicalMaterial({ color: 0x20252a, roughness: 0.35, metalness: 0.04, clearcoat: 0.45, clearcoatRoughness: 0.2 }),
      pavement: new THREE.MeshStandardMaterial({ color: 0xb9b5aa, roughness: 0.9 }),
      kerb: new THREE.MeshStandardMaterial({ color: 0x8f8b83, roughness: 0.85 }),
      sandstone: new THREE.MeshStandardMaterial({ color: 0xa89270, roughness: 0.95 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x8b6049, roughness: 0.95 }),
      slate: new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x14283a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.7 }),
      hedge: new THREE.MeshStandardMaterial({ color: 0x2f7138, roughness: 1 }),
      white: new THREE.MeshBasicMaterial({ color: 0xf2eee1 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xe0bd3a }),
      black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 })
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
      }
    }
  }

  addDetails() {
    for (let z = -330; z < 340; z += 34) {
      addBox(this.scene, -20, 0, z, 2.2, 2.1, 22, this.mat.hedge);
      addBox(this.scene, 20, 0, z + 12, 2.2, 2.1, 22, this.mat.hedge);
    }

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.25, roughness: 0.6 });
    for (let z = -300; z < 330; z += 58) {
      for (const x of [-12, 12]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 10), poleMat);
        pole.position.set(x, 4, z);
        pole.castShadow = true;
        this.scene.add(pole);
      }
    }
  }

  collides(position, radius = 3) {
    const box = new THREE.Box3(new THREE.Vector3(position.x - radius, 0, position.z - radius), new THREE.Vector3(position.x + radius, 8, position.z + radius));
    return this.colliders.some(c => c.intersectsBox(box));
  }
}
