const sourceUrl = new URL('./live-game-v5.js?v=20260529c', import.meta.url);
let source = await fetch(sourceUrl).then(response => {
  if (!response.ok) throw new Error(`Unable to load game source: ${response.status}`);
  return response.text();
});

const roadImport = new URL('./data/clarkstonRoads.js?v=20260529h', import.meta.url).href;
const inputImport = new URL('./core/Input.js', import.meta.url).href;

function patch(find, replacement) {
  if (!source.includes(find)) throw new Error(`Patch target missing: ${find.slice(0, 80)}`);
  source = source.replace(find, replacement);
}

patch(
  "import { CLARKSTON_ROAD_ROWS } from './data/clarkstonRoads.js?v=20260529h';",
  `import { CLARKSTON_ROAD_ROWS } from '${roadImport}';`
);
patch(
  "import { Input } from './core/Input.js';",
  `import { Input } from '${inputImport}';`
);
patch(
  "const trains = [];\nlet vehicles = [];",
  "const trains = [];\nconst traffic = [];\nlet vehicles = [];"
);
patch(
  "  { name: 'Sports Coupe', color: '#b82732', roof: '#111827', width: 10, length: 20, maxSpeed: 610, accel: 560, brake: 610, turn: 3.0, drag: .955, engine: 168 }\n];",
  "  { name: 'Sports Coupe', color: '#b82732', roof: '#111827', width: 10, length: 20, maxSpeed: 610, accel: 560, brake: 610, turn: 3.0, drag: .955, engine: 168 },\n  { name: 'City Bus', color: '#c91f37', roof: '#e5e7eb', width: 12, length: 34, maxSpeed: 330, accel: 245, brake: 430, turn: 1.8, drag: .975, engine: 72 },\n  { name: 'Delivery Truck', color: '#f4f0dc', roof: '#7f8a95', width: 12, length: 30, maxSpeed: 360, accel: 270, brake: 455, turn: 1.9, drag: .972, engine: 82 }\n];"
);
patch(
  "function parseRoads() {\n  let id = 0;",
  "function parseRoads() {\n  let id = 0;\n  map.labels = [];"
);
patch(
  "  }).filter(Boolean);\n}\nfunction buildJunctions() {",
  `  }).filter(Boolean);
  cleanRoadNetwork();
  map.labels = [];
  for (const road of map.roads) if (road.name && road.main) addLabel(road.name, road.points[Math.floor(road.points.length / 2)].x, road.points[Math.floor(road.points.length / 2)].y);
}
function isNearWorldEdge(p, margin = 84) {
  return p.x < margin || p.y < margin || p.x > world.width - margin || p.y > world.height - margin;
}
function endpointKey(p) {
  return \`\${Math.round(p.x / 56)}:\${Math.round(p.y / 56)}\`;
}
function connectedRoadCount(point, roads) {
  let count = 0;
  for (const road of roads) {
    const a = road.points[0], b = road.points[road.points.length - 1];
    if (Math.hypot(point.x - a.x, point.y - a.y) < 62 || Math.hypot(point.x - b.x, point.y - b.y) < 62) count++;
  }
  return count;
}
function cleanRoadNetwork() {
  const drivable = map.roads.filter(r => !r.foot);
  const usable = [];
  for (const road of map.roads) {
    if (road.foot) { usable.push(road); continue; }
    const start = road.points[0], end = road.points[road.points.length - 1];
    const edgeStart = isNearWorldEdge(start), edgeEnd = isNearWorldEdge(end);
    const hasInteriorConnection = connectedRoadCount(start, drivable) > 1 || connectedRoadCount(end, drivable) > 1;
    if ((edgeStart || edgeEnd) && !road.main) continue;
    if (edgeStart && edgeEnd && !hasInteriorConnection) continue;
    usable.push(road);
  }
  const roadSet = usable.filter(r => !r.foot);
  const graph = new Map();
  for (const road of roadSet) for (const key of [endpointKey(road.points[0]), endpointKey(road.points[road.points.length - 1])]) {
    if (!graph.has(key)) graph.set(key, []);
    graph.get(key).push(road);
  }
  const seen = new Set(), components = [];
  for (const road of roadSet) {
    if (seen.has(road.id)) continue;
    const stack = [road], roads = [];
    seen.add(road.id);
    while (stack.length) {
      const current = stack.pop();
      roads.push(current);
      for (const key of [endpointKey(current.points[0]), endpointKey(current.points[current.points.length - 1])]) {
        for (const next of graph.get(key) || []) if (!seen.has(next.id)) { seen.add(next.id); stack.push(next); }
      }
    }
    components.push(roads);
  }
  const largest = components.sort((a, b) => b.length - a.length)[0] || [];
  const keepIds = new Set(largest.map(r => r.id));
  for (const group of components) if (group.some(r => r.main) && group.length > 4) for (const road of group) keepIds.add(road.id);
  map.roads = usable.filter(road => road.foot || keepIds.has(road.id)).map(road => ({ ...road, bounds: boundsOf(road.points) }));
}
function buildJunctions() {`
);
patch(
  "function applyFeatures(features) {\n  map.buildings = (features.buildings || []).map((points, i) => ({ points, bounds: boundsOf(points), color: rand(i) > .93 ? '#bda56f' : '#8e7963' }));",
  "function applyFeatures(features) {\n  map.buildings = (features.buildings || []).filter(points => !buildingBlocksRoad(points)).map((points, i) => ({ points, bounds: boundsOf(points), color: rand(i) > .93 ? '#bda56f' : '#8e7963' }));"
);
patch(
  "  makeTrees();\n}\nfunction makeTrees() {",
  "  makeTrees();\n}\nfunction buildingBlocksRoad(points) {\n  const c = centroid(points);\n  if (isOnRoad(c.x, c.y, 24)) return true;\n  return points.some(p => isOnRoad(p.x, p.y, 12));\n}\nfunction makeTrees() {"
);
patch(
  "  for (const road of map.roads.filter(r => !r.foot && r.width >= 30)) for (let i = 0; i < road.points.length - 1 && made < 56; i++) {",
  "  for (const road of map.roads.filter(r => !r.foot && r.width >= 30)) for (let i = 0; i < road.points.length - 1 && made < 92; i++) {"
);
patch(
  "    for (let d = 75; d < length - 50 && made < 56; d += 220) {",
  "    for (let d = 75; d < length - 50 && made < 92; d += 185) {"
);
patch(
  "      vehicles.push(createVehicle(x, y, angle, 1 + made));",
  "      const typeIndex = made % 17 === 0 ? 5 : made % 23 === 0 ? 6 : 1 + made;\n      vehicles.push(createVehicle(x, y, angle, typeIndex));"
);
patch(
  "}\nfunction updateVehicle(v, delta) {",
  `}
function setupTraffic() {
  traffic.length = 0;
  const roads = map.roads.filter(r => !r.foot && r.width >= 30 && r.points.length > 2);
  let made = 0;
  for (let i = 0; i < roads.length && made < 38; i += Math.max(1, Math.floor(roads.length / 44))) {
    const road = roads[i], segment = Math.min(road.points.length - 2, 1 + Math.floor(rand(i + 21) * Math.max(1, road.points.length - 2)));
    const typeIndex = made % 11 === 0 ? 5 : made % 8 === 0 ? 6 : (made % 4) + 1;
    const v = createVehicle(0, 0, 0, typeIndex);
    v.ai = { road, segment, t: rand(i + 44), direction: rand(i + 12) > .5 ? 1 : -1, speed: 52 + rand(i + 91) * 58 };
    placeTrafficVehicle(v);
    traffic.push(v);
    made++;
  }
}
function placeTrafficVehicle(v) {
  const { road, segment, t, direction } = v.ai;
  const a = road.points[segment], b = road.points[segment + 1];
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length;
  const lane = Math.min(road.width * .23, 10) * direction;
  v.x = a.x + dx * t + uy * lane;
  v.y = a.y + dy * t - ux * lane;
  v.angle = Math.atan2(dy, dx) + (direction < 0 ? Math.PI : 0);
}
function updateTraffic(delta) {
  for (const v of traffic) {
    if (!v.ai.road.points[v.ai.segment + 1]) continue;
    const a = v.ai.road.points[v.ai.segment], b = v.ai.road.points[v.ai.segment + 1];
    const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    v.ai.t += (v.ai.speed * delta / length) * v.ai.direction;
    if (v.ai.t > 1 || v.ai.t < 0) pickNextTrafficSegment(v);
    placeTrafficVehicle(v);
  }
}
function pickNextTrafficSegment(v) {
  const atEnd = v.ai.t > 1;
  const point = atEnd ? v.ai.road.points[v.ai.segment + 1] : v.ai.road.points[v.ai.segment];
  const choices = [];
  for (const road of map.roads.filter(r => !r.foot && r.width >= 30)) for (let i = 0; i < road.points.length - 1; i++) {
    if (Math.hypot(point.x - road.points[i].x, point.y - road.points[i].y) < 58) choices.push({ road, segment: i, direction: 1, t: 0 });
    if (Math.hypot(point.x - road.points[i + 1].x, point.y - road.points[i + 1].y) < 58) choices.push({ road, segment: i, direction: -1, t: 1 });
  }
  const next = choices[Math.floor(rand(performance.now() + v.x + v.y) * choices.length)] || {
    road: v.ai.road,
    segment: Math.max(0, Math.min(v.ai.road.points.length - 2, v.ai.segment + (atEnd ? 1 : -1))),
    direction: atEnd ? 1 : -1,
    t: atEnd ? 0 : 1
  };
  Object.assign(v.ai, next);
}
function updateVehicle(v, delta) {`
);
patch(
  "  if (v.name === 'Taxi') { ctx.fillStyle='#f8fafc'; ctx.fillRect(-3,-2,6,4); }\n  if (active) {",
  "  if (v.name === 'Taxi') { ctx.fillStyle='#f8fafc'; ctx.fillRect(-3,-2,6,4); }\n  if (v.name === 'City Bus') { ctx.fillStyle='#dbeafe'; for (let y = -v.length * .36; y < v.length * .24; y += 7) ctx.fillRect(-v.width * .36, y, v.width * .72, 3); }\n  if (v.name === 'Delivery Truck') { ctx.fillStyle='#e5e7eb'; ctx.fillRect(-v.width * .42, -v.length * .05, v.width * .84, v.length * .38); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=1; ctx.strokeRect(-v.width * .42, -v.length * .05, v.width * .84, v.length * .38); }\n  if (active) {"
);
patch(
  "drawMap(); checkpoints.forEach(drawCheckpoint); trains.forEach(drawTrain); for (const v of vehicles) drawVehicle(v,v===activeVehicle);",
  "drawMap(); checkpoints.forEach(drawCheckpoint); trains.forEach(drawTrain); traffic.forEach(v => drawVehicle(v, false)); for (const v of vehicles) drawVehicle(v,v===activeVehicle);"
);
patch(
  "updateRace(); updateCamera(); updateTrains(delta); updateAudio(delta);",
  "updateRace(); updateCamera(); updateTrains(delta); updateTraffic(delta); updateAudio(delta);"
);
patch(
  "setupTrains(); placeVehicles(); bestEl.textContent",
  "setupTrains(); placeVehicles(); setupTraffic(); bestEl.textContent"
);

await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
