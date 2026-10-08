import { BLOCKS as B } from './world.js';

// Original fallback palettes and 32-pixel silhouettes; a generated atlas can override them.
export const itemDefs = {};
const define = (id, name, color, block = null, extra = {}) => {
  itemDefs[id] = { name, color, block, max: 64, icon: block !== null ? 'block' : 'chunk', ...extra };
};
const blocks = [
  ['dirt', '土', '#896342', B.DIRT], ['stone', '丸石', '#858c8c', B.COBBLE],
  ['log', 'オークの原木', '#956638', B.WOOD, 'log'], ['leaves', 'オークの葉', '#4d8a38', B.LEAVES, 'leaves'],
  ['plank', '木材', '#c2995c', B.PLANK, 'plank'], ['sand', '砂', '#e5d39a', B.SAND],
  ['glass', 'ガラス', '#b8e8e9', B.GLASS, 'glass'], ['snow', '雪', '#e4eff4', B.SNOW],
  ['moss', '苔むした石', '#78905d', B.RUIN, 'moss'], ['amethyst', 'アメジスト', '#b785e4', B.GLOW, 'crystal'],
  ['table', '作業台', '#b8874d', B.TABLE, 'table'], ['furnace', 'かまど', '#737a7e', B.FURNACE, 'furnace'],
  ['chest', 'チェスト', '#bd8640', B.CHEST, 'chest'], ['clay', '粘土', '#a8b5c2', B.CLAY],
  ['brickBlock', 'レンガ', '#bf6b51', B.BRICK, 'brickBlock'], ['bookshelf', '本棚', '#bc935a', B.BOOKSHELF, 'bookshelf'],
  ['obsidian', '黒曜石', '#403251', B.OBSIDIAN, 'obsidian'], ['basalt', '玄武岩', '#4d5157', B.BASALT],
  ['pineLog', 'トウヒの原木', '#725137', B.SNOW_LOG, 'log'], ['pineLeaves', 'トウヒの葉', '#3b7164', B.PINE_LEAVES, 'leaves'],
  ['jungleLog', 'ジャングルの原木', '#ae8063', B.JUNGLE_LOG, 'log'], ['jungleLeaves', 'ジャングルの葉', '#55a347', B.JUNGLE_LEAVES, 'leaves'],
  ['redSand', '赤い砂', '#cb8551', B.RED_SAND], ['ice', '氷', '#88c3df', B.ICE, 'ice'],
  ['wool', '羊毛', '#e5ded4', B.WOOL, 'wool'], ['cactus', 'サボテン', '#579543', B.CACTUS, 'cactus'],
  ['mushroom', 'キノコ', '#c96850', B.MUSHROOM, 'mushroom'], ['smoothStone', 'なめらかな石', '#92979c', B.STONE],
];
for (const [id, name, color, block, icon] of blocks) define(id, name, color, block, icon ? { icon } : {});

define('coal', '石炭', '#34353b', null, { icon: 'chunk', fuel: true });
define('charcoal', '木炭', '#41403a', null, { icon: 'chunk', fuel: true });
for (const [id, name, color] of [
  ['ironOre', '鉄の原石', '#c2a089'], ['goldOre', '金の原石', '#eac34a'], ['copperOre', '銅の原石', '#ce9369'],
]) define(id, name, color, null, { icon: 'rawOre' });
for (const [id, name, color] of [
  ['iron', '鉄インゴット', '#d6e0e3'], ['gold', '金インゴット', '#ffd05d'], ['copper', '銅インゴット', '#e1a47a'],
]) define(id, name, color, null, { icon: 'ingot' });
for (const [id, name, color] of [
  ['diamond', 'ダイヤモンド', '#55dada'], ['emerald', 'エメラルド', '#55d878'],
  ['redstone', 'レッドストーン', '#dd534f'], ['lapis', 'ラピスラズリ', '#4772d9'],
]) define(id, name, color, null, { icon: id === 'redstone' ? 'dust' : 'gem' });
for (const [id, name, color, block] of [
  ['ironBlock', '鉄ブロック', '#ccd8dc', B.IRON_BLOCK], ['goldBlock', '金ブロック', '#f7c447', B.GOLD_BLOCK],
  ['copperBlock', '銅ブロック', '#ca956b', B.COPPER_BLOCK], ['diamondBlock', 'ダイヤモンドブロック', '#4bd2d3', B.DIAMOND_BLOCK],
  ['emeraldBlock', 'エメラルドブロック', '#48c86f', B.EMERALD_BLOCK],
]) define(id, name, color, block, { icon: 'metalBlock' });

