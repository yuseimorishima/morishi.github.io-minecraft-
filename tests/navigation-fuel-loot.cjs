const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const SAVE_KEY = 'block-coaster-world-v6';
const OFFSET = 32;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /shader|webgl|three\.webgl|out of memory/i.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript(() => {
      HTMLElement.prototype.requestPointerLock = () => Promise.resolve();
      Object.defineProperty(window, 'devicePixelRatio', { value: .18 });
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000');
    async function enter() {
      await page.waitForFunction(() => window.blockCoaster?.streamingStats && blockCoaster.getState().version === 6, null, {timeout:120000});
      await page.locator('#enter').click();
      await page.locator('#distance').selectOption('3');
    }
    await enter();
    const state = () => page.evaluate(() => blockCoaster.getState());
    const count = async key => (await state()).bag.reduce((sum,stack)=>sum+(stack?.id===key?stack.count:0),0);
    const cabin = (await page.evaluate(() => blockCoaster.structures())).find(s=>s.x===16&&s.z===21&&s.name.includes('小屋'));
    assert(cabin, 'the original cabin is available for navigation and workstation fixtures');
    const furnace = {x:18,y:cabin.y,z:23};
    const chest = {x:18,y:cabin.y,z:20};
    const furnaceKey = `${furnace.x},${furnace.y},${furnace.z}`;
    const chestKey = `${chest.x},${chest.y},${chest.z}`;
    async function fixture(edit) {
      if(await page.locator('#inventory').isVisible()) await page.keyboard.press('Escape');
      if(await page.locator('#mapPanel').isVisible()) await page.keyboard.press('Escape');
      const s = await state();edit(s);
      await page.evaluate(s=>localStorage.setItem('block-coaster-world-v6',JSON.stringify(s)),s);
      await page.locator('#load').click();
      assert.doesNotMatch(await page.locator('#message').innerText(),/壊れて|互換性/);
    }
    function navigation(s) {
      s.player = [16.5-OFFSET,cabin.y,21.5-OFFSET];
      s.view = [0,0];s.selected=0;s.gameMode='survival';
    }
    async function look(x,y,z) {
      const s = await state(),eye=s.position;
      const dx=x-OFFSET-eye[0],dy=y-eye[1],dz=z-OFFSET-eye[2];
      const yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz));
      await page.mouse.move(600,400);await page.mouse.down();
      await page.dispatchEvent('canvas','mousemove',{
        movementX:(s.yaw-yaw)/.0025,movementY:(s.pitch-pitch)/.0025,bubbles:true,
      });
      await page.mouse.up();
    }
    async function station(block,title) {
      // With a placeable block selected, the diagnostic target is the adjacent
      // placement cell. Select an empty hotbar slot to inspect the workstation.
      await page.keyboard.press('Digit9');
      await look(block.x+.5,block.y+.5,block.z+.5);
      await page.waitForFunction(block=>{
        const t=blockCoaster.getState().target;
        return t&&t.x===block.x&&t.y===block.y&&t.z===block.z;
      },block,{timeout:15000});
      await page.keyboard.press('KeyF');
      await page.waitForFunction(title=>document.getElementById('inventoryTitle').textContent.includes(title),title,{timeout:15000});
    }

    // M and held navigation items both use the real keyboard interaction.
    await fixture(s=>{
      navigation(s);s.bag=Array(36).fill(null);
      s.bag[0]={id:'compass',count:1};s.bag[1]={id:'clock',count:1};s.bag[2]={id:'map',count:1};
    });
    await page.keyboard.press('KeyM');
    assert(await page.locator('#mapPanel').isVisible());
    assert.match(await page.locator('#mapDetail').innerText(),/現在地 X .*Z .*バイオーム/);
    const stopped = (await state()).player;
    await page.keyboard.down('ArrowUp');
    try { await page.waitForTimeout(500); } finally { await page.keyboard.up('ArrowUp'); }
    assert.deepEqual((await state()).player,stopped,'the map pauses movement');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#mapPanel').isVisible(),false);
    await page.keyboard.press('Digit1');await page.keyboard.press('KeyE');
    assert.match(await page.locator('#message').innerText(),/コンパス：出発地まで約\d+m/);
    await page.keyboard.press('Digit2');await page.keyboard.press('KeyE');
    assert.match(await page.locator('#message').innerText(),/時計：\d+:\d{2}/);
    await page.keyboard.press('Digit3');await page.keyboard.press('KeyE');
    assert(await page.locator('#mapPanel').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await count('compass'),1);assert.equal(await count('clock'),1);assert.equal(await count('map'),1);
    console.log('PASS M/Esc map, map movement pause, and held compass/clock/map use without consumption');

    // A single log cannot be both the input and the missing fuel for charcoal.
    await fixture(s=>{navigation(s);s.bag=Array(36).fill(null);s.bag[0]={id:'log',count:1};});
    await station(furnace,'かまど');
    assert.equal(await page.locator('#smeltRecipes [data-smelt="charcoal"]').count(),0);
    assert.equal((await state()).furnaceJobs.length,0);
    assert.equal(await count('log'),1);
    await page.keyboard.press('Escape');
    console.log('PASS single-log charcoal recipe requires a separate fuel item');

    // One coal reserves eight outputs, including two logs converted to charcoal.
    // Save/reload the active jobs and remaining six outputs of fuel credit.
    await fixture(s=>{
      navigation(s);s.bag=Array(36).fill(null);
      s.bag[0]={id:'log',count:2};s.bag[1]={id:'coal',count:1};s.bag[2]={id:'ironOre',count:6};
    });
    assert.equal((await state()).furnaceFuel[furnaceKey]??0,0);
    await station(furnace,'かまど');
    for(let i=0;i<2;i++) await page.locator('#smeltRecipes [data-smelt="charcoal"]').click();
    assert.equal(await count('log'),0);assert.equal(await count('coal'),0);
    assert.equal((await state()).furnaceFuel[furnaceKey],24);
    const charJobs = (await state()).furnaceJobs.filter(j=>j.index===furnaceKey);
    assert(charJobs.every(j=>j.id==='charcoal'));
    assert.equal(charJobs.length+await count('charcoal'),2);
    await page.keyboard.press('Escape');await page.locator('#save').click();
    await page.reload();await enter();await page.locator('#load').click();
    assert.doesNotMatch(await page.locator('#message').innerText(),/壊れて|互換性/);
    assert.equal((await state()).furnaceFuel[furnaceKey],24);
    assert.equal(await count('coal'),0);assert.equal(await count('log'),0);
    await station(furnace,'かまど');
    await page.waitForFunction(()=>blockCoaster.getState().furnaceJobs.length===0,null,{timeout:120000});
    assert.equal(await count('charcoal'),2);
    for(let i=0;i<6;i++) await page.locator('#smeltRecipes [data-smelt="iron"]').click();
    assert.equal(await count('ironOre'),0);assert.equal((await state()).furnaceFuel[furnaceKey],0);
    await page.waitForFunction(()=>blockCoaster.getState().furnaceJobs.length===0,null,{timeout:120000});
    assert.equal(await count('iron'),6);assert.equal(await count('charcoal'),2);assert.equal(await count('coal'),0);
    await page.keyboard.press('Escape');
    await page.locator('#save').click();await page.locator('#load').click();
    assert.equal(await count('iron'),6);assert.equal(await count('charcoal'),2);assert.equal((await state()).furnaceFuel[furnaceKey],0);
    console.log('PASS one coal produces eight outputs; active jobs and remaining fuel survive page reload');

    // Empty a natural treasure chest, break it, and replace it in the same voxel.
    // Replacement must not refill the original treasure, even after reloading.
    await fixture(s=>{
      navigation(s);s.gameMode='creative';s.bag=Array(36).fill(null);
      s.bag[0]={id:'chest',count:1};s.selected=8;
    });
    await station(chest,'チェスト');
    let s=await state();const loot=s.chests[chestKey].filter(Boolean).map(v=>({...v}));
    assert(loot.length>0,'a natural cabin chest starts with generated treasure');
    assert(s.lootedChestKeys.includes(chestKey));
    for(const i of s.chests[chestKey].map((v,i)=>v?i:-1).filter(i=>i>=0)){
      const free=(await state()).bag.findIndex(v=>!v);
      assert(free>=0);
      await page.locator(`#chestSlots [data-slot="${i}"]`).click();
      await page.locator(`#bag [data-slot="${free}"]`).click();
    }
    s=await state();assert(s.chests[chestKey].every(v=>v===null));
    for(const stack of loot) assert((await count(stack.id))>=stack.count,stack.id+' was transferred to the bag');
    await page.keyboard.press('Escape');await page.keyboard.press('Digit9');
    await look(chest.x+.5,chest.y+.5,chest.z+.5);
    await page.waitForFunction(block=>{const t=blockCoaster.getState().target;return t&&t.x===block.x&&t.y===block.y&&t.z===block.z;},chest,{timeout:15000});
    await page.keyboard.press('KeyE');
    await page.waitForFunction(block=>blockCoaster.voxel(block.x,block.y,block.z)===0,chest,{timeout:15000});
    assert.equal((await state()).chests[chestKey],undefined);
    assert((await state()).lootedChestKeys.includes(chestKey));
    await page.keyboard.press('Digit1');await look(chest.x+.5,chest.y-.1,chest.z+.5);
    await page.waitForFunction(block=>{
      const s=blockCoaster.getState(),t=s.target;
      return s.valid&&t&&t.x===block.x&&t.y===block.y&&t.z===block.z;
    },chest,{timeout:15000});
    await page.keyboard.press('KeyE');
    await page.waitForFunction(block=>blockCoaster.voxel(block.x,block.y,block.z)===18,chest,{timeout:15000});
    await station(chest,'チェスト');
    assert((await state()).chests[chestKey].every(v=>v===null),'replacement chest does not regenerate treasure');
    await page.keyboard.press('Escape');
    const bagBefore=(await state()).bag;
    await page.locator('#save').click();await page.locator('#load').click();
    assert((await state()).lootedChestKeys.includes(chestKey));
    await station(chest,'チェスト');
    s=await state();assert(s.chests[chestKey].every(v=>v===null));assert.deepEqual(s.bag,bagBefore);
    assert.deepEqual(errors,[],errors.join('\n'));
    console.log('PASS natural chest loot transfer, empty chest mining/replacement, no refill, and looted marker persistence');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
