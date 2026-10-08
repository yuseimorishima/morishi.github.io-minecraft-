import assert from 'node:assert/strict';
import { VoxelWorld, BLOCKS as B, WORLD_MIN_Y, WORLD_MAX_Y, WORLD_CHUNK } from '../world.js';
import { createLegacyWorld } from '../legacy-world.js';

const check = (name, fn) => { const started=performance.now();fn();console.log(`✓ ${name} (${Math.round(performance.now()-started)} ms)`); };
const at = (x,y,z) => (y-WORLD_MIN_Y)*256+z*16+x;

check('Signed-coordinate chunks are deterministic regardless of loading order', () => {
 const coordinates=[[-1,-1],[0,-1],[-1,0],[0,0],[3,4],[-7,8],[21,-19]];
 const a=new VoxelWorld({seed:3}),b=new VoxelWorld({seed:3});
 for(const [x,z] of coordinates)a.chunk(x,z);
 for(const [x,z] of [...coordinates].reverse())b.chunk(x,z);
 for(const [x,z] of coordinates){assert.deepEqual(a.chunk(x,z).data,b.chunk(x,z).data);assert.deepEqual(a.chunk(x,z).cave,b.chunk(x,z).cave);assert.deepEqual(a.chunk(x,z).heights,b.chunk(x,z).heights);}
 assert.notDeepEqual(a.chunk(21,-19).data,new VoxelWorld({seed:74}).chunk(21,-19).data);
 assert.equal(WORLD_CHUNK,16);
});

check('Negative and positive chunk boundaries preserve voxel addressing', () => {
 const w=new VoxelWorld();for(const x of [-33,-32,-17,-16,-1,0,15,16,31,32])for(const z of [-17,-16,-1,0,15,16]){
  const cx=Math.floor(x/16),cz=Math.floor(z/16),c=w.chunk(cx,cz),lx=x-cx*16,lz=z-cz*16;
  assert.equal(w.voxel(x,-64,z),B.BEDROCK);assert.equal(w.height(x,z),c.heights[lz*16+lx]);
  for(const y of [-62,-40,-1,10,60,111])assert.equal(w.voxel(x,y,z),c.data[at(lx,y,lz)]);
 }
 assert.equal(w.voxel(-1,-65,-1),B.AIR);assert.equal(w.voxel(0,WORLD_MAX_Y,0),B.AIR);
});

check('The original region is retained and its four edges blend into new terrain', () => {
 const legacy=createLegacyWorld(B),w=new VoxelWorld({legacy});
 for(let z=0;z<64;z+=5)for(let x=0;x<64;x+=5){assert.equal(w.height(x,z),legacy.heights[z*64+x]);for(let y=legacy.minY;y<legacy.maxY;y+=3)assert.equal(w.voxel(x,y,z),legacy.data[(y-legacy.minY)*4096+z*64+x]);}
 for(let n=0;n<64;n+=4){assert.ok(Math.abs(w.height(-1,n)-w.height(0,n))<=1);assert.ok(Math.abs(w.height(64,n)-w.height(63,n))<=1);assert.ok(Math.abs(w.height(n,-1)-w.height(n,0))<=1);assert.ok(Math.abs(w.height(n,64)-w.height(n,63))<=1);}
 assert.ok(w.voxel(33,-60,35)!==B.BEDROCK);
});

check('All eight biomes occur within a short exploration distance', () => {
 const w=new VoxelWorld(),found=new Set();for(let z=-400;z<=400;z+=24)for(let x=-400;x<=400;x+=24)found.add(w.biome(x,z).id);
 assert.deepEqual([...found].sort(),['badlands','desert','forest','jungle','ocean','plains','snow','taiga']);
 let tallest=-Infinity,lowest=Infinity;for(let z=-400;z<=400;z+=32)for(let x=-400;x<=400;x+=32){const h=w._height(x,z);tallest=Math.max(tallest,h);lowest=Math.min(lowest,h);}
 assert.ok(tallest>50,`mountain height ${tallest}`);assert.ok(lowest<0,`ocean floor ${lowest}`);
});

