import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const N = 64, OFFSET = N / 2, MIN_Y = -36, MAX_Y = 64, BODY = 1.7, CHUNK = 8;
const T = { AIR: 0, DIRT: 1, STONE: 2, GRASS: 3, SNOW: 4, WOOD: 5, ROOF: 6, RUIN: 7, BEDROCK: 8 };
const plane = N * N, volume = plane * (MAX_Y - MIN_Y);
const inside = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
const inWorld = (x, y, z) => inside(x, z) && y >= MIN_Y && y < MAX_Y;
const id = (x, z) => z * N + x;
const index = (x, y, z) => (y - MIN_Y) * plane + id(x, z);
const cellAt = (x, z) => ({ x: Math.floor(x + OFFSET), z: Math.floor(z + OFFSET) });
const world = new Uint8Array(volume), edits = new Map(), heights = [];
const voxel = (x, y, z) => inWorld(x, y, z) ? world[index(x, y, z)] : T.AIR;
const put = (x, y, z, type) => { if (inWorld(x, y, z)) world[index(x, y, z)] = type; };
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a4d8ed'); scene.fog = new THREE.Fog('#a4d8ed', 42, 115);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 170); camera.rotation.order = 'YXZ';
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
catch (e) { $('message').textContent = '3D描画にはWebGL対応ブラウザが必要です。'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; $('world').append(renderer.domElement);
const ambient = new THREE.HemisphereLight(0xdceeff, 0x657d39, 2.2); scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffefc2, 2.5); sun.position.set(25, 60, 10); scene.add(sun);
const mat = color => new THREE.MeshLambertMaterial({ color, vertexColors: true });
const grass = mat('#79a447'), dirt = mat('#886243'), stone = mat('#657886'), snow = mat('#e6f3f7');
const bark = mat('#916f47'), roof = mat('#a05c49'), ruin = mat('#91b5a5'), bedrock = mat('#39404a');
const metal = new THREE.MeshLambertMaterial({ color: '#dce0d8' }), wood = new THREE.MeshLambertMaterial({ color: '#805233' });
function pixelTexture(base, colors) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 100; i++) { g.fillStyle = colors[i % colors.length]; g.fillRect((i * 7) % 16, Math.floor(i * 17 / 11) % 16, 1 + (i % 2), 1); }
  const texture = new THREE.CanvasTexture(c); texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