define('stick', '棒', '#a7814d', null, { icon: 'stick' });
define('torch', '松明', '#f5bd56', B.TORCH, { icon: 'torch' });
define('rail', 'レール', '#b8c5ca', null, { icon: 'rail', rail: true });
define('apple', 'りんご', '#e46048', null, { icon: 'apple', food: 4, heal: 2 });
define('bakedApple', '焼きりんご', '#b77442', null, { icon: 'apple', food: 6, heal: 2 });
define('goldenApple', '金のりんご', '#f6cb55', null, { icon: 'apple', food: 10, heal: 8 });
define('bowl', 'ボウル', '#a47945', null, { icon: 'bowl', max: 16 });
define('mushroomStew', 'キノコシチュー', '#c48a51', null, { icon: 'stew', max: 1, food: 6, heal: 2, returns: 'bowl' });
define('paper', '紙', '#eee8d6', null, { icon: 'paper' });
define('book', '本', '#95704b', null, { icon: 'book' });
define('brick', 'レンガのかけら', '#c07756', null, { icon: 'ingot' });
define('compass', 'コンパス', '#bfccd0', null, { icon: 'compass', max: 1, navigation: 'spawn' });
define('clock', '時計', '#e5bd5c', null, { icon: 'clock', max: 1, navigation: 'time' });
define('map', '地図', '#d9ca98', null, { icon: 'map', max: 1, navigation: 'biome' });

export const equipmentSlots = ['head', 'chest', 'legs', 'feet', 'offhand'];
const tiers = [
  { id: 'wood', name: '木', material: 'plank', color: '#bb9458', life: 60, level: 1, speed: 2, attack: 4, armor: [1, 3, 2, 1], armorLife: [60, 90, 80, 70] },
  { id: 'stone', name: '石', material: 'stone', color: '#879092', life: 132, level: 2, speed: 4, attack: 5 },
  { id: 'iron', name: '鉄', material: 'iron', color: '#d8e4e7', life: 251, level: 3, speed: 6, attack: 6, armor: [2, 6, 5, 2], armorLife: [165, 240, 225, 195] },
  { id: 'gold', name: '金', material: 'gold', color: '#f9cc56', life: 33, level: 1, speed: 12, attack: 4, armor: [2, 5, 3, 1], armorLife: [77, 112, 105, 91] },
  { id: 'diamond', name: 'ダイヤモンド', material: 'diamond', color: '#62dddd', life: 1562, level: 4, speed: 8, attack: 7, armor: [3, 8, 6, 3], armorLife: [363, 528, 495, 429] },
  { id: 'emerald', name: 'エメラルド', material: 'emerald', color: '#69d995', life: 1800, level: 4, speed: 9, attack: 7, armor: [3, 7, 6, 3], armorLife: [400, 550, 510, 460] },
];
for (const tier of tiers) {
  for (const [suffix, tool, label] of [['Pick', 'pick', 'ツルハシ'], ['Axe', 'axe', '斧'], ['Shovel', 'shovel', 'シャベル'], ['Sword', 'sword', '剣']]) {
    define(tier.id + suffix, tier.name + 'の' + label, tier.color, null, {
      max: 1, icon: tool, tool, material: tier.id, life: tier.life, level: tier.level,
      speed: tier.speed, attack: tier.attack + (tool === 'axe' ? 1 : tool === 'sword' ? 0 : -2),
    });
  }
  if (!tier.armor) continue;
  for (const [i, suffix, icon, label] of [[0, 'Helmet', 'helmet', 'ヘルメット'], [1, 'Chestplate', 'chestplate', 'チェストプレート'], [2, 'Leggings', 'leggings', 'レギンス'], [3, 'Boots', 'boots', 'ブーツ']]) {
    define(tier.id + suffix, tier.name + 'の' + label, tier.color, null, {
      max: 1, icon, material: tier.id, slot: equipmentSlots[i], armor: tier.armor[i], life: tier.armorLife[i],
    });
  }
}
define('shield', '盾', '#bd955d', null, { max: 1, icon: 'shield', slot: 'offhand', protection: 4, life: 337 });

