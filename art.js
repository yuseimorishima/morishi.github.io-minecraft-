// These two sheets were generated with ChatGPT image generation for this game.
export const generatedArtSheets = [
  {
    src: 'assets/equipment-atlas.png', cols: 8, rows: 8,
    mapping: 'woodPick stonePick ironPick goldPick diamondPick emeraldPick woodAxe stoneAxe ironAxe goldAxe diamondAxe emeraldAxe woodShovel stoneShovel ironShovel goldShovel diamondShovel emeraldShovel woodSword stoneSword ironSword goldSword diamondSword emeraldSword woodHelmet woodChestplate woodLeggings woodBoots ironHelmet ironChestplate ironLeggings ironBoots goldHelmet goldChestplate goldLeggings goldBoots diamondHelmet diamondChestplate diamondLeggings diamondBoots emeraldHelmet emeraldChestplate emeraldLeggings emeraldBoots shield compass clock map coal ironOre goldOre copperOre iron gold copper diamond emerald redstone lapis amethyst stick apple goldenApple torch'.split(' '),
  },
  {
    src: 'assets/materials-atlas.png', cols: 8, rows: 5,
    mapping: 'dirt stone log leaves plank sand glass snow moss table furnace chest clay brickBlock bookshelf obsidian basalt pineLog pineLeaves jungleLog jungleLeaves redSand ice wool cactus mushroom smoothStone charcoal ironBlock goldBlock copperBlock diamondBlock emeraldBlock rail bakedApple bowl mushroomStew paper book brick'.split(' '),
  },
];
export async function loadGeneratedArt(register,onSheet){
 await Promise.all(generatedArtSheets.map(sheet=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{register(image,sheet.mapping,sheet.cols,sheet.rows);onSheet?.(sheet);resolve();};image.onerror=()=>reject(Error('Artwork unavailable'));image.src=sheet.src;
 })));
}
