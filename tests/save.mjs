import assert from 'node:assert/strict';
import { validateSnapshot, migrateV5 } from '../save.js';
import { VoxelWorld, BLOCKS, WORLD_MIN_Y, WORLD_MAX_Y } from '../world.js';
import { createLegacyWorld } from '../legacy-world.js';
import { itemDefs, equipmentSlots } from '../items.js';

const clone=s=>structuredClone(s),empty=n=>Array(n).fill(null),index=(x,y,z)=>(y+48)*4096+z*64+x;
const legacy=createLegacyWorld(BLOCKS),world=new VoxelWorld({legacy}),options={world,itemDefs,equipmentSlots,minY:WORLD_MIN_Y,maxY:WORLD_MAX_Y,blockTypes:BLOCKS};
const check=(name,fn)=>{fn();console.log(`✓ ${name}`);};
function snapshot() {return {version:6,seed:3,edits:[],rails:[],player:[.5,legacy.heights[10*64+32],-21.5],view:[-2.8,.2],bag:empty(36),selected:0,gameMode:'survival',health:20,food:16,worldTime:75,craftGrid:empty(9),craftSize:2,equipment:empty(5),chests:{},furnaceJobs:[],furnaceFuel:{},visitedRegions:['0,0'],visitedBiomes:['plains'],lootedChestKeys:[],defeatedMobs:[],caveFound:false,caveRidden:false,mined:0};}
function expectInvalid(change,source=snapshot()) {const s=clone(source);change(s);const before=[...world.edits];assert.throws(()=>validateSnapshot(s,options),/Invalid save/);assert.deepEqual([...world.edits],before);}

check('Fractional health from armor-protected damage remains saveable',()=>{
 const s=snapshot();s.health=.25;s.equipment[1]={id:'diamondChestplate',count:1,durability:500};
 const result=validateSnapshot(JSON.parse(JSON.stringify(s)),options);
 assert.equal(result.data.health,.25);assert.equal(result.data.equipment[1].durability,500);
});

check('A real version 5 world migrates inventory, edited fixtures, loot and queued fuel',()=>{
 const y=legacy.heights[2*64+2],ci=index(2,y,2),fi=index(3,y,2),v5={...snapshot(),version:5,seed:2,edits:[[ci,BLOCKS.CHEST],[fi,BLOCKS.FURNACE]],chests:{[ci]:empty(27)},furnaceJobs:[{id:'iron',input:'ironOre',fuel:'coal',remaining:2.5,index:fi}],furnaceFuel:{[fi]:2},caveFound:true,caveRidden:true,mined:123,customMissionFlag:true};
 delete v5.equipment;delete v5.craftSize;delete v5.visitedRegions;delete v5.visitedBiomes;delete v5.lootedChestKeys;delete v5.defeatedMobs;
 v5.bag[0]={id:'log',count:16};v5.bag[1]={id:'ironPick',count:1,durability:231};v5.bag[2]={id:'ironOre',count:3};v5.chests[ci][0]={id:'apple',count:6};v5.chests[ci][1]={id:'woodPick',count:1,durability:54};
 const original=clone(v5),migrated=migrateV5(v5),{data,edits}=validateSnapshot(migrated,options);
 assert.deepEqual(v5,original);assert.deepEqual(data.bag,v5.bag);assert.deepEqual(data.player,v5.player);assert.deepEqual(data.chests[`2,${y},2`],v5.chests[ci]);assert.deepEqual(edits,[[`2,${y},2`,BLOCKS.CHEST],[`3,${y},2`,BLOCKS.FURNACE]]);assert.equal(data.furnaceJobs[0].index,`3,${y},2`);assert.equal(data.furnaceJobs[0].remaining,2.5);assert.equal(data.furnaceFuel[`3,${y},2`],2);assert.equal(data.caveRidden,true);assert.equal(data.customMissionFlag,true);assert.deepEqual(data.equipment,empty(5));assert.deepEqual(data.lootedChestKeys,[`2,${y},2`]);
 migrated.bag[0].count=1;assert.equal(data.bag[0].count,16);
 const noFuel=clone(v5);delete noFuel.furnaceFuel;assert.deepEqual(validateSnapshot(migrateV5(noFuel),options).data.furnaceFuel,{});
});

