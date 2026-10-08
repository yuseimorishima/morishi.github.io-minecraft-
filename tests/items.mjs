import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BLOCKS } from '../world.js';
import { itemDefs, recipes, equipmentSlots, smeltingRecipes, drawItemIcon, setItemAtlas } from '../items.js';

// Item data remains importable in Node; browser-only canvas work is deferred.
assert.equal(typeof globalThis.document, 'undefined');
assert.throws(() => drawItemIcon('diamond'), /browser canvas/);
assert.throws(() => drawItemIcon('missing-item'), /Unknown item/);
assert.throws(() => drawItemIcon('diamond', 0), /Icon size/);

const blockIds = new Set(Object.values(BLOCKS));
for (const [id, d] of Object.entries(itemDefs)) {
  assert.ok(d.name && d.description && /^#[0-9a-f]{6}$/i.test(d.color), id + ': localized name, description and palette');
  assert.ok(Number.isInteger(d.max) && d.max >= 1 && d.max <= 64, id + ': valid stack cap');
  if (d.block !== null) assert.ok(blockIds.has(d.block) && d.block > 0, id + ': valid placeable block');
  if (d.life) assert.ok(Number.isInteger(d.life) && d.life > 0 && d.max === 1, id + ': durable items do not stack');
  if (d.slot) assert.ok(equipmentSlots.includes(d.slot), id + ': equipment slot exists');
}
assert.ok(Object.keys(itemDefs).length >= 95);
assert.ok(recipes.length >= 70);

const needs = recipe => {
  const result = {};
  for (const row of recipe.shape) for (const symbol of row) if (symbol !== ' ') result[recipe.keys[symbol]] = (result[recipe.keys[symbol]] || 0) + 1;
  return result;
};
const signatures = new Set();
for (const r of recipes) {
  assert.ok(itemDefs[r.id], r.id + ': output exists');
  assert.ok(Number.isInteger(r.n) && r.n > 0 && r.n <= itemDefs[r.id].max, r.id + ': result fits one stack');
  assert.ok(r.size === 2 || r.size === 3);
  assert.ok(r.shape.length > 0 && r.shape.length <= r.size);
  assert.ok(r.shape.every(row => row.length > 0 && row.length <= r.size));
  let cells = 0;
  for (const row of r.shape) for (const symbol of row) {
    if (symbol === ' ') continue;
    cells++;
    assert.ok(itemDefs[r.keys[symbol]], r.id + ': every ingredient exists');
  }
  assert.ok(cells > 0 && cells <= 9);
  const signature = r.shape.map(row => [...row].map(s => s === ' ' ? '_' : r.keys[s]).join(',')).join('/');
  assert.ok(!signatures.has(signature), r.id + ': recipe does not collide with another output');
  signatures.add(signature);
}
for (const r of smeltingRecipes) {
  assert.ok(itemDefs[r.id] && itemDefs[r.input]);
  assert.ok(r.time > 0 && Number.isFinite(r.time));
}

// A real sequence of recipe quantities, from a log to a full diamond outfit.
const bag = { log: 5 };
function craft(id, choice = 0) {
  const r = recipes.filter(r => r.id === id)[choice];
  assert.ok(r, id + ': recipe exists');
  const ingredients = needs(r);
  for (const [key, count] of Object.entries(ingredients)) assert.ok((bag[key] || 0) >= count, id + ': enough ' + key);
  for (const [key, count] of Object.entries(ingredients)) bag[key] -= count;
  bag[id] = (bag[id] || 0) + r.n;
}
for (let i = 0; i < 5; i++) craft('plank');
craft('table');
for (let i = 0; i < 3; i++) craft('stick');
craft('woodPick');
assert.equal(itemDefs.woodPick.level, 1);
bag.stone = 11; // Cobblestone becomes obtainable with the wooden pickaxe.
craft('stonePick'); craft('furnace');
assert.equal(itemDefs.stonePick.level, 2);
bag.ironOre = 3; bag.coal = 3;
const ironSmelt = smeltingRecipes.find(r => r.id === 'iron');
for (let i = 0; i < 3; i++) { bag[ironSmelt.input]--; bag.coal--; bag.iron = (bag.iron || 0) + 1; }
craft('ironPick');
assert.equal(itemDefs.ironPick.level, 3);
bag.diamond = 27; // Iron unlocks deep diamond ore; diamonds do not need smelting.
craft('diamondPick');
for (const part of ['Helmet', 'Chestplate', 'Leggings', 'Boots']) craft('diamond' + part);
assert.equal(bag.diamond, 0, 'Three diamonds for a pickaxe and 24 for the full outfit');
assert.equal(['Helmet', 'Chestplate', 'Leggings', 'Boots'].reduce((n, part) => n + itemDefs['diamond' + part].armor, 0), 20);
assert.ok(itemDefs.diamondPick.life > itemDefs.ironPick.life && itemDefs.ironPick.life > itemDefs.stonePick.life);
assert.ok(itemDefs.goldPick.speed > itemDefs.diamondPick.speed && itemDefs.goldPick.life < itemDefs.woodPick.life, 'Gold is fast but wears out quickly');
assert.equal(itemDefs.shield.slot, 'offhand');
assert.ok(itemDefs.shield.protection > 0);
assert.notEqual(itemDefs.diamondSword.icon, itemDefs.diamondPick.icon, 'Swords have their own silhouette');
assert.notEqual(itemDefs.ironHelmet.icon, itemDefs.ironChestplate.icon);
assert.notEqual(itemDefs.ironLeggings.icon, itemDefs.ironBoots.icon);
assert.deepEqual(needs(recipes.find(r => r.id === 'rail')), { iron: 6, stick: 1 });
assert.equal(recipes.find(r => r.id === 'rail').n, 16);
for (const metal of ['iron', 'gold', 'copper', 'diamond', 'emerald']) {
  assert.deepEqual(needs(recipes.find(r => r.id === metal + 'Block')), { [metal]: 9 });
  assert.equal(recipes.find(r => r.id === metal).n, 9, metal + ': compression is reversible');
}

// Exercise the fallback pixel painter with a tiny in-memory canvas, no DOM library.
const canvases = [];
globalThis.document = { createElement(tag) {
  assert.equal(tag, 'canvas');
  const canvas = { width: 0, height: 0, pixels: new Map() };
  const context = { fillStyle: '', imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      assert.ok([x, y, w, h].every(Number.isFinite));
      for (let py = Math.max(0, Math.floor(y)); py < Math.min(canvas.height, y + h); py++) for (let px = Math.max(0, Math.floor(x)); px < Math.min(canvas.width, x + w); px++) canvas.pixels.set(py * canvas.width + px, this.fillStyle);
    },
    drawImage(...args) { canvas.imageCall = args; },
  };
  canvas.getContext = kind => { assert.equal(kind, '2d'); return context; };
  canvases.push(canvas);
  return canvas;
} };
const hashes = new Set();
for (const id of Object.keys(itemDefs)) {
  const canvas = drawItemIcon(id);
  assert.equal(canvas.width, 32); assert.equal(canvas.height, 32);
  assert.ok(canvas.pixels.size >= 50 && canvas.pixels.size < 1024, id + ': visible art with a transparent border');
  const hash = createHash('sha256').update(JSON.stringify([...canvas.pixels].sort((a, b) => a[0] - b[0]))).digest('hex');
  assert.ok(!hashes.has(hash), id + ': original icon differs from every other item');
  hashes.add(hash);
  assert.equal(drawItemIcon(id), canvas, id + ': icon is cached');
}
const image = { width: 1024, height: 1024 };
assert.throws(() => setItemAtlas(image, { unknown: 0 }), /Invalid atlas cell/);
assert.throws(() => setItemAtlas(image, { diamond: 64 }), /Invalid atlas cell/);
const equipmentMapping = [
  'woodPick', 'stonePick', 'ironPick', 'goldPick', 'diamondPick', 'emeraldPick', 'woodAxe', 'stoneAxe',
  'ironAxe', 'goldAxe', 'diamondAxe', 'emeraldAxe', 'woodShovel', 'stoneShovel', 'ironShovel', 'goldShovel',
  'diamondShovel', 'emeraldShovel', 'woodSword', 'stoneSword', 'ironSword', 'goldSword', 'diamondSword', 'emeraldSword',
  'woodHelmet', 'woodChestplate', 'woodLeggings', 'woodBoots', 'ironHelmet', 'ironChestplate', 'ironLeggings', 'ironBoots',
  'goldHelmet', 'goldChestplate', 'goldLeggings', 'goldBoots', 'diamondHelmet', 'diamondChestplate', 'diamondLeggings', 'diamondBoots',
  'emeraldHelmet', 'emeraldChestplate', 'emeraldLeggings', 'emeraldBoots', 'shield', 'compass', 'clock', 'map',
  'coal', 'ironOre', 'goldOre', 'copperOre', 'iron', 'gold', 'copper', 'diamond',
  'emerald', 'redstone', 'lapis', 'amethyst', 'stick', 'apple', 'goldenApple', 'torch',
];
const materialsMapping = Object.keys(itemDefs).filter(id => !equipmentMapping.includes(id));
assert.equal(equipmentMapping.length, 64);
assert.equal(materialsMapping.length, 40);
setItemAtlas(image, equipmentMapping);
const firstSheetDiamond = drawItemIcon('diamond');
assert.deepEqual(firstSheetDiamond.imageCall.slice(1), [896, 768, 128, 128, 0, 0, 32, 32], 'Generated art takes precedence and uses the correct grid cell');
assert.ok(drawItemIcon('stone').pixels.size, 'Unmapped items retain their fallback');
const materialsImage = { width: 1024, height: 640 };
setItemAtlas(materialsImage, materialsMapping, 8, 5);
assert.equal(drawItemIcon('diamond'), firstSheetDiamond, 'Registering another sheet preserves the first sheet and its cached sprite');
assert.equal(drawItemIcon('diamond').imageCall[0], image);
assert.equal(drawItemIcon('stone').imageCall[0], materialsImage, 'A second sheet replaces only the IDs that it supplies');
assert.deepEqual(drawItemIcon('dirt').imageCall.slice(1), [0, 0, 128, 128, 0, 0, 32, 32]);
const replacementImage = { width: 512, height: 512 };
setItemAtlas(replacementImage, { diamond: 3 }, 4, 4);
assert.notEqual(drawItemIcon('diamond'), firstSheetDiamond, 'Replacing an existing ID invalidates its old canvas');
assert.equal(drawItemIcon('diamond').imageCall[0], replacementImage);
assert.equal(drawItemIcon('stone').imageCall[0], materialsImage, 'Replacing one item preserves sprites from other sheets');
delete globalThis.document;
console.log(`Item validation passed: ${Object.keys(itemDefs).length} items, ${recipes.length} crafting recipes, ${smeltingRecipes.length} smelting recipes, ${hashes.size} distinct pixel icons.`);
