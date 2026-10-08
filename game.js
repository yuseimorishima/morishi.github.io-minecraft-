import * as THREE from './vendor/three.module.js';
import { BLOCKS, VoxelWorld, WORLD_MIN_Y, WORLD_MAX_Y, WORLD_CHUNK, hash3 } from './world.js';
import { createLegacyWorld } from './legacy-world.js';
import { loadGeneratedArt } from './art.js';
import { validateSnapshot, migrateV5 } from './save.js';
import { miningProfile } from './mining.js';
import { nightAt, daylightAt, NightCreatures, createCreatureVisuals } from './monsters.js';
import { itemDefs, recipes, drawItemIcon, setItemAtlas, equipmentSlots, smeltingRecipes } from './items.js';

const $ = id => document.getElementById(id);
const N=64,OFFSET=32,MIN_Y=WORLD_MIN_Y,MAX_Y=WORLD_MAX_Y,BODY=1.7,CHUNK=WORLD_CHUNK,T=BLOCKS;
const legacy=createLegacyWorld(T);
const world=new VoxelWorld({seed:3,legacy,maxCachedChunks:180}),edits=world.edits;
const inside=(x,z)=>Number.isSafeInteger(x)&&Number.isSafeInteger(z);
const inWorld=(x,y,z)=>inside(x,z)&&Number.isInteger(y)&&y>=MIN_Y&&y<MAX_Y;
const index=(x,y,z)=>`${x},${y},${z}`;
const decodeKey=key=>key.split(',').map(Number);
const cellAt=(x,z)=>({x:Math.floor(x+OFFSET),z:Math.floor(z+OFFSET)});
const voxel=(x,y,z)=>world.voxel(x,y,z);
const height=(x,z)=>world.height(x,z);
const inCave=(wx,wz,feet)=>{const c=cellAt(wx,wz);return world.isCave(c.x,Math.floor(feet),c.z)||world.isCave(c.x,Math.floor(feet+1),c.z);};
const hash=(x,y,z)=>hash3(x,y,z,3);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a4d8ed'); scene.fog = new THREE.Fog('#a4d8ed', 42, 115);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 170); camera.rotation.order = 'YXZ';
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
catch (e) { $('message').textContent = '3D描画にはWebGL対応ブラウザが必要です。';$('message').style.display='block';$('enter').disabled=true;$('homeLoad').disabled=true; throw e; }
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
  if(['coal','iron','gold','glow','diamond','emerald','redstone','lapis','copper'].includes(kind)){const color={coal:'#262725',iron:'#c69670',gold:'#efc347',glow:'#ab80de',diamond:'#54d9e5',emerald:'#48d28a',redstone:'#cf4744',lapis:'#426ed2',copper:'#bd885c'}[kind];for(const [x,y]of[[2,3],[8,2],[11,9],[4,11],[7,7]]){g.fillStyle=color;g.fillRect(x,y,3,2);g.fillStyle=kind==='coal'?'#111510':'#f1d9b4';g.fillRect(x,y,1,1);}}
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
for(const[type,kind,base,palette]of [
 [T.DIAMOND,'diamond','#656b74',['#81878e','#515862']], [T.EMERALD,'emerald','#69736d',['#808a80','#525d54']],
 [T.REDSTONE,'redstone','#5d616a',['#757984','#484d56']], [T.LAPIS,'lapis','#616976',['#7e8898','#4c5461']], [T.COPPER,'copper','#85857e',['#9a9b90','#6d7268']],
 [T.COPPER_BLOCK,'metal','#bd845c',['#d9a077','#925936']], [T.IRON_BLOCK,'metal','#b9c5c5',['#dbe4e0','#95a5a6']], [T.GOLD_BLOCK,'metal','#e6b33d',['#f6d66c','#b88728']],
 [T.DIAMOND_BLOCK,'metal','#49bfc9',['#80e4e4','#278a96']], [T.EMERALD_BLOCK,'metal','#39b570',['#6cd796','#208255']],
 [T.OBSIDIAN,'stone','#332c41',['#4f3c66','#201d2d']], [T.BRICK,'brick','#af6752',['#c88565','#815044']], [T.BOOKSHELF,'bookcase','#b28b50',['#cfaa65','#815f31']],
 [T.CACTUS,'cactus','#54803a',['#709f4b','#376929']], [T.MUSHROOM,'mushroom','#b64b3c',['#efcfbd','#723a30']], [T.BASALT,'stone','#484d50',['#606668','#333a3d']],
 [T.CLAY,'stone','#94a4b0',['#aebac0','#7b8996']], [T.SNOW_LOG,'wood','#674a2b',['#81613b','#493824']], [T.PINE_LEAVES,'leaves','#38674b',['#4c8162','#285839']],
 [T.JUNGLE_LOG,'wood','#aa7552',['#c59169','#87583f']], [T.JUNGLE_LEAVES,'leaves','#548b30',['#72a43d','#427721']], [T.RED_SAND,'sand','#bb7b45',['#d29759','#a36538']],
 [T.ICE,'ice','#9bc9da',['#bce3eb','#76b3ca']], [T.LAVA,'lava','#ed7627',['#feb349','#a8381d']], [T.WOOL,'wool','#dedbd0',['#f2eee3','#c5c2b8']],
])material(type,kind,base,palette,type===T.ICE?{transparent:true,opacity:.7}:type===T.LAVA?{emissive:0xfc7521,emissiveIntensity:.9}:{});
const grassSide=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture('grassSide','#87633f',['#a48055','#67492f']),vertexColors:true}));
const woodEnd=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture('end','#b08e54',['#c5a76b','#99763e']),vertexColors:true}));
const metal = new THREE.MeshLambertMaterial({ color: '#dce0d8' }), wood = new THREE.MeshLambertMaterial({ color: '#805233' });
const solidType=t=>![T.AIR,T.WATER,T.LAVA,T.TORCH,T.MUSHROOM].includes(t);
const solid=(x,y,z)=>solidType(voxel(x,y,z));
const deepOreMaterials={};for(const [type,kind]of [[T.COAL,'coal'],[T.IRON,'iron'],[T.GOLD,'gold'],[T.DIAMOND,'diamond'],[T.EMERALD,'emerald'],[T.REDSTONE,'redstone'],[T.LAPIS,'lapis'],[T.COPPER,'copper']]){deepOreMaterials[type]=materials.length;materials.push(new THREE.MeshLambertMaterial({map:texture(kind,'#515560',['#656973','#424651']),vertexColors:true}));}
const cube = new THREE.BoxGeometry(1, 1, 1);
const faces = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];
const torchSourcesByChunk=new Map();let torchSourcesDirty=true;
const chunks=new Map(),dirty=new Set(),chunkQueue=[],queuedChunks=new Set();
let streamCenter='',streamClock=0,viewRadius=matchMedia('(pointer:coarse)').matches?3:4;
const chunkKey=(x,z)=>`${Math.floor(x/CHUNK)},${Math.floor(z/CHUNK)}`;
function rebuildChunk(cx,cz){
 const record=world.chunk(cx,cz),data=record.data;
 const borders={left:world.chunk(cx-1,cz).data,right:world.chunk(cx+1,cz).data,back:world.chunk(cx,cz-1).data,front:world.chunk(cx,cz+1).data};
 const torchSources=[];const stride=CHUNK*CHUNK,buckets=materials.map(()=>({p:[],n:[],uv:[],c:[],i:[]}));
 const get=(x,y,z)=>{if(y<MIN_Y||y>=MAX_Y)return 0;let buffer=data;if(x<0){x+=CHUNK;buffer=borders.left;}else if(x>=CHUNK){x-=CHUNK;buffer=borders.right;}else if(z<0){z+=CHUNK;buffer=borders.back;}else if(z>=CHUNK){z-=CHUNK;buffer=borders.front;}return buffer[(y-MIN_Y)*stride+z*CHUNK+x];};
 for(let z=0;z<CHUNK;z++)for(let x=0;x<CHUNK;x++)for(let y=MIN_Y;y<MAX_Y;y++){
  const type=data[(y-MIN_Y)*stride+z*CHUNK+x];if(!type)continue;const gx=cx*CHUNK+x,gz=cz*CHUNK+z;if(type===T.TORCH)torchSources.push(new THREE.Vector3(gx-OFFSET+.5,y+.8,gz-OFFSET+.5));
  for(const face of faces){const [dx,dy,dz]=face.n,n=get(x+dx,y+dy,z+dz);if(n&&(type===n||(solidType(n)&&n!==T.GLASS&&n!==T.ICE)))continue;
   const m=deepOreMaterials[type]&&y<-16?deepOreMaterials[type]:type===T.GRASS?(dy===1?blockMaterials[T.GRASS]:dy===-1?blockMaterials[T.DIRT]:grassSide):[T.WOOD,T.SNOW_LOG,T.JUNGLE_LOG].includes(type)&&dy?woodEnd:blockMaterials[type];
   const bucket=buckets[m];if(!bucket)continue;const start=bucket.p.length/3,shade=.87+((gx*13+gz*7+y*3)&7)*.013;
   for(let corner=0;corner<4;corner++){const v=face.v[corner];bucket.p.push(gx-OFFSET+(type===T.TORCH?.4+v[0]*.2:v[0]),y+(type===T.TORCH?v[1]*.7:[T.WATER,T.LAVA].includes(type)?v[1]*.87:v[1]),gz-OFFSET+(type===T.TORCH?.4+v[2]*.2:v[2]));bucket.n.push(dx,dy,dz);bucket.uv.push(...[[0,0],[0,1],[1,1],[1,0]][corner]);bucket.c.push(shade,shade,shade);}
   bucket.i.push(start,start+1,start+2,start,start+2,start+3);
  }
 }
 const geometry=new THREE.BufferGeometry(),p=[],normals=[],uv=[],colors=[],indices=[];
 buckets.forEach((bucket,i)=>{const start=indices.length,offset=p.length/3;for(const v of bucket.p)p.push(v);for(const v of bucket.n)normals.push(v);for(const v of bucket.uv)uv.push(v);for(const v of bucket.c)colors.push(v);for(const v of bucket.i)indices.push(v+offset);if(bucket.i.length)geometry.addGroup(start,bucket.i.length,i);});
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
 const key=`${cx},${cz}`,mesh=chunks.get(key);torchSourcesByChunk.set(key,torchSources);torchSourcesDirty=true;if(mesh){mesh.geometry.dispose();mesh.geometry=geometry;}else{const mesh=new THREE.Mesh(geometry,materials);chunks.set(key,mesh);scene.add(mesh);}
}
function queueChunk(key){if(!queuedChunks.has(key)){queuedChunks.add(key);chunkQueue.push(key);}}
function updateStreaming(force=false){
 const c=cellAt(camera.position.x,camera.position.z),cx=Math.floor(c.x/CHUNK),cz=Math.floor(c.z/CHUNK),center=`${cx},${cz}`;
 if(!force&&center===streamCenter)return;streamCenter=center;
 const keep=new Set(),wanted=[];
 for(let dz=-viewRadius;dz<=viewRadius;dz++)for(let dx=-viewRadius;dx<=viewRadius;dx++){const key=`${cx+dx},${cz+dz}`;keep.add(key);wanted.push({key,d:dx*dx+dz*dz});}
 for(const [key,mesh]of chunks)if(!keep.has(key)){scene.remove(mesh);mesh.geometry.dispose();chunks.delete(key);torchSourcesByChunk.delete(key);torchSourcesDirty=true;}
 for(let i=chunkQueue.length-1;i>=0;i--)if(!keep.has(chunkQueue[i])){queuedChunks.delete(chunkQueue[i]);chunkQueue.splice(i,1);}
 wanted.sort((a,b)=>a.d-b.d);for(const {key}of wanted)if(!chunks.has(key))queueChunk(key);
 const halo=new Set(keep);for(let dz=-viewRadius-1;dz<=viewRadius+1;dz++)for(let dx=-viewRadius-1;dx<=viewRadius+1;dx++)halo.add(`${cx+dx},${cz+dz}`);world.evictExcept(halo);
}
function pumpChunks(){const key=chunkQueue.shift();if(!key)return;queuedChunks.delete(key);const [x,z]=key.split(',').map(Number);rebuildChunk(x,z);}
function rebuildAll(){for(const mesh of chunks.values()){scene.remove(mesh);mesh.geometry.dispose();}chunks.clear();torchSourcesByChunk.clear();torchSourcesDirty=true;chunkQueue.length=0;queuedChunks.clear();dirty.clear();streamCenter='';updateStreaming(true);const c=cellAt(camera.position.x,camera.position.z);const cx=Math.floor(c.x/CHUNK),cz=Math.floor(c.z/CHUNK),key=`${cx},${cz}`;rebuildChunk(cx,cz);queuedChunks.delete(key);const at=chunkQueue.indexOf(key);if(at>=0)chunkQueue.splice(at,1);}
function setVoxel(x,y,z,type){world.set(x,y,z,type);for(const[dx,dz]of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])dirty.add(chunkKey(x+dx,z+dz));}
function flushChunks(){for(const key of dirty)if(chunks.has(key)){const[x,z]=key.split(',').map(Number);rebuildChunk(x,z);}dirty.clear();}
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
sign('旅人の山小屋\n地下探索の出発点',16,height(16,16),16);
sign('風見の見張り塔\n階段をジャンプで登ろう',23,height(23,15),15);
sign('地鳴りの遺跡\n土の下へ、階段状に掘ろう',33,height(33,35),33);
const caveLights=[];
for(const[x,z]of [[35,44],[28,35],[48,52]]){let floor=-48;for(let y=-45;y<0;y++)if(world.isCave(x,y,z)){floor=y;break;}const l=new THREE.PointLight(0xad85ef,5,12,1.6);l.position.set(x-OFFSET+.5,floor+1,z-OFFSET+.5);scene.add(l);caveLights.push(l);}
const pond=()=>false;
let torchPositions=[],torchTimer=0;
const torchLights=Array.from({length:4},()=>{const l=new THREE.PointLight(0xffc477,0,11,1.7);scene.add(l);return l;});
function refreshTorches(){const points=new Map();for(const list of torchSourcesByChunk.values())for(const p of list)points.set(`${p.x},${p.y},${p.z}`,p);for(const[key,t]of edits)if(t===T.TORCH){const[x,y,z]=decodeKey(key),p=new THREE.Vector3(x-OFFSET+.5,y+.8,z-OFFSET+.5);points.set(`${p.x},${p.y},${p.z}`,p);}torchPositions=[...points.values()];torchSourcesDirty=false;torchTimer=1;}
function updateTorches(dt){torchTimer+=dt;if(torchSourcesDirty)refreshTorches();if(torchTimer<.4)return;torchTimer=0;const nearest=torchesNear();torchLights.forEach((l,i)=>{l.intensity=nearest[i]?9:0;if(nearest[i])l.position.copy(nearest[i]);});}

