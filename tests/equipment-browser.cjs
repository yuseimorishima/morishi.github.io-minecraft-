const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const SAVE_KEY = 'block-coaster-world-v6';
const OFFSET = 32;

(async () => {
  const { itemDefs, recipes } = await import('../items.js');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      HTMLElement.prototype.requestPointerLock = () => Promise.resolve();
      Object.defineProperty(window, 'devicePixelRatio', { value: .25 });
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000');
    await page.waitForFunction(() => window.blockCoaster?.artStats && blockCoaster.getState().version === 6 && Array.isArray(blockCoaster.getState().equipment), null, { timeout: 120000 });
    await page.locator('#enter').click();
    const state = () => page.evaluate(() => blockCoaster.getState());
    const count = async key => (await state()).bag.reduce((sum, s) => sum + (s?.id === key ? s.count : 0), 0);
    const cabin = (await page.evaluate(() => blockCoaster.structures())).find(s => s.x === 16 && s.z === 21 && s.name.includes('小屋'));
    assert(cabin, 'The accessible starting cabin remains part of the expanded world');

    async function fixture(edit) {
      if (await page.locator('#inventory').isVisible()) await page.keyboard.press('Escape');
      const saved = await state();
      delete saved.heights;
      edit(saved);
      await page.evaluate(saved => localStorage.setItem('block-coaster-world-v6', JSON.stringify(saved)), saved);
      await page.locator('#load').click();
      assert.doesNotMatch(await page.locator('#message').innerText(), /壊れて|互換性/);
      await page.waitForFunction(() => blockCoaster.streamingStats().rendered > 0, null, { timeout: 120000 });
    }
    function cabinFixture(s) {
      s.player = [16.5 - OFFSET, cabin.y, 21.5 - OFFSET];
      s.view = [0, 0]; s.gameMode = 'survival'; s.worldTime = 0; s.health = 20; s.food = 15;
      s.bag = Array(36).fill(null); s.equipment = Array(5).fill(null); s.craftGrid = Array(9).fill(null); s.selected = 0;
      s.craftSize = 2;
    }
    async function look(x, y, z) {
      const s = await state(), eye = s.position;
      const dx = x - OFFSET - eye[0], dy = y - eye[1], dz = z - OFFSET - eye[2];
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await page.mouse.move(700, 400);
      await page.mouse.down();
      await page.dispatchEvent('canvas', 'mousemove', {
        movementX: (s.yaw - yaw) / .0025,
        movementY: (s.pitch - pitch) / .0025,
        bubbles: true,
      });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    async function table() {
      await look(15.5, cabin.y + .5, 23.5);
      const aimed = await state();
      await page.keyboard.press('KeyF');
      await page.waitForFunction(() => !document.getElementById('inventory').hidden, null, { timeout: 10000 });
      assert.match(await page.locator('#inventoryTitle').innerText(), /3 × 3/, 'F opens the cabin workbench: target=' + JSON.stringify(aimed.target) + ' player=' + JSON.stringify(aimed.player) + ' message=' + await page.locator('#message').innerText());
      assert.equal((await state()).craftSize, 3);
    }
    async function checkCraftableList() {
      const s = await state(), totals = {};
      for (const stack of [...s.bag, ...s.craftGrid]) if (stack) totals[stack.id] = (totals[stack.id] || 0) + stack.count;
      const expected = recipes.filter(r => {
        if (r.size > s.craftSize) return false;
        const needs = {};
        for (const row of r.shape) for (const symbol of row) if (r.keys[symbol]) needs[r.keys[symbol]] = (needs[r.keys[symbol]] || 0) + 1;
        return Object.entries(needs).every(([key, amount]) => (totals[key] || 0) >= amount);
      }).map(r => r.id).sort();
      const actual = (await page.locator('#recipeBook [data-recipe]').evaluateAll(elements => elements.map(el => el.dataset.recipe))).sort();
      assert.deepEqual(actual, expected, 'Recipe book lists exactly the recipes that fit the open grid and available materials');
    }
    async function craft(key) {
      const button = page.locator(`#recipeBook [data-recipe="${key}"]`).first();
      assert.equal(await button.count(), 1, key + ' is craftable');
      await button.click();
      assert.equal(await page.locator('#craftOutput').isDisabled(), false, key + ': recipe fills the crafting grid');
      await checkCraftableList();
      await page.locator('#craftOutput').click();
      assert.ok(await count(key), key + ': crafted output was added to the bag');
      await checkCraftableList();
    }
    async function equip(key) {
      const index = (await state()).bag.findIndex(s => s?.id === key);
      assert.ok(index >= 0, key + ' exists in the bag');
      await page.locator(`#bag [data-slot="${index}"]`).click({ modifiers: ['Shift'] });
      const slot = ['head', 'chest', 'legs', 'feet', 'offhand'].indexOf(itemDefs[key].slot);
      assert.equal((await state()).equipment[slot]?.id, key, key + ': Shift-click equips the correct slot');
      assert.equal(await count(key), 0, key + ': equipment is moved out of the bag');
    }

    // A 2x2 grid hides tool recipes even when all of their ingredients exist.
    await fixture(s => { cabinFixture(s); s.bag[0] = { id: 'diamond', count: 3 }; s.bag[1] = { id: 'stick', count: 2 }; });
    await page.keyboard.press('KeyI');
    await checkCraftableList();
    assert.equal(await page.locator('#recipeBook [data-recipe="diamondPick"]').count(), 0);
    await page.keyboard.press('Escape');
    await table();
    assert.equal(await page.locator('#recipeBook [data-recipe="diamondPick"]').count(), 1);
    await page.locator('#recipeBook [data-recipe="diamondPick"]').click();
    assert.equal(await count('diamond'), 0);
    assert.equal(await count('stick'), 0);
    assert.equal(await page.locator('#recipeBook [data-recipe="diamondPick"]').count(), 1, 'Materials already in the grid still count towards recipe visibility');
    await checkCraftableList();
    await page.locator('#craftOutput').click();
    assert.equal(await count('diamondPick'), 1);
    assert.equal(await page.locator('#recipeBook [data-recipe="diamondPick"]').count(), 0, 'Consuming the final ingredients hides the recipe');
    await checkCraftableList();
    await page.keyboard.press('Escape');
    console.log('PASS recipes depend on material quantities, workbench size, and ingredients already in the grid');

    // Craft every requested armor material through actual workbench input.
    await fixture(s => {
      cabinFixture(s);
      for (const [index, id] of ['plank', 'stick', 'stone', 'iron', 'gold', 'diamond', 'emerald'].entries()) s.bag[index] = { id, count: 64 };
    });
    await table();
    await craft('diamondPick');
    for (const material of ['wood', 'iron', 'gold', 'diamond', 'emerald']) {
      for (const part of ['Helmet', 'Chestplate', 'Leggings', 'Boots']) await craft(material + part);
    }
    assert.equal(await count('diamond'), 37, 'Diamond pick and outfit use exactly 27 diamonds');
    for (const material of ['iron', 'gold', 'emerald']) assert.equal(await count(material), 40, material + ': complete outfit uses 24 units');
    console.log('PASS diamond pickaxe and all five complete armor sets are crafted with the correct costs');

    for (const part of ['Helmet', 'Chestplate', 'Leggings', 'Boots']) await equip('diamond' + part);
    assert.match(await page.locator('#armorRating').innerText(), /20/);
    await page.locator('#equipmentSlots [data-kind="equipment"][data-slot="0"]').click();
    assert.equal((await state()).equipment[0], null);
    assert.equal(await count('diamondHelmet'), 1, 'Clicking worn gear returns it to the bag');
    await equip('diamondHelmet');
    await page.screenshot({ path: '/tmp/equipment-crafting.png' });
    await page.keyboard.press('Escape');
    console.log('PASS Shift-click armor equip, correct defense total, and worn-gear unequip');

    // A real fall must wear armor and reduce the received damage.
    const patch = await page.evaluate(() => {
      for (let z = 6; z < 16; z++) for (let x = 28; x < 36; x++) {
        const y = blockCoaster.worldInfo(x, z).height;
        if (![0, 22, 23, 47].includes(blockCoaster.voxel(x, y - 1, z)) && Array.from({ length: 12 }, (_, i) => i).every(i => blockCoaster.voxel(x, y + i, z) === 0)) return { x, y, z };
      }
      return null;
    });
    assert(patch, 'A clear, dry patch exists for testing fall damage');
    const fullArmor = (await state()).equipment.map(s => s ? { ...s } : null);
    async function fall(equipment) {
      await fixture(s => {
        s.player = [patch.x + .5 - OFFSET, patch.y + 8, patch.z + .5 - OFFSET];
        s.equipment = equipment.map(stack => stack ? { ...stack } : null);
        s.view = [0, 0]; s.health = 20; s.food = 15; s.worldTime = 0; s.gameMode = 'survival';
      });
      await page.waitForFunction(y => Math.abs(blockCoaster.getState().player[1] - y) < .1 && blockCoaster.getState().health < 20, patch.y, { timeout: 20000 });
      return state();
    }
    const unprotected = await fall(Array(5).fill(null));
    const protectedState = await fall(fullArmor);
    assert.ok(protectedState.health > unprotected.health, 'Worn diamond armor reduces real fall damage');
    assert.ok(protectedState.equipment.slice(0, 4).every((s, i) => s.durability < fullArmor[i].durability), 'Armor durability wears when it absorbs damage');
    console.log('PASS armor protection and durability under actual fall damage');

    await page.locator('#save').click();
    const savedEquipment = (await state()).equipment;
    await page.reload();
    await page.waitForFunction(() => window.blockCoaster?.artStats, null, { timeout: 120000 });
    await page.locator('#enter').click();
    await page.locator('#load').click();
    assert.deepEqual((await state()).equipment, savedEquipment, 'Save/reload preserves every worn item and its durability');
    console.log('PASS worn equipment and used durability survive save/reload');

    // Navigation-only fixtures select an exposed generated ore. Mining uses real input.
    const ore = await page.evaluate(() => {
      // Search both the preserved starting region and genuinely generated chunks.
      for (const [x0, z0, size, minY] of [[4, 4, 56, -46], [96, 0, 32, -58], [64, 64, 32, -58], [-64, -64, 32, -58]])
      for (let y = minY; y <= -26; y++) for (let z = z0; z < z0 + size; z++) for (let x = x0; x < x0 + size; x++) {
        if (blockCoaster.voxel(x, y, z) !== 24) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const px = x + dx, pz = z + dz;
          if (blockCoaster.voxel(px, y, pz) === 0 && blockCoaster.voxel(px, y + 1, pz) === 0 && ![0, 22, 23, 47].includes(blockCoaster.voxel(px, y - 1, pz))) return { x, y, z, px: px + .5, pz: pz + .5 };
        }
      }
      return null;
    });
    assert(ore, 'The expanded cave resources include an exposed deep diamond vein');
    await fixture(s => {
      s.player = [ore.px - OFFSET, ore.y, ore.pz - OFFSET]; s.view = [0, 0]; s.worldTime = 0;
      s.bag = Array(36).fill(null);
      s.bag[0] = { id: 'woodPick', count: 1, durability: itemDefs.woodPick.life };
      s.bag[1] = { id: 'ironPick', count: 1, durability: itemDefs.ironPick.life };
      s.selected = 0; s.health = 20; s.food = 15;
    });
    const aimX = ore.x + (ore.px < ore.x ? .01 : ore.px > ore.x + 1 ? .99 : .5);
    const aimZ = ore.z + (ore.pz < ore.z ? .01 : ore.pz > ore.z + 1 ? .99 : .5);
    await look(aimX, ore.y + .45, aimZ);
    await page.waitForFunction(({ x, y, z }) => {
      const t = blockCoaster.getState().target;
      return t && t.x === x && t.y === y && t.z === z;
    }, ore, { timeout: 15000 });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(({ x, y, z }) => blockCoaster.voxel(x, y, z), ore), 24, 'A wooden pickaxe cannot harvest diamond ore');
    assert.equal(await count('diamond'), 0);
    await page.keyboard.press('Digit2');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(({ x, y, z }) => blockCoaster.voxel(x, y, z) === 0, ore, { timeout: 15000 });
    assert.equal(await count('diamond'), 1, 'Diamond ore drops a diamond directly, rather than another ore item');
    assert.equal((await state()).bag.find(s => s?.id === 'ironPick').durability, itemDefs.ironPick.life - 1);
    console.log('PASS deep diamond ore tool requirement, real mining, gem drop, and tool durability');

    await page.waitForFunction(() => {
      const s = blockCoaster.artStats();
      return s.ready === 2 && s.generatedIcons === 104;
    }, null, { timeout: 120000 });
    await fixture(s => { cabinFixture(s); s.gameMode = 'creative'; });
    await page.keyboard.press('KeyI');
    const catalogCount = await page.locator('#creativeItems .slot').count();
    assert.equal(catalogCount, 104, 'All item categories have generated artwork in the creative catalog');
    assert.equal(await page.locator('#creativeItems .item-icon').count(), 104);
    await page.screenshot({ path: '/tmp/equipment-generated-art.png' });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS two generated sprite atlases, 104 creative item icons, screenshots, and no browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