grass.map = pixelTexture('#d5e5b7', ['#c3d39d', '#e2edc5', '#a9c089']);
dirt.map = pixelTexture('#dbc9ab', ['#bba583', '#edd9b9', '#b09a7c']);
stone.map = pixelTexture('#cad6da', ['#9aaeb8', '#dfebee', '#718b99']);
bark.map = pixelTexture('#cfb893', ['#a18762', '#eed9ae']);
ruin.map = pixelTexture('#d4dfd3', ['#9fb1a1', '#dde7cc', '#84978b']);
roof.map = pixelTexture('#dec7b2', ['#bda48e', '#efd9c2']);
const materials = [dirt, stone, grass, snow, bark, roof, ruin, bedrock];
const cube = new THREE.BoxGeometry(1, 1, 1);
for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
  const main = 40 * Math.exp(-((x - 44) ** 2 + (z - 43) ** 2) / 190);
  const ridge = 24 * Math.exp(-((x - 49) ** 2 + (z - 19) ** 2) / 90);
  const valley = 4 * Math.exp(-((x - 14) ** 2 + (z - 46) ** 2) / 120);
  const h = Math.max(3, Math.floor(9 + main + ridge - valley + 1.8 * Math.sin(x * .19) * Math.cos(z * .16)));
  heights.push(h);
  for (let y = MIN_Y; y < h; y++) put(x, y, z, y === MIN_Y ? T.BEDROCK : h >= 37 && y >= h - 3 ? T.SNOW : h >= 22 ? T.STONE : y === h - 1 ? T.GRASS : y >= h - 3 ? T.DIRT : T.STONE);
}
// Entirely sealed underground. Mining must expose the chamber before entry.
// A natural rock terrace along its north rim can carry a descending railway.
const caveCells = new Map();
for (let z = 31; z <= 55; z++) for (let x = 29; x <= 57; x++) {
  if (((x - 43) / 14.2) ** 2 + ((z - 43) / 12.2) ** 2 > 1) continue;
  const floor = z <= 36 ? Math.max(-24, -4 - (x - 30)) : -24;
  const ceiling = -4 + Math.floor(1.5 * Math.sin(x * .19) * Math.cos(z * .13));
  if (floor >= ceiling) continue;
  caveCells.set(id(x, z), { floor, ceiling });
  for (let y = floor; y < ceiling; y++) put(x, y, z, T.AIR);
}
function caveAt(x, z) { return inside(x, z) ? caveCells.get(id(x, z)) : undefined; }
function inCave(x, z, feet) { const c = cellAt(x, z), cave = caveAt(c.x, c.z); return !!cave && feet >= cave.floor - 1 && feet < cave.ceiling; }
const structures = [];
function fillBox(x0, y0, z0, sx, sy, sz, type) { for (let z = z0; z < z0 + sz; z++) for (let x = x0; x < x0 + sx; x++) for (let y = y0; y < y0 + sy; y++) put(x, y, z, type); }
function flatten(x0, z0, sx, sz, level) {
  for (let z = z0; z < z0 + sz; z++) for (let x = x0; x < x0 + sx; x++) {
    for (let y = MIN_Y + 1; y < MAX_Y; y++) if (y >= level) put(x, y, z, T.AIR); else if (y >= heights[id(x, z)] - 1) put(x, y, z, y === level - 1 ? T.GRASS : level >= 20 ? T.STONE : T.DIRT);
    heights[id(x, z)] = level;
  }
}
// Enterable timber cabin with a pitched roof and open windows.
const cabinX = 13, cabinZ = 18, cabinY = heights[id(16, 21)];
flatten(cabinX, cabinZ, 7, 7, cabinY);
fillBox(cabinX, cabinY - 1, cabinZ, 7, 1, 7, T.WOOD);
for (let y = cabinY; y < cabinY + 4; y++) for (let x = cabinX; x < cabinX + 7; x++) for (let z = cabinZ; z < cabinZ + 7; z++) {
  if (x === cabinX || x === cabinX + 6 || z === cabinZ || z === cabinZ + 6) put(x, y, z, T.WOOD);
}
fillBox(cabinX + 3, cabinY, cabinZ, 1, 3, 1, T.AIR);
for (const x of [cabinX, cabinX + 6]) fillBox(x, cabinY + 1, cabinZ + 2, 1, 2, 3, T.AIR);
for (let layer = 0; layer < 4; layer++) fillBox(cabinX - 1 + layer, cabinY + 4 + layer, cabinZ - 1, 9 - layer * 2, 1, 9, T.ROOF);
fillBox(cabinX + 1, cabinY, cabinZ + 5, 2, 1, 1, T.WOOD);
structures.push({ name: '旅人の山小屋', x: 16, z: 21, y: cabinY });
// A climbable open watchtower, with a spiral staircase and an observation deck.
const towerX = 24, towerZ = 16, towerY = heights[id(26, 18)];
flatten(towerX, towerZ, 5, 5, towerY);
for (const dx of [0, 4]) for (const dz of [0, 4]) fillBox(towerX + dx, towerY, towerZ + dz, 1, 11, 1, T.WOOD);
const spiral = [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2]];
fillBox(towerX, towerY + 9, towerZ, 5, 1, 5, T.WOOD);
fillBox(towerX + 1, towerY + 9, towerZ + 1, 2, 1, 2, T.AIR);
for (let i = 0; i < 10; i++) { const [dx, dz] = spiral[i % 8]; put(towerX + dx, towerY + i, towerZ + dz, T.WOOD); }
for (let k = 0; k < 5; k++) for (const edge of [0, 4]) { put(towerX + k, towerY + 10, towerZ + edge, T.WOOD); put(towerX + edge, towerY + 10, towerZ + k, T.WOOD); }
structures.push({ name: '風見の見張り塔', x: 26, z: 18, y: towerY + 10 });
// Ruins are a digging landmark, not an already open entrance.
const ruinX = 33, ruinZ = 35, ruinY = heights[id(ruinX, ruinZ)];
flatten(ruinX - 3, ruinZ - 3, 7, 7, ruinY);
for (const [dx, dz, h] of [[-3, -3, 4], [3, -3, 3], [-3, 3, 2], [3, 3, 4]]) fillBox(ruinX + dx, ruinY, ruinZ + dz, 1, h, 1, T.RUIN);
for (let k = -2; k <= 2; k++) { put(ruinX + k, ruinY - 1, ruinZ - 2, T.RUIN); put(ruinX + k, ruinY - 1, ruinZ + 2, T.RUIN); }
put(ruinX, ruinY - 1, ruinZ, T.DIRT);
structures.push({ name: '地鳴りの遺跡', x: ruinX, z: ruinZ, y: ruinY });
// A stair path reaches the ruins without opening the underground chamber.
for (let z = 18; z < 32; z++) flatten(ruinX - 1, z, 3, 1, ruinY - (32 - z));
// Preserve original solids so sparse voxel edits can be saved and validated.
const original = world.slice();
const faces = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];
const chunks = new Map(), dirty = new Set();
function chunkKey(x, z) { return `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`; }
function rebuildChunk(cx, cz) {
  const buckets = materials.map(() => ({ p: [], n: [], uv: [], c: [] }));
  for (let z = cz * CHUNK; z < (cz + 1) * CHUNK; z++) for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) for (let y = MIN_Y; y < MAX_Y; y++) {
    const type = voxel(x, y, z); if (!type) continue;
    for (const face of faces) {
      const [dx, dy, dz] = face.n; if (voxel(x + dx, y + dy, z + dz)) continue;
      const material = type === T.GRASS ? (dy === 1 ? 2 : 0) : type === T.SNOW ? 3 : [0, 0, 1, 2, 3, 4, 5, 6, 7][type];
      const bucket = buckets[material], shade = .91 + ((x * 13 + z * 7 + y * 3) & 7) * .012;
      for (const corner of [0, 1, 2, 0, 2, 3]) {
        const v = face.v[corner]; bucket.p.push(x - OFFSET + v[0], y + v[1], z - OFFSET + v[2]); bucket.n.push(dx, dy, dz);
        bucket.uv.push(...[[0, 0], [0, 1], [1, 1], [1, 0]][corner]); bucket.c.push(shade, shade, shade);
      }
    }
  }
  const geometry = new THREE.BufferGeometry(), p = [], normals = [], uv = [], colors = [];
  buckets.forEach((bucket, i) => { const start = p.length / 3; p.push(...bucket.p); normals.push(...bucket.n); uv.push(...bucket.uv); colors.push(...bucket.c); if (bucket.p.length) geometry.addGroup(start, bucket.p.length / 3, i); });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeBoundingSphere();
  const key = `${cx},${cz}`, mesh = chunks.get(key);
  if (mesh) { mesh.geometry.dispose(); mesh.geometry = geometry; }
  else { const mesh = new THREE.Mesh(geometry, materials); chunks.set(key, mesh); scene.add(mesh); }
}
function rebuildAll() { for (let cz = 0; cz < N / CHUNK; cz++) for (let cx = 0; cx < N / CHUNK; cx++) rebuildChunk(cx, cz); dirty.clear(); }
function setVoxel(x, y, z, type) {
  const i = index(x, y, z); world[i] = type; if (type === original[i]) edits.delete(i); else edits.set(i, type);
  for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) if (inside(x + dx, z + dz)) dirty.add(chunkKey(x + dx, z + dz));
}
function flushChunks() { for (const key of dirty) { const [x, z] = key.split(',').map(Number); rebuildChunk(x, z); } dirty.clear(); }
rebuildAll();
const trees = new THREE.Group(), caveDecor = new THREE.Group(); scene.add(trees, caveDecor);
const obstacles = [];
function block(x, y, z, sx, sy, sz, material, parent = trees) {
  const mesh = new THREE.Mesh(cube, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
}
for (const [x, z] of [[5, 7], [9, 31], [36, 10], [39, 29], [20, 38], [7, 40], [57, 21], [19, 9], [29, 13], [11, 18], [9, 52], [22, 51], [53, 55], [58, 39], [5, 23], [8, 13], [15, 32], [22, 30]]) {
  const y = heights[id(x, z)], wx = x - OFFSET + .5, wz = z - OFFSET + .5;
  obstacles.push({ x: wx, z: wz, y, radius: .55, height: 3, kind: 'tree' });
  const trunk = new THREE.MeshLambertMaterial({ color: '#705135' }), leaves = new THREE.MeshLambertMaterial({ color: '#487c39' });
  block(wx, y + 1.5, wz, .65, 3, .65, trunk); block(wx, y + 3.3, wz, 3, 2, 3, leaves); block(wx, y + 4.5, wz, 2, 1, 2, leaves);
}
function sign(text, x, y, z) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#172e29'; g.fillRect(0, 0, 512, 192); g.strokeStyle = '#bcd58e'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 184);
  g.fillStyle = '#e0f7bc'; g.textAlign = 'center'; g.font = 'bold 29px sans-serif'; text.split('\n').forEach((line, i) => g.fillText(line, 256, 65 + i * 55));
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); mesh.position.set(x - OFFSET + .5, y + 1.7, z - OFFSET + .5); mesh.rotation.y = Math.PI; scene.add(mesh);
  block(x - OFFSET + .5, y + .65, z - OFFSET + .5, .13, 1.3, .13, wood);
}
sign('旅人の山小屋\n地下探索の出発点', 16, heights[id(16, 16)], 16);
sign('風見の見張り塔\n階段をジャンプで登ろう', 23, heights[id(23, 15)], 15);
sign('地鳴りの遺跡\n中央の土を「3 → E」で掘る', 33, ruinY, 33);
const crystalMaterials = [0x5aeeee, 0xa18bff, 0x78caff].map(color => new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: .65, shininess: 90, flatShading: true }));
const crystalGeometry = new THREE.ConeGeometry(.45, 1, 5);
const crystalBases = [[33, 38], [36, 33], [46, 32], [54, 39], [52, 49], [44, 53], [35, 49], [30, 43], [49, 45]];
crystalBases.forEach(([x, z], i) => {
  const cave = caveAt(x, z); if (!cave) return; const floor = cave.floor, wx = x - OFFSET + .5, wz = z - OFFSET + .5;
  obstacles.push({ x: wx, z: wz, y: floor, radius: .7, height: 4, kind: 'crystal' });
  for (let k = 0; k < 5; k++) { const crystal = new THREE.Mesh(crystalGeometry, crystalMaterials[i % 3]), height = k === 0 ? 4.6 : 1.5 + k * .45; crystal.scale.set(k === 0 ? 1.4 : .9, height, k === 0 ? 1.4 : .9); crystal.position.set(wx + (k ? Math.cos(k * 2.4) * .65 : 0), floor + height / 2, wz + (k ? Math.sin(k * 2.4) * .65 : 0)); crystal.rotation.z = k ? Math.sin(k * 2) * .2 : 0; caveDecor.add(crystal); }
  const glow = new THREE.PointLight([0x68ffff, 0xb394ff, 0x79bbff][i % 3], 14, 22, 1.35); glow.position.set(wx, floor + 3, wz); caveDecor.add(glow);
});
const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.MeshPhongMaterial({ color: 0x3cbbcd, emissive: 0x116d79, emissiveIntensity: .45, transparent: true, opacity: .85, shininess: 100 }));
pool.rotation.x = -Math.PI / 2; pool.position.set(11.5, -23.98, 13.5); caveDecor.add(pool);
const pond = (x, z, y) => y === -24 && Math.hypot(x - 43, z - 45) < 4.5;
const stalactiteGeometry = new THREE.ConeGeometry(.9, 4, 5);
for (const [x, z] of [[35, 37], [40, 34], [47, 36], [52, 43], [37, 49], [44, 50]]) { const cave = caveAt(x, z); if (!cave) continue; const mesh = new THREE.Mesh(stalactiteGeometry, new THREE.MeshLambertMaterial({ color: '#56717c' })); mesh.rotation.z = Math.PI; mesh.position.set(x - OFFSET + .5, cave.ceiling - 1.9, z - OFFSET + .5); caveDecor.add(mesh); }
const motesGeometry = new THREE.BufferGeometry(), motePositions = [];
for (let k = 0; k < 100; k++) { const x = 32 + (k * 17 % 210) / 10, z = 34 + (k * 23 % 175) / 10; const cave = caveAt(Math.floor(x), Math.floor(z)); if (!cave) continue; motePositions.push(x - OFFSET, cave.floor + 1 + (k % 15) * .6, z - OFFSET); }
motesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3));
const motes = new THREE.Points(motesGeometry, new THREE.PointsMaterial({ color: 0xa0faff, size: .075, transparent: true, opacity: .7 })); caveDecor.add(motes);
const railGroup = new THREE.Group(); scene.add(railGroup);
let rails = [], tool = 'rail', mode = 'build', entered = false, yaw = -2.80, pitch = .25;
let target = null, valid = false, riding = 0, rideDirection = 1, speed = 4, velocity = 0;
let caveFound = false, caveRidden = false, mined = 0, caveMix = 0;
const keys = new Set(), player = new THREE.Vector3(32.5 - OFFSET, heights[id(32, 10)], 10.5 - OFFSET);
camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); scene.add(camera);
const lantern = new THREE.SpotLight(0xd6f5ff, 0, 24, .8, .7, 1.2), lanternTarget = new THREE.Object3D(); lantern.position.set(0, 0, 0); lanternTarget.position.set(0, 0, -1); camera.add(lantern, lanternTarget); lantern.target = lanternTarget;
function supportBelow(x, z, limit) { const c = cellAt(x, z); if (!inside(c.x, c.z)) return MIN_Y; for (let y = Math.min(MAX_Y - 1, Math.floor(limit) - 1); y >= MIN_Y; y--) if (voxel(c.x, y, c.z)) return y + 1; return MIN_Y; }
function ceilingAbove(x, z, feet) { const c = cellAt(x, z); for (let y = Math.max(MIN_Y, Math.floor(feet + .01)); y < MAX_Y; y++) if (voxel(c.x, y, c.z)) return y; return Infinity; }
function bodyClear(x, z, feet) {
  if (x < -OFFSET + .2 || x > OFFSET - .2 || z < -OFFSET + .2 || z > OFFSET - .2) return false;
  for (const [dx, dz] of [[0, 0], [.18, .18], [-.18, .18], [.18, -.18], [-.18, -.18]]) { const c = cellAt(x + dx, z + dz); for (let y = Math.floor(feet + .01); y < feet + BODY - .01; y++) if (voxel(c.x, y, c.z)) return false; }
  return !obstacles.some(t => Math.abs(x - t.x) < t.radius && Math.abs(z - t.z) < t.radius && feet < t.y + t.height && feet + BODY > t.y);
}
function safeSpawn() { for (const [x, z] of [[32, 10], [32, 11], [31, 10], [33, 11]]) { const y = supportBelow(x - OFFSET + .5, z - OFFSET + .5, MAX_Y); if (bodyClear(x - OFFSET + .5, z - OFFSET + .5, y)) return new THREE.Vector3(x - OFFSET + .5, y, z - OFFSET + .5); } return new THREE.Vector3(32.5 - OFFSET, MAX_Y, 10.5 - OFFSET); }
const railPoint = r => new THREE.Vector3(r.x - OFFSET + .5, r.y + .12, r.z - OFFSET + .5);
const markerMaterial = new THREE.MeshBasicMaterial({ color: '#d0f789' });
function beam(a, b, width, height, material) { const mesh = new THREE.Mesh(cube, material); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.scale.set(width, height, a.distanceTo(b)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()); railGroup.add(mesh); }
let lengths = [], routeLength = 0;
const caveRail = r => inCave(r.x - OFFSET + .5, r.z - OFFSET + .5, r.y);
const connectedToCave = () => rails.some(caveRail) && rails.some(r => r.y >= 0 && !caveRail(r));
function updateMission() {
  const connected = connectedToCave(); $('mission').classList.toggle('complete', caveRidden);
  $('missionTitle').textContent = caveRidden ? '地底への冒険、達成！' : connected ? '地底の大洞窟へ出発しよう' : caveFound ? '地上と大洞窟をつなごう' : '掘って、地底の光を探そう';
  $('missionDetail').textContent = caveRidden ? '山と地底を結ぶ、あなたのジェットコースター。' : connected ? '自分の線路で、あの大空間へ試乗。' : caveFound ? '階段やトンネルに沿って線路をつなごう。' : '遺跡の下から、不思議な音が聞こえる。';
  $('missionSteps').textContent = `${mined ? '✓' : '○'} 掘削　${caveFound ? '✓' : '○'} 発見　${connected ? '✓' : '○'} 接続　${caveRidden ? '✓' : '○'} 試乗`;
}
function refreshRails() {
  railGroup.clear();
  for (let i = 0; i < rails.length; i++) {
    const a = railPoint(rails[i]), next = rails[i + 1] || rails[i - 1], b = next ? railPoint(next) : a.clone().add(new THREE.Vector3(0, 0, -1));
    const direction = b.clone().sub(a); direction.y = 0; direction.normalize(); const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (const k of [-.32, 0, .32]) { const center = a.clone().addScaledVector(direction, k); beam(center.clone().addScaledVector(side, -.43), center.clone().addScaledVector(side, .43), .13, .09, wood); }
    if (i < rails.length - 1) for (const k of [-.28, .28]) beam(a.clone().addScaledVector(side, k), railPoint(rails[i + 1]).addScaledVector(side, k), .065, .065, metal);
    else { for (const k of [-.28, .28]) beam(a.clone().addScaledVector(side, k).addScaledVector(direction, -.42), a.clone().addScaledVector(side, k).addScaledVector(direction, .42), .065, .065, metal); block(a.x, a.y + .035, a.z, .14, .06, .14, markerMaterial, railGroup); }
  }
  lengths = rails.slice(1).map((r, i) => railPoint(r).distanceTo(railPoint(rails[i]))); routeLength = lengths.reduce((sum, len) => sum + len, 0);
  $('stats').textContent = `レール ${rails.length} マス · 高低差 ${rails.length ? Math.max(...rails.map(r => r.y)) - Math.min(...rails.map(r => r.y)) : 0} m`;
  $('ride').disabled = rails.length < 2; $('undo').disabled = !rails.length; updateMission();
}
// Grid traversal picks the actual nearest solid voxel, including walls and ceilings.
// It does not depend on triangle counts or allow building through terrain.
function traceVoxel() {
  const o = camera.position, d = camera.getWorldDirection(new THREE.Vector3());
  const ox = o.x + OFFSET, oz = o.z + OFFSET; let x = Math.floor(ox), y = Math.floor(o.y), z = Math.floor(oz), distance = 0, normal = { x: 0, y: 0, z: 0 };
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z), deltaX = Math.abs(1 / d.x), deltaY = Math.abs(1 / d.y), deltaZ = Math.abs(1 / d.z);
  let tx = d.x ? ((sx > 0 ? x + 1 : x) - ox) / d.x : Infinity, ty = d.y ? ((sy > 0 ? y + 1 : y) - o.y) / d.y : Infinity, tz = d.z ? ((sz > 0 ? z + 1 : z) - oz) / d.z : Infinity;
  for (let n = 0; n < 80 && distance <= 8; n++) {
    if (voxel(x, y, z)) return { x, y, z, normal, distance, type: voxel(x, y, z) };
    if (tx <= ty && tx <= tz) { x += sx; distance = tx; tx += deltaX; normal = { x: -sx, y: 0, z: 0 }; }
    else if (ty <= tz) { y += sy; distance = ty; ty += deltaY; normal = { x: 0, y: -sy, z: 0 }; }
    else { z += sz; distance = tz; tz += deltaZ; normal = { x: 0, y: 0, z: -sz }; }
  }
  return null;
}
const selector = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: 0xc8f786, transparent: true, opacity: .6, wireframe: true, depthWrite: false })); scene.add(selector);
const blocked = (x, z, y) => obstacles.some(t => Math.abs(t.x - (x - OFFSET + .5)) < .8 && Math.abs(t.z - (z - OFFSET + .5)) < .8 && y < t.y + t.height && y >= t.y - 1) || pond(x, z, y);
function railSupported(r, data = world) { return inWorld(r.x, r.y - 1, r.z) && inWorld(r.x, r.y + 1, r.z) && !!data[index(r.x, r.y - 1, r.z)] && !data[index(r.x, r.y, r.z)] && !data[index(r.x, r.y + 1, r.z)]; }
function canPlace(t) { if (!t || !railSupported(t) || blocked(t.x, t.z, t.y) || rails.some(r => r.x === t.x && r.z === t.z && r.y === t.y)) return false; const prev = rails.at(-1); return !prev || (Math.abs(t.x - prev.x) + Math.abs(t.z - prev.z) === 1 && Math.abs(t.y - prev.y) <= 1); }
function canMine(t) { return t && inWorld(t.x, t.y, t.z) && t.type !== T.BEDROCK && !rails.some(r => r.x === t.x && r.z === t.z && r.y - 1 === t.y) && !obstacles.some(o => Math.abs(o.x - (t.x - OFFSET + .5)) < .8 && Math.abs(o.z - (t.z - OFFSET + .5)) < .8 && t.y === o.y - 1); }
function canBuild(t) {
  if (!t || !inWorld(t.x, t.y, t.z) || voxel(t.x, t.y, t.z) || blocked(t.x, t.z, t.y + 1) || rails.some(r => r.x === t.x && r.z === t.z && t.y >= r.y - 1 && t.y <= r.y + 1)) return false;
  const c = cellAt(player.x, player.z); return !(c.x === t.x && c.z === t.z && t.y + 1 > player.y && t.y < player.y + BODY);
}
function aim() {
  target = null; selector.visible = false; if (mode !== 'build' || !entered) return;
  camera.updateMatrixWorld(); const hit = traceVoxel(); if (!hit) return;
  if (tool === 'rail') { if (hit.normal.y !== 1) return; target = { x: hit.x, z: hit.z, y: hit.y + 1, layer: inCave(hit.x - OFFSET + .5, hit.z - OFFSET + .5, hit.y + 1) ? 'cave' : 'surface' }; valid = canPlace(target); selector.position.set(target.x - OFFSET + .5, target.y + .02, target.z - OFFSET + .5); selector.scale.set(1.025, .035, 1.025); }
  else if (tool === 'lower') { target = hit; valid = canMine(target); selector.position.set(hit.x - OFFSET + .5, hit.y + .5, hit.z - OFFSET + .5); selector.scale.set(1.01, 1.01, 1.01); }
  else { target = { x: hit.x + hit.normal.x, y: hit.y + hit.normal.y, z: hit.z + hit.normal.z }; valid = canBuild(target); selector.position.set(target.x - OFFSET + .5, target.y + .5, target.z - OFFSET + .5); selector.scale.set(1.01, 1.01, 1.01); }
  selector.material.color.set(valid ? '#c8f786' : '#fa7b67'); selector.visible = true;
  $('target').textContent = `高さ ${target.y} m · ${valid ? (tool === 'lower' ? 'Eで掘削' : 'Eで配置') : 'ここには置けません'}`;
}
function notify(s) { $('message').textContent = s; }
function place() {
  if (!entered || mode !== 'build') return; aim();
  if (!target) { notify('8ブロック以内の地面・壁・床を狙ってください。'); return; }
  if (!valid) { notify(tool === 'rail' ? '最後のレールの隣へ。段差は1ブロックまで・頭上2マスの空間が必要です。' : tool === 'lower' ? '最下層・木や結晶の土台・線路の下は掘れません。線路は先にQで外してください。' : '自分の体や線路に重ならない、空いているマスを狙ってください。'); return; }
  if (tool === 'rail') { rails.push({ x: target.x, z: target.z, y: target.y }); refreshRails(); notify(rails.length === 1 ? '最初のレールを敷きました。ここから、あなたの冒険が始まる。' : connectedToCave() ? '地上と大洞窟がつながりました！「乗る」で出発。' : 'レールを敷きました。隣へつないでいこう。'); }
  else { const type = tool === 'lower' ? T.AIR : tool === 'wood' ? T.WOOD : tool === 'stone' ? T.STONE : T.DIRT; setVoxel(target.x, target.y, target.z, type); flushChunks(); if (tool === 'lower') { mined++; updateMission(); notify('1ブロック掘りました。階段状に掘ると、戻り道と線路を作れます。'); } else notify(tool === 'wood' ? '木材を置きました。壁・床・橋を作れます。' : tool === 'stone' ? '石ブロックを置きました。土台や階段に使おう。' : '土を置きました。道や地下への階段を整えよう。'); }
  aim();
}
function chooseTool(t) { tool = t; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('selected', b.dataset.tool === t)); notify(t === 'rail' ? '1 レール：床を狙ってEで敷設。' : t === 'lower' ? '3 掘削：地面や壁を狙ってEで1ブロック掘る。地底の大洞窟を探そう。' : t === 'wood' ? '4 木材：Eで木のブロックを置く。自分の構造物を作ろう。' : t === 'stone' ? '5 石：Eで石のブロックを置く。土台や橋を作ろう。' : '2 土：Eでブロックを置き、坂道や帰りの階段を作ろう。'); }
function enter() { entered = true; document.body.classList.add('playing'); if (!matchMedia('(pointer:coarse)').matches) renderer.domElement.requestPointerLock()?.catch(() => notify('マウスをドラッグして見回せます。')); notify('矢印キーで移動、Eで配置。遺跡の土を3＋Eで掘ると、深い地下への冒険が始まります。'); }
$('enter').onclick = enter; $('helpToggle').onclick = () => { $('help').hidden = !$('help').hidden; };
let hintIndex = 0;
$('hint').onclick = () => { const hints = ['雪の大きな山へ向かう途中に、緑がかった石柱の遺跡があります。そこの中央の土が手がかり。', '「3 掘削」に切り替え、地面を狙ってE。入口は最初から開いていません。深く掘るほど地下の光へ近づきます。', '遺跡の真下にたどり着いたら、東側に続く石の段々を探そう。その先に大空間が広がっています。', '1段ずつ階段状に掘るか、土・木材・石で地下への階段を作ると、地上からレールをつなげられます。Rでいつでも地上へ戻れます。']; notify(hints[Math.min(hintIndex++, hints.length - 1)]); };
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => chooseTool(b.dataset.tool)); $('place').onclick = place;
function stopRide() { mode = 'build'; player.copy(camera.position); player.y = supportBelow(player.x, player.z, camera.position.y); if (!bodyClear(player.x, player.z, player.y)) player.copy(safeSpawn()); velocity = 0; $('ride').textContent = '▶ 乗る'; $('mode').textContent = '一人称 · 建設'; notify('降車しました。地上でも地下でも線路を編集できます。'); }
function goHome() { if (mode === 'ride') stopRide(); player.copy(safeSpawn()); camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); velocity = 0; keys.clear(); notify('地上へ戻りました。掘った地形と線路は残っています。'); }
$('home').onclick = goHome;
function undo() { if (mode === 'ride') stopRide(); rails.pop(); refreshRails(); notify('末尾のレールを取り外しました。'); }
$('undo').onclick = undo; $('clear').onclick = () => { if (mode === 'ride') stopRide(); rails = []; refreshRails(); notify('線路を消しました。地形・構造物・発見記録は残っています。'); };
$('ride').onclick = () => { if (mode === 'ride') { stopRide(); return; } if (rails.length < 2) return; if (!entered) enter(); mode = 'ride'; riding = 0; rideDirection = 1; const delta = railPoint(rails[1]).sub(railPoint(rails[0])); yaw = Math.atan2(-delta.x, -delta.z); pitch = 0; $('ride').textContent = '■ 降りる'; $('mode').textContent = '一人称 · 乗車'; notify('出発！自分で掘ったトンネルと敷いた線路の先へ。マウスで自由に見回せます。'); };
$('speed').oninput = e => speed = +e.target.value;
function snapshot() { return { version: 4, seed: 1, edits: [...edits], rails: rails.map(r => ({ ...r })), caveFound, caveRidden, mined, player: mode === 'ride' ? [camera.position.x, supportBelow(camera.position.x, camera.position.z, camera.position.y), camera.position.z] : player.toArray(), view: [yaw, pitch] }; }
$('save').onclick = () => { try { localStorage.setItem('block-coaster-world-v4', JSON.stringify(snapshot())); notify('掘った地形・構造物・線路・現在地を保存しました。'); } catch { notify('保存できません。ブラウザの保存設定を確認してください。'); } };
function validateSave(s) {
  if (s.version !== 4 || s.seed !== 1 || !Array.isArray(s.edits) || s.edits.length > volume || !Array.isArray(s.rails) || s.rails.length > 12000 || typeof s.caveFound !== 'boolean' || typeof s.caveRidden !== 'boolean' || !Number.isSafeInteger(s.mined) || s.mined < 0) throw Error('Invalid world');
  const candidate = original.slice(), seen = new Set();
  for (const pair of s.edits) { if (!Array.isArray(pair) || pair.length !== 2) throw Error('Invalid edit'); const [i, type] = pair; if (!Number.isInteger(i) || i < plane || i >= volume || !Number.isInteger(type) || type < 0 || type > T.RUIN || seen.has(i)) throw Error('Invalid edit'); seen.add(i); candidate[i] = type; }
  seen.clear();
  s.rails.forEach((r, i) => { if (!Number.isInteger(r.x) || !Number.isInteger(r.z) || !Number.isInteger(r.y) || !inWorld(r.x, r.y, r.z) || r.y > MAX_Y - 2 || !railSupported(r, candidate) || blocked(r.x, r.z, r.y)) throw Error('Invalid rail'); const key = `${r.x},${r.z},${r.y}`; if (seen.has(key)) throw Error('Duplicate rail'); seen.add(key); if (i) { const a = s.rails[i - 1]; if (Math.abs(a.x - r.x) + Math.abs(a.z - r.z) !== 1 || Math.abs(a.y - r.y) > 1) throw Error('Disconnected rail'); } });
  if (!Array.isArray(s.player) || s.player.length !== 3 || s.player.some(v => !Number.isFinite(v)) || Math.abs(s.player[0]) >= OFFSET || Math.abs(s.player[2]) >= OFFSET || s.player[1] < MIN_Y + 1 || s.player[1] > MAX_Y || !Array.isArray(s.view) || s.view.length !== 2 || s.view.some(v => !Number.isFinite(v)) || Math.abs(s.view[1]) > 1.5) throw Error('Invalid position');
  return candidate;
}
$('load').onclick = () => { try { const raw = localStorage.getItem('block-coaster-world-v4'); if (!raw) { notify('この山岳ワールドの保存がありません。まず地形や線路を保存してみよう。'); return; } const s = JSON.parse(raw), candidate = validateSave(s); if (mode === 'ride') stopRide(); world.set(candidate); edits.clear(); s.edits.forEach(([i, t]) => edits.set(i, t)); rails = s.rails.map(r => ({ x: r.x, z: r.z, y: r.y })); caveFound = s.caveFound; caveRidden = s.caveRidden; mined = s.mined; player.fromArray(s.player); if (!bodyClear(player.x, player.z, player.y)) player.copy(safeSpawn()); [yaw, pitch] = s.view; velocity = 0; keys.clear(); camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); rebuildAll(); refreshRails(); notify('地形・構造物・線路・現在地を読み込みました。'); } catch { notify('保存データが壊れているか、このバージョンと互換性がありません。'); } };
let dragging = false, touchX = 0, touchY = 0;
renderer.domElement.addEventListener('pointerdown', e => { if (!entered) return; if (e.pointerType === 'touch') { dragging = true; touchX = e.clientX; touchY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); return; } if (document.pointerLockElement === renderer.domElement) { if (e.button === 0) place(); if (e.button === 2) undo(); } else if (e.button === 0) { dragging = true; renderer.domElement.requestPointerLock()?.catch(() => {}); } });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault()); window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('mousemove', e => { if (document.pointerLockElement === renderer.domElement || dragging) { yaw -= e.movementX * .0025; pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * .0025)); } });
renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && dragging) { yaw -= (e.clientX - touchX) * .005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - touchY) * .005)); touchX = e.clientX; touchY = e.clientY; } });
window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.code)) e.preventDefault(); keys.add(e.code); if (e.repeat) return; if (e.code === 'KeyE') place(); if (e.code === 'KeyQ') undo(); if (e.code === 'KeyR') goHome(); if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) chooseTool(['rail', 'raise', 'lower', 'wood', 'stone'][+e.code.slice(-1) - 1]); });
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', () => { keys.clear(); dragging = false; }); document.addEventListener('pointerlockchange', () => keys.clear());
document.querySelectorAll('[data-key]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(b.dataset.key); b.setPointerCapture(e.pointerId); }); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => keys.delete(b.dataset.key)); });
function walk(dt) {
  let floor = supportBelow(player.x, player.z, player.y + .1); if (player.y <= floor + .02) { player.y = floor; velocity = keys.has('Space') ? 7 : 0; }
  let dx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0), dz = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0); const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
  const v = keys.has('ShiftLeft') ? 6 : 3.8, nx = player.x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * v * dt, nz = player.z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * v * dt;
  const tryMove = (x, z) => { const step = Math.max(player.y, supportBelow(x, z, player.y + .6)); if (bodyClear(x, z, step)) { player.x = x; player.z = z; player.y = step; } };
  tryMove(nx, player.z); tryMove(player.x, nz); velocity -= 18 * dt;
  floor = supportBelow(player.x, player.z, player.y + .1); const cap = ceilingAbove(player.x, player.z, player.y) - BODY;
  let next = player.y + velocity * dt; if (next > cap) { next = cap; velocity = Math.min(0, velocity); } if (next <= floor) { next = floor; velocity = 0; }
  player.y = next; camera.position.copy(player); camera.position.y += 1.65;
}
function ride(dt) { riding += dt * speed * rideDirection; if (riding > routeLength) { riding = routeLength; rideDirection = -1; } else if (riding < 0) { riding = 0; rideDirection = 1; } let d = riding, i = 0; while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; } camera.position.lerpVectors(railPoint(rails[i]), railPoint(rails[i + 1]), d / lengths[i]); camera.position.y += 1.15; $('target').textContent = `走行 ${Math.round(riding)} / ${Math.round(routeLength)} m · ${rideDirection === 1 ? '往路' : '復路'}`; }
function updateExploration(dt, time) {
  const feet = mode === 'build' ? player.y : camera.position.y - 1.27, c = cellAt(camera.position.x, camera.position.z);
  const depth = inside(c.x, c.z) ? Math.max(0, heights[id(c.x, c.z)] - feet) : 0, underground = depth > 2;
  caveMix += ((underground ? 1 : 0) - caveMix) * Math.min(1, dt * 3); ambient.intensity = THREE.MathUtils.lerp(2.2, .33, caveMix); sun.intensity = THREE.MathUtils.lerp(2.5, .08, caveMix); lantern.intensity = caveMix * 26;
  scene.background.set('#a4d8ed').lerp(new THREE.Color('#101f2b'), caveMix); scene.fog.color.copy(scene.background); scene.fog.near = THREE.MathUtils.lerp(42, 20, caveMix); scene.fog.far = THREE.MathUtils.lerp(115, 70, caveMix); motes.material.opacity = .55 + Math.sin(time * .0008) * .18;
  const landmark = structures.find(s => Math.hypot(c.x - s.x, c.z - s.z) < 6 && Math.abs(feet - s.y) < 12);
  $('location').textContent = `高度 ${Math.round(feet)} m · ${underground ? `地下 ${Math.round(depth)} m` : landmark ? landmark.name : '山岳と草原'}`;
  if (entered && inCave(camera.position.x, camera.position.z, feet)) { if (!caveFound) { caveFound = true; updateMission(); notify('✧ 地底の大洞窟を発見！巨大な結晶と地底湖、その先まで線路をつなごう。'); } if (mode === 'ride' && connectedToCave() && !caveRidden) { caveRidden = true; updateMission(); notify('✦ 冒険達成！自分の線路で、深い地底の大洞窟に到着しました。'); } }
}
refreshRails(); let last = performance.now();
function frame(t) { const dt = Math.min((t - last) / 1000, .04); last = t; if (entered) { if (mode === 'build') walk(dt); else ride(dt); } camera.rotation.set(pitch, yaw, 0, 'YXZ'); updateExploration(dt, t); aim(); if (!target && mode === 'build') $('target').textContent = '地面や壁を狙う · Eで操作'; renderer.render(scene, camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame); window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
notify('雪山・山小屋・見張り塔・遺跡。そして、地面の奥にはまだ見ぬ大洞窟。');
window.blockCoaster = {
  getState: () => ({ mode, entered, position: camera.position.toArray(), feet: player.y, direction: camera.getWorldDirection(new THREE.Vector3()).toArray(), yaw, pitch, target: target ? { ...target } : null, valid, tool, connected: connectedToCave(), heights: [...heights], ...snapshot() }),
  terrainRange: () => [Math.min(...heights), Math.max(...heights)],
  caveLayout: () => [...caveCells].map(([i, c]) => ({ x: i % N, z: Math.floor(i / N), y: c.floor, ceiling: c.ceiling })),
  structures: () => structures.map(s => ({ ...s })),
  voxel: (x, y, z) => voxel(x, y, z), dimensions: () => ({ size: N, minY: MIN_Y, maxY: MAX_Y })
};
