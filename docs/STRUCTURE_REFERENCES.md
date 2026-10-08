# 構造物の参考資料と今回の独自設計

調査日: 2026-10-08（日本時間）

ユーザーの「マインクラフト王略などのYouTubeチャンネル」は、チャンネル名または「マインクラフト攻略」の表記である可能性があります。正確なチャンネルを特定できていないため、特定の投稿者の作品を参照・再現したとは扱いません。

## 外部資料の確認状況

この環境では YouTube、Google 検索、Minecraft.net への HTTPS 接続が CONNECT プロキシで HTTP 403 になりました。動画や記事の本文は取得できていません。アクセス制限や証明書検証を回避していません。

| 確認した取得先 | 結果 |
| --- | --- |
| [YouTube: Minecraft Japan / 構造物の検索](https://www.youtube.com/results?search_query=Minecraft+Japan+%E6%A7%8B%E9%80%A0%E7%89%A9) | HTTP 403、動画・チャンネル未確認 |
| [Google: Minecraft structures youtube official](https://www.google.com/search?q=Minecraft+structures+youtube+official) | HTTP 403、検索結果未確認 |
| [Minecraft.net の記事候補](https://www.minecraft.net/en-us/article/block-week--village) | HTTP 403、記事の存在・本文とも未確認 |

以下は、閲覧可能な環境で後から調べられる資料候補です。この更新で閲覧・検証した資料ではありません。

- [Minecraft 公式 YouTube のチャンネル候補](https://www.youtube.com/@minecraft)
- [YouTube: マインクラフト 攻略 村 砂漠寺院 廃坑](https://www.youtube.com/results?search_query=%E3%83%9E%E3%82%A4%E3%83%B3%E3%82%AF%E3%83%A9%E3%83%95%E3%83%88+%E6%94%BB%E7%95%A5+%E6%9D%91+%E7%A0%82%E6%BC%A0%E5%AF%BA%E9%99%A2+%E5%BB%83%E5%9D%91)
- [Minecraft Wiki: Structure](https://minecraft.wiki/w/Structure)
- [Minecraft Wiki: Village](https://minecraft.wiki/w/Village)
- [Minecraft Wiki: Desert pyramid](https://minecraft.wiki/w/Desert_pyramid)
- [Minecraft Wiki: Jungle pyramid](https://minecraft.wiki/w/Jungle_pyramid)
- [Minecraft Wiki: Igloo](https://minecraft.wiki/w/Igloo)
- [Minecraft Wiki: Mineshaft](https://minecraft.wiki/w/Mineshaft)
- [Minecraft Wiki: Trail ruins](https://minecraft.wiki/w/Trail_Ruins)
- [Minecraft Wiki: Ocean ruins](https://minecraft.wiki/w/Ocean_Ruins)

## 実装のための独自設計案

次の案は、Minecraft の一般的な構造物の種類を手掛かりに、このゲームのブロック、移動、採掘、クラフト、線路の仕組みへ合わせたオリジナルの設計です。動画の設計図、画像、テクスチャ、音源を取り込んでいません。公式の構造物と寸法、配色、配置、入手品が一致することは目標にしません。

| バイオーム・場所 | 構造物案 | ブロックで表現する特徴 | 探索と製作につながる使い方 |
| --- | --- | --- | --- |
| 平原 | 旅人の小村 | 3〜5軒の木造住宅、道、畑、共同井戸、窓、切妻屋根 | 作業台・かまど・チェストを見つけて拠点にし、村同士を線路で結ぶ |
| 砂漠 | 風砂の神殿 | 砂岩の台座、左右の塔、中央の階段、半分埋まった地下室 | 砂を掘って入口や宝物室を発見する。金やレール素材を置く |
| ジャングル | 苔むした遺跡 | 段状の石壁、欠けた柱、つるを思わせる葉、狭い地下通路 | 岩壁を掘って通路を見つけ、苔石を建築材として回収する |
| 雪原 | 氷雪の小屋 | 雪の丸みを段積みで表した外壁、木の床、暖炉、地下収納 | 寒冷地で一息つける拠点。石炭・木材・食料を用意する |
| 森・丘陵 | 木の見張り塔 | 4本の柱、回り階段、手すり、広い展望台 | 周囲の地形や別の構造物を見つける目印にする |
| 高い山 | 古い石の塔 | 石の土台、崩れた上階、山肌の階段、窓のある部屋 | 高所まで線路を敷く目標にし、山の鉱脈につなぐ |
| 地下の洞窟 | 放棄された坑道 | 木の支柱と梁、残ったレール、分岐、作業場、資材箱 | 支柱を目印に鉱脈を探し、残存レールを自作線路へ接続する |
| 深い地底 | 地底の遺跡 | 深層石の床、欠けたアーチ、埋まった小部屋、鉱脈の露出 | ダイヤモンドや金の探索目標。掘削で初めて発見する場所も作る |
| 海岸・湿地 | 水際の石の遺跡 | 低い石壁、崩れた柱、砂に埋もれた床、浅い水 | ガラス用の砂やチェストを見つけ、橋と線路を建てる |

### 地形への置き方

- 地形のバイオームと高さから構造物の候補を決め、ワールド座標を使った乱数で配置を固定する。
- 構造物の中心のある区画を所有者にし、隣の区画へはみ出しても重複して生成しない。
- 隣の区画との境界をまたぐ家・坑道・道は、同じ生成規則と座標でつながるようにする。
- 住宅や作業場は入口と頭上2ブロックの空間を確保する。見た目の箱だけにせず内部へ歩いて入れるようにする。
- 目印になる地上構造物と、掘削で発見する地底構造物を用意する。地底全体を地上から開いた穴で置き換えない。
- 宝箱はワールド座標から中身を決め、回収したアイテムと編集した建物は移動・保存・再読込で保持する。

今後、ユーザーが具体的なチャンネルURLや動画URLを指定した場合は、その資料の利用可能な範囲で構造の特徴を確認し、この記録に追記できます。
