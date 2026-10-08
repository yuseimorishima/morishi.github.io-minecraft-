import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const N = 64, OFFSET = N / 2, MIN_Y = -48, MAX_Y = 64, BODY = 1.7, CHUNK = 8;
const T = { AIR: 0, DIRT: 1, STONE: 2, GRASS: 3, SNOW: 4, WOOD: 5, ROOF: 6, RUIN: 7, BEDROCK: 8, LEAVES: 9, PLANK: 10, COBBLE: 11, COAL: 12, IRON: 13, GOLD: 14, DEEP: 15, TABLE: 16, FURNACE: 17, CHEST: 18, GLASS: 19, SAND: 20, GLOW: 21, WATER: 22, TORCH: 23 };
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
// Original pixel art: each block has a readable grain, seam or mineral pattern.
function texture(kind, base, palette) {
  const c=document.createElement('canvas'); c.width=c.height=16; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,16,16);
  for(let i=0;i<105;i++){g.fillStyle=palette[i%palette.length];g.fillRect((i*7+i*i)%16,Math.floor(i*17/11)%16,1+i%2,1);}
  if(['plank','table','chest'].includes(kind)){g.fillStyle='#44311d';for(let y=3;y<16;y+=4)g.fillRect(0,y,16,1);for(let y=0;y<16;y+=4)g.fillRect((y*3)%15,y,1,3);}
  if(kind==='wood'){for(let x=2;x<16;x+=4){g.fillStyle='#49321f';g.fillRect(x,0,1,16);}}
  if(kind==='end'){for(let k=1;k<8;k+=2){g.strokeStyle=k%4===1?'#654524':'#b59355';g.strokeRect(k,k,16-k*2,16-k*2);}}
  if(kind==='cobble'){g.strokeStyle='#444746';for(let y=0;y<16;y+=5){g.beginPath();g.moveTo(0,y);g.lineTo(16,y);g.stroke();for(let x=(y%2)*3;x<16;x+=7)g.strokeRect(x,y,7,5);}}
  if(['coal','iron','gold','glow'].includes(kind)){const color={coal:'#262725',iron:'#c69670',gold:'#efc347',glow:'#ab80de'}[kind];for(const [x,y]of[[2,3],[8,2],[11,9],[4,11],[7,7]]){g.fillStyle=color;g.fillRect(x,y,3,2);g.fillStyle=kind==='coal'?'#111510':'#f1d9b4';g.fillRect(x,y,1,1);}}
  if(kind==='grassSide'){g.fillStyle='#659338';g.fillRect(0,0,16,3);for(let x=0;x<16;x+=3)g.fillRect(x,3,2,1+x%3);}
  if(kind==='table'){g.fillStyle='#453223';g.fillRect(2,2,12,12);g.strokeStyle='#c19b61';for(let i=2;i<15;i+=4){g.beginPath();g.moveTo(i,2);g.lineTo(i,14);g.moveTo(2,i);g.lineTo(14,i);g.stroke();}}
  if(kind==='furnace'){g.fillStyle='#252929';g.fillRect(3,3,10,3);g.fillRect(3,9,10,5);g.fillStyle='#676b69';g.fillRect(4,10,8,1);}
  if(kind==='chest'){g.fillStyle='#3c2b18';g.fillRect(0,6,16,2);g.fillStyle='#d9c995';g.fillRect(7,6,2,4);}
  const t=new THREE.CanvasTexture(c); t.magFilter=t.minFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;return t;
}
const materials=[], blockMaterials={};
function material(type,kind,base,palette,extra={}){const m=new THREE.MeshLambertMaterial({map:texture(kind,base,palette),vertexColors:true,...extra});blockMaterials[type]=materials.length;materials.push(m);return m;}
const dirt=material(T.DIRT,'dirt','#87633f',['#a48055','#67492f','#97724e']);
const stone=material(T.STONE,'stone','#858782',['#777a74','#999b95','#6d706b']);
const grass=material(T.GRASS,'grass','#66933b',['#7ba846','#588333','#91b855']);
const snow=material(T.SNOW,'snow','#ecf1ef',['#d5e4e7','#ffffff']);
const bark=material(T.WOOD,'wood','#886137',['#a17b46','#684925']);
const roof=material(T.ROOF,'plank','#89533b',['#9f644b','#6c3d2a']);
const ruin=material(T.RUIN,'cobble','#748867',['#8ca17b','#566950']);
material(T.BEDROCK,'stone','#353735',['#171c1b','#555852']);
material(T.LEAVES,'leaves','#3e742c',['#548f35','#2c5b22','#659a40']);
material(T.PLANK,'plank','#b18a50',['#c7a168','#96713b']);
material(T.COBBLE,'cobble','#82857c',['#96998f','#696d63']);
material(T.COAL,'coal','#858782',['#747a75','#9a9d95']);
material(T.IRON,'iron','#858782',['#747a75','#9a9d95']);
material(T.GOLD,'gold','#595965',['#656675','#494a58']);
material(T.DEEP,'stone','#4f525c',['#626572','#3b3f48']);
material(T.TABLE,'table','#b18a50',['#c7a168','#96713b']);
material(T.FURNACE,'furnace','#81867e',['#96998f','#696d63']);
material(T.CHEST,'chest','#b38a48',['#c4a365','#95733c']);
material(T.GLASS,'glass','#b9dce4',['#e4f5f5'],{transparent:true,opacity:.35,depthWrite:false});
material(T.SAND,'sand','#dbc69b',['#caba93','#e8d7b2']);
material(T.GLOW,'glow','#6f5797',['#8566b0','#514067'],{emissive:0x8054bf,emissiveIntensity:.5});
material(T.WATER,'water','#4a83b2',['#659cc5','#386fa0'],{transparent:true,opacity:.62,depthWrite:false});
material(T.TORCH,'wood','#bc8437',['#ffc95e','#825622'],{emissive:0xe9972e,emissiveIntensity:1});
const grassSide=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture('grassSide','#87633f',['#a48055','#67492f']),vertexColors:true}));
const woodEnd=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture('end','#b08e54',['#c5a76b','#99763e']),vertexColors:true}));
const metal = new THREE.MeshLambertMaterial({ color: '#dce0d8' }), wood = new THREE.MeshLambertMaterial({ color: '#805233' });
const solidType=t=>t!==T.AIR&&t!==T.WATER&&t!==T.TORCH;
const solid=(x,y,z)=>solidType(voxel(x,y,z));
const deepOreMaterials={};for(const [type,kind]of [[T.COAL,'coal'],[T.IRON,'iron'],[T.GOLD,'gold']]){deepOreMaterials[type]=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture(kind,'#515560',['#656973','#424651']),vertexColors:true}));}
const cube = new THREE.BoxGeometry(1, 1, 1);
for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
  const main = 40 * Math.exp(-((x - 44) ** 2 + (z - 43) ** 2) / 190);
  const ridge = 24 * Math.exp(-((x - 49) ** 2 + (z - 19) ** 2) / 90);
  const valley = 4 * Math.exp(-((x - 14) ** 2 + (z - 46) ** 2) / 120);
  const h = Math.max(3, Math.floor(9 + main + ridge - valley + 1.8 * Math.sin(x * .19) * Math.cos(z * .16)));
  heights.push(h);
  for (let y = MIN_Y; y < h; y++) put(x, y, z, y === MIN_Y ? T.BEDROCK : h >= 37 && y >= h - 3 ? T.SNOW : h >= 22 ? T.STONE : y === h - 1 ? T.GRASS : y >= h - 3 ? T.DIRT : T.STONE);
}
// Seeded value noise distorts ellipsoids; overlapping curved worms form branches.
const hash=(x,y,z)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
function noise(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=t=>t*t*(3-2*t),fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz);let v=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)v+=hash(ix+a,iy+b,iz+c)*(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz);return v;}
const caveMask=new Uint8Array(volume),caveCells=new Map();
function carve(cx,cy,cz,rx,ry,rz){for(let z=Math.max(1,Math.floor(cz-rz-2));z<Math.min(N-1,cz+rz+2);z++)for(let x=Math.max(1,Math.floor(cx-rx-2));x<Math.min(N-1,cx+rx+2);x++)for(let y=Math.max(MIN_Y+3,Math.floor(cy-ry-2));y<Math.min(heights[id(x,z)]-4,cy+ry+2);y++){
 const r=((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2+((z+.5-cz)/rz)**2;
 if(r<.84+(noise(x*.29,y*.32,z*.29)-.5)*.65){put(x,y,z,T.AIR);caveMask[index(x,y,z)]=1;}
}}
function worm(points,radius=2.7){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(...a.map((v,k)=>v-b[k]))*2);for(let j=0;j<=steps;j++){const t=j/steps,p=a.map((v,k)=>v+(b[k]-v)*t);const r=radius*(.88+.2*Math.sin((i+t)*3));carve(...p,r,r*.86,r);}}}
// The starting chamber is buried beneath the ruins: players dig to discover it.
worm([[33.5,0,35.5],[37,-4,38],[42,-8,36],[47,-13,40],[44,-18,45],[39,-24,44]],3.1);
worm([[42,-8,36],[48,-9,31],[52,-14,26],[47,-19,22],[39,-21,26]],2.5);
worm([[39,-24,44],[32,-27,47],[25,-30,43],[23,-33,35],[29,-35,29],[38,-32,30],[44,-29,36]],3);
worm([[32,-27,47],[28,-25,53],[18,-22,51],[13,-18,43],[17,-14,35],[24,-10,31]],2.4);
worm([[47,-13,40],[54,-17,44],[54,-24,51],[48,-30,54],[40,-33,49],[39,-24,44]],2.8);
worm([[24,-10,31],[19,-5,26],[12,-2,29],[9,-5,36]],2.4);
function cavern(cx,cy,cz,rx,ry,rz){for(let z=Math.floor(cz-rz-2);z<=cz+rz+2;z++)for(let x=Math.floor(cx-rx-2);x<=cx+rx+2;x++){const r=((x+.5-cx)/rx)**2+((z+.5-cz)/rz)**2;if(r>1+(noise(x*.3,cy*.3,z*.3)-.5)*.38)continue;const edge=Math.sqrt(Math.max(0,1-r)),floor=Math.floor(cy-ry*.7+(1-edge)*3+(noise(x*.26,8,z*.26)-.5)*3),roof=Math.floor(cy+ry*edge+(noise(x*.3,5,z*.3)-.5)*3);for(let y=Math.max(MIN_Y+3,floor);y<Math.min(roof,heights[id(x,z)]-4);y++){put(x,y,z,T.AIR);caveMask[index(x,y,z)]=1;}}}
cavern(39,-20,43,10,10,9);cavern(26,-29,36,8,7,9);cavern(48,-27,50,7,9,7);carve(18,-19,48,5,4,6);
// Stone pillars and shelves survive inside larger caverns.
for(const [x,z]of[[38,42],[42,45],[25,36],[49,50]])for(let y=-40;y<-8;y++)if(caveMask[index(x,y,z)]&&noise(x*.2,y*.17,z*.2)>.27){put(x,y,z,y<-16?T.DEEP:T.STONE);caveMask[index(x,y,z)]=0;}
for(let z=0;z<N;z++)for(let x=0;x<N;x++){const intervals=[];let start=null;for(let y=MIN_Y+1;y<MAX_Y;y++){if(caveMask[index(x,y,z)]){if(start===null)start=y;}else if(start!==null){intervals.push({floor:start,ceiling:y});start=null;}}if(intervals.length)caveCells.set(id(x,z),intervals);}
function caveAt(x,z){return caveCells.get(id(x,z))?.at(-1);}
function inCave(wx,wz,feet){const c=cellAt(wx,wz);return [Math.floor(feet),Math.floor(feet+1)].some(y=>inWorld(c.x,y,c.z)&&caveMask[index(c.x,y,c.z)]);}
// Mineral veins use correlated noise instead of isolated random dots.
for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)for(let y=MIN_Y+1;y<heights[id(x,z)]-3;y++)if(voxel(x,y,z)===T.STONE){
 let t=y<-16?T.DEEP:T.STONE;
 if(noise(x*.53,y*.51,z*.53)>.74)t=T.COAL;
 if(y<12&&noise((x+73)*.6,y*.6,(z+29)*.6)>.75)t=T.IRON;
 if(y<-23&&noise((x+141)*.6,y*.6,(z+137)*.6)>.8)t=T.GOLD;
 put(x,y,z,t);
}
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
// A shallow surface pond has sand banks that can be mined and smelted into glass.
for(let z=47;z<=55;z++)for(let x=5;x<=14;x++){const r=((x-9.5)/5)**2+((z-51)/4)**2;if(r<1.25){const h=heights[id(x,z)];put(x,h-1,z,T.SAND);if(r<.55){put(x,h-2,z,T.SAND);put(x,h-1,z,T.WATER);}}}
// Harvestable voxel trees: logs, leaves and a leafy canopy.
for(const [x,z]of[[5,7],[9,31],[36,10],[39,29],[20,38],[7,40],[57,21],[19,9],[29,13],[11,18],[9,52],[22,51],[53,55],[58,39],[5,23],[8,13],[15,32],[22,30]]){
 const h=heights[id(x,z)],trunk=4;
 for(let y=h+2;y<=h+5;y++)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dz)<(y===h+5?2:4)&&!voxel(x+dx,y,z+dz))put(x+dx,y,z+dz,T.LEAVES);
 for(let y=h;y<h+trunk;y++)put(x,y,z,T.WOOD);
}
// A few exposed coal veins give a visible route into the mining progression.
for(const [x,z]of[[35,25],[36,26],[37,27]]){let y=heights[id(x,z)]-1;if(voxel(x,y,z)===T.STONE)put(x,y,z,T.COAL);}
put(15,cabinY,23,T.TABLE);put(18,cabinY,23,T.FURNACE);put(18,cabinY,20,T.CHEST);
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
      const [dx, dy, dz] = face.n; const neighbor=voxel(x+dx,y+dy,z+dz);if(neighbor && (type===neighbor || (solidType(neighbor)&&neighbor!==T.GLASS))) continue;
      const material=deepOreMaterials[type]&&y<-16?deepOreMaterials[type]:type===T.GRASS?(dy===1?blockMaterials[T.GRASS]:dy===-1?blockMaterials[T.DIRT]:grassSide):type===T.WOOD&&dy?woodEnd:blockMaterials[type];
      const bucket = buckets[material], shade = .91 + ((x * 13 + z * 7 + y * 3) & 7) * .012;
      for (const corner of [0, 1, 2, 0, 2, 3]) {
        const v = face.v[corner]; bucket.p.push(x - OFFSET + (type===T.TORCH?.4+v[0]*.2:v[0]), y + (type===T.TORCH?v[1]*.7:type===T.WATER?v[1]*.86:v[1]), z - OFFSET + (type===T.TORCH?.4+v[2]*.2:v[2])); bucket.n.push(dx, dy, dz);
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
sign('地鳴りの遺跡\n土の下へ、階段状に掘ろう', 33, ruinY, 33);
const caveLights=[];
// Sparse amethyst alcoves, rather than a room filled with decorative giant cones.
for(const [x,z]of[[35,44],[28,35],[48,52]]){const intervals=caveCells.get(id(x,z));const c=intervals?.[0];if(!c)continue;for(const [dx,dz]of[[0,0],[1,0],[0,1]]){const y=c.floor-1;if(solid(x+dx,y,z+dz)){world[index(x+dx,y,z+dz)]=T.GLOW;original[index(x+dx,y,z+dz)]=T.GLOW;}}const l=new THREE.PointLight(0xad85ef,5,12,1.6);l.position.set(x-OFFSET+.5,c.floor+1,z-OFFSET+.5);scene.add(l);caveLights.push(l);}
const pond=()=>false;
// Small underground pools follow the voxel floor, with no invisible circular obstacle.
for(let z=45;z<=48;z++)for(let x=17;x<=20;x++){const c=caveCells.get(id(x,z))?.[0];if(c&&voxel(x,c.floor,z)===T.AIR){put(x,c.floor,z,T.WATER);original[index(x,c.floor,z)]=T.WATER;}}
rebuildAll();
let torchPositions=[],torchTimer=0;
const torchLights=Array.from({length:4},()=>{const l=new THREE.PointLight(0xffc477,0,11,1.7);scene.add(l);return l;});
function refreshTorches(){torchPositions=[...edits].filter(([,t])=>t===T.TORCH).map(([i])=>new THREE.Vector3(i%N-OFFSET+.5,Math.floor(i/plane)+MIN_Y+.8,Math.floor((i%plane)/N)-OFFSET+.5));torchTimer=1;}
function updateTorches(dt){torchTimer+=dt;if(torchTimer<.4)return;torchTimer=0;const nearest=torchesNear();torchLights.forEach((l,i)=>{l.intensity=nearest[i]?7:0;if(nearest[i])l.position.copy(nearest[i]);});}
function torchesNear(){return torchPositions.filter(p=>p.distanceToSquared(camera.position)<225).sort((a,b)=>a.distanceToSquared(camera.position)-b.distanceToSquared(camera.position)).slice(0,4);}

// Inventory stores actual stacks. Hotbar is the first nine slots of a 36-slot bag.
const itemDefs={};
function item(key,name,color,block=null,extra={}){itemDefs[key]={name,color,block,max:64,...extra};}
item('dirt','土','#896342',T.DIRT);item('stone','丸石','#81857e',T.COBBLE);item('log','原木','#795633',T.WOOD);item('leaves','葉','#487733',T.LEAVES);item('plank','木材','#bd995d',T.PLANK);item('sand','砂','#d9c49b',T.SAND);item('glass','ガラス','#b9dce4',T.GLASS);item('snow','雪','#e5edef',T.SNOW);item('moss','苔の石','#7c916f',T.RUIN);item('amethyst','アメジスト','#9b74c5',T.GLOW);
item('coal','石炭','#282c28');item('ironOre','鉄の原石','#b98e71');item('goldOre','金の原石','#edc452');item('iron','鉄インゴット','#d4d9d2');item('gold','金インゴット','#f2c950');item('stick','棒','#9c733d');item('apple','りんご','#c54d39');
item('table','作業台','#ac884e',T.TABLE);item('furnace','かまど','#7c8079',T.FURNACE);item('chest','チェスト','#af8542',T.CHEST);item('torch','松明','#ffc66b',T.TORCH);item('rail','レール','#b6bab4',null,{rail:true});
for(const [tier,name,color,life,level]of[['wood','木','#b89458',60,1],['stone','石','#898f87',132,2],['iron','鉄','#d1d8d1',251,3]]){
 item(tier+'Pick',name+'のツルハシ',color,null,{max:1,tool:'pick',life,level});
 item(tier+'Axe',name+'の斧',color,null,{max:1,tool:'axe',life,level});
 item(tier+'Shovel',name+'のシャベル',color,null,{max:1,tool:'shovel',life,level});
}
let bag=Array(36).fill(null),selected=0,gameMode='survival',panel=null,heldSlot=null,craftSize=2,craftGrid=Array(9).fill(null),chests={},furnaceJobs=[];
let mining=null,mineHeld=false,handSwing=0,health=20,food=20,fallStart=null,regenTime=0,flying=false,worldTime=0;
const held=()=>bag[selected];
const total=key=>bag.reduce((n,s)=>n+(s?.id===key?s.count:0),0);
function addTo(slots,key,count,durability){const d=itemDefs[key];for(const s of slots)if(s?.id===key&&d.max>1&&s.count<d.max){const n=Math.min(count,d.max-s.count);s.count+=n;count-=n;if(!count)return true;}for(let i=0;i<slots.length&&count;i++)if(!slots[i]){const n=Math.min(count,d.max);slots[i]={id:key,count:n,...(d.life?{durability:durability??d.life}:{})};count-=n;}return !count;}
function roomFor(key,count){const copy=bag.map(s=>s?{...s}:null);return addTo(copy,key,count);}
function gain(key,count=1,durability){if(!roomFor(key,count))return false;addTo(bag,key,count,durability);renderInventory();return true;}
function consume(key,count){for(let i=0;i<bag.length&&count;i++)if(bag[i]?.id===key){const n=Math.min(count,bag[i].count);bag[i].count-=n;count-=n;if(!bag[i].count)bag[i]=null;}renderInventory();}
function spendSelected(){if(gameMode==='creative')return;if(bag[selected]&&!--bag[selected].count)bag[selected]=null;renderInventory();}
const iconCache={};
function icon(key){const d=itemDefs[key],span=document.createElement('span');span.className='item-icon';
 if(!iconCache[key]){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');
 if(d.block){const m=materials[blockMaterials[d.block]],img=m.map.image;g.drawImage(img,2,2,12,12);g.fillStyle='#ffffff30';g.fillRect(2,2,12,2);g.fillStyle='#00000035';g.fillRect(12,2,2,12);}
 else if(d.tool){g.fillStyle='#5b3e20';for(let i=0;i<10;i++)g.fillRect(3+i,13-i,2,2);g.fillStyle=d.color;if(d.tool==='pick'){g.fillRect(4,2,10,2);g.fillRect(11,4,3,3);g.fillRect(3,3,2,2);}else if(d.tool==='axe'){g.fillRect(7,2,6,6);g.fillRect(10,1,4,4);}else{g.fillRect(9,1,5,5);g.fillRect(10,6,3,1);}g.fillStyle='#ffffff45';g.fillRect(7,2,5,1);}
 else if(key==='rail'){g.fillStyle='#b3b9b5';g.fillRect(3,1,2,14);g.fillRect(11,1,2,14);g.fillStyle='#775130';for(let y=3;y<16;y+=4)g.fillRect(1,y,14,2);}
 else if(key==='stick'){g.fillStyle='#a17a43';for(let i=0;i<12;i++)g.fillRect(2+i,13-i,2,2);}
 else{g.fillStyle=d.color;g.fillRect(3,5,10,7);g.fillRect(5,3,6,2);g.fillRect(4,12,8,1);g.fillStyle='#ffffff55';g.fillRect(5,5,6,2);g.fillStyle='#00000033';g.fillRect(10,8,3,4);}
 iconCache[key]=c.toDataURL();}span.style.backgroundImage=`url(${iconCache[key]})`;return span;
}
function slotButton(stack,index,kind){const b=document.createElement('button');b.className='slot';b.dataset.slot=index;b.dataset.kind=kind;if(kind==='bag'&&index===selected)b.classList.add('selected');if(heldSlot?.kind===kind&&heldSlot.index===index)b.classList.add('carrying');b.title=stack?`${itemDefs[stack.id].name} ×${stack.count}${stack.durability?' / 耐久 '+stack.durability:''}`:'空きスロット';b.setAttribute('aria-label',b.title);if(stack){b.append(icon(stack.id));const c=document.createElement('span');c.className='count';c.textContent=stack.count>1?stack.count:'';b.append(c);if(stack.durability){const bar=document.createElement('i');bar.className='durability';bar.style.width=(stack.durability/itemDefs[stack.id].life*80)+'%';b.append(bar);}}if(kind==='hotbar'){const n=document.createElement('small');n.textContent=index+1;b.append(n);b.onclick=()=>select(index);}else b.onclick=e=>moveSlot(kind,index,e.shiftKey);return b;}
function slotList(kind){return kind==='bag'?bag:kind==='craft'?craftGrid:chests[panel.index];}
function moveSlot(kind,index,shift){const slots=slotList(kind);if(!slots)return;
 if(shift&&kind==='bag'&&panel?.type==='chest'){const s=slots[index];if(s){const copy=chests[panel.index].map(s=>s?{...s}:null);if(addTo(copy,s.id,s.count,s.durability)){chests[panel.index]=copy;slots[index]=null;}}}
 else if(heldSlot){const source=slotList(heldSlot.kind);if(!source){heldSlot=null;return;}const s=source[heldSlot.index];if(s){if(kind==='craft'){if(!slots[index]||slots[index].id===s.id){if(!slots[index])slots[index]={id:s.id,count:0,...(s.durability?{durability:s.durability}:{})};if(slots[index].count<itemDefs[s.id].max){slots[index].count++;if(!--s.count)source[heldSlot.index]=null;}}}
 else{const dest=slots[index];if(dest?.id===s.id&&itemDefs[s.id].max>1&&!(source===slots&&heldSlot.index===index)){const n=Math.min(s.count,itemDefs[s.id].max-dest.count);dest.count+=n;s.count-=n;if(!s.count)source[heldSlot.index]=null;}else{slots[index]=s;source[heldSlot.index]=dest;}heldSlot=null;}}
 }else if(slots[index])heldSlot={kind,index};renderInventory();}
const recipes=[
 {id:'plank',n:4,shape:['L'],keys:{L:'log'},size:2},
 {id:'stick',n:4,shape:['P','P'],keys:{P:'plank'},size:2},
 {id:'table',n:1,shape:['PP','PP'],keys:{P:'plank'},size:2},
 {id:'torch',n:4,shape:['C','S'],keys:{C:'coal',S:'stick'},size:2},
 {id:'woodPick',n:1,shape:['PPP',' S ',' S '],keys:{P:'plank',S:'stick'},size:3},
 {id:'stonePick',n:1,shape:['PPP',' S ',' S '],keys:{P:'stone',S:'stick'},size:3},
 {id:'ironPick',n:1,shape:['PPP',' S ',' S '],keys:{P:'iron',S:'stick'},size:3},
 ...['wood','stone','iron'].flatMap(t=>[{id:t+'Axe',n:1,shape:['PP ','PS ',' S '],keys:{P:t==='wood'?'plank':t==='stone'?'stone':'iron',S:'stick'},size:3},{id:t+'Shovel',n:1,shape:['P','S','S'],keys:{P:t==='wood'?'plank':t==='stone'?'stone':'iron',S:'stick'},size:3}]),
 {id:'furnace',n:1,shape:['CCC','C C','CCC'],keys:{C:'stone'},size:3},
 {id:'chest',n:1,shape:['PPP','P P','PPP'],keys:{P:'plank'},size:3},
 {id:'rail',n:16,shape:['I I','ISI','I I'],keys:{I:'iron',S:'stick'},size:3}
];
function ingredients(r){const a={};for(const row of r.shape)for(const char of row)if(r.keys[char])a[r.keys[char]]=(a[r.keys[char]]||0)+1;return a;}
function gridRecipe(){const filled=[];for(let i=0;i<craftSize*craftSize;i++)if(craftGrid[i])filled.push([i%craftSize,Math.floor(i/craftSize),craftGrid[i].id]);if(!filled.length)return null;const minX=Math.min(...filled.map(v=>v[0])),minY=Math.min(...filled.map(v=>v[1]));const actual=filled.map(([x,y,k])=>`${x-minX},${y-minY}:${k}`).sort().join('|');return recipes.find(r=>r.size<=craftSize&&[false,true].some(mirror=>{const expected=[];for(let y=0;y<r.shape.length;y++)for(let x=0;x<r.shape[y].length;x++)if(r.keys[r.shape[y][x]])expected.push(`${mirror?r.shape[y].length-x-1:x},${y}:${r.keys[r.shape[y][x]]}`);const mx=Math.min(...expected.map(v=>+v.split(',')[0]));return expected.map(v=>{const [coord,k]=v.split(':');const [x,y]=coord.split(',');return `${+x-mx},${y}:${k}`;}).sort().join('|')===actual;}))??null;}
function returnGrid(){const copy=bag.map(s=>s?{...s}:null);for(const s of craftGrid)if(s&&!addTo(copy,s.id,s.count,s.durability))return false;bag=copy;craftGrid.fill(null);heldSlot=null;return true;}
function fillRecipe(r){if(r.size>craftSize){notify('作業台を置いて、近くでFを押すと3×3のクラフトができます。');return;}if(!returnGrid()){notify('素材を戻す空きスロットが足りません。');return;}const needs=ingredients(r);if(Object.entries(needs).some(([k,n])=>total(k)<n)){notify('このレシピの素材が足りません。必要数をレシピに表示しています。');renderInventory();return;}for(const [k,n]of Object.entries(needs))consume(k,n);for(let y=0;y<r.shape.length;y++)for(let x=0;x<r.shape[y].length;x++){const k=r.keys[r.shape[y][x]];if(k)craftGrid[y*craftSize+x]={id:k,count:1};}renderInventory();}
function craft(){const r=gridRecipe();if(!r||!roomFor(r.id,r.n))return;if(gameMode==='survival')for(let i=0;i<craftSize*craftSize;i++)if(craftGrid[i]&&!--craftGrid[i].count)craftGrid[i]=null;gain(r.id,r.n);notify(`${itemDefs[r.id].name} ×${r.n} をクラフトしました。`);renderInventory();}
function select(i){selected=i;mining=null;renderInventory();notify(`${i+1}：${held()?itemDefs[held().id].name:'素手'} · Eで配置 / 左クリック長押しで採掘`);}
function nearby(type){const c=cellAt(player.x,player.z);for(let z=c.z-4;z<=c.z+4;z++)for(let x=c.x-4;x<=c.x+4;x++)for(let y=Math.floor(player.y)-2;y<=Math.floor(player.y)+3;y++)if(voxel(x,y,z)===type&&Math.hypot(x+.5-OFFSET-player.x,y+.5-player.y,z+.5-OFFSET-player.z)<4.5)return {x,y,z,index:index(x,y,z)};return null;}
function openPanel(type='inventory',station=null){if(panel){closePanel();return;}if(!entered)return;mining=null;mineHeld=false;keys.clear();dragging=false;if(document.pointerLockElement)document.exitPointerLock();craftSize=type==='table'?3:2;panel={type,...station};if(type==='chest')chests[panel.index]??=Array(27).fill(null);$('inventory').hidden=false;renderInventory();}
function closePanel(){if(!panel)return;if(!returnGrid()){notify('クラフト欄の素材を戻すため、空きスロットを作ってください。');return;}panel=null;heldSlot=null;$('inventory').hidden=true;keys.clear();renderInventory();if(!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock()?.catch(()=>{});}
function workstation(){camera.updateMatrixWorld();const hit=traceVoxel();if(hit&&hit.distance<=5&&[T.TABLE,T.FURNACE,T.CHEST].includes(hit.type)){openPanel(hit.type===T.TABLE?'table':hit.type===T.FURNACE?'furnace':'chest',{x:hit.x,y:hit.y,z:hit.z,index:index(hit.x,hit.y,hit.z)});return;}const station=nearby(T.TABLE);openPanel(station?'table':'inventory',station);}
function smelt(key){const station=panel?.type==='furnace'?panel:nearby(T.FURNACE);if(!station){notify('かまどを置いて近くで使ってください。');return;}const input={iron:'ironOre',gold:'goldOre',glass:'sand'}[key];const fuel=total('coal')?'coal':total('log')?'log':total('plank')?'plank':null;if(!total(input)||!fuel||furnaceJobs.length>=32){notify('原料と燃料（石炭・原木・木材）が必要です。');return;}consume(input,1);consume(fuel,1);furnaceJobs.push({id:key,input,fuel,remaining:4,index:station.index});renderInventory();}
function tickFurnace(dt){if(!furnaceJobs.length)return;const j=furnaceJobs[0];if(world[j.index]!==T.FURNACE)return;j.remaining=Math.max(0,j.remaining-dt);if(!j.remaining&&roomFor(j.id,1)){gain(j.id);furnaceJobs.shift();notify(`${itemDefs[j.id].name}が焼けました。インベントリに入りました。`);}if(panel?.type==='furnace')$('smeltStatus').textContent=`${itemDefs[j.id].name} · ${Math.ceil(j.remaining)}秒 / 待ち ${furnaceJobs.length}（空きが必要）`;}
function renderInventory(){const hot=$('hotbar');hot.replaceChildren(...bag.slice(0,9).map((s,i)=>slotButton(s,i,'hotbar')));$('heldName').textContent=held()?`${itemDefs[held().id].name}${gameMode==='creative'?' ∞':''}`:'素手';$('playMode').textContent=gameMode==='creative'?'クリエイティブ':'サバイバル';$('vitals').hidden=gameMode==='creative';$('resources').textContent=`原木 ${total('log')} · 丸石 ${total('stone')} · 鉄 ${total('iron')} · レール ${total('rail')}`;
 if(!panel)return;$('inventoryTitle').textContent=panel.type==='table'?'作業台 · 3 × 3':panel.type==='furnace'?'かまど':panel.type==='chest'?'チェスト':'インベントリ · 2 × 2';
 $('bag').replaceChildren(...bag.map((s,i)=>slotButton(s,i,'bag')));$('recipeBook').hidden=['chest','furnace'].includes(panel.type);$('craftArea').hidden=['chest','furnace'].includes(panel.type);$('chestArea').hidden=panel.type!=='chest';$('furnaceArea').hidden=panel.type!=='furnace';$('creativeArea').hidden=gameMode!=='creative';
 if(panel.type==='chest')$('chestSlots').replaceChildren(...chests[panel.index].map((s,i)=>slotButton(s,i,'chest')));
 if(!$('craftArea').hidden){$('craftGrid').style.gridTemplateColumns=`repeat(${craftSize},var(--slot))`;$('craftGrid').replaceChildren(...craftGrid.slice(0,craftSize*craftSize).map((s,i)=>slotButton(s,i,'craft')));const r=gridRecipe();$('craftOutput').replaceChildren();$('craftOutput').disabled=!r||!roomFor(r.id,r.n);if(r){$('craftOutput').append(icon(r.id));$('craftOutput').append(document.createTextNode(' ×'+r.n));}$('recipeBook').replaceChildren(...recipes.map(r=>{const b=document.createElement('button');b.dataset.recipe=r.id;const needs=ingredients(r);b.className='recipe'+(r.size>craftSize?' locked':'');b.append(icon(r.id));const text=document.createElement('span');text.textContent=`${itemDefs[r.id].name} ×${r.n}`;const small=document.createElement('small');small.textContent=Object.entries(needs).map(([k,n])=>`${itemDefs[k].name}${n}`).join('・')+(r.size>craftSize?' / 作業台':'' );text.append(small);b.append(text);b.onclick=()=>fillRecipe(r);return b;}));}
 if(panel.type==='furnace'){$('smeltStatus').textContent=furnaceJobs.length?`精錬中 · 残り ${furnaceJobs.length} 個`:'原料1個＋燃料1個 → 4秒で精錬';}
 if(gameMode==='creative')$('creativeItems').replaceChildren(...Object.keys(itemDefs).map(k=>{const b=document.createElement('button');b.className='slot';b.title=itemDefs[k].name;b.append(icon(k));b.onclick=()=>{gain(k,itemDefs[k].max);};return b;}));
}
$('discard').onclick=()=>{if(heldSlot){const slots=slotList(heldSlot.kind);if(slots)slots[heldSlot.index]=null;heldSlot=null;renderInventory();notify('選んだスタックを捨てました。');}};
$('inventoryToggle').onclick=()=>openPanel();$('craftToggle').onclick=workstation;$('closeInventory').onclick=closePanel;$('craftOutput').onclick=craft;
for(const key of ['iron','gold','glass'])$('smelt'+key).onclick=()=>smelt(key);
$('playMode').onclick=()=>{gameMode=gameMode==='survival'?'creative':'survival';renderInventory();notify(gameMode==='creative'?'クリエイティブ：Iの素材一覧から自由に建築できます。':'サバイバル：採掘・クラフトして集めた素材を使います。');};
const drops={[T.DIRT]:'dirt',[T.GRASS]:'dirt',[T.STONE]:'stone',[T.DEEP]:'stone',[T.SNOW]:'snow',[T.WOOD]:'log',[T.ROOF]:'plank',[T.RUIN]:'moss',[T.LEAVES]:'leaves',[T.PLANK]:'plank',[T.COBBLE]:'stone',[T.COAL]:'coal',[T.IRON]:'ironOre',[T.GOLD]:'goldOre',[T.TABLE]:'table',[T.FURNACE]:'furnace',[T.CHEST]:'chest',[T.GLASS]:'glass',[T.SAND]:'sand',[T.GLOW]:'amethyst',[T.TORCH]:'torch'};
const stoneTypes=[T.STONE,T.DEEP,T.COAL,T.IRON,T.GOLD,T.COBBLE,T.RUIN,T.FURNACE,T.GLOW];
function miningInfo(hit){const d=held()?itemDefs[held().id]:null,stone=stoneTypes.includes(hit.type),level=hit.type===T.GOLD?3:hit.type===T.IRON||hit.type===T.GLOW?2:stone?1:0;const category=stone?'pick':[T.WOOD,T.PLANK,T.TABLE,T.CHEST,T.ROOF].includes(hit.type)?'axe':[T.DIRT,T.GRASS,T.SAND,T.SNOW].includes(hit.type)?'shovel':'hand';const right=d?.tool===category;return {harvest:!level||(d?.tool==='pick'&&d.level>=level),time:gameMode==='creative'?.06:(stone?1.6:hit.type===T.WOOD?1.1:hit.type===T.LEAVES||hit.type===T.TORCH?.16:.45)/(right?[1,2.5,4,6][d.level]:1),drop:drops[hit.type]};}
function beginMine(){if(!entered||panel||mode!=='build')return;camera.updateMatrixWorld();const h=traceVoxel();if(!canMine(h)){notify('このブロックは掘れません。線路の土台はQでレールを外してから掘れます。');return;}const info=miningInfo(h);if(!info.harvest&&gameMode==='survival'){notify('回収には'+(h.type===T.GOLD?'鉄':h.type===T.IRON||h.type===T.GLOW?'石以上':'木以上')+'のツルハシが必要です。I → レシピで作ろう。');return;}mining={...h,progress:0,...info};handSwing=.3;}
function mineBlock(h){const info=miningInfo(h);if(info.drop&&gameMode==='survival'&&!roomFor(info.drop,1)){notify('インベントリがいっぱいです。チェストへ移すか、ブロックを置いて空きを作ろう。');return;}
 if(h.type===T.CHEST&&chests[index(h.x,h.y,h.z)]?.some(Boolean)){notify('中身を取り出してからチェストを壊してください。');return;}if(furnaceJobs.some(j=>j.index===index(h.x,h.y,h.z))){notify('精錬が終わってから、かまどを壊してください。');return;}
 setVoxel(h.x,h.y,h.z,T.AIR);if(gameMode==='survival'&&info.drop)gain(info.drop);if(h.type===T.CHEST)delete chests[index(h.x,h.y,h.z)];if(h.type===T.LEAVES&&hash(h.x,h.y,h.z)>.94&&roomFor('apple',1))gain('apple');
 const s=held();if(gameMode==='survival'&&s&&itemDefs[s.id].tool){if(!--s.durability){bag[selected]=null;notify('道具が壊れました。');}renderInventory();}mined++;handSwing=.3;flushChunks();if(h.type===T.TORCH)refreshTorches();updateMission();}
function tickMining(dt){if(!mining)return;camera.updateMatrixWorld();const h=traceVoxel();if(panel||mode!=='build'||!h||h.x!==mining.x||h.y!==mining.y||h.z!==mining.z){mining=null;return;}mining.progress+=dt;$('breakProgress').hidden=false;$('breakFill').style.width=Math.min(100,mining.progress/mining.time*100)+'%';handSwing=.2;if(mining.progress>=mining.time){mineBlock(mining);mining=null;$('breakProgress').hidden=true;if(mineHeld)beginMine();}}

const railGroup = new THREE.Group(); scene.add(railGroup);
let rails = [], tool = 'lower', mode = 'build', entered = false, yaw = -2.80, pitch = .25;
let target = null, valid = false, riding = 0, rideDirection = 1, speed = 4, velocity = 0;
let caveFound = false, caveRidden = false, mined = 0, caveMix = 0;
const keys = new Set(), player = new THREE.Vector3(32.5 - OFFSET, heights[id(32, 10)], 10.5 - OFFSET);
camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); scene.add(camera);
const lantern = new THREE.SpotLight(0xd6f5ff, 0, 24, .8, .7, 1.2), lanternTarget = new THREE.Object3D(); lantern.position.set(0, 0, 0); lanternTarget.position.set(0, 0, -1); camera.add(lantern, lanternTarget); lantern.target = lanternTarget;
function supportBelow(x, z, limit) { const c = cellAt(x, z); if (!inside(c.x, c.z)) return MIN_Y; for (let y = Math.min(MAX_Y - 1, Math.floor(limit) - 1); y >= MIN_Y; y--) if (solid(c.x, y, c.z)) return y + 1; return MIN_Y; }
function ceilingAbove(x, z, feet) { const c = cellAt(x, z); for (let y = Math.max(MIN_Y, Math.floor(feet + .01)); y < MAX_Y; y++) if (solid(c.x, y, c.z)) return y; return Infinity; }
function bodyClear(x, z, feet) {
  if (x < -OFFSET + .2 || x > OFFSET - .2 || z < -OFFSET + .2 || z > OFFSET - .2) return false;
  for (const [dx, dz] of [[0, 0], [.18, .18], [-.18, .18], [.18, -.18], [-.18, -.18]]) { const c = cellAt(x + dx, z + dz); for (let y = Math.floor(feet + .01); y < feet + BODY - .01; y++) if (solid(c.x, y, c.z)) return false; }
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
const crackCanvas=document.createElement('canvas');crackCanvas.width=crackCanvas.height=16;const crackTexture=new THREE.CanvasTexture(crackCanvas);crackTexture.magFilter=THREE.NearestFilter;const crackMesh=new THREE.Mesh(cube,new THREE.MeshBasicMaterial({map:crackTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));crackMesh.scale.setScalar(1.004);crackMesh.visible=false;scene.add(crackMesh);let crackStage=-1;
const selector=new THREE.LineSegments(new THREE.EdgesGeometry(cube),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.65,depthWrite:false})); scene.add(selector);
const blocked = (x, z, y) => obstacles.some(t => Math.abs(t.x - (x - OFFSET + .5)) < .8 && Math.abs(t.z - (z - OFFSET + .5)) < .8 && y < t.y + t.height && y >= t.y - 1) || pond(x, z, y);
function railSupported(r, data = world) { return inWorld(r.x, r.y - 1, r.z) && inWorld(r.x, r.y + 1, r.z) && solidType(data[index(r.x,r.y-1,r.z)]) && !solidType(data[index(r.x,r.y,r.z)]) && !solidType(data[index(r.x,r.y+1,r.z)]); }
function canPlace(t) { if (!t || !railSupported(t) || blocked(t.x, t.z, t.y) || rails.some(r => r.x === t.x && r.z === t.z && r.y === t.y)) return false; const prev = rails.at(-1); return !prev || (Math.abs(t.x - prev.x) + Math.abs(t.z - prev.z) === 1 && Math.abs(t.y - prev.y) <= 1); }
function canMine(t) { return t && inWorld(t.x, t.y, t.z) && t.type !== T.BEDROCK && t.type !== T.WATER && !rails.some(r => r.x === t.x && r.z === t.z && r.y - 1 === t.y) && !obstacles.some(o => Math.abs(o.x - (t.x - OFFSET + .5)) < .8 && Math.abs(o.z - (t.z - OFFSET + .5)) < .8 && t.y === o.y - 1); }
function canBuild(t) {
  if (!t || !inWorld(t.x, t.y, t.z) || voxel(t.x, t.y, t.z) || blocked(t.x, t.z, t.y + 1) || rails.some(r => r.x === t.x && r.z === t.z && t.y >= r.y - 1 && t.y <= r.y + 1)) return false;
  return !(Math.abs(player.x-(t.x-OFFSET+.5))<.69&&Math.abs(player.z-(t.z-OFFSET+.5))<.69&&t.y+1>player.y&&t.y<player.y+BODY);
}
function aim() {
 target=null;valid=false;selector.visible=false;if(mode!=='build'||!entered||panel)return;
 camera.updateMatrixWorld();const hit=traceVoxel();if(!hit)return;
 const d=held()?itemDefs[held().id]:null;tool=d?.rail?'rail':d?.block?'block':'lower';
 if(tool==='rail'&&!mining&&!mineHeld){if(hit.normal.y!==1)return;target={x:hit.x,z:hit.z,y:hit.y+1};valid=canPlace(target);selector.position.set(target.x-OFFSET+.5,target.y+.02,target.z-OFFSET+.5);selector.scale.set(1.015,.03,1.015);}
 else if(tool==='lower'||mining||mineHeld){target=hit;valid=canMine(hit);selector.position.set(hit.x-OFFSET+.5,hit.y+.5,hit.z-OFFSET+.5);selector.scale.set(1.006,1.006,1.006);}
 else{target={x:hit.x+hit.normal.x,y:hit.y+hit.normal.y,z:hit.z+hit.normal.z};valid=canBuild(target);selector.position.set(target.x-OFFSET+.5,target.y+.5,target.z-OFFSET+.5);selector.scale.set(1.006,1.006,1.006);}
 selector.material.color.set(valid?'#ffffff':'#e96554');selector.visible=true;
 const name=Object.entries(T).find(([,v])=>v===hit.type)?.[0];
 $('target').textContent=`${drops[hit.type]?itemDefs[drops[hit.type]].name:name} · ${valid?(tool==='lower'?'E / 左長押しで採掘':'Eで配置・左長押しで採掘'):'場所を変えてください'} · Fで作業台などを使う`;
}
function notify(s){$('message').textContent=s;}
function place(){
 if(!entered||panel||mode!=='build')return;
 const d=held()?itemDefs[held().id]:null;if(held()?.id==='apple'){if(gameMode==='survival')consume('apple',1);food=Math.min(20,food+4);health=Math.min(20,health+2);notify('りんごを食べました。体力と満腹度が回復しました。');return;}
 if(!d?.block&&!d?.rail){beginMine();return;}
 aim();if(!target||!valid){notify(d.rail?'レールは最後のマスの隣、段差1ブロックまで。頭上2マス空けてください。':'空いている隣のマスを狙ってください。自分の体には置けません。');return;}
 if(d.rail){rails.push({x:target.x,y:target.y,z:target.z});spendSelected();refreshRails();notify('レールを敷きました。Qで取り外すと素材が戻ります。');}
 else{setVoxel(target.x,target.y,target.z,d.block);spendSelected();flushChunks();if(d.block===T.TORCH)refreshTorches();notify(`${d.name}を置きました。${[T.TABLE,T.FURNACE,T.CHEST].includes(d.block)?'近くでFを押すと使えます。':''}`);}
 handSwing=.3;aim();
}
function enter(){entered=true;document.body.classList.add('playing');if(!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock()?.catch(()=>{});notify('まず木を集めよう。左長押しで採掘 / Eで配置 / Iでインベントリ / Fで作業台。');}
$('enter').onclick=enter;$('helpToggle').onclick=()=>{$('help').hidden=!$('help').hidden;if(!$('help').hidden&&document.pointerLockElement)document.exitPointerLock();};
let hintIndex=0;
$('hint').onclick=()=>{const hints=['木を左クリック長押し、または素手のEで採掘。Iで原木→木材→棒・作業台をクラフト。','作業台をホットバーへ移し、Eで設置。近くでFを押して木のツルハシを作る。石を掘って石のツルハシへ。','遺跡の下に洞窟が眠っています。鉄は石のツルハシで採掘。松明を持って、階段状に掘り進もう。','丸石8個でかまど。原鉄と石炭などを焼いて鉄に。作業台で鉄6個＋棒1本からレール16本を作る。','レールは最後のマスの前後左右につなごう。段差は1ブロックまで。Rで地上へ帰れます。'];notify(hints[Math.min(hintIndex++,hints.length-1)]);};
$('place').onclick=place;
function stopRide() { mode = 'build'; player.copy(camera.position); player.y = supportBelow(player.x, player.z, camera.position.y); if (!bodyClear(player.x, player.z, player.y)) player.copy(safeSpawn()); velocity=0;fallStart=null;flying=false; $('ride').textContent = '▶ 乗る'; $('mode').textContent = '一人称 · 建設'; notify('降車しました。地上でも地下でも線路を編集できます。'); }
function goHome() { if (mode === 'ride') stopRide(); player.copy(safeSpawn()); camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); velocity = 0; fallStart=null;flying=false;keys.clear(); notify('地上へ戻りました。掘った地形と線路は残っています。'); }
$('home').onclick = goHome;
function undo() { if (mode === 'ride') stopRide(); if(!rails.length)return;if(gameMode==='survival'&&!roomFor('rail',1)){notify('レールを回収する空きがありません。');return;}rails.pop();if(gameMode==='survival')gain('rail');refreshRails();notify('末尾のレールを回収しました。'); }
$('undo').onclick=undo; $('clear').onclick=()=>{if(gameMode==='survival'&&!roomFor('rail',rails.length)){notify('全部のレールを回収する空きが足りません。Qで少しずつ回収できます。');return;}if(mode==='ride')stopRide();if(gameMode==='survival'&&rails.length)gain('rail',rails.length);rails=[];refreshRails();notify('線路を回収しました。');};
$('ride').onclick = () => { if (mode === 'ride') { stopRide(); return; } if (rails.length < 2) return; if (!entered) enter(); mode = 'ride'; riding = 0; rideDirection = 1; const delta = railPoint(rails[1]).sub(railPoint(rails[0])); yaw = Math.atan2(-delta.x, -delta.z); pitch = 0; $('ride').textContent = '■ 降りる'; $('mode').textContent = '一人称 · 乗車'; notify('出発！自分で掘ったトンネルと敷いた線路の先へ。マウスで自由に見回せます。'); };
$('speed').oninput = e => speed = +e.target.value;
const SAVE_KEY='block-coaster-world-v5';
function snapshot(){return {version:5,seed:2,edits:[...edits],rails:rails.map(r=>({...r})),caveFound,caveRidden,mined,player:mode==='ride'?[camera.position.x,supportBelow(camera.position.x,camera.position.z,camera.position.y),camera.position.z]:player.toArray(),view:[yaw,pitch],bag:bag.map(s=>s?{...s}:null),selected,gameMode,health,food,worldTime,craftGrid:craftGrid.map(s=>s?{...s}:null),chests:JSON.parse(JSON.stringify(chests)),furnaceJobs:furnaceJobs.map(j=>({...j}))};}
$('save').onclick=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));notify('地形・線路・持ち物・チェスト・精錬・現在地を保存しました。');}catch{notify('保存できません。ブラウザの保存設定を確認してください。');}};
function validSlots(slots,length){
 if(!Array.isArray(slots)||slots.length!==length)throw Error('Invalid inventory');
 for(const s of slots){if(s===null)continue;if(typeof s!=='object'||Array.isArray(s)||!Object.hasOwn(itemDefs,s.id))throw Error('Unknown item');const d=itemDefs[s.id];if(!Number.isInteger(s.count)||s.count<1||s.count>d.max||(d.life&&(!Number.isInteger(s.durability)||s.durability<1||s.durability>d.life))||(!d.life&&s.durability!==undefined))throw Error('Invalid stack');}
}
function validateSave(s){
 if(s.version!==5||s.seed!==2||!Array.isArray(s.edits)||s.edits.length>volume||!Array.isArray(s.rails)||s.rails.length>12000||typeof s.caveFound!=='boolean'||typeof s.caveRidden!=='boolean'||!Number.isSafeInteger(s.mined)||s.mined<0)throw Error('Invalid world');
 const candidate=original.slice(),seen=new Set();for(const pair of s.edits){if(!Array.isArray(pair)||pair.length!==2)throw Error('Invalid edit');const [i,t]=pair;if(!Number.isInteger(i)||i<plane||i>=volume||!Number.isInteger(t)||t<0||t>T.TORCH||t===T.BEDROCK||seen.has(i))throw Error('Invalid edit');seen.add(i);candidate[i]=t;}
 seen.clear();s.rails.forEach((r,i)=>{if(!Number.isInteger(r.x)||!Number.isInteger(r.z)||!Number.isInteger(r.y)||!inWorld(r.x,r.y,r.z)||!railSupported(r,candidate))throw Error('Invalid rail');const k=`${r.x},${r.y},${r.z}`;if(seen.has(k))throw Error('Duplicate rail');seen.add(k);if(i){const a=s.rails[i-1];if(Math.abs(a.x-r.x)+Math.abs(a.z-r.z)!==1||Math.abs(a.y-r.y)>1)throw Error('Disconnected rail');}});
 if(!Array.isArray(s.player)||s.player.length!==3||s.player.some(v=>!Number.isFinite(v))||Math.abs(s.player[0])>=OFFSET||Math.abs(s.player[2])>=OFFSET||s.player[1]<MIN_Y+1||s.player[1]>MAX_Y+14||!Array.isArray(s.view)||s.view.length!==2||s.view.some(v=>!Number.isFinite(v))||Math.abs(s.view[1])>1.5)throw Error('Invalid position');
 if(!Number.isFinite(s.health)||s.health<1||s.health>20||!Number.isFinite(s.food)||s.food<0||s.food>20||!Number.isFinite(s.worldTime)||s.worldTime<0)throw Error('Invalid vitals');validSlots(s.bag,36);validSlots(s.craftGrid,9);if(!Number.isInteger(s.selected)||s.selected<0||s.selected>8||!['survival','creative'].includes(s.gameMode)||!s.chests||Array.isArray(s.chests)||typeof s.chests!=='object'||Object.keys(s.chests).length>512)throw Error('Invalid inventory');
 for(const [k,v]of Object.entries(s.chests)){if(!/^\d+$/.test(k)||candidate[+k]!==T.CHEST)throw Error('Invalid chest');validSlots(v,27);}
 if(!Array.isArray(s.furnaceJobs)||s.furnaceJobs.length>32)throw Error('Invalid furnace');for(const j of s.furnaceJobs)if(!['iron','gold','glass'].includes(j.id)||j.input!=={iron:'ironOre',gold:'goldOre',glass:'sand'}[j.id]||!['coal','log','plank'].includes(j.fuel)||!Number.isInteger(j.index)||candidate[j.index]!==T.FURNACE||!Number.isFinite(j.remaining)||j.remaining<0||j.remaining>4)throw Error('Invalid smelting');return candidate;
}
$('load').onclick=()=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw){notify('このワールドの保存はありません。以前の保存は旧バージョン用として残っています。');return;}const s=JSON.parse(raw),candidate=validateSave(s);if(mode==='ride')stopRide();world.set(candidate);edits.clear();s.edits.forEach(([i,t])=>edits.set(i,t));rails=s.rails.map(r=>({x:r.x,z:r.z,y:r.y}));caveFound=s.caveFound;caveRidden=s.caveRidden;mined=s.mined;bag=s.bag;selected=s.selected;gameMode=s.gameMode;health=s.health;food=s.food;worldTime=s.worldTime;fallStart=null;flying=false;craftGrid=s.craftGrid;chests=s.chests;furnaceJobs=s.furnaceJobs;panel=null;$('inventory').hidden=true;heldSlot=null;player.fromArray(s.player);if(!bodyClear(player.x,player.z,player.y))player.copy(safeSpawn());[yaw,pitch]=s.view;velocity=0;keys.clear();mining=null;camera.position.copy(player).add(new THREE.Vector3(0,1.65,0));rebuildAll();refreshRails();refreshTorches();renderInventory();updateMission();notify('持ち物と世界を読み込みました。');}catch(error){console.warn('Save loading failed:',error.message);notify('保存データが壊れているか、このバージョンと互換性がありません。');}};
let dragging = false, touchX = 0, touchY = 0;
renderer.domElement.addEventListener('pointerdown',e=>{if(!entered||panel)return;if(e.pointerType==='touch'){dragging=true;touchX=e.clientX;touchY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);return;}if(document.pointerLockElement===renderer.domElement){if(e.button===0){mineHeld=true;beginMine();}if(e.button===2)place();}else if(e.button===0){dragging=true;renderer.domElement.requestPointerLock()?.catch(()=>{});}});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('pointerup',()=>{dragging=false;if(mineHeld)mining=null;mineHeld=false;});
window.addEventListener('mousemove',e=>{if(!panel&&(document.pointerLockElement===renderer.domElement||dragging)){yaw-=e.movementX*.0025;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*.0025));}});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&dragging&&!panel){yaw-=(e.clientX-touchX)*.005;pitch=Math.max(-1.5,Math.min(1.5,pitch-(e.clientY-touchY)*.005));touchX=e.clientX;touchY=e.clientY;}});
renderer.domElement.addEventListener('wheel',e=>{if(entered&&!panel){e.preventDefault();select((selected+(e.deltaY>0?1:8))%9);}},{passive:false});
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(['Space','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyE','KeyI','KeyC','KeyF','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(panel)closePanel();return;}if(e.repeat)return;
 if(e.code==='KeyI'||e.code==='KeyC'){openPanel();return;}if(e.code==='KeyF'){if(panel)closePanel();else workstation();return;}if(panel)return;
 keys.add(e.code);if(e.code==='KeyE')place();if(e.code==='KeyQ')undo();if(e.code==='KeyR')goHome();if(e.code==='KeyV'&&gameMode==='creative'){flying=!flying;velocity=0;notify(flying?'飛行：矢印で移動、Spaceで上昇、Shiftで下降。Vで着地。':'飛行を終了しました。');}if(/^Digit[1-9]$/.test(e.code))select(+e.code.slice(-1)-1);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();dragging=false;mineHeld=false;mining=null;});document.addEventListener('pointerlockchange',()=>{keys.clear();mineHeld=false;mining=null;});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(!panel)keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
