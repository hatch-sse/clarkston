import * as THREE from 'three';
import { project } from '../core/Geo.js';

const BOUNDS = '55.7830,-4.2885,55.7975,-4.2590';

export class OSMClarkstonWorld {
  constructor(scene) {
    this.scene = scene;
    this.roads = [];
    this.buildings = [];
    this.colliders = [];

    this.materials = {
      road: new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.95 }),
      mainRoad: new THREE.MeshStandardMaterial({ color: 0x24282d, roughness: 0.94 }),
      pavement: new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 1 }),
      building: new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.95 }),
      shop: new THREE.MeshStandardMaterial({ color: 0xd1bea0, roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x70685c, roughness: 1 }),
      white: new THREE.MeshBasicMaterial({ color: 0xf1ead8 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xd7bc38 })
    };
  }

  async load() {
    const query = `[out:json][timeout:25];(way["highway"](${BOUNDS});way["building"](${BOUNDS});way["railway"](${BOUNDS}););out body;>;out skel qt;`;
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    let data = null;

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 14000);
        const response = await fetch(endpoint, {
          method: 'POST',
          body: query,
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error('OSM endpoint failed');
        data = await response.json();
        break;
      } catch (error) {
        console.warn('OSM endpoint unavailable', endpoint, error);
      }
    }

    if (!data) throw new Error('Could not load Clarkston OSM data');

    const nodes = new Map();
    for (const item of data.elements) {
      if (item.type === 'node') {
        const p = project(item.lat, item.lon);
        nodes.set(item.id, new THREE.Vector2(p.x, p.z));
      }
    }

    let roadCount = 0;
    let buildingCount = 0;

    for (const item of data.elements) {
      if (item.type !== 'way' || !item.nodes) continue;

      const points = item.nodes.map(id => nodes.get(id)).filter(Boolean);
      if (points.length < 2) continue;

      const tags = item.tags || {};

      if (tags.highway) {
        this.addRoad(points, tags);
        roadCount++;
      }

      if (tags.railway) {
        this.addRail(points);
      }

      if (tags.building) {
        this.addBuilding(points, tags);
        buildingCount++;
      }
    }

    return { roadCount, buildingCount };
  }

  addSegment(a, b, width, height, material, y) {
    const length = a.distanceTo(b);
    if (length < 0.5) return;

    const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);

    mesh.position.set(mid.x, y, mid.y);
    mesh.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  addRoad(points, tags) {
    const highway = tags.highway || 'residential';
    const main = ['primary', 'secondary', 'tertiary', 'trunk'].includes(highway);
    const foot = ['footway', 'path', 'cycleway', 'pedestrian', 'steps'].includes(highway);
    const width = main ? 11.5 : foot ? 2.2 : 6.8;

    this.roads.push({ points, main, foot, name: tags.name || '' });

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      if (foot) {
        this.addSegment(a, b, width, 0.05, this.materials.pavement, 0.12);
      } else {
        this.addSegment(a, b, width + 5.4, 0.035, this.materials.pavement, 0.04);
        this.addSegment(a, b, width, 0.08, main ? this.materials.mainRoad : this.materials.road, 0.09);
        this.addRoadMarkings(a, b, width, main);
      }
    }
  }

  addRoadMarkings(a, b, width, main) {
    if (!main) return;

    const length = a.distanceTo(b);
    if (length < 20) return;

    const dir = new THREE.Vector2().subVectors(b, a).normalize();

    for (let d = 8; d < length - 8; d += 24) {
      const p1 = a.clone().addScaledVector(dir, d);
      const p2 = a.clone().addScaledVector(dir, Math.min(d + 10, length));
      this.addSegment(p1, p2, 0.38, 0.025, this.materials.white, 0.15);
    }
  }

  addRail(points) {
    for (let i = 0; i < points.length - 1; i++) {
      this.addSegment(points[i], points[i + 1], 3.2, 0.08, this.materials.road, 0.1);
    }
  }

  makeShape(points) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
    shape.closePath();
    return shape;
  }

  addBuilding(points, tags) {
    if (points.length < 3) return;

    const height = Number(tags.height) || Number(tags['building:levels']) * 3.1 || (tags.shop ? 7 : 7 + Math.random() * 7);
    const geometry = new THREE.ExtrudeGeometry(this.makeShape(points), {
      depth: height,
      bevelEnabled: false
    });

    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, tags.shop ? this.materials.shop : this.materials.building);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh).expandByScalar(0.8);
    this.colliders.push(box);
    this.buildings.push(points);
  }

  collides(position, radius = 3) {
    const box = new THREE.Box3(
      new THREE.Vector3(position.x - radius, 0, position.z - radius),
      new THREE.Vector3(position.x + radius, 8, position.z + radius)
    );

    return this.colliders.some(collider => collider.intersectsBox(box));
  }
}
