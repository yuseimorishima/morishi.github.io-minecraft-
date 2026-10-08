# 友だちに送る方法

次の公開リンクを、そのままLINEやメールなどで送れば遊べます。

**https://yuseimorishima.github.io/morishi.github.io-minecraft-/**

新しい版が表示されないときは、ページを再読み込みしてください。今回の版には、WASD移動、画面長押し採掘、整理したホーム画面、夜に自律移動するゾンビとスライム、松明による拠点の保護が入っています。8バイオーム、装備・クラフト、ChatGPTで生成した画像も引き続き遊べます。

保存データは各自のブラウザ内にあります。終了前に「保存」を押してください。

## HTMLファイルを送る

`index.html` をファイルとして送ることもできます。受け取った人は保存したHTMLを、PCのChrome・Edge・FirefoxなどWebGL対応ブラウザで開いてください。ほかのファイルや外部通信は必要ありません。スマホでは公開リンクを使う方法がおすすめです。

## 公開設定

このリポジトリのGitHub Pagesは `main` ブランチの `/ (root)` を公開します。組み込み済みHTMLと `.nojekyll` を含むため、GitHub Pages側でゲームをビルドする必要はありません。

開発時は `python3 scripts/build_html.py` でHTMLを更新し、`main` に反映します。
