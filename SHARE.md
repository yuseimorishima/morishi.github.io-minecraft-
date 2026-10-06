# 友だちに送る方法

## ファイルで送る（公開設定不要）

`index.html` をダウンロードして、LINE、メールなどにファイルとして添付してください。友だちは保存したHTMLをPCのChrome、Edge、FirefoxなどのWebGL対応ブラウザで開けば遊べます。他のファイルは必要ありません。

このチャットのファイルリンクは、ゲームを一般公開するWebサイトのURLではありません。チャットのリンクだけを友だちへ転送する代わりに、HTMLそのものを送ってください。

## リンクを開くだけで遊べるようにする（GitHub Pages）

このリポジトリに完成版を反映したあと、管理権限のあるGitHubアカウントで次の設定を行います。

1. リポジトリの **Settings → Pages** を開く。
2. **Source** を **Deploy from a branch** にする。
3. **Branch** を **main**、フォルダを **/ (root)** にし、**Save**。
4. Pagesの画面で公開完了を確認し、表示されたサイトURLを友だちへ送る。

公開後の標準URLは次のとおりです。サイトが公開されるまでは遊べるリンクになりません。

`https://yuseimorishima.github.io/morishi.github.io-minecraft-/`

HTMLは事前に組み込み済みで、`.nojekyll` も含まれています。GitHub Pages側でゲームをビルドする必要はありません。
