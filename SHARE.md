# 友だちに送る方法

次の公開リンクを、そのままLINEやメールなどで送れば遊べます。

**https://yuseimorishima.github.io/morishi.github.io-minecraft-/**

新しい版が表示されないときは、ページを再読み込みしてください。今回の版には、移動先へ広がる8バイオーム、鉱脈・構造物、装備とクラフト、ChatGPTで生成したアイテム画像が入っています。

保存データは各自のブラウザ内にあります。終了前に「保存」を押してください。

## HTMLファイルを送る

`index.html` をファイルとして送ることもできます。受け取った人は保存したHTMLを、PCのChrome・Edge・FirefoxなどWebGL対応ブラウザで開いてください。ほかのファイルや外部通信は必要ありません。スマホでは公開リンクを使う方法がおすすめです。

## 公開設定

このリポジトリのGitHub Pagesは `main` ブランチの `/ (root)` を公開します。組み込み済みHTMLと `.nojekyll` を含むため、GitHub Pages側でゲームをビルドする必要はありません。

開発時は `python3 scripts/build_html.py` でHTMLを更新し、`main` に反映します。
