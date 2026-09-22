# 過去問ルーレット

通話中の友達と同じ画面でルーレットを回し、「大学 × 年度 × 科目」を1タップで決めて、
そのまま時間計測・自己採点まで流す Web アプリ。

仕様は [SPEC.md](./SPEC.md)。この README は動かし方だけ。

現在の実装範囲は **F1〜F10 と F12**。F11（復習キュー）は見送り。

## 構成

- Next.js 15（App Router）+ TypeScript、静的書き出し（`output: "export"`）
- Supabase（Postgres + Realtime）
- GitHub Pages に自動デプロイ（main への push で `.github/workflows/deploy.yml` が走る）

公開URL: <https://s70rm3892.github.io/random-kakomon/>

静的ホスティングなのでサーバー側のルーティングが無い。ルームIDはパスではなくクエリで渡す
（招待リンクは `.../room/?id=<uuid>`）。

抽選の乱数はブラウザではなく Postgres の関数 `draw_exam_set` が1回だけ引き、
結果を `draws` に保存する。各端末は Realtime で保存済みの結果を受け取るだけなので、
全員に必ず同じ結果が出る。`draws` への INSERT は RLS で塞いであり、この関数以外からは書けない。

タイマーは「開始時刻」と「一時停止中の累計」だけを共有し、残り時間は各端末が計算する。
端末ごとの時計ズレは `server_now()` との差分で補正する。

## セットアップ

1. Supabase でプロジェクトを作る（[ダッシュボード](https://supabase.com/dashboard) > New project）
2. **SQL Editor** に [`supabase/setup.sql`](supabase/setup.sql) を貼って実行する

   テーブル・関数・RLS・Realtime・データ（大学12件、過去問315件）が全部入る。
   何度流しても同じ結果になるので、失敗したら貼り直していい。
   最後に大学ごとの件数（合計315件）が表示されれば成功。

   コピーは GitHub の **Raw** を開いてから全選択する。
   通常のファイル表示は画面外の行を描画せず、途中までしかコピーされないことがある。

3. Supabase の **Settings > API Keys** から Publishable key（`sb_publishable_...`）をコピーして、
   `.env.local`（ローカル）か GitHub の Variables（デプロイ）に入れる

   プロジェクト URL は `src/lib/supabase.ts` に直接書いてある（秘密ではないため）。
   別のプロジェクトに向けたいときだけ `NEXT_PUBLIC_SUPABASE_URL` を設定する。

`supabase/setup.sql` は3つの SQL を繋げたもの。中身を変えるときは元のファイルを直して
`npm run gen:seed`（seed を作り直す場合）と `sh scripts/gen-setup-sql.sh` を流す。
問題データを足したら `npm run gen:seed` で作り直して、SQL Editor に貼り直す。

ローカルに Node がある場合は、SQL Editor の代わりに `npm run seed` でも入れられる。
そちらは `SUPABASE_SERVICE_ROLE_KEY`（`sb_secret_...`）が要る。

## 公開（GitHub Pages）

リポジトリの Settings > Secrets and variables > Actions > Variables に2つ入れる。

| 名前 | 値 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の公開用キー（`sb_publishable_...`。古いプロジェクトは `eyJ...` の anon キー）。`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` という名前でも読む |

入れたら main に push するだけでビルドとデプロイが走る。Settings > Pages の Source が
「GitHub Actions」になっていない場合はワークフローが自動で有効化を試みる。失敗したら手で切り替える。

キーが未設定でもサイト自体は公開される（画面に「Supabase のキーが未設定」と出る）。
あとから Variables を入れて Actions の画面でワークフローを re-run すれば、そのまま動くようになる。

### キーの形について

Supabase は API キーの形式を移行中で、どちらが出るかはプロジェクトの作成時期で変わる。

| 用途 | 新しい形 | 古い形 |
| --- | --- | --- |
| 公開用（このアプリが使う） | `sb_publishable_...` | `anon` キー（`eyJ...`）|
| 秘密（`npm run seed` だけが使う） | `sb_secret_...` | `service_role` キー（`eyJ...`）|

publishable キーは anon キーと同じ低権限で、RLS の挙動も同じ。そのまま差し替えて使える。
どちらの形でもこのアプリは動く。

公開用のキーはブラウザに配られる前提の値で、秘密にはできない（どのホスティングでも同じ）。
アクセス制御は RLS 側でやる。**秘密のキー（`sb_secret_...` / `service_role`）は絶対にここに入れない。**

### 承知のうえの割り切り

ログインを入れていないので、RLS は「anon がルーム・メンバー・結果を読み書きできる」
という粒度にしてある。公開URLとanonキーが揃えば、第三者が他人のルームの表示名と自己採点を
読める。入るのがニックネームと自己採点の点数だけなので、この規模では割り切る。
本名や他人に見せたくない情報は入れない。

抽選の公平性とタイマーだけは、この割り切りの外に置いてある（`draws` への直接 INSERT は
RLS で禁止し、`draw_exam_set` 関数以外から書けない）。

## 使い方

1. トップで表示名を入れて「ルームを作る」
2. 出てきた招待リンクを通話チャットに貼る
3. ロビーで大学・科目・年度範囲・重み・抽選の粒度をホストが決める
4. 「ルーレットを回す」→ 全員の画面に同じ結果が出る
5. 各自が入手元リンクで問題を開き、ホストが「全員でタイマー開始」
6. 終了後、大問ごとの自己採点と失点原因を入力する。全員の点数は同じ画面に並んで出る
7. トップの「履歴を見る」で、科目別の平均得点率・失点原因の割合・京大過去問の消化率を確認する

履歴はログインではなく端末に保存した匿名IDで紐づける。端末を変えると引き継がれない。
ルーレットの効果音は音声ファイルではなく WebAudio で鳴らしていて、画面上のボタンで切り替えられる。
`prefers-reduced-motion` が有効な環境ではアニメーションを飛ばす。

## 過去問データについて

問題PDFは保存も配布もしない。入手元へのリンクだけを持つ（SPEC「過去問の入手元と著作権の扱い」）。

`src/data/catalog.ts` の制限時間・大問数には必ず出典URLを付ける。出典のない数字は入れない。
京大工学部の配点と試験時間は京大公式の配点予告PDFと令和7年度入学者選抜要項で確認済み。

現在のマスタは京大工学部の数学・英語・物理・化学と、他9大学の理系数学（2005〜2025年度）。

## 自分でやる作業

- [ ] Supabase のプロジェクト作成とキー発行
- [ ] キーを GitHub の Actions Variables に入れる
- [ ] 京大工学部の ExamSet を公式資料と再照合（`src/data/catalog.ts` のコメントに根拠を書いてある）
