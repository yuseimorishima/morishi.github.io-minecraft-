import { BLOCKS as B } from './world.js';
const rock=new Set([B.STONE,B.DEEP,B.COAL,B.IRON,B.GOLD,B.COBBLE,B.RUIN,B.FURNACE,B.GLOW,B.DIAMOND,B.EMERALD,B.REDSTONE,B.LAPIS,B.COPPER,B.OBSIDIAN,B.BASALT,B.BRICK,B.COPPER_BLOCK,B.IRON_BLOCK,B.GOLD_BLOCK,B.DIAMOND_BLOCK,B.EMERALD_BLOCK]);
const timber=new Set([B.WOOD,B.SNOW_LOG,B.JUNGLE_LOG,B.PLANK,B.TABLE,B.CHEST,B.ROOF,B.BOOKSHELF]);
const soil=new Set([B.DIRT,B.GRASS,B.SAND,B.SNOW,B.RED_SAND,B.CLAY]);
const foliage=new Set([B.LEAVES,B.PINE_LEAVES,B.JUNGLE_LEAVES,B.MUSHROOM]);
export function miningProfile(type,tool=null,creative=false){
 const category=rock.has(type)?'pick':timber.has(type)?'axe':soil.has(type)?'shovel':foliage.has(type)?'sword':'hand';
 const base=type===B.OBSIDIAN?24:rock.has(type)?4.8:timber.has(type)?1.6:foliage.has(type)?.24:type===B.TORCH?.16:.8;
 const efficiency=tool?.tool===category?Math.max(1,tool.speed):1;
 return {category,time:creative?.06:base/efficiency,harvest:true};
}
