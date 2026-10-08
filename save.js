// Save files are validated completely before the caller changes the live world.
const SV_COORD_LIMIT=10000000,SV_OLD_MIN=-48,SV_OLD_MAX=64,SV_OLD_SIZE=64,SV_OLD_PLANE=4096,SV_OLD_VOLUME=458752;
const SV_BIOMES=new Set(['plains','forest','desert','taiga','snow','jungle','badlands','ocean']);
const SV_SMELTING={iron:['ironOre'],gold:['goldOre'],copper:['copperOre'],glass:['sand'],brick:['clay'],charcoal:['log','pineLog','jungleLog'],smoothStone:['stone'],bakedApple:['apple']};
const SV_FUELS=new Set(['coal','charcoal','log','pineLog','jungleLog','plank']);
const svFail=reason=>{throw new Error(`Invalid save: ${reason}`);};
const svOwn=(value,key)=>Object.hasOwn(value,key);
function svRecord(value,label) {if(!value||typeof value!=='object'||Array.isArray(value))svFail(label);const p=Object.getPrototypeOf(value);if(p!==Object.prototype&&p!==null)svFail(`${label} prototype`);return value;}
function svArray(value,length,label,max=length) {if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||(length!==null&&value.length!==length))svFail(label);for(let i=0;i<value.length;i++)if(!svOwn(value,i))svFail(`${label} sparse array`);return value;}
function svClone(value,depth=0,budget={n:0}) {
 if(depth>32||++budget.n>5000000)svFail('data size');
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))svFail('non-finite number');return value;}
 if(typeof value!=='object')svFail('non-JSON value');
 const array=Array.isArray(value);if(array)svArray(value,null,'array',1000000);else svRecord(value,'object');
 const out=array?[]:{};for(const key of Reflect.ownKeys(value)){if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key))svFail('object key');if(array&&key==='length')continue;if(array&&!/^(0|[1-9]\d*)$/.test(key))svFail('array property');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!svOwn(d,'value')||!d.enumerable)svFail('accessor/property');out[key]=svClone(d.value,depth+1,budget);}return out;
}
function svInteger(value,min,max,label) {if(!Number.isSafeInteger(value)||value<min||value>max)svFail(label);return value;}
function svNumber(value,min,max,label) {if(!Number.isFinite(value)||value<min||value>max)svFail(label);return value;}
function svCoordinate(key,minY,maxY) {if(typeof key!=='string'||!/^(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.test(key))svFail('coordinate key');const p=key.split(',').map(Number);if(p.join(',')!==key)svFail('non-canonical coordinate');svInteger(p[0],-SV_COORD_LIMIT,SV_COORD_LIMIT,'coordinate X');svInteger(p[1],minY+1,maxY-1,'coordinate Y');svInteger(p[2],-SV_COORD_LIMIT,SV_COORD_LIMIT,'coordinate Z');return p;}
function svRegion(key) {if(typeof key!=='string'||!/^(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.test(key))svFail('region key');const p=key.split(',').map(Number);if(p.join(',')!==key)svFail('non-canonical region');p.forEach(v=>svInteger(v,-SV_COORD_LIMIT,SV_COORD_LIMIT,'region coordinate'));return key;}
function svUnique(values,max,label,check) {svArray(values,null,label,max);const seen=new Set();for(const v of values){check(v);if(seen.has(v))svFail(`duplicate ${label}`);seen.add(v);}return values;}

export function validateSnapshot(snapshot,{world,itemDefs,equipmentSlots,minY,maxY,blockTypes}) {
 if(!world||typeof world.baseVoxel!=='function')throw new TypeError('A voxel world is required.');
 const s=svClone(snapshot);svRecord(s,'snapshot');for(const key of ['version','seed','edits','rails','player','view','bag','selected','gameMode','health','food','worldTime','craftGrid','chests','furnaceJobs','caveFound','caveRidden','mined'])if(!svOwn(s,key))svFail(`missing ${key}`);
 if(s.version!==6||s.seed!==3)svFail('world version');if(typeof s.caveFound!=='boolean'||typeof s.caveRidden!=='boolean')svFail('mission flags');svInteger(s.mined,0,Number.MAX_SAFE_INTEGER,'mined count');
 const blockEntries=blockTypes instanceof Set?[...blockTypes]:Array.isArray(blockTypes)?blockTypes:Object.values(blockTypes),allowedBlocks=new Set(blockEntries);const codes=Array.isArray(blockTypes)||blockTypes instanceof Set?{}:blockTypes;
 const bedrock=codes.BEDROCK??8,air=codes.AIR??0,water=codes.WATER??22,lava=codes.LAVA??47,torch=codes.TORCH??23,mushroom=codes.MUSHROOM??38,chest=codes.CHEST??18,furnace=codes.FURNACE??17;
 svArray(s.edits,null,'edits',200000);const editMap=new Map();for(const pair of s.edits){svArray(pair,2,'edit');const [key,type]=pair,p=svCoordinate(key,minY,maxY);if(!Number.isInteger(type)||!allowedBlocks.has(type)||type===bedrock||editMap.has(key))svFail('block edit');if(world.baseVoxel(...p)===bedrock)svFail('bedrock edit');editMap.set(key,type);}
 const candidate=(x,y,z)=>{if(y<minY||y>=maxY)return air;const key=`${x},${y},${z}`;return editMap.has(key)?editMap.get(key):world.baseVoxel(x,y,z);};
 const nonSolid=new Set([air,water,lava,torch,mushroom]);
 svArray(s.rails,null,'rails',12000);const railKeys=new Set();for(let i=0;i<s.rails.length;i++){const r=svRecord(s.rails[i],'rail');for(const k of ['x','y','z'])if(!svOwn(r,k))svFail('rail coordinate');svCoordinate(`${r.x},${r.y},${r.z}`,minY,maxY);if(![r.x,r.y,r.z].every(Number.isInteger)||r.y+1>=maxY)svFail('rail bounds');const key=`${r.x},${r.y},${r.z}`;if(railKeys.has(key))svFail('duplicate rail');railKeys.add(key);if(i){const a=s.rails[i-1];if(Math.abs(r.x-a.x)+Math.abs(r.z-a.z)!==1||Math.abs(r.y-a.y)>1)svFail('disconnected rail');}}
 for(const r of s.rails)if(nonSolid.has(candidate(r.x,r.y-1,r.z))||![air,torch,mushroom].includes(candidate(r.x,r.y,r.z))||![air,torch,mushroom].includes(candidate(r.x,r.y+1,r.z)))svFail('unsupported or obstructed rail');
 svArray(s.player,3,'player');svNumber(s.player[0],-SV_COORD_LIMIT,SV_COORD_LIMIT,'player X');svNumber(s.player[1],minY+1,maxY+24,'player Y');svNumber(s.player[2],-SV_COORD_LIMIT,SV_COORD_LIMIT,'player Z');svArray(s.view,2,'view');svNumber(s.view[0],-Number.MAX_VALUE,Number.MAX_VALUE,'yaw');svNumber(s.view[1],-1.5,1.5,'pitch');
 svNumber(s.health,Number.MIN_VALUE,20,'health');svNumber(s.food,0,20,'food');svNumber(s.worldTime,0,Number.MAX_VALUE,'world time');svInteger(s.selected,0,8,'selected slot');if(!['survival','creative'].includes(s.gameMode))svFail('game mode');
 const validSlot=(stack)=>{if(stack===null)return;svRecord(stack,'stack');if(!svOwn(stack,'id')||typeof stack.id!=='string'||!svOwn(itemDefs,stack.id)||!svOwn(stack,'count'))svFail('unknown item');const d=itemDefs[stack.id];svInteger(stack.count,1,d.max,'stack count');if(d.life){if(!svOwn(stack,'durability'))svFail('missing durability');svInteger(stack.durability,1,d.life,'durability');}else if(svOwn(stack,'durability'))svFail('unexpected durability');};
 const slots=(values,n,label)=>{svArray(values,n,label);values.forEach(validSlot);};slots(s.bag,36,'inventory');slots(s.craftGrid,9,'crafting grid');
 s.craftSize=svOwn(s,'craftSize')?s.craftSize:2;if(![2,3].includes(s.craftSize))svFail('crafting size');
 s.equipment=svOwn(s,'equipment')?s.equipment:Array(5).fill(null);svArray(equipmentSlots,5,'equipment definitions');slots(s.equipment,5,'equipment');s.equipment.forEach((stack,i)=>{if(stack!==null&&itemDefs[stack.id].slot!==equipmentSlots[i])svFail('equipment slot');});
 svRecord(s.chests,'chests');if(Object.keys(s.chests).length>50000)svFail('chest count');for(const [key,values]of Object.entries(s.chests)){const p=svCoordinate(key,minY,maxY);if(candidate(...p)!==chest)svFail('missing chest');slots(values,27,'chest inventory');}
 svArray(s.furnaceJobs,null,'furnace queue',64);for(const j of s.furnaceJobs){svRecord(j,'furnace job');for(const k of ['id','input','fuel','remaining','index'])if(!svOwn(j,k))svFail('furnace job field');const validFuel=j.fuel==='reserve'||typeof j.fuel==='string'&&svOwn(itemDefs,j.fuel)&&(SV_FUELS.has(j.fuel)||itemDefs[j.fuel].fuel===true);if(!svOwn(itemDefs,j.id)||!svOwn(itemDefs,j.input)||!svOwn(SV_SMELTING,j.id)||!SV_SMELTING[j.id].includes(j.input)||!validFuel)svFail('smelting recipe');svNumber(j.remaining,0,4,'smelting timer');if(candidate(...svCoordinate(j.index,minY,maxY))!==furnace)svFail('missing furnace');}
 s.furnaceFuel=svOwn(s,'furnaceFuel')?s.furnaceFuel:{};svRecord(s.furnaceFuel,'furnace fuel');if(Object.keys(s.furnaceFuel).length>50000)svFail('fuel station count');for(const [key,credits]of Object.entries(s.furnaceFuel)){if(candidate(...svCoordinate(key,minY,maxY))!==furnace)svFail('missing fuel furnace');svNumber(credits,0,32,'fuel credit');}
 s.visitedRegions=svOwn(s,'visitedRegions')?s.visitedRegions:[];svUnique(s.visitedRegions,20000,'visited regions',svRegion);
 s.visitedBiomes=svOwn(s,'visitedBiomes')?s.visitedBiomes:[];svUnique(s.visitedBiomes,16,'visited biomes',v=>{if(!SV_BIOMES.has(v))svFail('biome ID');});
 s.lootedChestKeys=svOwn(s,'lootedChestKeys')?s.lootedChestKeys:[];svUnique(s.lootedChestKeys,50000,'looted chests',key=>svCoordinate(key,minY,maxY));
 s.defeatedMobs=svOwn(s,'defeatedMobs')?s.defeatedMobs:[];svUnique(s.defeatedMobs,50000,'defeated mobs',v=>{if(typeof v!=='string'||v.length<1||v.length>128||/[\x00-\x1f\x7f]/.test(v)||['__proto__','constructor','prototype'].includes(v))svFail('mob spawn ID');});
 return {data:s,edits:s.edits.map(([key,type])=>[key,type])};
}

function svOldCoordinate(index) {svInteger(index,SV_OLD_PLANE,SV_OLD_VOLUME-1,'old block index');const y=Math.floor(index/SV_OLD_PLANE)+SV_OLD_MIN,col=index%SV_OLD_PLANE,z=Math.floor(col/SV_OLD_SIZE),x=col%SV_OLD_SIZE;return `${x},${y},${z}`;}
function svOldKey(key) {if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||String(Number(key))!==key)svFail('old fixture key');return svOldCoordinate(Number(key));}
export function migrateV5(snapshot) {
 const s=svClone(snapshot);svRecord(s,'old snapshot');if(s.version!==5||s.seed!==2)svFail('old world version');for(const key of ['edits','rails','player','view','bag','selected','gameMode','health','food','worldTime','craftGrid','chests','furnaceJobs','caveFound','caveRidden','mined'])if(!svOwn(s,key))svFail(`missing old ${key}`);
 svArray(s.edits,null,'old edits',SV_OLD_VOLUME);const seen=new Set();s.edits=s.edits.map(pair=>{svArray(pair,2,'old edit');const [i,t]=pair,key=svOldCoordinate(i);if(!Number.isInteger(t)||t<0||t>23||t===8||seen.has(i))svFail('old edit');seen.add(i);return [key,t];});
 svArray(s.rails,null,'old rails',12000);for(const r of s.rails){svRecord(r,'old rail');svInteger(r.x,0,63,'old rail X');svInteger(r.z,0,63,'old rail Z');svInteger(r.y,SV_OLD_MIN+1,SV_OLD_MAX-2,'old rail Y');}
 svArray(s.player,3,'old player');svNumber(s.player[0],-32,32,'old player X');svNumber(s.player[2],-32,32,'old player Z');if(Math.abs(s.player[0])>=32||Math.abs(s.player[2])>=32)svFail('old player bounds');svNumber(s.player[1],SV_OLD_MIN+1,SV_OLD_MAX+14,'old player Y');
 svArray(s.view,2,'old view');svNumber(s.view[0],-Number.MAX_VALUE,Number.MAX_VALUE,'old yaw');svNumber(s.view[1],-1.5,1.5,'old pitch');svArray(s.bag,36,'old inventory');svArray(s.craftGrid,9,'old crafting grid');svInteger(s.selected,0,8,'old selected slot');if(!['survival','creative'].includes(s.gameMode)||typeof s.caveFound!=='boolean'||typeof s.caveRidden!=='boolean')svFail('old gameplay flags');svNumber(s.health,1,20,'old health');svNumber(s.food,0,20,'old food');svNumber(s.worldTime,0,Number.MAX_VALUE,'old time');svInteger(s.mined,0,Number.MAX_SAFE_INTEGER,'old mined count');
 svRecord(s.chests,'old chests');if(Object.keys(s.chests).length>512)svFail('old chest count');const chests={};for(const [key,slots]of Object.entries(s.chests)){svArray(slots,27,'old chest inventory');chests[svOldKey(key)]=slots;}s.chests=chests;
 svArray(s.furnaceJobs,null,'old furnace queue',32);for(const j of s.furnaceJobs){svRecord(j,'old furnace job');if(!['iron','gold','glass'].includes(j.id)||j.input!=={iron:'ironOre',gold:'goldOre',glass:'sand'}[j.id]||!['coal','log','plank'].includes(j.fuel))svFail('old smelting recipe');svNumber(j.remaining,0,4,'old smelting timer');j.index=svOldCoordinate(j.index);}
 const fuel=svOwn(s,'furnaceFuel')?s.furnaceFuel:{};svRecord(fuel,'old furnace fuel');s.furnaceFuel={};for(const [key,credits]of Object.entries(fuel))s.furnaceFuel[svOldKey(key)]=credits;
 s.version=6;s.seed=3;if(!svOwn(s,'craftSize'))s.craftSize=s.craftGrid.some(Boolean)?3:2;if(!svOwn(s,'equipment'))s.equipment=Array(5).fill(null);if(!svOwn(s,'visitedRegions'))s.visitedRegions=['0,0'];if(!svOwn(s,'visitedBiomes'))s.visitedBiomes=['plains'];if(!svOwn(s,'lootedChestKeys'))s.lootedChestKeys=Object.keys(chests);if(!svOwn(s,'defeatedMobs'))s.defeatedMobs=[];return s;
}