export const recipes = [];
function recipe(id, n, shape, keys, size = Math.max(shape.length, ...shape.map(r => r.length)) > 2 ? 3 : 2) {
  recipes.push({ id, n, shape, keys, size });
}
for (const log of ['log', 'pineLog', 'jungleLog']) recipe('plank', 4, ['L'], { L: log });
recipe('stick', 4, ['P', 'P'], { P: 'plank' });
recipe('table', 1, ['PP', 'PP'], { P: 'plank' });
for (const fuel of ['coal', 'charcoal']) recipe('torch', 4, ['C', 'S'], { C: fuel, S: 'stick' });
for (const tier of tiers) {
  const keys = { P: tier.material, S: 'stick' };
  recipe(tier.id + 'Pick', 1, ['PPP', ' S ', ' S '], keys, 3);
  recipe(tier.id + 'Axe', 1, ['PP', 'PS', ' S'], keys, 3);
  recipe(tier.id + 'Shovel', 1, ['P', 'S', 'S'], keys, 3);
  recipe(tier.id + 'Sword', 1, ['P', 'P', 'S'], keys, 3);
  if (!tier.armor) continue;
  recipe(tier.id + 'Helmet', 1, ['PPP', 'P P'], { P: tier.material }, 3);
  recipe(tier.id + 'Chestplate', 1, ['P P', 'PPP', 'PPP'], { P: tier.material }, 3);
  recipe(tier.id + 'Leggings', 1, ['PPP', 'P P', 'P P'], { P: tier.material }, 3);
  recipe(tier.id + 'Boots', 1, ['P P', 'P P'], { P: tier.material }, 3);
}
recipe('furnace', 1, ['CCC', 'C C', 'CCC'], { C: 'stone' });
recipe('chest', 1, ['PPP', 'P P', 'PPP'], { P: 'plank' });
recipe('rail', 16, ['I I', 'ISI', 'I I'], { I: 'iron', S: 'stick' });
for (const metal of ['iron', 'gold', 'copper', 'diamond', 'emerald']) {
  recipe(metal + 'Block', 1, ['MMM', 'MMM', 'MMM'], { M: metal });
  recipe(metal, 9, ['B'], { B: metal + 'Block' });
}
recipe('shield', 1, ['PIP', 'PPP', ' P '], { P: 'plank', I: 'iron' });
recipe('bowl', 4, ['P P', ' P '], { P: 'plank' });
recipe('mushroomStew', 1, ['MM', 'B '], { M: 'mushroom', B: 'bowl' });
recipe('goldenApple', 1, ['GGG', 'GAG', 'GGG'], { G: 'gold', A: 'apple' });
recipe('paper', 3, ['LLL'], { L: 'leaves' });
recipe('book', 1, ['PP', 'PW'], { P: 'paper', W: 'plank' });
recipe('bookshelf', 1, ['WWW', 'BBB', 'WWW'], { W: 'plank', B: 'book' });
recipe('brickBlock', 1, ['BB', 'BB'], { B: 'brick' });
recipe('moss', 4, [' S ', 'SLS', ' S '], { S: 'stone', L: 'leaves' });
recipe('compass', 1, [' I ', 'IRI', ' I '], { I: 'iron', R: 'redstone' });
recipe('clock', 1, [' G ', 'GRG', ' G '], { G: 'gold', R: 'redstone' });
recipe('map', 1, ['PPP', 'PCP', 'PPP'], { P: 'paper', C: 'compass' });

export const smeltingRecipes = [
  { id: 'iron', input: 'ironOre', time: 4 }, { id: 'gold', input: 'goldOre', time: 4 },
  { id: 'copper', input: 'copperOre', time: 4 }, { id: 'glass', input: 'sand', time: 4 },
  { id: 'brick', input: 'clay', time: 4 }, { id: 'charcoal', input: 'log', time: 4 },
  { id: 'smoothStone', input: 'stone', time: 4 }, { id: 'bakedApple', input: 'apple', time: 4 },
];

for (const [id, d] of Object.entries(itemDefs)) {
  d.description = d.tool
    ? `${d.name} · ${d.tool==='sword'?'葉やキノコを切る速度':'採掘速度'} ${d.speed} · 耐久 ${d.life}`
    : d.slot ? `${d.name} · 防御 ${d.armor ?? d.protection} · 耐久 ${d.life}`
    : d.food ? `${d.name} · 満腹度 +${d.food}${d.heal ? ' · 体力 +' + d.heal : ''}`
    : id === 'compass' ? '最初の拠点の方角を確認できます。'
    : id === 'clock' ? '現在の時刻と昼夜を確認できます。'
    : id === 'map' ? '座標、バイオーム、近くの構造物を確認できます。'
    : d.rail ? 'Eで配置。地形に沿って隣接するレールをつなげます。'
    : d.block !== null ? '選択してEで配置できます。'
    : 'クラフトや精錬の素材です。';
}

const canvasCache = new Map();
const itemAtlasSprites = new Map();
/** Register a loaded image and its row-major sprite IDs without touching the DOM. */
export function setItemAtlas(image, mapping, cols = 8, rows = 8) {
  const width = image?.naturalWidth || image?.width;
  const height = image?.naturalHeight || image?.height;
  if (!width || !height || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) throw new TypeError('A loaded sprite atlas and positive grid dimensions are required.');
  const cells = Array.isArray(mapping) ? Object.fromEntries(mapping.map((key, cell) => [key, cell]).filter(([key]) => key)) : { ...mapping };
  for (const [id, cell] of Object.entries(cells)) if (!itemDefs[id] || !Number.isInteger(cell) || cell < 0 || cell >= cols * rows) throw new RangeError('Invalid atlas cell for ' + id);
  for (const [id, cell] of Object.entries(cells)) {
    itemAtlasSprites.set(id, { image, cell, cols, rows, width, height });
    // Replacing a sprite invalidates every cached size of that item only.
    for (const key of canvasCache.keys()) if (key.startsWith(id + ':')) canvasCache.delete(key);
  }
}