check('Signed remote coordinates, supported rail slopes and equipment are reloadable',()=>{
 const s=snapshot();s.player=[-2048-32+.5,100,4097-32+.5];s.edits=[['-2048,100,4097',BLOCKS.CHEST],['-2047,100,4097',BLOCKS.FURNACE]];s.chests['-2048,100,4097']=empty(27);s.chests['-2048,100,4097'][0]={id:'diamond',count:12};s.furnaceFuel['-2047,100,4097']=12;s.furnaceJobs=[{id:'copper',input:'copperOre',fuel:'reserve',remaining:4,index:'-2047,100,4097'}];s.equipment[0]={id:'diamondHelmet',count:1,durability:300};s.equipment[4]={id:'shield',count:1,durability:337};s.visitedRegions=['0,0','-32,64'];s.visitedBiomes=['plains','jungle'];s.defeatedMobs=['cave:-128,256'];s.lootedChestKeys=['-2048,100,4097'];
 for(let i=0;i<3;i++){const x=-2048+i,y=100+(i===2?1:0),z=-4000;s.rails.push({x,y,z});s.edits.push([`${x},${y-1},${z}`,BLOCKS.PLANK],[`${x},${y},${z}`,BLOCKS.AIR],[`${x},${y+1},${z}`,BLOCKS.AIR]);}
 const before=[...world.edits],result=validateSnapshot(s,options);assert.deepEqual(result.data,s);assert.deepEqual([...world.edits],before);assert.equal(world.voxel(-2048,100,4097),world.baseVoxel(-2048,100,4097));
 result.data.chests['-2048,100,4097'][0].count=1;assert.equal(s.chests['-2048,100,4097'][0].count,12);
});

check('A rejected file cannot change existing live-world edits',()=>{
 world.set(71,100,75,BLOCKS.GOLD_BLOCK);const before=[...world.edits];expectInvalid(s=>{s.edits=[['71,100,75',BLOCKS.DIRT]];s.bag[0]={id:'unknownOldItem',count:1};});assert.deepEqual([...world.edits],before);assert.equal(world.voxel(71,100,75),BLOCKS.GOLD_BLOCK);
 const s=snapshot();world.set(72,100,75,BLOCKS.CHEST);s.chests['72,100,75']=empty(27);assert.throws(()=>validateSnapshot(s,options),/missing chest/);assert.equal(world.voxel(72,100,75),BLOCKS.CHEST);
});

check('Unknown items, bad stacks, durability and misplaced armor are rejected',()=>{
 expectInvalid(s=>s.bag[0]={id:'toString',count:1});expectInvalid(s=>s.bag[0]={id:'diamond',count:65});expectInvalid(s=>s.bag[0]={id:'ironPick',count:1,durability:252});expectInvalid(s=>s.bag[0]={id:'woodPick',count:1});expectInvalid(s=>s.bag[0]={id:'coal',count:1,durability:4});expectInvalid(s=>s.bag[0]={id:'stone',count:0});expectInvalid(s=>s.equipment[0]={id:'ironBoots',count:1,durability:190});expectInvalid(s=>s.equipment[4]={id:'diamondSword',count:1,durability:100});expectInvalid(s=>s.equipment[1]={id:'diamondChestplate',count:1,durability:529});expectInvalid(s=>s.craftGrid[8]={id:'staleRecipeMaterial',count:1});
});

check('Noncanonical keys, impossible coordinates and bedrock edits are rejected',()=>{
 for(const key of ['01,5,2','-0,5,2','1,5.5,2','+1,5,2','10000001,5,2','1,-64,2','1,112,2'])expectInvalid(s=>s.edits=[[key,BLOCKS.DIRT]]);
 expectInvalid(s=>s.edits=[['1,5,2',BLOCKS.BEDROCK]]);expectInvalid(s=>s.edits=[['1,5,2',49]]);expectInvalid(s=>s.edits=[['1,5,2',BLOCKS.DIRT],['1,5,2',BLOCKS.STONE]]);expectInvalid(s=>s.player=[10000001,50,0]);expectInvalid(s=>s.view=[0,1.6]);expectInvalid(s=>s.health=0);expectInvalid(s=>s.visitedRegions=['00,0']);expectInvalid(s=>s.visitedBiomes=['removedBiome']);
 const s=snapshot();s.edits=[['1,-63,2',BLOCKS.AIR]];const bedrockWorld={baseVoxel:()=>BLOCKS.BEDROCK};assert.throws(()=>validateSnapshot(s,{...options,world:bedrockWorld}),/bedrock edit/);
});

