const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const SAVE_KEY = 'block-coaster-world-v6';
const OFFSET = 32;
const REGION = 64;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /shader|webgl|three\.webgl|out of memory/i.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript(() => {
      HTMLElement.prototype.requestPointerLock = () => Promise.resolve();
      Object.defineProperty(window, 'devicePixelRatio', { value: .25 });
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000');
    await page.waitForFunction(() => window.blockCoaster?.streamingStats && blockCoaster.getState().version === 6, null, { timeout: 120000 });
    await page.locator('#enter').click();

    const state = () => page.evaluate(() => blockCoaster.getState());
    const stats = () => page.evaluate(() => blockCoaster.streamingStats());
    async function settled() {
      await page.waitForFunction(() => {
        const s = blockCoaster.streamingStats();
        return s.rendered > 0 && s.pending < 5;
      }, null, { timeout: 120000 });
      const s = await stats();
      assert(s.residentChunks <= s.maxCachedChunks, `world cache exceeded its limit: ${JSON.stringify(s)}`);
      return s;
    }
    async function load(saved, fly = false) {
      await page.evaluate(saved => localStorage.setItem('block-coaster-world-v6', JSON.stringify(saved)), saved);
      await page.locator('#load').click();
      assert.doesNotMatch(await page.locator('#message').innerText(), /壊れて|互換性/);
      if (fly) await page.keyboard.press('KeyV');
    }
    async function look(x, y, z) {
      const s = await state(), o = s.position;
      const dx = x - OFFSET - o[0], dy = y - o[1], dz = z - OFFSET - o[2];
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await page.mouse.move(500, 350);
      await page.mouse.down();
      await page.dispatchEvent('canvas', 'mousemove', {
        movementX: (s.yaw - yaw) / .0025,
        movementY: (s.pitch - pitch) / .0025,
        bubbles: true
      });
      await page.mouse.up();
    }

    const dimensions = await page.evaluate(() => blockCoaster.dimensions());
    assert.equal(dimensions.infinite, true);
    assert.equal(dimensions.size, REGION);
    const initialStats = await settled();
    console.log('PASS streaming startup', JSON.stringify(initialStats));
    const frameTimes = await page.evaluate(() => new Promise(resolve => {
      const elapsed=[];let last=performance.now();
      const observe=now=>{elapsed.push(now-last);last=now;if(elapsed.length<30)requestAnimationFrame(observe);else{elapsed.sort((a,b)=>a-b);resolve({medianMs:elapsed[15],p95Ms:elapsed[28]});}};
      requestAnimationFrame(observe);
    }));
    console.log('OBSERVE software-rendered frame times',JSON.stringify(frameTimes));

    // Use actual placement and chest input to make an origin save worth preserving.
    const patch = await page.evaluate(() => {
      for (let z = 6; z <= 16; z++) for (let x = 28; x <= 36; x++) {
        const h = blockCoaster.worldInfo(x, z).height;
        const cells = [[x,z], [x+1,z], [x+2,z]];
        if (cells.every(([cx,cz]) => blockCoaster.worldInfo(cx,cz).height === h &&
          blockCoaster.voxel(cx,h-1,cz) !== 0 &&
          [0,1,2,3,4,5,6,7].every(dy => blockCoaster.voxel(cx,h+dy,cz) === 0))) return {x,z,h};
      }
      return null;
    });
    assert(patch, 'expected an open, level origin patch for the placement test');
    let s = await state();
    s.player = [patch.x + .5 - OFFSET, patch.h, patch.z + .5 - OFFSET];
    s.view = [0, 0];
    s.gameMode = 'survival';
    s.bag[0] = {id: 'plank', count: 8};
    s.bag[1] = {id: 'chest', count: 1};
    s.bag[2] = {id: 'iron', count: 7};
    s.selected = 0;
    await load(s);
    await look(patch.x + 2.5, patch.h - .1, patch.z + .5);
    await page.waitForFunction(() => blockCoaster.getState().valid && blockCoaster.getState().target, null, {timeout: 15000});
    const plankTarget = (await state()).target;
    await page.keyboard.press('KeyE');
    await page.waitForFunction(t => blockCoaster.voxel(t.x,t.y,t.z) === 10, plankTarget, {timeout: 15000});
    assert.equal((await state()).bag[0].count, 7);
    await page.keyboard.press('Digit2');
    await look(plankTarget.x + .5, plankTarget.y + .98, plankTarget.z + .5);
    await page.waitForFunction(() => blockCoaster.getState().valid && blockCoaster.getState().target, null, {timeout: 15000});
    const chestTarget = (await state()).target;
    await page.keyboard.press('KeyE');
    await page.waitForFunction(t => blockCoaster.voxel(t.x,t.y,t.z) === 18, chestTarget, {timeout: 15000});
    await look(chestTarget.x + .5, chestTarget.y + .5, chestTarget.z + .5);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => document.getElementById('inventoryTitle').textContent.includes('チェスト'));
    await page.keyboard.down('Shift');
    try { await page.locator('#bag [data-slot="2"]').click(); }
    finally { await page.keyboard.up('Shift'); }
    await page.keyboard.press('Escape');
    s = await state();
    const chestKey = `${chestTarget.x},${chestTarget.y},${chestTarget.z}`;
    assert.equal(s.chests[chestKey][0].id, 'iron');
    assert.equal(s.chests[chestKey][0].count, 7);
    assert.equal(s.bag[2], null);
    await page.locator('#save').click();
    const originSave = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    assert(originSave.edits.some(([key,t]) => key === chestKey && t === 18));
    const expectedEdits = JSON.stringify(originSave.edits);
    const expectedChest = JSON.stringify(originSave.chests[chestKey]);
    const expectedBag = JSON.stringify(originSave.bag);
    console.log('PASS actual placement, resource consumption, chest transfer and save');

    // Every arrow crosses a former finite-world boundary using the real movement input.
    const arrowCases = [
      {key:'ArrowRight', axis:0, edge:63.65, x:63.65, z:20.5, sign:1},
      {key:'ArrowLeft', axis:0, edge:.35, x:.35, z:20.5, sign:-1},
      {key:'ArrowDown', axis:2, edge:63.65, x:20.5, z:63.65, sign:1},
      {key:'ArrowUp', axis:2, edge:.35, x:20.5, z:.35, sign:-1}
    ];
    for (const t of arrowCases) {
      s = await state();
      s.player = [t.x - OFFSET, dimensions.maxY - 3, t.z - OFFSET];
      s.view = [0,0]; s.gameMode = 'creative';
      await load(s, true);
      await settled();
      await page.keyboard.down(t.key);
      try {
        await page.waitForFunction(({axis,sign,edge,offset}) => {
          const p = blockCoaster.getState().player[axis] + offset;
          return sign > 0 ? p > edge + 1 : p < edge - 1;
        }, {...t,offset:OFFSET}, {timeout:20000});
      } finally { await page.keyboard.up(t.key); }
      const at = (await state()).player[t.axis] + OFFSET;
      assert(t.sign > 0 ? at > REGION : at < 0, `${t.key} stopped at the old boundary: ${at}`);
      console.log('PASS old-world boundary crossed with', t.key, at.toFixed(2));
    }

    // Travel continuously across six mesh chunks. Loading fixtures alone would
    // clear all meshes and would not catch a leak in normal streaming movement.
    s = await state();
    s.player = [160.5-OFFSET,dimensions.maxY-3,20.5-OFFSET];
    s.view = [0,0]; s.gameMode = 'creative';
    await load(s,true);
    await settled();
    const flightStart = (await state()).player[0];
    await page.keyboard.down('ArrowRight');
    try {
      for (const distance of [32,64,96]) {
        await page.waitForFunction(({start,distance}) => blockCoaster.getState().player[0]-start > distance,
          {start:flightStart,distance}, {timeout:120000});
        const during = await stats();
        assert(during.residentChunks<=during.maxCachedChunks,`cache grew during flight: ${JSON.stringify(during)}`);
        assert(during.rendered<=(2*during.viewRadius+1)**2,`meshes grew during flight: ${JSON.stringify(during)}`);
        assert(during.pending<=(2*during.viewRadius+1)**2,`queue grew during flight: ${JSON.stringify(during)}`);
        console.log('PASS continuous streaming flight',distance,JSON.stringify(during));
      }
    } finally { await page.keyboard.up('ArrowRight'); }
    await settled();

    const samples = [];
    const places = [[2,0],[-2,1],[3,3],[-3,-3],[6,1],[-6,0],[0,0]];
    for (const [rx,rz] of places) {
      const x = rx * REGION + 32.5, z = rz * REGION + 20.5;
      s = await state();
      s.player = [x-OFFSET,dimensions.maxY-3,z-OFFSET];
      s.view = [0,-.35]; s.gameMode = 'creative';
      await load(s, true);
      const mesh = await settled();
      const loaded = await state();
      assert(Math.abs(loaded.player[0] + OFFSET - x) < .5 && Math.abs(loaded.player[2] + OFFSET - z) < .5, `save navigation reset region ${rx},${rz} to spawn`);
      assert.equal(JSON.stringify(loaded.edits), expectedEdits);
      assert.equal(JSON.stringify(loaded.chests[chestKey]), expectedChest);
      assert.equal(JSON.stringify(loaded.bag), expectedBag);
      const info = await page.evaluate(({x,z}) => blockCoaster.worldInfo(Math.floor(x), Math.floor(z)), {x,z});
      assert(Number.isFinite(info.height), 'distant terrain has no height');
      assert(info.biome, 'distant terrain has no biome');
      samples.push({region:[rx,rz],biome:info.biome,...mesh});
      console.log('PASS distant region', `${rx},${rz}`, JSON.stringify({biome:info.biome,...mesh}));
    }
    assert(new Set(samples.map(v => typeof v.biome === 'string' ? v.biome : JSON.stringify(v.biome))).size >= 2, 'distant regions did not expose different biomes');
    const maxRendered = Math.max(initialStats.rendered,...samples.map(v=>v.rendered));
    assert(maxRendered <= Math.max(64,initialStats.rendered*2), `meshes grew with exploration: ${maxRendered}`);
    assert(samples.at(-1).generatedChunks > initialStats.generatedChunks, 'distant visits did not generate new terrain');

    // Restore the origin through the normal load button, not through a world mutator.
    await load(originSave);
    await settled();
    assert.equal(await page.evaluate(t=>blockCoaster.voxel(t.x,t.y,t.z),plankTarget),10);
    assert.equal(await page.evaluate(t=>blockCoaster.voxel(t.x,t.y,t.z),chestTarget),18);
    s = await state();
    assert.equal(JSON.stringify(s.chests[chestKey]),expectedChest);
    assert.equal(JSON.stringify(s.bag),expectedBag);
    assert.equal(JSON.stringify(s.edits),expectedEdits);
    assert.deepEqual(errors,[],errors.join('\n'));
    await page.screenshot({path:'/tmp/streaming-origin.png'});
    console.log('PASS origin edit/chest/inventory recovery, bounded caches, diverse biomes, no shader or page errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