const palettes = new Map();
function shade(hex, delta) {
  const values = hex.match(/[0-9a-f]{2}/gi).map(n => Math.max(0, Math.min(255, parseInt(n, 16) + delta)));
  return '#' + values.map(n => n.toString(16).padStart(2, '0')).join('');
}
function palette(color) {
  if (!palettes.has(color)) palettes.set(color, { base: color, dark: shade(color, -45), shadow: shade(color, -25), light: shade(color, 34), shine: shade(color, 65), outline: shade(color, -80) });
  return palettes.get(color);
}
function inside(x, y, points) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a, b] = points[i], [c, d] = points[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) result = !result;
  }
  return result;
}
function paintItem(g, id, d) {
  const p = palette(d.color), ink = '#252b33';
  const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  const polygon = (points, color) => {
    const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
    const maxX = Math.min(32, Math.ceil(Math.max(...points.map(p => p[0]))));
    const maxY = Math.min(32, Math.ceil(Math.max(...points.map(p => p[1]))));
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) if (inside(x + .5, y + .5, points)) rect(x, y, 1, 1, color);
  };
  const line = (x0, y0, x1, y1, color, width = 1) => {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { rect(x0, y0, width, width, color); if (x0 === x1 && y0 === y1) break; const e = 2 * err; if (e >= dy) { err += dy; x0 += sx; } if (e <= dx) { err += dx; y0 += sy; } }
  };
  const handle = () => { line(7, 26, 22, 11, '#46382c', 4); line(8, 25, 22, 11, '#92643c', 2); line(9, 25, 22, 12, '#c49a5a'); rect(6, 27, 4, 2, '#604329'); };
  const block = (style) => {
    const top = [[4, 8], [16, 2], [28, 8], [16, 14]], front = [[4, 8], [16, 14], [16, 29], [4, 23]], side = [[16, 14], [28, 8], [28, 23], [16, 29]];
    const silhouette = [[3, 8], [16, 1], [29, 8], [29, 24], [16, 31], [3, 24]];
    polygon(silhouette, p.outline); polygon(top, p.light); polygon(front, p.base); polygon(side, p.shadow);
    const random = (x, y) => ((x * 37 + y * 71 + id.length * 53 + id.charCodeAt(0) * 3) % 83) / 83;
    for (let y = 3; y < 29; y++) for (let x = 4; x < 28; x++) {
      const r = random(x, y); if (r > .08) continue;
      if ([top, front, side].some(face => inside(x + .5, y + .5, face))) rect(x, y, 1, 1, r < .04 ? p.dark : p.shine);
    }
    if (style === 'plank' || style === 'chest' || style === 'bookshelf' || style === 'table') {
      line(4, 14, 15, 20, p.shadow); line(4, 20, 15, 26, p.shadow); line(17, 20, 27, 15, p.dark); line(17, 26, 27, 21, p.dark);
    }
    if (style === 'log') {
      polygon([[7, 8], [16, 4], [25, 8], [16, 12]], '#d4b47a');
      polygon([[11, 8], [16, 6], [21, 8], [16, 10]], '#8e653f');
      rect(15, 7, 2, 2, '#e7c58d');
      for (const x of [5, 8, 11, 14]) line(x, 12 + Math.floor((x - 4) / 2), x, 21 + Math.floor((x - 4) / 2), p.dark);
      for (const x of [19, 23, 26]) line(x, 15 - Math.floor((x - 16) / 2), x, 27 - Math.floor((x - 16) / 2), p.dark);
    } else if (style === 'leaves' || style === 'moss') {
      for (const [x, y] of [[7, 10], [8, 19], [19, 7], [20, 16], [25, 10], [17, 25], [12, 7]]) { rect(x, y, 3, 2, p.light); rect(x + 1, y + 2, 2, 2, p.dark); }
    } else if (style === 'furnace') {
      polygon([[6, 14], [14, 18], [14, 25], [6, 21]], '#252d33');
      line(7, 20, 13, 23, '#e98437', 2); line(8, 16, 12, 18, '#4b535b', 2);
      line(6, 9, 14, 13, p.shine); line(6, 11, 14, 15, p.dark);
    } else if (style === 'table') {
      polygon([[7, 8], [16, 4], [25, 8], [16, 12]], '#e2bd79');
      for (let x = 0; x < 3; x++) { line(10 + x * 3, 7 - x, 19 + x * 3, 12 - x, '#684a30'); line(10 + x * 3, 6 + x, 4 + x * 3, 9 + x, '#684a30'); }
      line(8, 17, 12, 25, '#5d4636', 2); line(13, 17, 7, 21, '#5d4636', 2);
    } else if (style === 'chest') {
      line(4, 15, 16, 21, '#6a442e', 2); line(16, 21, 27, 15, '#6a442e', 2);
      rect(10, 17, 3, 5, '#f0d181'); rect(11, 18, 1, 2, '#f9ecb6');
    } else if (style === 'bookshelf') {
      const colors = ['#ae4b43', '#608b86', '#d4b065', '#6770a5'];
      for (let x = 5; x < 14; x += 2) { const y = 13 + Math.floor((x - 4) / 2); rect(x, y, 2, 5, colors[(x >> 1) % 4]); rect(x, y + 7, 2, 5, colors[((x >> 1) + 2) % 4]); }
      line(4, 20, 15, 26, '#533d2c', 2);
    } else if (style === 'glass' || style === 'ice') {
      polygon(front, style === 'glass' ? '#8ac6d575' : '#8dc6e1'); polygon(side, '#6fabc0');
      line(5, 11, 15, 16, '#e9fcff'); line(6, 15, 10, 20, '#daf5ff', 2); line(18, 17, 24, 11, '#d9f6ff');
      if (style === 'glass') polygon([[7, 17], [13, 20], [13, 25], [7, 22]], '#bddce6');
    } else if (style === 'brickBlock') {
      for (const y of [13, 18, 23]) line(4, y, 15, y + 5, '#e3b3a0');
      line(9, 12, 9, 16, '#e3b3a0'); line(12, 19, 12, 23, '#e3b3a0'); line(6, 21, 6, 24, '#e3b3a0');
      for (const y of [15, 20, 25]) line(17, y, 27, y - 5, '#bd8976');
    } else if (style === 'metalBlock') {
      line(5, 9, 15, 14, p.shine); line(5, 10, 5, 22, p.light); line(18, 16, 26, 12, p.dark);
      polygon([[7, 16], [13, 19], [13, 23], [7, 20]], p.light);
    } else if (style === 'obsidian') {
      for (const [x, y] of [[6, 12], [10, 19], [18, 7], [19, 22], [24, 13]]) { rect(x, y, 3, 2, '#786087'); rect(x + 1, y + 2, 2, 1, '#a17dae'); }
    } else if (style === 'wool') {
      for (const [x, y] of [[5, 11], [9, 14], [6, 20], [12, 23], [20, 16], [24, 12], [21, 22], [17, 7]]) { rect(x, y, 2, 2, p.shine); rect(x + 2, y + 1, 1, 2, p.shadow); }
    }
  };

  if (['block', 'log', 'leaves', 'plank', 'glass', 'ice', 'moss', 'table', 'furnace', 'chest', 'brickBlock', 'bookshelf', 'metalBlock', 'obsidian', 'wool'].includes(d.icon)) return block(d.icon);
  if (d.icon === 'pick' || d.icon === 'axe' || d.icon === 'shovel') {
    handle();
    if (d.icon === 'pick') {
      polygon([[4, 5], [15, 3], [25, 8], [29, 16], [25, 16], [22, 11], [13, 8], [5, 11]], ink);
      polygon([[5, 6], [15, 4], [24, 9], [27, 14], [25, 14], [22, 10], [13, 7], [6, 9]], p.base);
      line(6, 6, 14, 5, p.shine); line(15, 5, 23, 9, p.light); line(24, 10, 26, 13, p.dark);
    } else if (d.icon === 'axe') {
      polygon([[11, 4], [19, 2], [26, 6], [27, 14], [21, 19], [15, 15], [15, 10], [10, 9]], ink);
      polygon([[12, 5], [19, 4], [24, 7], [25, 13], [21, 17], [17, 14], [17, 9], [12, 8]], p.base);
      polygon([[20, 5], [24, 7], [25, 13], [23, 15], [22, 9]], p.shine); rect(14, 6, 4, 2, p.dark);
    } else {
      polygon([[20, 2], [27, 3], [30, 9], [25, 16], [17, 12], [16, 7]], ink);
      polygon([[20, 4], [26, 4], [28, 9], [24, 14], [19, 11], [18, 7]], p.base);
      line(20, 5, 25, 5, p.shine, 2); line(20, 11, 24, 13, p.dark, 2);
    }
    return;
  }
  if (d.icon === 'sword') {
    polygon([[26, 2], [30, 3], [29, 9], [15, 22], [11, 18]], ink);
    polygon([[26, 4], [28, 4], [27, 9], [15, 20], [13, 18]], p.base);
    line(26, 5, 14, 17, p.shine, 2); line(27, 7, 16, 19, p.dark);
    line(7, 17, 17, 27, ink, 3); line(8, 18, 17, 27, p.shadow, 2); line(7, 19, 16, 28, p.light);
    line(5, 26, 11, 20, '#48382f', 4); line(6, 27, 11, 22, '#9e7145', 2); rect(3, 27, 4, 3, p.base);
    return;
  }
  if (['helmet', 'chestplate', 'leggings', 'boots'].includes(d.icon)) {
    const shapes = {
      helmet: [[6, 8], [10, 4], [23, 4], [27, 9], [27, 25], [21, 25], [21, 17], [11, 17], [11, 25], [5, 24], [5, 10]],
      chestplate: [[8, 4], [12, 4], [13, 9], [19, 9], [20, 4], [24, 4], [30, 10], [26, 16], [23, 14], [23, 28], [9, 28], [9, 14], [5, 17], [1, 11]],
      leggings: [[7, 4], [25, 4], [25, 29], [18, 29], [18, 16], [14, 16], [14, 29], [7, 29]],
      boots: [[5, 8], [13, 8], [13, 26], [2, 26], [2, 20], [5, 18], [5, 8]],
    };
    const points = shapes[d.icon]; polygon(points, ink);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (!inside(x + .5, y + .5, points) || !inside(x - .5, y + .5, points) || !inside(x + 1.5, y + .5, points) || !inside(x + .5, y - .5, points) || !inside(x + .5, y + 1.5, points)) continue;
      rect(x, y, 1, 1, x < 14 ? p.light : p.base);
    }
    if (d.icon === 'helmet') { rect(10, 6, 12, 2, p.shine); rect(7, 12, 3, 9, p.shadow); rect(21, 13, 4, 3, p.dark); }
    if (d.icon === 'chestplate') { rect(11, 12, 10, 2, p.shine); rect(10, 25, 12, 2, p.dark); line(21, 15, 21, 23, p.shadow); rect(14, 17, 4, 3, p.light); }
    if (d.icon === 'leggings') { rect(8, 6, 16, 3, p.dark); rect(14, 6, 4, 2, '#f8e6b7'); rect(9, 11, 2, 14, p.shine); rect(20, 11, 2, 14, p.shadow); }
    if (d.icon === 'boots') {
      polygon([[19, 8], [27, 8], [27, 18], [30, 20], [30, 26], [19, 26]], ink);
      polygon([[20, 9], [26, 9], [26, 19], [29, 21], [29, 25], [20, 25]], p.base);
      rect(6, 10, 5, 3, p.shine); rect(20, 10, 5, 3, p.light); rect(3, 23, 9, 2, p.dark); rect(20, 23, 9, 2, p.dark);
    }
    return;
  }
  if (d.icon === 'shield') {
    polygon([[5, 4], [26, 4], [26, 20], [22, 26], [16, 30], [9, 26], [5, 20]], '#4a4948');
    polygon([[7, 6], [24, 6], [24, 19], [20, 25], [16, 27], [11, 24], [7, 19]], p.base);
    for (const x of [10, 14, 18, 22]) line(x, 7, x, x > 18 ? 22 : 24, p.dark);
    rect(14, 8, 4, 16, '#a9b1b3'); rect(8, 14, 15, 4, '#a9b1b3'); rect(15, 10, 1, 13, '#e5e7df');
    for (const [x, y] of [[6, 5], [24, 5], [6, 18], [24, 18]]) rect(x, y, 2, 2, '#f0e7c4');
    return;
  }
  if (d.icon === 'ingot') {
    polygon([[3, 18], [9, 10], [23, 8], [29, 14], [28, 21], [9, 26], [3, 23]], p.outline);
    polygon([[5, 18], [10, 11], [23, 10], [27, 15], [10, 20]], p.light);
    polygon([[5, 20], [10, 22], [27, 16], [26, 21], [10, 24], [5, 22]], p.shadow);
    line(10, 12, 22, 11, p.shine, 2); line(10, 20, 26, 16, p.base, 2); return;
  }
  if (d.icon === 'gem' || d.icon === 'crystal') {
    if (d.icon === 'crystal') {
      for (const [x, y, h, w] of [[9, 11, 15, 8], [16, 3, 24, 10], [22, 14, 12, 6]]) {
        polygon([[x, y + 4], [x + w / 2, y], [x + w, y + 4], [x + w, y + h - 3], [x + w / 2, y + h], [x, y + h - 3]], p.outline);
        polygon([[x + 1, y + 5], [x + w / 2, y + 2], [x + w / 2, y + h - 2], [x + 1, y + h - 4]], p.light);
        polygon([[x + w / 2, y + 2], [x + w - 1, y + 5], [x + w - 1, y + h - 4], [x + w / 2, y + h - 2]], p.base);
      }
    } else {
      const isEmerald = id === 'emerald', outline = isEmerald ? [[10, 2], [23, 2], [28, 8], [26, 23], [21, 29], [9, 29], [4, 23], [5, 8]] : [[9, 4], [23, 4], [29, 12], [16, 29], [3, 12]];
      polygon(outline, p.outline); polygon(outline.map(([x, y]) => [16 + (x - 16) * .82, 16 + (y - 16) * .85]), p.base);
      if (isEmerald) { polygon([[11, 5], [21, 5], [24, 9], [22, 22], [19, 26], [11, 26], [7, 22], [8, 9]], p.light); rect(11, 8, 10, 13, p.base); rect(11, 8, 7, 3, p.shine); }
      else { polygon([[10, 6], [22, 6], [26, 12], [6, 12]], p.light); polygon([[6, 13], [14, 13], [16, 26]], p.shine); polygon([[16, 13], [26, 13], [17, 26]], p.shadow); line(13, 7, 10, 11, '#e1ffff', 2); }
    }
    return;
  }
  if (d.icon === 'chunk' || d.icon === 'rawOre' || d.icon === 'dust') {
    polygon([[5, 13], [9, 6], [19, 5], [26, 11], [29, 20], [23, 27], [11, 28], [3, 21]], d.icon === 'rawOre' ? '#535864' : p.outline);
    polygon([[7, 13], [10, 8], [18, 7], [24, 12], [26, 20], [21, 25], [12, 26], [6, 20]], d.icon === 'rawOre' ? '#7c7d80' : p.base);
    polygon([[9, 12], [13, 8], [18, 9], [16, 16], [10, 17]], d.icon === 'rawOre' ? '#a0a0a0' : p.light);
    if (d.icon === 'rawOre') for (const [x, y] of [[9, 12], [16, 9], [20, 15], [12, 20], [20, 22]]) { rect(x, y, 4, 3, p.base); rect(x, y, 2, 1, p.shine); rect(x + 2, y + 2, 2, 1, p.dark); }
    else if (d.icon === 'dust') { polygon([[5, 24], [10, 18], [15, 21], [20, 16], [28, 24], [23, 28], [9, 29]], p.shadow); rect(8, 21, 3, 2, p.shine); rect(19, 20, 3, 2, p.light); rect(14, 25, 2, 2, p.base); }
    else { line(10, 10, 15, 8, p.shine, 2); line(18, 17, 24, 20, p.dark, 2); }
    return;
  }
  if (d.icon === 'stick') { line(4, 26, 24, 6, '#4a3425', 4); line(5, 26, 24, 7, p.base, 2); line(6, 25, 24, 7, p.light); return; }
  if (d.icon === 'rail') {
    for (const y of [7, 14, 21, 27]) { rect(3, y, 26, 4, '#503a29'); rect(4, y, 24, 2, '#b17e49'); }
    for (const x of [7, 22]) { rect(x, 2, 4, 28, '#4a5359'); rect(x, 3, 3, 26, '#b5c3c8'); rect(x, 3, 1, 26, '#edf3ef'); for (const y of [8, 15, 22, 28]) rect(x + 1, y, 2, 1, '#707a81'); }
    return;
  }
  if (d.icon === 'torch') {
    polygon([[15, 2], [21, 8], [22, 15], [17, 20], [10, 15], [10, 9]], '#ce603a');
    polygon([[16, 5], [20, 10], [19, 15], [15, 17], [12, 12]], '#f5be43');
    rect(15, 10, 3, 5, '#fff0ab'); rect(13, 17, 6, 13, '#63492f'); rect(14, 18, 4, 11, '#b38b4e'); rect(14, 18, 1, 10, '#dec178'); return;
  }
  if (d.icon === 'apple') {
    polygon([[5, 11], [9, 7], [15, 9], [22, 7], [27, 11], [28, 20], [22, 28], [16, 26], [10, 28], [4, 21]], p.outline);
    polygon([[6, 12], [10, 9], [16, 11], [22, 9], [25, 13], [26, 20], [21, 26], [16, 24], [10, 26], [6, 20]], p.base);
    rect(9, 12, 4, 6, p.light); rect(10, 12, 2, 3, p.shine); line(20, 23, 24, 19, p.dark, 2);
    line(15, 9, 17, 4, '#61402e', 2); polygon([[17, 4], [22, 2], [26, 3], [23, 6], [18, 7]], '#5b9153');
    if (id === 'bakedApple') { line(15, 19, 20, 21, '#6e422d', 2); rect(13, 3, 1, 3, '#c0c6b4'); rect(11, 1, 1, 2, '#dce0d1'); }
    return;
  }
  if (d.icon === 'bowl' || d.icon === 'stew') {
    polygon([[3, 13], [7, 9], [24, 9], [29, 13], [27, 22], [22, 28], [10, 28], [5, 23]], '#61412c');
    polygon([[5, 14], [9, 12], [23, 12], [27, 14], [24, 23], [21, 26], [11, 26], [7, 22]], p.base);
    polygon([[5, 13], [9, 10], [23, 10], [27, 13], [23, 18], [9, 18]], d.icon === 'stew' ? '#d2a76a' : '#694930');
    line(8, 20, 12, 24, p.light, 2); line(14, 26, 21, 26, p.dark);
    if (d.icon === 'stew') { rect(9, 12, 4, 3, '#ba5a43'); rect(18, 12, 5, 3, '#845530'); rect(14, 15, 3, 2, '#6f8b47'); rect(17, 8, 1, 2, '#dcd9c5'); rect(16, 5, 1, 2, '#e6e3d6'); }
    return;
  }
  if (d.icon === 'mushroom') {
    rect(13, 14, 6, 15, '#b69c80'); rect(14, 16, 3, 11, '#eee0bb');
    polygon([[2, 14], [5, 7], [12, 3], [20, 3], [27, 8], [30, 16], [24, 19], [7, 18]], '#763f3a');
    polygon([[4, 13], [7, 8], [12, 5], [20, 5], [25, 9], [28, 15], [22, 17], [8, 16]], p.base);
    for (const [x, y] of [[8, 10], [14, 6], [21, 11], [14, 14]]) rect(x, y, 3, 2, '#f1ddc3'); return;
  }
  if (d.icon === 'cactus') {
    rect(11, 3, 11, 27, '#315a38'); rect(12, 5, 9, 24, p.base); rect(13, 5, 2, 23, p.light); rect(18, 5, 2, 24, p.dark);
    rect(4, 12, 7, 6, p.shadow); rect(4, 8, 4, 10, p.base); rect(22, 18, 7, 5, p.shadow); rect(25, 12, 4, 11, p.base);
    for (const [x, y] of [[11, 8], [17, 10], [13, 15], [18, 20], [13, 25], [5, 10], [26, 16]]) rect(x, y, 2, 2, '#d4d9a1'); return;
  }
  if (d.icon === 'paper' || d.icon === 'book' || d.icon === 'map') {
    if (d.icon === 'book') {
      polygon([[5, 7], [21, 3], [28, 9], [28, 25], [11, 29], [5, 24]], '#513c31');
      polygon([[7, 9], [22, 6], [26, 10], [12, 14]], '#f3e4c6'); polygon([[12, 15], [26, 11], [26, 24], [12, 27]], p.base);
      line(8, 10, 8, 23, p.light, 2); line(15, 19, 23, 17, '#e9c487', 2); line(15, 22, 21, 20, '#e9c487');
    } else {
      polygon([[6, 3], [24, 3], [27, 7], [27, 29], [4, 29], [4, 7]], '#8f8273'); rect(6, 5, 18, 22, p.base); rect(6, 5, 2, 22, p.shine); polygon([[24, 4], [27, 8], [23, 8]], p.shadow);
      if (d.icon === 'map') { polygon([[8, 7], [14, 9], [17, 7], [22, 9], [22, 23], [17, 21], [14, 24], [8, 22]], '#96a271'); line(11, 10, 14, 15, '#7aafd0', 2); line(14, 15, 12, 23, '#7aafd0', 2); rect(18, 14, 2, 2, '#a37153'); line(8, 25, 20, 25, '#a99569'); }
      else for (const y of [10, 14, 18, 22]) rect(10, y, y === 22 ? 8 : 12, 1, '#c2bbae');
    }
    return;
  }
  if (d.icon === 'compass' || d.icon === 'clock') {
    const rim = [[10, 2], [22, 2], [29, 9], [29, 23], [22, 30], [10, 30], [3, 23], [3, 9]];
    polygon(rim, p.outline); polygon(rim.map(([x, y]) => [16 + (x - 16) * .85, 16 + (y - 16) * .85]), p.base);
    polygon([[11, 7], [21, 7], [25, 11], [25, 21], [21, 25], [11, 25], [7, 21], [7, 11]], '#4f5d6a');
    if (d.icon === 'compass') { polygon([[17, 7], [20, 18], [16, 16], [12, 15]], '#f17d65'); polygon([[12, 15], [16, 16], [20, 18], [13, 25]], '#e2e3dd'); rect(15, 15, 3, 3, '#ecdb9b'); }
    else { polygon([[9, 15], [12, 9], [21, 9], [24, 15]], '#82c4d2'); rect(10, 16, 13, 6, '#263549'); rect(15, 9, 3, 3, '#f9df93'); rect(13, 12, 7, 1, '#f9df93'); rect(20, 19, 2, 2, '#d8e4eb'); line(16, 16, 16, 10, '#ffffff'); line(16, 16, 21, 18, '#ffffff'); }
    rect(8, 7, 4, 2, p.shine); rect(5, 11, 2, 5, p.light); return;
  }
}

/** A cached, transparent canvas. Callers may display it, but should not paint into it. */
export function drawItemIcon(key, size = 32) {
  const d = itemDefs[key];
  if (!d) throw new RangeError('Unknown item: ' + key);
  if (!Number.isInteger(size) || size < 1 || size > 512) throw new RangeError('Icon size must be an integer from 1 to 512.');
  const cacheKey = key + ':' + size;
  if (canvasCache.has(cacheKey)) return canvasCache.get(cacheKey);
  if (typeof document === 'undefined') throw new Error('Item artwork requires a browser canvas.');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  const sprite = itemAtlasSprites.get(key);
  if (sprite) {
    const { cell, cols, rows, width, height, image } = sprite, w = width / cols, h = height / rows;
    g.drawImage(image, (cell % cols) * w, Math.floor(cell / cols) * h, w, h, 0, 0, size, size);
  }
  else if (size === 32) paintItem(g, key, d);
  else g.drawImage(drawItemIcon(key, 32), 0, 0, size, size);
  canvasCache.set(cacheKey, canvas);
  return canvas;
}
