# アイテム画像

このフォルダーの画像は、今回のゲーム用に ChatGPT の画像生成ツールで新規に生成したオリジナルのスプライトです。Minecraft の公式画像や外部のテクスチャパックを取り込んでいません。

- `equipment-atlas.png`: 道具、防具、鉱物など。8列 × 8行、64種類。
- `materials-atlas.png`: ブロック、建材、食料など。8列 × 5行、40種類。

アイテムの対応は左から右、上から下です。画像生成の出力サイズが異なる場合にも、`setItemAtlas()` は画像の実際の幅と高さをグリッド数で割って切り出します。2枚の登録は蓄積され、後から登録したアトラスが別のアトラスを消しません。同じアイテム ID を再登録した場合のみ、そのアイテムの表示を更新します。

`scripts/build_html.py` により、画像も単体の `index.html` に埋め込まれます。外部画像のダウンロードは必要ありません。アトラスに登録されていないアイテムには、`items.js` で描画する独自の32ピクセル画像を使います。

## equipment-atlas.png

```text
woodPick       stonePick       ironPick       goldPick       diamondPick       emeraldPick       woodAxe       stoneAxe
ironAxe        goldAxe         diamondAxe     emeraldAxe     woodShovel        stoneShovel       ironShovel    goldShovel
diamondShovel  emeraldShovel   woodSword      stoneSword     ironSword         goldSword         diamondSword  emeraldSword
woodHelmet     woodChestplate  woodLeggings   woodBoots      ironHelmet        ironChestplate    ironLeggings  ironBoots
goldHelmet     goldChestplate  goldLeggings   goldBoots      diamondHelmet     diamondChestplate diamondLeggings diamondBoots
emeraldHelmet  emeraldChestplate emeraldLeggings emeraldBoots shield           compass           clock         map
coal           ironOre         goldOre        copperOre      iron              gold              copper        diamond
emerald        redstone        lapis          amethyst       stick             apple             goldenApple   torch
```

## materials-atlas.png

```text
dirt          stone         log           leaves       plank         sand       glass        snow
moss          table         furnace       chest        clay          brickBlock bookshelf    obsidian
basalt        pineLog       pineLeaves    jungleLog    jungleLeaves  redSand    ice          wool
cactus        mushroom      smoothStone   charcoal     ironBlock     goldBlock  copperBlock  diamondBlock
emeraldBlock  rail          bakedApple    bowl         mushroomStew  paper      book         brick
```

## terrain-atlas.png

ChatGPTの画像生成で新規作成した、地形用の4×4アトラス。公式テクスチャは使用していません。
左上から草、土、石、草側面／丸石、木材、樹皮、年輪／葉、砂、深層岩、黒曜石／レンガ、雪、本棚、羊毛。
実行時に各タイルを16×16へ切り出して最近傍表示し、鉱石には識別しやすい独自の鉱物模様を重ねます。単体HTMLにも画像を内蔵します。