function torchesNear(){return torchPositions.filter(p=>p.distanceToSquared(camera.position)<225).sort((a,b)=>a.distanceToSquared(camera.position)-b.distanceToSquared(camera.position)).slice(0,4);}

// Inventory stores actual stacks. Hotbar is the first nine slots of a 36-slot bag.
let bag=Array(36).fill(null),selected=0,gameMode='survival',panel=null,heldSlot=null,craftSize=2,craftGrid=Array(9).fill(null),chests={},furnaceJobs=[],furnaceFuel={},equipment=Array(5).fill(null);
let mining=null,mineHeld=false,handSwing=0,health=20,food=20,fallStart=null,regenTime=0,flying=false,worldTime=0,artReady=0,visitedRegions=new Set(['0,0']),visitedBiomes=new Set(['plains']),defeatedMobs=new Set(),lootedChestKeys=new Set();
const held=()=>bag[selected];
const total=key=>bag.reduce((n,s)=>n+(s?.id===key?s.count:0),0);
function addTo(slots,key,count,durability){const d=itemDefs[key];for(const s of slots)if(s?.id===key&&d.max>1&&s.count<d.max){const n=Math.min(count,d.max-s.count);s.count+=n;count-=n;if(!count)return true;}for(let i=0;i<slots.length&&count;i++)if(!slots[i]){const n=Math.min(count,d.max);slots[i]={id:key,count:n,...(d.life?{durability:durability??d.life}:{})};count-=n;}return !count;}
function roomFor(key,count){const copy=bag.map(s=>s?{...s}:null);return addTo(copy,key,count);}
function gain(key,count=1,durability){if(!roomFor(key,count))return false;addTo(bag,key,count,durability);renderInventory();return true;}
function consume(key,count){for(let i=0;i<bag.length&&count;i++)if(bag[i]?.id===key){const n=Math.min(count,bag[i].count);bag[i].count-=n;count-=n;if(!bag[i].count)bag[i]=null;}renderInventory();}
function spendSelected(){if(gameMode==='creative')return;if(bag[selected]&&!--bag[selected].count)bag[selected]=null;renderInventory();}
const iconCache={};
function icon(key){const span=document.createElement('span');span.className='item-icon';if(!iconCache[key])iconCache[key]=drawItemIcon(key,32).toDataURL();span.style.backgroundImage=`url(${iconCache[key]})`;return span;}
function slotButton(stack,index,kind){const b=document.createElement('button');b.className='slot';b.dataset.slot=index;b.dataset.kind=kind;if(kind==='bag'&&index===selected)b.classList.add('selected');if(heldSlot?.kind===kind&&heldSlot.index===index)b.classList.add('carrying');b.title=stack?`${itemDefs[stack.id].description} ×${stack.count}${stack.durability?' / 残り耐久 '+stack.durability:''}`:kind==='equipment'?['頭','胴','脚','足','盾'][index]:'空きスロット';b.setAttribute('aria-label',b.title);if(stack){b.append(icon(stack.id));const c=document.createElement('span');c.className='count';c.textContent=stack.count>1?stack.count:'';b.append(c);if(stack.durability){const bar=document.createElement('i');bar.className='durability';bar.style.width=(stack.durability/itemDefs[stack.id].life*80)+'%';b.append(bar);}}if(kind==='hotbar'){const n=document.createElement('small');n.textContent=index+1;b.append(n);b.onclick=()=>select(index);}else b.onclick=e=>moveSlot(kind,index,e.shiftKey);return b;}
function slotList(kind){return kind==='bag'?bag:kind==='craft'?craftGrid:kind==='equipment'?equipment:chests[panel.index];}
function moveSlot(kind,index,shift){const slots=slotList(kind);if(!slots)return;
 if(kind==='equipment'&&!heldSlot&&slots[index]){const stack=slots[index];if(!roomFor(stack.id,1)){notify('装備を外すために、持ち物の空きを作ってください。');return;}addTo(bag,stack.id,1,stack.durability);slots[index]=null;renderInventory();return;}
 if(shift&&kind==='bag'&&panel?.type!=='chest'&&slots[index]&&itemDefs[slots[index].id].slot){equipFrom(index);return;}
 if(shift&&kind==='bag'&&panel?.type==='chest'){const s=slots[index];if(s){const copy=chests[panel.index].map(s=>s?{...s}:null);if(addTo(copy,s.id,s.count,s.durability)){chests[panel.index]=copy;slots[index]=null;}}}
 else if(heldSlot){const source=slotList(heldSlot.kind);if(!source){heldSlot=null;return;}const s=source[heldSlot.index];if(s){if((kind==='equipment'&&itemDefs[s.id].slot!==equipmentSlots[index])||(heldSlot.kind==='equipment'&&slots[index]&&itemDefs[slots[index].id].slot!==equipmentSlots[heldSlot.index])){notify('その部位に合う装備を選んでください。');return;}if(kind==='craft'){if(!slots[index]||slots[index].id===s.id){if(!slots[index])slots[index]={id:s.id,count:0,...(s.durability?{durability:s.durability}:{})};if(slots[index].count<itemDefs[s.id].max){slots[index].count++;if(!--s.count)source[heldSlot.index]=null;}}}
 else{const dest=slots[index];if(dest?.id===s.id&&itemDefs[s.id].max>1&&!(source===slots&&heldSlot.index===index)){const n=Math.min(s.count,itemDefs[s.id].max-dest.count);dest.count+=n;s.count-=n;if(!s.count)source[heldSlot.index]=null;}else{slots[index]=s;source[heldSlot.index]=dest;}heldSlot=null;}}
 }else if(slots[index])heldSlot={kind,index};renderInventory();}