check('Missing fixtures, invalid furnace recipes and broken rail chains are rejected',()=>{
 expectInvalid(s=>s.chests['250,100,250']=empty(27));expectInvalid(s=>s.furnaceFuel['250,100,250']=4);expectInvalid(s=>{s.edits=[['250,100,250',BLOCKS.FURNACE]];s.furnaceJobs=[{id:'diamond',input:'coal',fuel:'coal',remaining:4,index:'250,100,250'}];});expectInvalid(s=>{s.edits=[['250,100,250',BLOCKS.FURNACE]];s.furnaceFuel['250,100,250']=33;});
 const s=snapshot();s.rails=[{x:256,y:100,z:256},{x:257,y:100,z:256}];for(const r of s.rails)s.edits.push([`${r.x},99,256`,BLOCKS.PLANK],[`${r.x},100,256`,BLOCKS.AIR],[`${r.x},101,256`,BLOCKS.AIR]);validateSnapshot(s,options);
 expectInvalid(v=>v.edits=v.edits.filter(([key])=>key!=='256,99,256'),s);expectInvalid(v=>v.edits.push(['256,100,256',BLOCKS.STONE]),s);expectInvalid(v=>v.rails[1].x=258,s);expectInvalid(v=>v.rails.push({...v.rails[0]}),s);
 const flood=clone(s);flood.edits=flood.edits.filter(([key])=>key!=='256,100,256');flood.edits.push(['256,100,256',BLOCKS.WATER]);assert.throws(()=>validateSnapshot(flood,options),/obstructed rail/);
});

check('Prototype tricks, accessors, sparse arrays and duplicate metadata are rejected',()=>{
 const s=snapshot(),inherited=Object.create({version:6});Object.assign(inherited,s);assert.throws(()=>validateSnapshot(inherited,options),/prototype/);
 const poison=JSON.parse(JSON.stringify(s));poison.bag[0]=JSON.parse('{"id":"coal","count":1,"__proto__":{"max":1000}}');assert.throws(()=>validateSnapshot(poison,options),/object key/);
 const getter=snapshot();Object.defineProperty(getter,'extra',{enumerable:true,get(){throw new Error('Getter must never execute');}});assert.throws(()=>validateSnapshot(getter,options),/accessor/);
 expectInvalid(v=>delete v.bag[3]);expectInvalid(v=>v.visitedRegions=['0,0','0,0']);expectInvalid(v=>v.lootedChestKeys=['1,5,2','1,5,2']);expectInvalid(v=>v.defeatedMobs=['mob\ninvalid']);
});

check('Corrupt legacy fields are rejected instead of discarded by migration',()=>{
 const v5={...snapshot(),version:5,seed:2};delete v5.furnaceFuel;
 for(const change of [v=>v.edits=[[1,BLOCKS.DIRT]],v=>v.edits=[['4096',BLOCKS.DIRT]],v=>v.edits=[[4096,BLOCKS.BEDROCK]],v=>v.chests={'04096':empty(27)},v=>v.furnaceJobs=[{id:'iron',input:'ironOre',fuel:'reserve',remaining:4,index:4096}],v=>v.player=[-33,10,0],v=>delete v.bag]){const bad=clone(v5);change(bad);assert.throws(()=>migrateV5(bad),/Invalid save/);}
 const unknown=clone(v5);unknown.bag[0]={id:'deletedV5Item',count:1};assert.throws(()=>validateSnapshot(migrateV5(unknown),options),/unknown item/);
});

console.log('Save validation and migration tests passed.');
