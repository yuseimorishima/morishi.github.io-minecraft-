// The previous 64×64 world remains the starting region of the streamed world.
export function createLegacyWorld(T) {
const N=64,MIN_Y=-48,MAX_Y=64,OFFSET=32,plane=N*N,volume=plane*(MAX_Y-MIN_Y);
const world=new Uint8Array(plane*(MAX_Y-MIN_Y)),heights=[];
const inside=(x,z)=>x>=0&&z>=0&&x<N&&z<N;
const inWorld=(x,y,z)=>inside(x,z)&&y>=MIN_Y&&y<MAX_Y;
const id=(x,z)=>z*N+x;
const index=(x,y,z)=>(y-MIN_Y)*plane+id(x,z);
const cellAt=(x,z)=>({x:Math.floor(x+OFFSET),z:Math.floor(z+OFFSET)});
const voxel=(x,y,z)=>inWorld(x,y,z)?world[index(x,y,z)]:0;
const put=(x,y,z,t)=>{if(inWorld(x,y,z))world[index(x,y,z)]=t;};
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

for(const [x,z]of[[35,44],[28,35],[48,52]]){const c=caveCells.get(id(x,z))?.[0];if(c)for(const[dx,dz]of[[0,0],[1,0],[0,1]]){const y=c.floor-1;if(voxel(x+dx,y,z+dz))put(x+dx,y,z+dz,T.GLOW);}}
for(let z=45;z<=48;z++)for(let x=17;x<=20;x++){const c=caveCells.get(id(x,z))?.[0];if(c&&voxel(x,c.floor,z)===T.AIR)put(x,c.floor,z,T.WATER);}
// Enrich familiar caves with new resources; old stone floors and structures stay.
for(let i=0;i<plane;i++)world[i]=T.DEEP;
for(const[type,count,low,high,radius]of [[T.COAL,50,-44,8,2.2],[T.IRON,42,-42,4,2],[T.COPPER,30,-20,12,2.1],[T.GOLD,28,-45,-22,1.9],[T.DIAMOND,26,-46,-27,1.6],[T.EMERALD,24,-42,-16,1.5],[T.REDSTONE,26,-46,-23,1.8],[T.LAPIS,24,-42,-9,1.8]])for(let k=0;k<count;k++){
 const cx=3+Math.floor(hash(type,k,17)*58),cz=3+Math.floor(hash(k,type,29)*58),cy=Math.floor(low+hash(type,k,41)*(high-low));
 for(let z=cz-3;z<=cz+3;z++)for(let x=cx-3;x<=cx+3;x++)for(let y=cy-3;y<=cy+3;y++)if(((x-cx)/radius)**2+((y-cy)/(radius*.8))**2+((z-cz)/radius)**2<1&&[T.STONE,T.DEEP].includes(voxel(x,y,z)))put(x,y,z,type);
}
// Mineral seams visible on cave walls make exploration rewarding immediately.
for(let z=1;z<63;z++)for(let x=1;x<63;x++)for(let y=-46;y<Math.min(6,heights[id(x,z)]-4);y++)if([T.STONE,T.DEEP].includes(voxel(x,y,z))&&[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([dx,dy,dz])=>voxel(x+dx,y+dy,z+dz)===T.AIR)){
 const roll=hash(Math.floor(x/2),Math.floor(y/2),Math.floor(z/2));let type=null;
 if(y<-26&&roll<.025)type=T.DIAMOND;else if(roll<.04)type=T.EMERALD;else if(y<-18&&roll<.075)type=T.REDSTONE;else if(roll<.10)type=T.LAPIS;else if(y<-18&&roll<.14)type=T.GOLD;else if(roll<.2)type=T.IRON;else if(roll<.27)type=T.COAL;else if(roll<.31)type=T.COPPER;
 if(type)put(x,y,z,type);
}
return {data:world,minY:MIN_Y,maxY:MAX_Y,heights,caveMask,structures};
}