$('mine').addEventListener('pointerdown',e=>{e.preventDefault();mineHeld=true;beginMine();$('mine').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('mine').addEventListener(event,()=>{mineHeld=false;mining=null;});
function walk(dt) {
 if(flying&&gameMode==='creative'){const up=(keys.has('Space')?1:0)-(keys.has('ShiftLeft')?1:0);const dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dz=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);const nx=player.x+(dx*Math.cos(yaw)+dz*Math.sin(yaw))*8*dt,nz=player.z+(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*8*dt,ny=THREE.MathUtils.clamp(player.y+up*8*dt,MIN_Y+1,MAX_Y+14);if(bodyClear(nx,nz,ny))player.set(nx,ny,nz);camera.position.copy(player).add(new THREE.Vector3(0,1.65,0));return;}

  let floor = supportBelow(player.x, player.z, player.y + .1); if (player.y <= floor + .02) { player.y = floor; velocity = keys.has('Space') ? 7 : 0;if(fallStart!==null){const fall=fallStart-player.y;fallStart=null;if(gameMode==='survival'&&fall>3){health-=Math.floor(fall-3);if(health<=0){health=20;food=20;player.copy(safeSpawn());notify('大きな落下で地上へ戻りました。持ち物は手元に残ります。');}else notify('落下で体力が減りました。段差を小さくして、階段を作ろう。');}} }
  let dx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0), dz = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0); const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
  if(velocity<0)fallStart=Math.max(fallStart??player.y,player.y);if(gameMode==='survival'&&(dx||dz))food=Math.max(0,food-dt*(keys.has('ShiftLeft')?.035:.006));const v = keys.has('ShiftLeft') && (food>6||gameMode==='creative') ? 6 : 3.8, nx = player.x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * v * dt, nz = player.z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * v * dt;
  const tryMove = (x, z) => { const step = Math.max(player.y, supportBelow(x, z, player.y + .6)); if (bodyClear(x, z, step)) { player.x = x; player.z = z; player.y = step; } };
  tryMove(nx, player.z); tryMove(player.x, nz); velocity -= 18 * dt;
  floor = supportBelow(player.x, player.z, player.y + .1); const cap = ceilingAbove(player.x, player.z, player.y) - BODY;
  let next = player.y + velocity * dt; if (next > cap) { next = cap; velocity = Math.min(0, velocity); } if (next <= floor) { next = floor; velocity = 0; }
  player.y = next; camera.position.copy(player); camera.position.y += 1.65;
}
function ride(dt) { riding += dt * speed * rideDirection; if (riding > routeLength) { riding = routeLength; rideDirection = -1; } else if (riding < 0) { riding = 0; rideDirection = 1; } let d = riding, i = 0; while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; } camera.position.lerpVectors(railPoint(rails[i]), railPoint(rails[i + 1]), d / lengths[i]); camera.position.y += 1.15; $('target').textContent = `走行 ${Math.round(riding)} / ${Math.round(routeLength)} m · ${rideDirection === 1 ? '往路' : '復路'}`; }
function updateExploration(dt,time){
 worldTime+=dt;if(gameMode==='survival'){regenTime+=dt;if(regenTime>8){regenTime=0;if(food>=18&&health<20){health=Math.min(20,health+1);food=Math.max(0,food-.5);}if(food===0&&health>2)health--;}}
 $('health').textContent='♥'.repeat(Math.ceil(health/2))+'♡'.repeat(10-Math.ceil(health/2));$('food').textContent='◆'.repeat(Math.ceil(food/2))+'◇'.repeat(10-Math.ceil(food/2));
 const daylight=.25+.75*Math.max(0,Math.sin(worldTime/600*Math.PI*2+1));

  const feet = mode === 'build' ? player.y : camera.position.y - 1.27, c = cellAt(camera.position.x, camera.position.z);
  const depth = inside(c.x, c.z) ? Math.max(0, heights[id(c.x, c.z)] - feet) : 0, underground = depth > 2;
  caveMix += ((underground ? 1 : 0) - caveMix) * Math.min(1, dt * 3); ambient.intensity=THREE.MathUtils.lerp(.5+1.7*daylight,.26,caveMix);sun.intensity=THREE.MathUtils.lerp(2.5*daylight,.06,caveMix); lantern.intensity = caveMix * 7;
  scene.background.set('#19344b').lerp(new THREE.Color('#a4d8ed'),daylight).lerp(new THREE.Color('#101f2b'), caveMix); scene.fog.color.copy(scene.background); scene.fog.near = THREE.MathUtils.lerp(42, 20, caveMix); scene.fog.far = THREE.MathUtils.lerp(115, 70, caveMix);
  const landmark = structures.find(s => Math.hypot(c.x - s.x, c.z - s.z) < 6 && Math.abs(feet - s.y) < 12);
  $('location').textContent = `高度 ${Math.round(feet)} m · ${underground ? `地下 ${Math.round(depth)} m` : landmark ? landmark.name : '山岳と草原'}`;
  if (entered && inCave(camera.position.x, camera.position.z, feet)) { if (!caveFound) { caveFound = true; updateMission(); notify('✧ 地底の大洞窟を発見！枝分かれする坑道と鉱脈。その先まで線路をつなごう。'); } if (mode === 'ride' && connectedToCave() && !caveRidden) { caveRidden = true; updateMission(); notify('✦ 冒険達成！自分の線路で、深い地底の大洞窟に到着しました。'); } }
}
const cloudGroup=new THREE.Group();scene.add(cloudGroup);
const cloudMaterial=new THREE.MeshBasicMaterial({color:0xe7eef0,transparent:true,opacity:.8});
for(let k=0;k<10;k++){const c=new THREE.Mesh(new THREE.BoxGeometry(10+k%3*4,1.8,6+k%2*5),cloudMaterial);c.position.set((k*29)%120-60,67+(k%3)*4,(k*47)%120-60);cloudGroup.add(c);}
const handGroup=new THREE.Group();camera.add(handGroup);
const arm=new THREE.Mesh(new THREE.BoxGeometry(.19,.5,.21),new THREE.MeshLambertMaterial({color:0xc49a75}));arm.position.set(.43,-.39,-.63);arm.rotation.set(-.3,0,-.15);handGroup.add(arm);
const sleeve=new THREE.Mesh(new THREE.BoxGeometry(.2,.21,.22),new THREE.MeshLambertMaterial({color:0x3d8991}));sleeve.position.set(.43,-.62,-.62);handGroup.add(sleeve);
let heldMesh=null,lastHeld='';
function updateHand(dt,time){handGroup.visible=entered&&!panel&&mode==='build';const k=held()?.id??'';if(k!==lastHeld){if(heldMesh){handGroup.remove(heldMesh);heldMesh.geometry.dispose();}heldMesh=null;if(k){const d=itemDefs[k];heldMesh=new THREE.Mesh(new THREE.BoxGeometry(d.tool?.12:.25,d.tool?.46:.25,.23),d.block?materials[blockMaterials[d.block]]:new THREE.MeshLambertMaterial({color:d.color}));heldMesh.position.set(.4,-.23,-.72);heldMesh.rotation.set(.2,.4,.15);handGroup.add(heldMesh);}lastHeld=k;}handSwing=Math.max(0,handSwing-dt);handGroup.rotation.z=Math.sin(handSwing*20)*.22;handGroup.position.y=keys.size&&!panel?Math.sin(time*.01)*.018:0;}
refreshRails(); let last = performance.now();
function frame(t) { const dt = Math.max(0,Math.min((t-last)/1000,.07)); last = t; if(entered&&!panel){if(mode==='build')walk(dt);else ride(dt);}tickFurnace(dt);tickMining(dt);updateTorches(dt);if(!mining){$('breakProgress').hidden=true;crackMesh.visible=false;crackStage=-1;}else{crackMesh.visible=true;crackMesh.position.set(mining.x-OFFSET+.5,mining.y+.5,mining.z-OFFSET+.5);const stage=Math.floor(mining.progress/mining.time*8);if(stage!==crackStage){crackStage=stage;const g=crackCanvas.getContext('2d');g.clearRect(0,0,16,16);g.strokeStyle='#171b17bb';g.lineWidth=1;for(let i=0;i<=stage+2;i++){g.beginPath();g.moveTo(8,8);g.lineTo((i*7)%16,(i*11)%16);g.lineTo((i*5+2)%16,(i*3+9)%16);g.stroke();}crackTexture.needsUpdate=true;}}updateHand(dt,t);cloudGroup.position.x=Math.sin(worldTime*.003)*8; camera.rotation.set(pitch, yaw, 0, 'YXZ'); updateExploration(dt, t); aim(); if (!target && mode === 'build') $('target').textContent = '地面や壁を狙う · Eで操作'; renderer.render(scene, camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame); window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderInventory();notify('木を集めてクラフト。鉄と松明を携えて、枝分かれする地底の世界へ。');
window.blockCoaster = {
  getState: () => ({ mode, entered, position: camera.position.toArray(), feet: player.y, direction: camera.getWorldDirection(new THREE.Vector3()).toArray(), yaw, pitch, target: target ? { ...target } : null, valid, tool, connected: connectedToCave(), heights: [...heights], ...snapshot() }),
  terrainRange: () => [Math.min(...heights), Math.max(...heights)],
  caveLayout: () => [...caveCells].flatMap(([i,cs])=>cs.map(c=>({x:i%N,z:Math.floor(i/N),y:c.floor,ceiling:c.ceiling}))),
  structures: () => structures.map(s => ({ ...s })),
  voxel: (x, y, z) => voxel(x, y, z), dimensions: () => ({ size: N, minY: MIN_Y, maxY: MAX_Y })
};
