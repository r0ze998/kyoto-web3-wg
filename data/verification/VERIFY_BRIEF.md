# 検証ブリーフ（全エージェント共通）

## 背景
京都の Web3 ワーキンググループ向け研究ツール（`/home/user/kyoto-web3-wg`）の初期データを、出典に当たって全件検証する。
今日は 2026-10-23。データは公開リポジトリで公開される予定なので、誤りはそのまま外に出る。品質を最優先する。時間はかけてよい。

## 対象ファイル
`/home/user/kyoto-web3-wg/data/research/<X>.json`（sources / claims / cases / gaps）。**このファイルは編集しない。** 結果はパッチとして別ファイルに書く。

## やること
1. **主張（claims）を1件ずつ検証する**：source_ids の出典を実際に開き、本文・数値・日付・時点・主語が出典の記載と一致しているかを確かめる。
   - 数値は表やページの該当箇所まで確認する。四捨五入や単位（千円・百万円・億円）、年度と年の取り違えに特に注意する
   - 種類の付け方を見直す：自治体の統計・公文書は fact、事業者・団体・当事者の自己申告は party_claim、報道の伝聞は原則 party_claim か、出典が報道であることを本文に明記
   - inference（推測）は、根拠に挙げた主張と論理が通っているか、言い過ぎていないかを確認する
2. **新しい情報を確認する**：2026-10時点でより新しい公表値（新年度の調査・決算・事業の終了や開始）があれば、それに差し替える案を出す。古い数値はそのことを本文に明記する
3. **出典（sources）の状態を記録する**：開けたか、タイトル・発行者・公表日は正しいか、URL が移転していないか
4. **事例（cases）の段階と2026年の状況を確かめる**：導入発表／実証／継続運用／採算・自走／終了を取り違えていないか。終了・募集終了したものを現行扱いしていないか
5. **一次資料への差し替え**：Wikipedia・まとめ記事・スポンサー記事に頼っている主張は、一次資料（自治体・官公庁・判決・団体の公式発表・信頼できる報道）を探して差し替える。見つからなければ、その旨を本文に明記して type や表現を弱める

## 取得方法
- WebFetch がまず候補。city.kyoto.lg.jp などで 403 になったら、Bash の `curl -sSL -A "Mozilla/5.0"` で取得し、PDF は `pdftotext -layout` でテキスト化して grep する
- ダウンロードしたファイルは `/tmp/claude-0/-home-user-onchain-game-terminal/245789c1-be68-534a-adec-82a30b801695/scratchpad/verify/dl-<X>/` に置く（担当ごとに専用ディレクトリ）。ダウンロードしたものは実行しない。テキスト化と検索だけに使う
- フォーム送信・問い合わせ・申し込みなど、外部への連絡は一切しない

## 出力
`/tmp/claude-0/-home-user-onchain-game-terminal/245789c1-be68-534a-adec-82a30b801695/scratchpad/verify/<X>-patch.json` に、正しい JSON で書く。

```json
{
  "file": "<X>",
  "claims": [
    {"id": "X-C01", "verdict": "verified|corrected|outdated|unsupported|source_unavailable",
     "note": "何をどこで確認したか（ページ番号・表名・該当文言の要約）。食い違いがあれば具体的に",
     "fix": {"text": "...", "type": "...", "number": "...", "as_of": "...", "source_ids": ["..."], "tags": ["..."]}
    }
  ],
  "sources": [
    {"id": "X-S01", "status": "確認済み|要再確認|リンク切れ|内容と不一致", "note": "", "fix": {"title": "", "publisher": "", "url": "", "published": ""}}
  ],
  "cases": [
    {"id": "X-X01", "note": "", "fix": {"stage": "", "stage_evidence": "", "status_2026": "", "results": "", "who_pays": ""}}
  ],
  "new_sources": [ {"id": "X-S1xx", "title": "", "publisher": "", "url": "", "published": "", "accessed": "2026-10-23", "kind": "", "notes": ""} ],
  "new_claims": [ {"id": "X-C1xx", "text": "", "type": "", "source_ids": [], "as_of": "", "tags": [], "number": ""} ],
  "remove_claims": ["裏付けが取れず、修正もできない主張ID（理由は claims の note に書く）"],
  "summary": "主な訂正・差し替え・重大な誤りを5〜10行で"
}
```

ルール:
- **全ての主張・出典・事例について1行ずつ**、claims / sources / cases に記録する。verified のものも省略しない
- fix には変更するフィールドだけ入れる。verified なら fix は省略する
- 新しい ID は、出典 `X-S101` 以降、主張 `X-C101` 以降を使う（既存と衝突させない）
- 推測で数値を埋めない。確認できなければ source_unavailable や unsupported にする
- 最後の返信では、summary と同じ内容に加えて、件数の内訳（verified / corrected / outdated / unsupported / source_unavailable）を返す