check('Branching caves reach deep layers and every ore is naturally exposed', () => {
 const w=new VoxelWorld(),oreTypes=[B.COAL,B.IRON,B.GOLD,B.DIAMOND,B.EMERALD,B.REDSTONE,B.LAPIS,B.COPPER],counts=new Map(oreTypes.map(t=>[t,0])),exposed=new Map(oreTypes.map(t=>[t,0]));let deepest=0,caveCount=0;
 for(let cz=-3;cz<=3;cz++)for(let cx=-3;cx<=3;cx++){const c=w.chunk(cx,cz);for(let y=-61;y<40;y++)for(let z=1;z<15;z++)for(let x=1;x<15;x++){const index=at(x,y,z),t=c.data[index];if(c.cave[index]){deepest=Math.min(deepest,y);caveCount++;}if(counts.has(t)){counts.set(t,counts.get(t)+1);assert.ok(y<c.heights[z*16+x]-2);if([index-1,index+1,index-16,index+16,index-256,index+256].some(i=>c.data[i]===B.AIR))exposed.set(t,exposed.get(t)+1);}}}
 for(const type of oreTypes){assert.ok(counts.get(type)>50,`${type}: ${counts.get(type)} ore blocks`);assert.ok(exposed.get(type)>0,`${type} ore visible from caves`);}
 assert.ok(deepest<=-57,`deepest cave ${deepest}`);assert.ok(caveCount>8000);
});

check('Edits survive eviction and reload, restoration removes their save entry', () => {
 const w=new VoxelWorld({maxCachedChunks:9}),original=w.voxel(-17,40,31);assert.equal(w.set(-17,40,31,B.DIAMOND_BLOCK),true);assert.equal(w.baseVoxel(-17,40,31),original);assert.equal(w.voxel(-17,40,31),B.DIAMOND_BLOCK);
 assert.equal(w.set(10,WORLD_MIN_Y,10,B.AIR),false);assert.equal(w.set(0,20,0,255),false);
 for(let i=0;i<40;i++)w.chunk(i+50,-i-20);assert.equal(w.stats().residentChunks,9);assert.equal(w.voxel(-17,40,31),B.DIAMOND_BLOCK);
 const save=[...w.edits],restored=new VoxelWorld({maxCachedChunks:9});restored.setEdits(save);assert.equal(restored.voxel(-17,40,31),B.DIAMOND_BLOCK);assert.equal(restored.baseVoxel(-17,40,31),original);
 assert.equal(restored.set(-17,40,31,original),true);assert.equal(restored.edits.size,0);restored.evictExcept(new Set());assert.equal(restored.voxel(-17,40,31),original);
 w.evictExcept(new Set(['-2,1']));assert.equal(w.stats().residentChunks,1);assert.equal(w.edits.size,1);
});

check('Generated buildings, usable workstations and loot cross chunk seams consistently', () => {
 const w=new VoxelWorld(),structures=w.structuresNear(0,0,500),types=new Set(structures.map(s=>s.type));for(const type of ['village','temple','jungle_ruin','igloo','shipwreck','watchtower','mineshaft'])assert.ok(types.has(type),`${type} present`);
 assert.equal(new Set(structures.map(s=>s.id)).size,structures.length);
 const village=structures.find(s=>s.type==='village'),{x,z,y}=village;
 assert.equal(w.voxel(x-9,y,z-10),B.AIR);assert.equal(w.voxel(x-9,y+1,z-10),B.AIR);assert.equal(w.voxel(x-9,y-1,z-10),B.PLANK);assert.equal(w.voxel(x-7,y,z-5),B.TABLE);assert.equal(w.voxel(x-8,y,z-5),B.FURNACE);
 const chest=[x-11,y,z-5],loot=w.lootAt(...chest);assert.ok(loot.some(i=>i.id==='iron'&&i.count>=3));assert.deepEqual(loot,new VoxelWorld().lootAt(...chest));assert.deepEqual(w.lootAt(x,y+12,z),[]);
 const mine=structures.find(s=>s.type==='mineshaft');assert.equal(w.voxel(mine.x,mine.y,mine.z),B.AIR);assert.equal(w.voxel(mine.x,mine.y-1,mine.z),B.PLANK);assert.equal(w.voxel(mine.x+2,mine.y,mine.z+5),B.TABLE);assert.equal(w.isCave(mine.x,mine.y,mine.z),true);
 const reverse=new VoxelWorld();const bounds=village.bounds,keys=[];for(let cz=Math.floor(bounds.minZ/16);cz<=Math.floor(bounds.maxZ/16);cz++)for(let cx=Math.floor(bounds.minX/16);cx<=Math.floor(bounds.maxX/16);cx++)keys.push([cx,cz]);for(const [cx,cz]of keys.reverse())reverse.chunk(cx,cz);for(const [cx,cz]of keys)assert.deepEqual(w.chunk(cx,cz).data,reverse.chunk(cx,cz).data);
});

check('Hundreds of explored regions retain a fixed resident cache', () => {
 const w=new VoxelWorld({maxCachedChunks:25});for(let i=0;i<220;i++)w.chunk(i*7,-i*11);assert.equal(w.stats().residentChunks,25);assert.ok(w.stats().residentRegions<=144);assert.equal(w.stats().generatedChunks,220);
});

console.log('World generation tests passed.');
