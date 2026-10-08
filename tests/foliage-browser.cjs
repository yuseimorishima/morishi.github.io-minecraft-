const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const SAVE_KEY = 'block-coaster-world-v6';
const OFFSET = 32;

(async () => {
  const { BLOCKS, hash3 } = await import('../world.js');
  const { itemDefs } = await import('../items.js');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      HTMLElement.prototype.requestPointerLock = () => Promise.resolve();
      Object.defineProperty(window, 'devicePixelRatio', { value: .18 });
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000');
    await page.waitForFunction(() => window.blockCoaster?.streamingStats && blockCoaster.getState().version === 6, null, { timeout: 120000 });
    await page.locator('#enter').click();
    await page.locator('#distance').selectOption('3');
    const state = () => page.evaluate(() => blockCoaster.getState());
    const count = async key => (await state()).bag.reduce((total, stack) => total + (stack?.id === key ? stack.count : 0), 0);

    function coordinate(apple) {
      for (let z = 8; z < 20; z++) for (let x = 8; x < 20; x++) {
        if ((hash3(x, 91, z, 3) > .94) === apple) return { x, y: 91, z };
      }
      throw new Error('No suitable leaf coordinate exists in the test patch');
    }
    async function fixture(block, amount) {
      const saved = await state();
      const edits = new Map(saved.edits);
      // A small dry platform and clear air isolate normal survival placement
      // and harvesting. No inventory mutation occurs after this fixture loads.
      for (let z = block.z - 2; z <= block.z + 5; z++) {
        for (let x = block.x - 2; x <= block.x + 2; x++) {
          edits.set(`${x},89,${z}`, BLOCKS.STONE);
          for (let y = 90; y <= 95; y++) edits.set(`${x},${y},${z}`, BLOCKS.AIR);
        }
      }
      edits.set(`${block.x},90,${block.z}`, BLOCKS.STONE);
      saved.edits = [...edits];
      saved.player = [block.x + .5 - OFFSET, 90, block.z + 3.5 - OFFSET];
      saved.view = [0, 0];
      saved.gameMode = 'survival';
      saved.health = 20; saved.food = 15; saved.worldTime = 0;
      saved.bag = Array(36).fill(null);
      saved.bag[0] = { id: 'leaves', count: amount };
      saved.bag[1] = { id: 'woodSword', count: 1, durability: itemDefs.woodSword.life };
      saved.selected = 0;
      saved.equipment = Array(5).fill(null);
      saved.craftGrid = Array(9).fill(null);
      saved.rails = [];
      await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: SAVE_KEY, saved });
      await page.locator('#load').click();
      assert.doesNotMatch(await page.locator('#message').innerText(), /壊れて|互換性/);
      await page.waitForFunction(() => blockCoaster.streamingStats().rendered > 0, null, { timeout: 120000 });
      assert.equal(await count('leaves'), amount, 'The survival fixture loaded its finite leaf supply');
    }
    async function look(x, y, z) {
      const saved = await state(), eye = saved.position;
      const dx = x - OFFSET - eye[0], dy = y - eye[1], dz = z - OFFSET - eye[2];
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await page.mouse.move(600, 400);
      await page.mouse.down();
      await page.dispatchEvent('canvas', 'mousemove', {
        movementX: (saved.yaw - yaw) / .0025,
        movementY: (saved.pitch - pitch) / .0025,
        bubbles: true,
      });
      await page.mouse.up();
    }
    async function placeAndHarvest(block) {
      await page.keyboard.press('Digit1');
      await look(block.x + .5, block.y - .001, block.z + .5);
      await page.waitForFunction(block => {
        const saved = blockCoaster.getState(), target = saved.target;
        return saved.valid && target && target.x === block.x && target.y === block.y && target.z === block.z;
      }, block, { timeout: 15000 });
      await page.keyboard.press('KeyE');
      await page.waitForFunction(({ block, leaves }) => blockCoaster.voxel(block.x, block.y, block.z) === leaves,
        { block, leaves: BLOCKS.LEAVES }, { timeout: 15000 });
      await page.keyboard.press('Digit2');
      await look(block.x + .5, block.y + .5, block.z + .5);
      await page.waitForFunction(block => {
        const target = blockCoaster.getState().target;
        return target && target.x === block.x && target.y === block.y && target.z === block.z;
      }, block, { timeout: 15000 });
      await page.keyboard.press('KeyE');
      await page.waitForFunction(block => blockCoaster.voxel(block.x, block.y, block.z) === 0, block, { timeout: 15000 });
    }

    const fruitLeaf = coordinate(true);
    await fixture(fruitLeaf, 3);
    const initialLife = (await state()).bag[1].durability;
    for (let cycle = 1; cycle <= 3; cycle++) {
      await placeAndHarvest(fruitLeaf);
      assert.equal(await count('leaves'), 3 - cycle, 'A fruit-bearing leaf is consumed rather than returned alongside its apple');
      assert.equal(await count('apple'), cycle, 'Each planted fruit-bearing leaf produces exactly one apple');
      assert.equal(await count('leaves') + await count('apple'), 3, 'Replanting cannot grow the combined item count');
      assert.equal((await state()).bag[1].durability, initialLife - cycle, 'Actual sword harvesting consumes one durability per leaf');
    }
    console.log('PASS three real E placement/harvest cycles cannot duplicate leaves or farm infinite apples; sword durability wears');

    const ordinaryLeaf = coordinate(false);
    await fixture(ordinaryLeaf, 1);
    await placeAndHarvest(ordinaryLeaf);
    assert.equal(await count('leaves'), 1, 'An ordinary leaf still returns one leaf');
    assert.equal(await count('apple'), 0, 'An ordinary leaf does not also drop an apple');
    assert.equal((await state()).bag[1].durability, itemDefs.woodSword.life - 1);
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS ordinary leaf harvesting returns one leaf without fruit or browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