function equipFrom(i){const stack=bag[i],slot=stack?equipmentSlots.indexOf(itemDefs[stack.id].slot):-1;if(slot<0)return;const old=equipment[slot];equipment[slot]=stack;bag[i]=old;heldSlot=null;renderInventory();notify(itemDefs[stack.id].name+'を装備しました。');}
function armorPoints(){return equipment.reduce((n,v)=>n+(v?(itemDefs[v.id].armor??0):0),0);}
function damage(amount,reason){if(gameMode==='creative')return;const protection=Math.min(.8,armorPoints()*.035+(equipment[4]?.id==='shield'?.1:0));health-=Math.max(.5,amount*(1-protection));for(let i=0;i<equipment.length;i++)if(equipment[i]&&(equipment[i].durability-=Math.max(1,Math.ceil(amount/2)))<=0){notify(itemDefs[equipment[i].id].name+'が壊れました。');equipment[i]=null;}if(health<=0){health=20;food=20;goHome();notify(reason+'で地上へ戻りました。持ち物は残ります。');}renderInventory();}
function ingredients(r){const a={};for(const row of r.shape)for(const char of row)if(r.keys[char])a[r.keys[char]]=(a[r.keys[char]]||0)+1;return a;}
function gridRecipe(){const filled=[];for(let i=0;i<craftSize*craftSize;i++)if(craftGrid[i])filled.push([i%craftSize,Math.floor(i/craftSize),craftGrid[i].id]);if(!filled.length)return null;const minX=Math.min(...filled.map(v=>v[0])),minY=Math.min(...filled.map(v=>v[1]));const actual=filled.map(([x,y,k])=>`${x-minX},${y-minY}:${k}`).sort().join('|');return recipes.find(r=>r.size<=craftSize&&[false,true].some(mirror=>{const expected=[];for(let y=0;y<r.shape.length;y++)for(let x=0;x<r.shape[y].length;x++)if(r.keys[r.shape[y][x]])expected.push(`${mirror?r.shape[y].length-x-1:x},${y}:${r.keys[r.shape[y][x]]}`);const mx=Math.min(...expected.map(v=>+v.split(',')[0]));return expected.map(v=>{const [coord,k]=v.split(':');const [x,y]=coord.split(',');return `${+x-mx},${y}:${k}`;}).sort().join('|')===actual;}))??null;}
function returnGrid(){const copy=bag.map(s=>s?{...s}:null);for(const s of craftGrid)if(s&&!addTo(copy,s.id,s.count,s.durability))return false;bag=copy;craftGrid.fill(null);heldSlot=null;return true;}
function ownedForCraft(key){return total(key)+craftGrid.reduce((n,v)=>n+(v?.id===key?v.count:0),0);}
function availableRecipes(){return recipes.filter(r=>r.size<=craftSize&&Object.entries(ingredients(r)).every(([key,n])=>ownedForCraft(key)>=n));}
function fillRecipe(r){if(r.size>craftSize){notify('作業台を置いて、近くでFを押すと3×3のクラフトができます。');return;}if(!returnGrid()){notify('素材を戻す空きスロットが足りません。');return;}const needs=ingredients(r);if(Object.entries(needs).some(([k,n])=>total(k)<n)){notify('このレシピの素材が足りません。必要数をレシピに表示しています。');renderInventory();return;}for(const [k,n]of Object.entries(needs))consume(k,n);for(let y=0;y<r.shape.length;y++)for(let x=0;x<r.shape[y].length;x++){const k=r.keys[r.shape[y][x]];if(k)craftGrid[y*craftSize+x]={id:k,count:1};}renderInventory();}
function craft(){const r=gridRecipe();if(!r||!roomFor(r.id,r.n))return;if(gameMode==='survival')for(let i=0;i<craftSize*craftSize;i++)if(craftGrid[i]&&!--craftGrid[i].count)craftGrid[i]=null;gain(r.id,r.n);notify(`${itemDefs[r.id].name} ×${r.n} をクラフトしました。`);renderInventory();}
function select(i){selected=i;mining=null;renderInventory();notify(`${i+1}：${held()?itemDefs[held().id].name:'素手'} · Eで配置 / 左クリック長押しで採掘`);}
function nearby(type){const c=cellAt(player.x,player.z);for(let z=c.z-4;z<=c.z+4;z++)for(let x=c.x-4;x<=c.x+4;x++)for(let y=Math.floor(player.y)-2;y<=Math.floor(player.y)+3;y++)if(voxel(x,y,z)===type&&Math.hypot(x+.5-OFFSET-player.x,y+.5-player.y,z+.5-OFFSET-player.z)<4.5)return {x,y,z,index:index(x,y,z)};return null;}
function openPanel(type='inventory',station=null){if(panel){closePanel();return;}if(!entered)return;mining=null;mineHeld=false;keys.clear();dragging=false;if(document.pointerLockElement)document.exitPointerLock();craftSize=type==='table'?3:2;panel={type,...station};if(type==='chest'&&!Object.hasOwn(chests,panel.index)){chests[panel.index]=Array(27).fill(null);if(!lootedChestKeys.has(panel.index)){for(const loot of world.lootAt(panel.x,panel.y,panel.z))addTo(chests[panel.index],loot.id,loot.count);lootedChestKeys.add(panel.index);}}$('inventory').hidden=false;renderInventory();}
function closePanel(){if(!panel)return;if(!returnGrid()){notify('クラフト欄の素材を戻すため、空きスロットを作ってください。');return;}panel=null;heldSlot=null;$('inventory').hidden=true;keys.clear();renderInventory();if(!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock()?.catch(()=>{});}
function workstation(){camera.updateMatrixWorld();const hit=traceVoxel();if(hit&&hit.distance<=5&&[T.TABLE,T.FURNACE,T.CHEST].includes(hit.type)){openPanel(hit.type===T.TABLE?'table':hit.type===T.FURNACE?'furnace':'chest',{x:hit.x,y:hit.y,z:hit.z,index:index(hit.x,hit.y,hit.z)});return;}const station=nearby(T.TABLE);openPanel(station?'table':'inventory',station);}
function smelt(key){
 const station=panel?.type==='furnace'?panel:nearby(T.FURNACE),recipe=smeltingRecipes.find(r=>r.id===key);if(!station||!recipe)return;
 let credit=furnaceFuel[station.index]??0;const fuel=['coal','charcoal','log','pineLog','jungleLog','plank'].find(k=>total(k)>(k===recipe.input?1:0));
 if(!total(recipe.input)||(!fuel&&credit<recipe.time)||furnaceJobs.length>=64){notify('原料と燃料が必要です。燃料は石炭・木炭・原木・木材。');return;}
 consume(recipe.input,1);let used='reserve';if(credit<recipe.time){used=fuel;consume(fuel,1);credit+=['coal','charcoal'].includes(fuel)?32:6;}furnaceFuel[station.index]=credit-recipe.time;
 furnaceJobs.push({id:key,input:recipe.input,fuel:used,remaining:recipe.time,index:station.index});renderInventory();
}
function tickFurnace(dt){
 const active=new Set(),finished=[];for(const j of furnaceJobs){if(active.has(j.index))continue;active.add(j.index);if(edits.get(j.index)===T.AIR)continue;j.remaining=Math.max(0,j.remaining-dt);if(!j.remaining&&roomFor(j.id,1)){gain(j.id);finished.push(j);notify(itemDefs[j.id].name+'が焼けました。');}}
 if(finished.length)furnaceJobs=furnaceJobs.filter(j=>!finished.includes(j));
 if(panel?.type==='furnace'){const jobs=furnaceJobs.filter(j=>j.index===panel.index);$('smeltStatus').textContent=jobs.length?`${itemDefs[jobs[0].id].name} · ${Math.ceil(jobs[0].remaining)}秒 / 待ち${jobs.length}個`:`原料を選んで精錬 · 燃料残量${Math.round((furnaceFuel[panel.index]??0)/4*10)/10}個分`;}
}
function renderAvatar(){const c=$('avatar'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.fillStyle='#23342c';g.fillRect(0,0,96,128);g.fillStyle='#ba9271';g.fillRect(32,14,32,30);g.fillStyle=equipment[0]?itemDefs[equipment[0].id].color:'#70553d';g.fillRect(28,8,40,12);if(equipment[0]){g.fillRect(28,17,7,20);g.fillRect(61,17,7,20);}g.fillStyle='#242826';g.fillRect(36,25,5,4);g.fillRect(54,25,5,4);g.fillStyle=equipment[1]?itemDefs[equipment[1].id].color:'#42838a';g.fillRect(26,47,44,37);g.fillRect(15,48,12,31);g.fillRect(69,48,12,31);g.fillStyle=equipment[2]?itemDefs[equipment[2].id].color:'#516788';g.fillRect(27,84,18,31);g.fillRect(51,84,18,31);g.fillStyle=equipment[3]?itemDefs[equipment[3].id].color:'#574b3b';g.fillRect(24,112,23,9);g.fillRect(49,112,23,9);g.fillStyle='#ffffff35';g.fillRect(30,49,30,3);if(equipment[4]){g.fillStyle=itemDefs[equipment[4].id].color;g.fillRect(72,62,20,27);g.fillStyle='#aebabc';g.fillRect(73,63,18,3);}}
function renderInventory(){const hot=$('hotbar');hot.replaceChildren(...bag.slice(0,9).map((s,i)=>slotButton(s,i,'hotbar')));$('heldName').textContent=held()?`${itemDefs[held().id].name}${gameMode==='creative'?' ∞':''}`:'素手';$('playMode').textContent=gameMode==='creative'?'クリエイティブ':'サバイバル';$('vitals').hidden=gameMode==='creative';$('armorRating').textContent=`防御 ${armorPoints()} / 20`;$('resources').textContent=`原木 ${total('log')} · 丸石 ${total('stone')} · 鉄 ${total('iron')} · レール ${total('rail')}`;
 if(!panel)return;$('inventoryTitle').textContent=panel.type==='table'?'作業台 · 3 × 3':panel.type==='furnace'?'かまど':panel.type==='chest'?'チェスト':'インベントリ · 2 × 2';
 $('equipmentSlots').replaceChildren(...equipment.map((v,i)=>slotButton(v,i,'equipment')));renderAvatar();$('bag').replaceChildren(...bag.map((s,i)=>slotButton(s,i,'bag')));$('recipeBook').hidden=['chest','furnace'].includes(panel.type);$('craftArea').hidden=['chest','furnace'].includes(panel.type);$('chestArea').hidden=panel.type!=='chest';$('furnaceArea').hidden=panel.type!=='furnace';$('creativeArea').hidden=gameMode!=='creative';
 if(panel.type==='chest')$('chestSlots').replaceChildren(...chests[panel.index].map((s,i)=>slotButton(s,i,'chest')));
 if(!$('craftArea').hidden){$('craftGrid').style.gridTemplateColumns=`repeat(${craftSize},var(--slot))`;$('craftGrid').replaceChildren(...craftGrid.slice(0,craftSize*craftSize).map((s,i)=>slotButton(s,i,'craft')));const r=gridRecipe();$('craftOutput').replaceChildren();$('craftOutput').disabled=!r||!roomFor(r.id,r.n);if(r){$('craftOutput').append(icon(r.id));$('craftOutput').append(document.createTextNode(' ×'+r.n));}$('recipeBook').replaceChildren(...availableRecipes().map(r=>{const b=document.createElement('button');b.dataset.recipe=r.id;const needs=ingredients(r);b.className='recipe'+(r.size>craftSize?' locked':'');b.append(icon(r.id));const text=document.createElement('span');text.textContent=`${itemDefs[r.id].name} ×${r.n}`;const small=document.createElement('small');small.textContent=Object.entries(needs).map(([k,n])=>`${itemDefs[k].name}${n}`).join('・')+(r.size>craftSize?' / 作業台':'' );text.append(small);b.append(text);b.onclick=()=>fillRecipe(r);return b;}));}
 $('recipeCount').textContent=`${availableRecipes().length} 種`;if(!$('recipeBook').children.length){const p=document.createElement('p');p.className='slot-guide';p.textContent='今作れるレシピはありません。木や鉱石を集め、作業台でFを押すと種類が増えます。';$('recipeBook').append(p);}
 if(panel.type==='furnace'){$('smeltRecipes').replaceChildren(...smeltingRecipes.filter(r=>total(r.input)>0&&((furnaceFuel[panel.index]??0)>=r.time||['coal','charcoal','log','pineLog','jungleLog','plank'].some(k=>total(k)>(k===r.input?1:0)))).map(r=>{const b=document.createElement('button');b.dataset.smelt=r.id;b.append(icon(r.id));b.append(document.createTextNode(itemDefs[r.input].name+' → '+itemDefs[r.id].name));b.onclick=()=>smelt(r.id);return b;}));$('smeltStatus').textContent=furnaceJobs.length?`精錬中 · 残り ${furnaceJobs.length} 個`:'原料を選んで精錬 → 4秒で完成';}
 if(gameMode==='creative')$('creativeItems').replaceChildren(...Object.keys(itemDefs).filter(k=>{const d=itemDefs[k],q=$('itemSearch').value.trim().toLowerCase(),category=$('itemCategory').value;return(!q||d.name.includes(q)||k.toLowerCase().includes(q))&&(category==='all'||category==='tool'&&d.tool||category==='armor'&&d.slot||category==='block'&&d.block!==null||category==='material'&&!d.tool&&!d.slot&&d.block===null);}).map(k=>{const b=document.createElement('button');b.className='slot';b.title=itemDefs[k].name;b.append(icon(k));b.onclick=()=>{gain(k,itemDefs[k].max);};return b;}));
}
$('discard').onclick=()=>{if(heldSlot){const slots=slotList(heldSlot.kind);if(slots)slots[heldSlot.index]=null;heldSlot=null;renderInventory();notify('選んだスタックを捨てました。');}};
$('inventoryToggle').onclick=()=>openPanel();$('craftToggle').onclick=workstation;$('closeInventory').onclick=closePanel;$('craftOutput').onclick=craft;

$('itemSearch').oninput=renderInventory;$('itemCategory').onchange=renderInventory;
$('playMode').onclick=()=>{gameMode=gameMode==='survival'?'creative':'survival';renderInventory();notify(gameMode==='creative'?'クリエイティブ：Iの素材一覧から自由に建築できます。':'サバイバル：採掘・クラフトして集めた素材を使います。');};
const drops={[T.DIRT]:'dirt',[T.GRASS]:'dirt',[T.STONE]:'stone',[T.DEEP]:'stone',[T.SNOW]:'snow',[T.WOOD]:'log',[T.ROOF]:'plank',[T.RUIN]:'moss',[T.LEAVES]:'leaves',[T.PLANK]:'plank',[T.COBBLE]:'stone',[T.COAL]:'coal',[T.IRON]:'ironOre',[T.GOLD]:'goldOre',[T.TABLE]:'table',[T.FURNACE]:'furnace',[T.CHEST]:'chest',[T.GLASS]:'glass',[T.SAND]:'sand',[T.GLOW]:'amethyst',[T.TORCH]:'torch',[T.DIAMOND]:'diamond',[T.EMERALD]:'emerald',[T.REDSTONE]:'redstone',[T.LAPIS]:'lapis',[T.COPPER]:'copperOre',[T.COPPER_BLOCK]:'copperBlock',[T.IRON_BLOCK]:'ironBlock',[T.GOLD_BLOCK]:'goldBlock',[T.DIAMOND_BLOCK]:'diamondBlock',[T.EMERALD_BLOCK]:'emeraldBlock',[T.OBSIDIAN]:'obsidian',[T.BRICK]:'brickBlock',[T.BOOKSHELF]:'bookshelf',[T.CACTUS]:'cactus',[T.MUSHROOM]:'mushroom',[T.BASALT]:'basalt',[T.CLAY]:'clay',[T.SNOW_LOG]:'pineLog',[T.PINE_LEAVES]:'pineLeaves',[T.JUNGLE_LOG]:'jungleLog',[T.JUNGLE_LEAVES]:'jungleLeaves',[T.RED_SAND]:'redSand',[T.ICE]:'ice',[T.WOOL]:'wool'};
function miningInfo(hit){return {...miningProfile(hit.type,held()?itemDefs[held().id]:null,gameMode==='creative'),drop:hit.type===T.LEAVES&&hash(hit.x,hit.y,hit.z)>.94?'apple':drops[hit.type]};}
function beginMine(){if(!entered||panel||mode!=='build')return;camera.updateMatrixWorld();const h=traceVoxel();if(strikeMonster(h)){mining=null;return;}if(!canMine(h)){notify('このブロックは掘れません。線路の土台はQでレールを外してから掘れます。');return;}const info=miningInfo(h);mining={...h,progress:0,...info};handSwing=.3;}
function mineBlock(h){const info=miningInfo(h);if(info.drop&&gameMode==='survival'&&!roomFor(info.drop,1)){notify('インベントリがいっぱいです。チェストへ移すか、ブロックを置いて空きを作ろう。');return;}
 if(h.type===T.CHEST&&!Object.hasOwn(chests,index(h.x,h.y,h.z))){const loot=world.lootAt(h.x,h.y,h.z);if(loot.length&&!lootedChestKeys.has(index(h.x,h.y,h.z))){notify('宝箱の中身をFで取り出してから壊してください。');return;}}
 if(h.type===T.CHEST&&chests[index(h.x,h.y,h.z)]?.some(Boolean)){notify('中身を取り出してからチェストを壊してください。');return;}if(furnaceJobs.some(j=>j.index===index(h.x,h.y,h.z))){notify('精錬が終わってから、かまどを壊してください。');return;}
 setVoxel(h.x,h.y,h.z,T.AIR);if(gameMode==='survival'&&info.drop)gain(info.drop);if(h.type===T.CHEST)delete chests[index(h.x,h.y,h.z)];if(h.type===T.FURNACE)delete furnaceFuel[index(h.x,h.y,h.z)];
 const s=held();if(gameMode==='survival'&&s&&itemDefs[s.id].tool){if(!--s.durability){bag[selected]=null;notify('道具が壊れました。');}renderInventory();}mined++;handSwing=.3;flushChunks();if(h.type===T.TORCH)refreshTorches();updateMission();}
function tickMining(dt){if(mineHeld&&!mining)beginMine();if(!mining)return;camera.updateMatrixWorld();const h=traceVoxel();if(panel||mode!=='build'||!h||h.x!==mining.x||h.y!==mining.y||h.z!==mining.z){mining=null;return;}mining.progress+=dt;$('breakProgress').hidden=false;$('breakFill').style.width=Math.min(100,mining.progress/mining.time*100)+'%';handSwing=.2;if(mining.progress>=mining.time){mineBlock(mining);mining=null;$('breakProgress').hidden=true;if(mineHeld)beginMine();}}

const railGroup = new THREE.Group(); scene.add(railGroup);
let rails = [], tool = 'lower', mode = 'build', entered = false, yaw = -2.80, pitch = .25;
let target = null, valid = false, riding = 0, rideDirection = 1, speed = 4, velocity = 0;
let caveFound = false, caveRidden = false, mined = 0, caveMix = 0;
const keys = new Set(), player = new THREE.Vector3(32.5 - OFFSET, height(32,10), 10.5 - OFFSET);
camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); scene.add(camera);
const lantern = new THREE.SpotLight(0xd6f5ff, 0, 24, .8, .7, 1.2), lanternTarget = new THREE.Object3D(); lantern.position.set(0, 0, 0); lanternTarget.position.set(0, 0, -1); camera.add(lantern, lanternTarget); lantern.target = lanternTarget;
function supportBelow(x, z, limit) { const c = cellAt(x, z); if (!inside(c.x, c.z)) return MIN_Y; for (let y = Math.min(MAX_Y - 1, Math.floor(limit) - 1); y >= MIN_Y; y--) if (solid(c.x, y, c.z)) return y + 1; return MIN_Y; }
function ceilingAbove(x, z, feet) { const c = cellAt(x, z); for (let y = Math.max(MIN_Y, Math.floor(feet + .01)); y < MAX_Y; y++) if (solid(c.x, y, c.z)) return y; return Infinity; }
function bodyClear(x, z, feet) {
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  for (const [dx, dz] of [[0, 0], [.18, .18], [-.18, .18], [.18, -.18], [-.18, -.18]]) { const c = cellAt(x + dx, z + dz); for (let y = Math.floor(feet + .01); y < feet + BODY - .01; y++) if (solid(c.x, y, c.z)) return false; }
  return !obstacles.some(t => Math.abs(x - t.x) < t.radius && Math.abs(z - t.z) < t.radius && feet < t.y + t.height && feet + BODY > t.y);
}
function safeSpawn() { for (const [x, z] of [[32, 10], [32, 11], [31, 10], [33, 11]]) { const y = supportBelow(x - OFFSET + .5, z - OFFSET + .5, MAX_Y); if (bodyClear(x - OFFSET + .5, z - OFFSET + .5, y)) return new THREE.Vector3(x - OFFSET + .5, y, z - OFFSET + .5); } return new THREE.Vector3(32.5 - OFFSET, MAX_Y, 10.5 - OFFSET); }
const railPoint = r => new THREE.Vector3(r.x - OFFSET + .5, r.y + .12, r.z - OFFSET + .5);
const markerMaterial = new THREE.MeshBasicMaterial({ color: '#d0f789' });
function beam(a, b, width, height, material) { const mesh = new THREE.Mesh(cube, material); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.scale.set(width, height, a.distanceTo(b)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()); railGroup.add(mesh); }
let lengths = [], routeLength = 0;
const caveRail = r => inCave(r.x - OFFSET + .5, r.z - OFFSET + .5, r.y);
let railConnection=false;
const connectedToCave = () => railConnection;
function updateMission() {
  const connected = connectedToCave(); $('mission').classList.toggle('complete', caveRidden);
  $('missionTitle').textContent = caveRidden ? '地底への冒険、達成！' : connected ? '地底の大洞窟へ出発しよう' : caveFound ? '地上と大洞窟をつなごう' : '掘って、地底の光を探そう';
  $('missionDetail').textContent = caveRidden ? '山と地底を結ぶ、あなたのジェットコースター。' : connected ? '自分の線路で、あの大空間へ試乗。' : caveFound ? '階段やトンネルに沿って線路をつなごう。' : '遺跡の下から、不思議な音が聞こえる。';
  $('missionSteps').textContent = `${mined ? '✓' : '○'} 掘削　${caveFound ? '✓' : '○'} 発見　${connected ? '✓' : '○'} 接続　${caveRidden ? '✓' : '○'} 試乗`;
}
function refreshRails() {
  railConnection=rails.some(caveRail)&&rails.some(r=>r.y>=0&&!caveRail(r));
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
  const o = camera.position, d = touchAim?new THREE.Vector3(touchAim.x,touchAim.y,.5).unproject(camera).sub(o).normalize():camera.getWorldDirection(new THREE.Vector3());
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
function railSupported(r,get=voxel){return inWorld(r.x,r.y-1,r.z)&&inWorld(r.x,r.y+1,r.z)&&solidType(get(r.x,r.y-1,r.z))&&[T.AIR,T.TORCH,T.MUSHROOM].includes(get(r.x,r.y,r.z))&&[T.AIR,T.TORCH,T.MUSHROOM].includes(get(r.x,r.y+1,r.z));}
function canPlace(t) { if (!t || !railSupported(t) || blocked(t.x, t.z, t.y) || rails.some(r => r.x === t.x && r.z === t.z && r.y === t.y)) return false; const prev = rails.at(-1); return !prev || (Math.abs(t.x - prev.x) + Math.abs(t.z - prev.z) === 1 && Math.abs(t.y - prev.y) <= 1); }
function canMine(t) { return t && inWorld(t.x, t.y, t.z) && t.type !== T.BEDROCK && t.type !== T.WATER && t.type !== T.LAVA && !rails.some(r => r.x === t.x && r.z === t.z && r.y - 1 === t.y) && !obstacles.some(o => Math.abs(o.x - (t.x - OFFSET + .5)) < .8 && Math.abs(o.z - (t.z - OFFSET + .5)) < .8 && t.y === o.y - 1); }
function canBuild(t) {
  if (!t || !inWorld(t.x, t.y, t.z) || voxel(t.x, t.y, t.z) || blocked(t.x, t.z, t.y + 1) || rails.some(r => r.x === t.x && r.z === t.z && t.y >= r.y - 1 && t.y <= r.y + 1)) return false;
  return !(Math.abs(player.x-(t.x-OFFSET+.5))<.69&&Math.abs(player.z-(t.z-OFFSET+.5))<.69&&t.y+1>player.y&&t.y<player.y+BODY);
}
function aim() {
 target=null;valid=false;selector.visible=false;if(mode!=='build'||!entered||panel)return;
 camera.updateMatrixWorld();const hit=traceVoxel();const foe=monsters.aimed(camera.position,aimDirection(),hit?.distance??Infinity);if(foe){$('target').textContent=foe.name+' · 体力 '+Math.ceil(foe.hp)+' · 左長押し / Eで攻撃';return;}if(!hit)return;
 const d=held()?itemDefs[held().id]:null;tool=d?.rail?'rail':d?.block?'block':'lower';
 if(tool==='rail'&&!mining&&!mineHeld){if(hit.normal.y!==1)return;target={x:hit.x,z:hit.z,y:hit.y+1};valid=canPlace(target);selector.position.set(target.x-OFFSET+.5,target.y+.02,target.z-OFFSET+.5);selector.scale.set(1.015,.03,1.015);}
 else if(tool==='lower'||mining||mineHeld){target=hit;valid=canMine(hit);selector.position.set(hit.x-OFFSET+.5,hit.y+.5,hit.z-OFFSET+.5);selector.scale.set(1.006,1.006,1.006);}
 else{target={x:hit.x+hit.normal.x,y:hit.y+hit.normal.y,z:hit.z+hit.normal.z};valid=canBuild(target);selector.position.set(target.x-OFFSET+.5,target.y+.5,target.z-OFFSET+.5);selector.scale.set(1.006,1.006,1.006);}
 selector.material.color.set(valid?'#ffffff':'#e96554');selector.visible=true;
 const name=Object.entries(T).find(([,v])=>v===hit.type)?.[0];
 $('target').textContent=`${drops[hit.type]?itemDefs[drops[hit.type]].name:name} · ${valid?(tool==='lower'?`長押しで採掘 · ${miningInfo(hit).time.toFixed(1)}秒`:'Eで配置・左長押しで採掘'):'場所を変えてください'} · Fで作業台などを使う`;
}
function notify(s){$('message').textContent=s;}
function place(){
 if(!entered||panel||mode!=='build')return;
 const d=held()?itemDefs[held().id]:null;if(d?.slot){equipFrom(selected);return;}if(d?.food){if(gameMode==='survival')consume(held().id,1);food=Math.min(20,food+d.food);health=Math.min(20,health+(d.heal??0));if(d.returns&&roomFor(d.returns,1))gain(d.returns);notify(d.name+'を食べました。');return;}if(d?.navigation){showNavigation(d.navigation);return;}
 if(!d?.block&&!d?.rail){beginMine();return;}
 aim();if(!target||!valid){notify(d.rail?'レールは最後のマスの隣、段差1ブロックまで。頭上2マス空けてください。':'空いている隣のマスを狙ってください。自分の体には置けません。');return;}
 if(d.rail){rails.push({x:target.x,y:target.y,z:target.z});spendSelected();refreshRails();notify('レールを敷きました。Qで取り外すと素材が戻ります。');}
 else{setVoxel(target.x,target.y,target.z,d.block);spendSelected();flushChunks();if(d.block===T.TORCH)refreshTorches();notify(`${d.name}を置きました。${[T.TABLE,T.FURNACE,T.CHEST].includes(d.block)?'近くでFを押すと使えます。':''}`);}
 handSwing=.3;aim();
}
function enter(){entered=true;document.body.classList.add('playing');if(!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock()?.catch(()=>{});notify('まず木を集めよう。左長押しで採掘 / Eで配置 / Iでインベントリ / Fで作業台。');}
$('enter').onclick=enter;try{$('homeLoad').disabled=!localStorage.getItem('block-coaster-world-v6')&&!localStorage.getItem('block-coaster-world-v5');}catch{$('homeLoad').disabled=true;}$('homeLoad').onclick=()=>{enter();$('load').onclick();};$('helpToggle').onclick=()=>{$('help').hidden=!$('help').hidden;if(!$('help').hidden&&document.pointerLockElement)document.exitPointerLock();};
let hintIndex=0;
$('hint').onclick=()=>{const hints=['木を左クリック長押し、または素手のEで採掘。Iで原木→木材→棒・作業台をクラフト。','作業台をホットバーへ移し、Eで設置。近くでFを押して木のツルハシを作る。ツルハシを使うと石や鉱石を速く掘れます。','遺跡の下に洞窟が眠っています。鉄は石のツルハシで速く採掘。松明を持って、階段状に掘り進もう。','丸石8個でかまど。原鉄と石炭などを焼いて鉄に。作業台で鉄6個＋棒1本からレール16本を作る。','レールは最後のマスの前後左右につなごう。段差は1ブロックまで。Rで地上へ帰れます。'];notify(hints[Math.min(hintIndex++,hints.length-1)]);};
$('place').onclick=place;
function stopRide() { mode = 'build'; player.copy(camera.position); player.y = supportBelow(player.x, player.z, camera.position.y); if (!bodyClear(player.x, player.z, player.y)) player.copy(safeSpawn()); velocity=0;fallStart=null;flying=false; $('ride').textContent = '▶ 乗る'; $('mode').textContent = '一人称 · 建設'; notify('降車しました。地上でも地下でも線路を編集できます。'); }
function goHome() { if (mode === 'ride') stopRide(); player.copy(safeSpawn()); camera.position.copy(player).add(new THREE.Vector3(0, 1.65, 0)); velocity = 0; fallStart=null;flying=false;keys.clear(); notify('地上へ戻りました。掘った地形と線路は残っています。'); }
$('home').onclick = goHome;
function undo() { if (mode === 'ride') stopRide(); if(!rails.length)return;if(gameMode==='survival'&&!roomFor('rail',1)){notify('レールを回収する空きがありません。');return;}rails.pop();if(gameMode==='survival')gain('rail');refreshRails();notify('末尾のレールを回収しました。'); }
$('undo').onclick=undo; $('clear').onclick=()=>{if(gameMode==='survival'&&!roomFor('rail',rails.length)){notify('全部のレールを回収する空きが足りません。Qで少しずつ回収できます。');return;}if(mode==='ride')stopRide();if(gameMode==='survival'&&rails.length)gain('rail',rails.length);rails=[];refreshRails();notify('線路を回収しました。');};
$('ride').onclick = () => { if (mode === 'ride') { stopRide(); return; } if (rails.length < 2) return; if (!entered) enter(); mode = 'ride'; riding = 0; rideDirection = 1; const delta = railPoint(rails[1]).sub(railPoint(rails[0])); yaw = Math.atan2(-delta.x, -delta.z); pitch = 0; $('ride').textContent = '■ 降りる'; $('mode').textContent = '一人称 · 乗車'; notify('出発！自分で掘ったトンネルと敷いた線路の先へ。マウスで自由に見回せます。'); };
$('speed').oninput = e => speed = +e.target.value;
const SAVE_KEY='block-coaster-world-v6';
function snapshot(){return {version:6,seed:3,edits:[...edits],rails:rails.map(r=>({...r})),caveFound,caveRidden,mined,player:mode==='ride'?[camera.position.x,supportBelow(camera.position.x,camera.position.z,camera.position.y),camera.position.z]:player.toArray(),view:[yaw,pitch],bag:bag.map(s=>s?{...s}:null),selected,gameMode,health,food,worldTime,craftGrid:craftGrid.map(s=>s?{...s}:null),craftSize,equipment:equipment.map(s=>s?{...s}:null),chests:JSON.parse(JSON.stringify(chests)),furnaceJobs:furnaceJobs.map(j=>({...j})),furnaceFuel:{...furnaceFuel},visitedRegions:[...visitedRegions],visitedBiomes:[...visitedBiomes],defeatedMobs:[...defeatedMobs],lootedChestKeys:[...lootedChestKeys]};}
$('save').onclick=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));notify('地形・建築・線路・装備・持ち物・探索地図を保存しました。');}catch{notify('保存できません。ブラウザの空き容量・保存設定を確認してください。');}};
$('load').onclick=()=>{try{
 let raw=localStorage.getItem(SAVE_KEY),migrated=false;if(!raw){raw=localStorage.getItem('block-coaster-world-v5');if(raw)migrated=true;}if(!raw){notify('このブラウザに保存はありません。');return;}
 const parsed=JSON.parse(raw),source=migrated?migrateV5(parsed):parsed;
 const{data:s,edits:validatedEdits}=validateSnapshot(source,{world,itemDefs,equipmentSlots,minY:MIN_Y,maxY:MAX_Y,blockTypes:T});
 if(mode==='ride')stopRide();monsters.clear();stopPrimary();world.setEdits(validatedEdits);rails=s.rails;bag=s.bag;selected=s.selected;gameMode=s.gameMode;health=s.health;food=s.food;worldTime=s.worldTime;equipment=s.equipment;craftGrid=s.craftGrid;craftSize=s.craftSize;chests=s.chests;furnaceJobs=s.furnaceJobs;furnaceFuel=s.furnaceFuel;visitedRegions=new Set(s.visitedRegions);visitedBiomes=new Set(s.visitedBiomes);defeatedMobs=new Set(s.defeatedMobs);lootedChestKeys=new Set(s.lootedChestKeys);caveFound=s.caveFound;caveRidden=s.caveRidden;mined=s.mined;
 panel=null;$('inventory').hidden=true;heldSlot=null;player.fromArray(s.player);if(!bodyClear(player.x,player.z,player.y))player.copy(safeSpawn());[yaw,pitch]=s.view;velocity=0;fallStart=null;flying=false;keys.clear();mining=null;closeMap(false);camera.position.copy(player).add(new THREE.Vector3(0,1.65,0));rebuildAll();refreshRails();refreshTorches();renderInventory();updateMission();if(migrated)localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));notify(migrated?'以前のワールドを引き継ぎました。持ち物・建築・線路を保って外へ冒険できます。':'世界・装備・持ち物・探索地図を読み込みました。');
 }catch(error){console.warn('Save loading failed:',error.message);notify('保存データが壊れているか、このバージョンと互換性がありません。');}};
