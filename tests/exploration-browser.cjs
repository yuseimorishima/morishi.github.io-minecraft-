const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const {VoxelWorld,BLOCKS:B}=await import('../world.js'),w=new VoxelWorld();
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{HTMLElement.prototype.requestPointerLock=()=>Promise.resolve();Object.defineProperty(window,'devicePixelRatio',{value:.2});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8016');
 await page.waitForFunction(()=>window.blockCoaster?.artStats().ready===3&&blockCoaster.artStats().terrainReady,null,{timeout:120000});
 await page.locator('#enter').click();await page.locator('#distance').selectOption('3');
 const state=()=>page.evaluate(()=>blockCoaster.getState());
 async function load(x,y,z,view=[0,0]){
  const s=await state();s.player=[x-32,y,z-32];s.view=view;s.gameMode='creative';s.worldTime=130;s.selected=8;
  s.bag=Array(36).fill(null);s.bag[0]={id:'cherryLog',count:2};s.visitedBiomes=[...new Set([...s.visitedBiomes,'cherry'])];
  await page.evaluate(s=>localStorage.setItem('block-coaster-world-v6',JSON.stringify(s)),s);await page.locator('#load').click();
  assert.doesNotMatch(await page.locator('#message').innerText(),/壊れて|互換性/);
  await page.waitForFunction(()=>blockCoaster.streamingStats().pending===0,null,{timeout:120000});await page.waitForTimeout(400);
 }
 await load(-74.5,w.height(-75,-251),-250.5,[0,.05]);
 assert.equal(await page.evaluate(()=>blockCoaster.voxel(-75,21,-255)),B.JUNGLE_LOG);
 await page.screenshot({path:'/tmp/jungle-bark.png'});
 console.log('PASS jungle bark and log ends use the new generated texture atlas');
 // Render a naturally generated cherry grove, then use the new material in the crafting UI.
 await load(-256.5,w.height(-257,-289),-288.5,[0,.05]);
 assert.equal(await page.evaluate(()=>blockCoaster.worldInfo(-257,-289).biome.id),'cherry');
 await page.screenshot({path:'/tmp/cherry-grove.png'});
 await page.keyboard.press('KeyI');await page.locator('#recipeBook [data-recipe="plank"]').click();await page.locator('#craftOutput').click();
 assert.equal((await state()).bag.reduce((n,s)=>n+(s?.id==='plank'?s.count:0),0),4);
 assert.equal(await page.locator('#creativeItems .item-icon').count(),109);
 await page.keyboard.press('Escape');await page.locator('#save').click();await page.locator('#load').click();
 assert((await state()).visitedBiomes.includes('cherry'));
 console.log('PASS generated cherry grove, 109 rendered item icons, cherry log crafting and saved discovery');
 const structures=w.structuresNear(32,32,250);
 for(const type of ['ancient_city','trial_chamber']){
  const s=structures.find(s=>s.type===type);await load(s.x+.5,s.y,s.z+7.5,[0,.1]);
  assert((await page.evaluate(()=>blockCoaster.structures())).some(v=>v.type===type));
  assert.match(await page.locator('#location').innerText(),type==='ancient_city'?/古代都市/:/トライアル/);
  await page.screenshot({path:`/tmp/${type}.png`});
  const [dx,dz]=type==='ancient_city'?[18,18]:[-16,6];
  await load(s.x+dx+.5,s.y,s.z+dz+3.5,[0,-Math.atan2(1.15,3)]);
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>!document.getElementById('inventory').hidden);
  assert.match(await page.locator('#inventoryTitle').innerText(),/チェスト/);
  assert((await state()).chests[`${s.x+dx},${s.y},${s.z+dz}`].some(Boolean));
  if(type==='ancient_city'){
   const st=await state(),slots=st.chests[`${s.x+dx},${s.y},${s.z+dz}`],gearSlot=slots.findIndex(v=>v&&/^(iron|diamond)(Pick|Sword|Helmet|Boots)$/.test(v.id));
   assert(gearSlot>=0);const reward={...slots[gearSlot]};assert(reward.durability>0);assert(slots.filter(Boolean).length>=6);
   await page.locator(`#chestSlots [data-slot="${gearSlot}"]`).click();await page.locator('#bag [data-slot="1"]').click();
   await page.keyboard.press('Escape');await page.locator('#save').click();await page.locator('#load').click();
   assert.deepEqual((await state()).bag[1],reward);assert.equal((await state()).chests[`${s.x+dx},${s.y},${s.z+dz}`][gearSlot],null);
   console.log('PASS ancient city guaranteed gear retains durability through transfer and save without refilling');
  }else await page.keyboard.press('Escape');
  console.log('PASS '+type+' renders its rooms, HUD discovery and usable natural treasure');
 }
 assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
