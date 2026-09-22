#!/bin/sh
# 3つの SQL を1ファイルに繋げる。SQL Editor に貼る回数を1回にするため。
#   sh scripts/gen-setup-sql.sh
# seed.sql を作り直したあと（npm run gen:seed）はこれも流す。
set -e
cd "$(dirname "$0")/.."
{
  echo "-- 過去問ルーレットのデータベース初期設定。これ1つを SQL Editor に貼って Run するだけでいい。"
  echo "--"
  echo "-- supabase/migrations/0001_init.sql, 0002_history.sql, seed.sql を繋げたもの。"
  echo "-- scripts/gen-setup-sql.sh が生成する。手で編集しない。"
  echo "-- 何度実行しても同じ結果になるので、失敗したら貼り直していい。"
  echo ""
  for f in supabase/migrations/0001_init.sql supabase/migrations/0002_history.sql supabase/seed.sql; do
    echo ""
    echo "-- ======================================================================"
    echo "-- $f"
    echo "-- ======================================================================"
    echo ""
    cat "$f"
  done
} > supabase/setup.sql
echo "supabase/setup.sql を生成: $(wc -l < supabase/setup.sql)行"