let dragging=false,touchX=0,touchY=0,touchPointer=null,touchHoldAt=0,touchAim=null,touchMoved=false;
function stopPrimary(){dragging=false;touchPointer=null;touchHoldAt=0;touchAim=null;mineHeld=false;mining=null;}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(!entered||panel||!$('mapPanel').hidden)return;
 if(e.pointerType==='touch'){
  if(touchPointer!==null)return;touchPointer=e.pointerId;dragging=true;touchMoved=false;touchX=e.clientX;touchY=e.clientY;touchHoldAt=performance.now()+350;
  const r=renderer.domElement.getBoundingClientRect();touchAim={x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2};renderer.domElement.setPointerCapture(e.pointerId);return;
 }
 if(e.button===0){mineHeld=true;beginMine();if(document.pointerLockElement!==renderer.domElement){dragging=true;renderer.domElement.requestPointerLock()?.catch(()=>{});}}
 if(e.button===2)place();
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'||e.pointerId===touchPointer)stopPrimary();});
renderer.domElement.addEventListener('pointercancel',stopPrimary);renderer.domElement.addEventListener('lostpointercapture',e=>{if(e.pointerId===touchPointer)stopPrimary();});
window.addEventListener('mousemove',e=>{if(!panel&&$('mapPanel').hidden&&(document.pointerLockElement===renderer.domElement||dragging)&&touchPointer===null){yaw-=e.movementX*.0025;pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*.0025));}});
renderer.domElement.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'&&e.pointerId===touchPointer&&dragging&&!panel){
  const dx=e.clientX-touchX,dy=e.clientY-touchY;if(touchMoved||Math.hypot(dx,dy)>8){touchMoved=true;touchHoldAt=0;touchAim=null;mineHeld=false;mining=null;yaw-=dx*.005;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.005));touchX=e.clientX;touchY=e.clientY;}
 }
});
function tickTouchHold(time){if(touchPointer!==null&&touchHoldAt&&time>=touchHoldAt&&!touchMoved&&!panel){touchHoldAt=0;mineHeld=true;beginMine();}}
renderer.domElement.addEventListener('wheel',e=>{if(entered&&!panel&&$('mapPanel').hidden){e.preventDefault();select((selected+(e.deltaY>0?1:8))%9);}},{passive:false});
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['Space','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyI','KeyC','KeyF','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(!$('mapPanel').hidden)closeMap();else if(panel)closePanel();else $('help').hidden=true;return;}if(e.repeat)return;
 if(e.code==='KeyM'){toggleMap();return;}if(!$('mapPanel').hidden)return;if(e.code==='KeyI'||e.code==='KeyC'){openPanel();return;}if(e.code==='KeyF'){if(panel)closePanel();else workstation();return;}if(panel)return;
 keys.add(e.code);if(e.code==='KeyE')place();if(e.code==='KeyQ')undo();if(e.code==='KeyR')goHome();if(e.code==='KeyV'&&gameMode==='creative'){flying=!flying;velocity=0;notify(flying?'飛行：矢印で移動、Spaceで上昇、Shiftで下降。Vで着地。':'飛行を終了しました。');}if(/^Digit[1-9]$/.test(e.code))select(+e.code.slice(-1)-1);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();stopPrimary();});document.addEventListener('pointerlockchange',()=>{keys.clear();if(!document.pointerLockElement)stopPrimary();});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(!panel)keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
$('mine').addEventListener('pointerdown',e=>{e.preventDefault();mineHeld=true;beginMine();$('mine').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('mine').addEventListener(event,()=>{mineHeld=false;mining=null;});
function walk(dt) {
 if(flying&&gameMode==='creative'){const up=(keys.has('Space')?1:0)-(keys.has('ShiftLeft')?1:0);const dx=((keys.has('ArrowRight')||keys.has('KeyD'))?1:0)-((keys.has('ArrowLeft')||keys.has('KeyA'))?1:0),dz=((keys.has('ArrowDown')||keys.has('KeyS'))?1:0)-((keys.has('ArrowUp')||keys.has('KeyW'))?1:0);const nx=player.x+(dx*Math.cos(yaw)+dz*Math.sin(yaw))*8*dt,nz=player.z+(-dx*Math.sin(yaw)+dz*Math.cos(yaw))*8*dt,ny=THREE.MathUtils.clamp(player.y+up*8*dt,MIN_Y+1,MAX_Y+14);if(bodyClear(nx,nz,ny))player.set(nx,ny,nz);camera.position.copy(player).add(new THREE.Vector3(0,1.65,0));return;}

  let floor = supportBelow(player.x, player.z, player.y + .1); if (player.y <= floor + .02) { player.y = floor; velocity = keys.has('Space') ? 7 : 0;if(fallStart!==null){const fall=fallStart-player.y;fallStart=null;if(gameMode==='survival'&&fall>3){damage(Math.floor(fall-3),'落下');}} }
  let dx = ((keys.has('ArrowRight')||keys.has('KeyD')) ? 1 : 0) - ((keys.has('ArrowLeft')||keys.has('KeyA')) ? 1 : 0), dz = ((keys.has('ArrowDown')||keys.has('KeyS')) ? 1 : 0) - ((keys.has('ArrowUp')||keys.has('KeyW')) ? 1 : 0); const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
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
 const daylight=daylightAt(worldTime),hours=Math.floor((worldTime/600*24+6)%24);$('worldClock').textContent=(nightAt(worldTime)?'☾ 夜':'☀ 昼')+' '+String(hours).padStart(2,'0')+':'+String(Math.floor(worldTime/600*1440)%60).padStart(2,'0');

  const feet = mode === 'build' ? player.y : camera.position.y - 1.27, c = cellAt(camera.position.x, camera.position.z);
  const regionKey=`${Math.floor(c.x/64)},${Math.floor(c.z/64)}`,biome=world.biome(c.x,c.z);visitedRegions.add(regionKey);if(entered&&!visitedBiomes.has(biome.id)){visitedBiomes.add(biome.id);notify(biome.name+'を発見！新しい地形と構造物を探そう。');}
  const depth = inside(c.x, c.z) ? Math.max(0, height(c.x,c.z) - feet) : 0, underground = depth > 2;
  caveMix += ((underground ? 1 : 0) - caveMix) * Math.min(1, dt * 3); ambient.intensity=THREE.MathUtils.lerp(.18+1.7*daylight,.26,caveMix);sun.intensity=THREE.MathUtils.lerp(2.5*daylight,.06,caveMix); lantern.intensity = caveMix * 7;
  scene.background.set('#19344b').lerp(new THREE.Color('#a4d8ed'),daylight).lerp(new THREE.Color('#101f2b'), caveMix); scene.fog.color.copy(scene.background); scene.fog.near = THREE.MathUtils.lerp(viewRadius*CHUNK*.55,16,caveMix); scene.fog.far = THREE.MathUtils.lerp(viewRadius*CHUNK*.97,Math.min(42,viewRadius*CHUNK*.9),caveMix);
  const landmark = world.structuresNear(c.x,c.z,20).find(s => Math.hypot(c.x - s.x, c.z - s.z) < 6 && Math.abs(feet - s.y) < 12);
  $('location').textContent = `高度 ${Math.round(feet)} m · X${c.x} Z${c.z} · ${underground ? `地下 ${Math.round(depth)} m` : landmark?landmark.name:world.biome(c.x,c.z).name}`;
  if (entered && inCave(camera.position.x, camera.position.z, feet)) { if (!caveFound) { caveFound = true; updateMission(); notify('✧ 地底の大洞窟を発見！枝分かれする坑道と鉱脈。その先まで線路をつなごう。'); } if (mode === 'ride' && connectedToCave() && !caveRidden) { caveRidden = true; updateMission(); notify('✦ 冒険達成！自分の線路で、深い地底の大洞窟に到着しました。'); } }
}
function clearSight(x,y,z,tx,ty,tz){const length=Math.hypot(tx-x,ty-y,tz-z),steps=Math.ceil(length*2);for(let i=1;i<steps;i++){const f=i/steps,c=cellAt(x+(tx-x)*f,z+(tz-z)*f);if(solid(c.x,Math.floor(y+(ty-y)*f),c.z))return false;}return true;}
function lightAt(x,y,z){let best=null,distance=81;for(const p of torchPositions){const d=(p.x-x)**2+(p.y-y)**2+(p.z-z)**2;if(d<distance&&clearSight(x,y,z,p.x,p.y,p.z)){best=p;distance=d;}}return best;}
function monsterBodyClear(x,y,z,r,h){for(const[dx,dz]of [[-r,-r],[r,-r],[-r,r],[r,r]]){const c=cellAt(x+dx,z+dz);for(let iy=Math.floor(y+.01);iy<y+h-.01;iy++)if(solid(c.x,iy,c.z))return false;}return true;}
const monsterVisuals=createCreatureVisuals(THREE,scene);
const monsters=new NightCreatures({
 ground:(x,z,limit)=>supportBelow(x,z,limit),occupy:monsterBodyClear,
 safeFloor:(x,y,z)=>{const c=cellAt(x,z);return solid(c.x,Math.floor(y)-1,c.z)&&![T.WATER,T.LAVA].includes(voxel(c.x,Math.floor(y),c.z));},
 light:lightAt,visible:clearSight,
 sky:(x,y,z)=>{const c=cellAt(x,z);for(let iy=Math.ceil(y);iy<MAX_Y;iy++)if(solid(c.x,iy,c.z))return false;return true;},
 spawn:c=>monsterVisuals.spawn(c),remove:c=>monsterVisuals.remove(c),update:c=>monsterVisuals.update(c),hurt:(amount,name)=>{damage(amount,name);notify(name+'の攻撃！剣で戦うか、松明の明かりへ逃げよう。');},
 defeated:c=>{defeatedMobs.add(c.id);if(gameMode==='survival')gain(c.kind==='slime'?'clay':'moss',1);notify(c.name+'を倒しました。');},
 hit:c=>{handSwing=.3;const stack=held();if(gameMode==='survival'&&stack&&itemDefs[stack.id].tool){if(!--stack.durability){bag[selected]=null;notify('道具が壊れました。');}renderInventory();}},
});
function aimDirection(){return touchAim?new THREE.Vector3(touchAim.x,touchAim.y,.5).unproject(camera).sub(camera.position).normalize():camera.getWorldDirection(new THREE.Vector3());}
function strikeMonster(block){const creature=monsters.aimed(camera.position,aimDirection(),block?.distance??Infinity);if(!creature)return false;return monsters.strike(creature,held()?(itemDefs[held().id].attack??1):1);}
function tickMonsters(dt){const actor={x:camera.position.x,y:mode==='build'?player.y:camera.position.y-1.65,z:camera.position.z};monsters.tick(dt,{enabled:entered,night:nightAt(worldTime),player:actor,invulnerable:gameMode==='creative'||mode==='ride'||flying});const protectedByTorch=!!lightAt(actor.x,actor.y+.9,actor.z);$('nightStatus').textContent=nightAt(worldTime)?protectedByTorch?'松明の明かり · 安全圏':`夜の探索 · 周囲のモンスター ${monsters.creatures.length}`:'昼の探索 · 夜に備えて松明を作ろう';}
const cloudGroup=new THREE.Group();scene.add(cloudGroup);
const cloudMaterial=new THREE.MeshBasicMaterial({color:0xe7eef0,transparent:true,opacity:.8});
for(let k=0;k<10;k++){const c=new THREE.Mesh(new THREE.BoxGeometry(10+k%3*4,1.8,6+k%2*5),cloudMaterial);c.position.set((k*29)%120-60,MAX_Y+14+(k%3)*4,(k*47)%120-60);cloudGroup.add(c);}
const handGroup=new THREE.Group();camera.add(handGroup);
const arm=new THREE.Mesh(new THREE.BoxGeometry(.19,.5,.21),new THREE.MeshLambertMaterial({color:0xc49a75}));arm.position.set(.43,-.39,-.63);arm.rotation.set(-.3,0,-.15);handGroup.add(arm);
const sleeve=new THREE.Mesh(new THREE.BoxGeometry(.2,.21,.22),new THREE.MeshLambertMaterial({color:0x3d8991}));sleeve.position.set(.43,-.62,-.62);handGroup.add(sleeve);
let heldMesh=null,lastHeld='';
function updateHand(dt,time){
 handGroup.visible=entered&&!panel&&$('mapPanel').hidden&&mode==='build';const k=held()?.id??'';
 if(k!==lastHeld){
  if(heldMesh){handGroup.remove(heldMesh);heldMesh.geometry.dispose();if(heldMesh.userData.ownedMaterial){heldMesh.material.map?.dispose();heldMesh.material.dispose();}}heldMesh=null;
  if(k){const d=itemDefs[k];if(d.block){heldMesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),materials[blockMaterials[d.block]]);}else{const texture=new THREE.CanvasTexture(drawItemIcon(k,128));texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;heldMesh=new THREE.Mesh(new THREE.PlaneGeometry(.42,.42),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.12,side:THREE.DoubleSide}));heldMesh.userData.ownedMaterial=true;}heldMesh.position.set(.4,-.23,-.72);heldMesh.rotation.set(.2,.4,.15);handGroup.add(heldMesh);}lastHeld=k;
 }
 handSwing=Math.max(0,handSwing-dt);handGroup.rotation.z=Math.sin(handSwing*20)*.22;handGroup.position.y=keys.size&&!panel?Math.sin(time*.01)*.018:0;
}
function drawMap(){
 const canvas=$('mapCanvas'),g=canvas.getContext('2d'),c=cellAt(player.x,player.z),rx=Math.floor(c.x/64),rz=Math.floor(c.z/64),tile=30,cols=20,rows=14;
 g.fillStyle='#182a27';g.fillRect(0,0,600,420);
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){const gx=rx+x-10,gz=rz+z-7,seen=visitedRegions.has(`${gx},${gz}`);g.fillStyle=seen?world.biome(gx*64+32,gz*64+32).color:'#273b35';g.fillRect(x*tile+1,z*tile+1,tile-2,tile-2);if(seen){for(const structure of world.structuresNear(gx*64+32,gz*64+32,44)){if(Math.floor(structure.x/64)!==gx||Math.floor(structure.z/64)!==gz)continue;g.fillStyle='#f4d68c';g.fillRect(x*tile+(structure.x-gx*64)/64*tile-2,z*tile+(structure.z-gz*64)/64*tile-2,4,4);}}}
 const px=10*tile+(c.x-rx*64)/64*tile,pz=7*tile+(c.z-rz*64)/64*tile;g.fillStyle='#fff5cd';g.beginPath();g.arc(px,pz,5,0,Math.PI*2);g.fill();g.strokeStyle='#fff5cd';g.beginPath();g.moveTo(px,pz);g.lineTo(px-Math.sin(yaw)*14,pz-Math.cos(yaw)*14);g.stroke();
 $('mapDetail').textContent=`現在地 X ${c.x} / Z ${c.z} · 発見 ${visitedBiomes.size} / 8 バイオーム · ${visitedRegions.size} 地域 · 黄色は構造物`;
}
function closeMap(lock=true){$('mapPanel').hidden=true;keys.clear();if(lock&&entered&&!panel&&!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock()?.catch(()=>{});}
function toggleMap(){if(!$('mapPanel').hidden){closeMap();return;}if(!entered)return;if(panel){closePanel();if(panel)return;}keys.clear();mining=null;mineHeld=false;if(document.pointerLockElement)document.exitPointerLock();$('mapPanel').hidden=false;drawMap();}
function showNavigation(kind){if(kind==='biome'){toggleMap();return;}if(kind==='time'){const hours=Math.floor((worldTime/600*24+6)%24),minutes=Math.floor((worldTime/600*1440)%60);notify(`時計：${hours}:${String(minutes).padStart(2,'0')} · 1日は10分`);return;}const c=cellAt(player.x,player.z),dx=32.5-c.x,dz=10.5-c.z;const direction=Math.abs(dx)>Math.abs(dz)?dx>0?'東':'西':dz>0?'南':'北';notify(`コンパス：出発地まで約${Math.round(Math.hypot(dx,dz))}m、${direction}へ · Rで帰還`);}
$('mapToggle').onclick=toggleMap;$('closeMap').onclick=()=>closeMap();$('distance').value=String(viewRadius);$('distance').onchange=e=>{viewRadius=Math.max(3,Math.min(5,+e.target.value));rebuildAll();notify('描画距離を変更しました。遠くの地形は順番に表示します。');};
loadGeneratedArt(setItemAtlas,()=>{artReady++;for(const key of Object.keys(iconCache))delete iconCache[key];lastHeld='\0';renderInventory();}).catch(error=>console.warn(error.message));

rebuildAll();refreshRails(); let last = performance.now();
function frame(t) { const dt = Math.max(0,Math.min((t-last)/1000,.07)); last = t; if(panel||!$('mapPanel').hidden){tickFurnace(dt);requestAnimationFrame(frame);return;}if(entered&&!panel&&$('mapPanel').hidden){if(mode==='build')walk(dt);else ride(dt);}updateStreaming();pumpChunks();tickFurnace(dt);tickMining(dt);updateTorches(dt);tickTouchHold(t);if(!mining){$('breakProgress').hidden=true;crackMesh.visible=false;crackStage=-1;}else{crackMesh.visible=true;crackMesh.position.set(mining.x-OFFSET+.5,mining.y+.5,mining.z-OFFSET+.5);const stage=Math.floor(mining.progress/mining.time*8);if(stage!==crackStage){crackStage=stage;const g=crackCanvas.getContext('2d');g.clearRect(0,0,16,16);g.strokeStyle='#171b17bb';g.lineWidth=1;for(let i=0;i<=stage+2;i++){g.beginPath();g.moveTo(8,8);g.lineTo((i*7)%16,(i*11)%16);g.lineTo((i*5+2)%16,(i*3+9)%16);g.stroke();}crackTexture.needsUpdate=true;}}updateHand(dt,t);cloudGroup.position.x=camera.position.x+Math.sin(worldTime*.003)*8;cloudGroup.position.z=camera.position.z; camera.rotation.set(pitch, yaw, 0, 'YXZ'); updateExploration(dt, t);tickMonsters(dt); aim(); if (!target && mode === 'build'&&!monsters.aimed(camera.position,aimDirection(),traceVoxel()?.distance??Infinity)) $('target').textContent = '地面や壁を狙う · Eで操作'; renderer.render(scene, camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame); window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderInventory();notify('木を集めてクラフト。鉄と松明を携えて、枝分かれする地底の世界へ。');
window.blockCoaster={
 getState:()=>({mode,entered,mining:mining?{x:mining.x,y:mining.y,z:mining.z,time:mining.time,progress:mining.progress}:null,position:camera.position.toArray(),feet:player.y,direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),yaw,pitch,target:target?{...target}:null,valid,tool,connected:connectedToCave(),heights:[...legacy.heights],...snapshot()}),
 monsterState:()=>({night:nightAt(worldTime),safe:!!lightAt(player.x,player.y+.9,player.z),active:monsters.snapshot(),visuals:monsterVisuals.count(),...monsters.stats}),
 terrainRange:()=>[Math.min(...legacy.heights),Math.max(...legacy.heights)],
 caveLayout:()=>{const out=[];for(let z=0;z<64;z++)for(let x=0;x<64;x++){let start=null;for(let y=MIN_Y;y<MAX_Y;y++){if(world.isCave(x,y,z)){if(start===null)start=y;}else if(start!==null){out.push({x,z,y:start,ceiling:y});start=null;}}}return out;},
 structures:()=>world.structuresNear(...Object.values(cellAt(player.x,player.z)),150).map(s=>({...s})),
 voxel:(x,y,z)=>voxel(x,y,z),dimensions:()=>({size:64,infinite:true,minY:MIN_Y,maxY:MAX_Y,chunk:CHUNK}),
 worldInfo:(x,z)=>({height:height(x,z),biome:world.biome(x,z)}),
 streamingStats:()=>({rendered:chunks.size,pending:chunkQueue.length,viewRadius,...world.stats()}),
 artStats:()=>({ready:artReady,generatedIcons:104,source:'ChatGPT image generation'}),equipmentState:()=>({slots:equipment.map(s=>s?{...s}:null),armor:armorPoints()}),itemCatalog:()=>JSON.parse(JSON.stringify(itemDefs)),availableRecipes:()=>availableRecipes().map(r=>({id:r.id,n:r.n})),
};
