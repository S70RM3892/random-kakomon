-- 過去問ルーレットのデータベース初期設定。これ1つを SQL Editor に貼って Run するだけでいい。
--
-- supabase/migrations/0001_init.sql, 0002_history.sql, seed.sql を繋げたもの。
-- scripts/gen-setup-sql.sh が生成する。手で編集しない。
-- 何度実行しても同じ結果になるので、失敗したら貼り直していい。


-- ======================================================================
-- supabase/migrations/0001_init.sql
-- ======================================================================

-- 過去問ルーレット MVP (F1〜F8) のスキーマ
-- SPEC.md「データモデル」に対応する。Supabase の SQL Editor に貼って実行する。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- マスタ

create table if not exists universities (
  id             text primary key,            -- 'kyoto', 'tokyo' ...
  name           text not null,
  short_name     text not null,
  default_weight integer not null default 1 check (default_weight > 0),
  sort_order     integer not null default 100
);

-- 1セット = 1大学 × 1学部 × 1年度 × 1科目
create table if not exists exam_sets (
  id             uuid primary key default gen_random_uuid(),
  university_id  text not null references universities(id) on delete cascade,
  faculty        text not null,               -- 配点は学部で違うので学部単位で持つ
  year           integer not null,            -- 実施年度（西暦）
  curriculum     text not null default 'new' check (curriculum in ('old', 'new')),
  subject        text not null,               -- 'math' | 'physics' | 'chemistry' | 'science' | 'english' | 'japanese'
  subject_label  text not null,
  duration_min   integer not null check (duration_min > 0),  -- その年度当時の制限時間
  question_count integer not null check (question_count > 0),
  question_points integer[],                  -- 大問ごとの配点。不明なら null
  total_points   integer,                     -- 素点の満点。学部換算配点とは別物
  has_solution   boolean not null default false,
  access_url     text,                        -- 問題を開く先（東進DB・大学公式など）
  source_url     text not null,               -- 制限時間・大問数の出典。出典なしは入れない
  created_at     timestamptz not null default now(),
  unique (university_id, faculty, year, subject)
);

create index if not exists exam_sets_pool_idx
  on exam_sets (university_id, subject, year);

-- ---------------------------------------------------------------- ルーム

create table if not exists rooms (
  id                uuid primary key default gen_random_uuid(),
  host_member_id    uuid,                     -- members を後から参照（循環のため FK なし）
  status            text not null default 'waiting'
                      check (status in ('waiting', 'drawn', 'running', 'finished')),
  -- 候補プール(F2)。{ "universities": [...], "subjects": [...], "year_from": 2005, "year_to": 2025 }
  pool              jsonb not null default '{}'::jsonb,
  -- 重み(F4)。ルーム共通。{ "kyoto": 10, "tokyo": 4, ... } 未指定は universities.default_weight
  weights           jsonb not null default '{}'::jsonb,
  -- 重複回避(F5)。'off' | 'self'（自分が解いた分）| 'room'（ルームで出た分）
  avoid_duplicates  text not null default 'room'
                      check (avoid_duplicates in ('off', 'self', 'room')),
  -- 抽選の粒度(F3)。'set' = 1年度まるごと / 'question' = 大問1問
  draw_granularity  text not null default 'set'
                      check (draw_granularity in ('set', 'question')),
  current_draw_id   uuid,
  -- 共通タイマー(F6)。開始時刻と一時停止の累計を共有し、残り時間は各端末で計算する
  timer_started_at  timestamptz,
  timer_paused_at   timestamptz,
  timer_paused_ms   bigint not null default 0,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '24 hours'
);

create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 20),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists members_room_idx on members (room_id);

-- 抽選ログ。F5 の重複回避もここを見る
create table if not exists draws (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  question_no integer,                        -- 大問単位のときだけ入る
  is_redraw   boolean not null default false,
  drawn_at    timestamptz not null default now()
);

create index if not exists draws_room_idx on draws (room_id, drawn_at desc);

create table if not exists results (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  draw_id     uuid not null references draws(id) on delete cascade,
  scores      jsonb not null default '[]'::jsonb,   -- 大問ごとの自己採点 [3, 0, 5, ...]
  elapsed_sec integer,
  miss_tags   text[] not null default '{}',         -- 計算ミス/方針不明/時間切れ/知識不足
  note        text,
  created_at  timestamptz not null default now(),
  unique (member_id, draw_id)
);

create index if not exists results_draw_idx on results (draw_id);

-- F11（2版目）用。MVP では書き込まないがスキーマだけ先に置く
create table if not exists review_items (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  exam_set_id uuid not null references exam_sets(id) on delete cascade,
  question_no integer,
  due_on      date not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- 関数

-- 端末ごとの時計ズレを補正するために使う
create or replace function server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

-- F3: 抽選。サーバー側で1回だけ乱数を引き、結果を draws に保存する。
-- 各端末は保存された結果を受け取るだけなので、全員に同じ結果が出る。
create or replace function draw_exam_set(
  p_room_id   uuid,
  p_member_id uuid,
  p_is_redraw boolean default false
)
returns draws
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room       rooms;
  v_exam       exam_sets;
  v_question   integer;
  v_draw       draws;
  v_redraws    integer;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if not found then
    raise exception 'room not found';
  end if;
  if v_room.expires_at < now() then
    raise exception 'このルームは期限切れ（作成から24時間）';
  end if;
  if v_room.host_member_id is distinct from p_member_id then
    raise exception 'ルーレットを回せるのはホストだけ';
  end if;

  -- 振り直しはホストのみ1回まで（SPEC「画面構成」）
  if p_is_redraw then
    select count(*) into v_redraws
      from draws
     where room_id = p_room_id
       and is_redraw
       and drawn_at > coalesce(v_room.timer_started_at, v_room.created_at);
    if v_redraws >= 1 then
      raise exception '振り直しは1回まで';
    end if;
  end if;

  -- 重み付き抽選。-ln(random())/w が最小のものを採る（重み w の指数レース）
  select e.* into v_exam
    from exam_sets e
   where (
           v_room.pool -> 'universities' is null
           or jsonb_array_length(v_room.pool -> 'universities') = 0
           or v_room.pool -> 'universities' ? e.university_id
         )
     and (
           v_room.pool -> 'subjects' is null
           or jsonb_array_length(v_room.pool -> 'subjects') = 0
           or v_room.pool -> 'subjects' ? e.subject
         )
     and (
           v_room.pool -> 'year_from' is null
           or e.year >= (v_room.pool ->> 'year_from')::int
         )
     and (
           v_room.pool -> 'year_to' is null
           or e.year <= (v_room.pool ->> 'year_to')::int
         )
     -- F5 重複回避
     and (
           v_room.avoid_duplicates = 'off'
           or (
             v_room.avoid_duplicates = 'room'
             and not exists (
               select 1 from draws d
                where d.room_id = p_room_id and d.exam_set_id = e.id
             )
           )
           or (
             v_room.avoid_duplicates = 'self'
             and not exists (
               select 1
                 from results r
                 join draws d2 on d2.id = r.draw_id
                where r.member_id = p_member_id and d2.exam_set_id = e.id
             )
           )
         )
   order by
     -ln(random())
     / greatest(
         coalesce(
           (v_room.weights ->> e.university_id)::numeric,
           (select u.default_weight from universities u where u.id = e.university_id)::numeric,
           1
         ),
         0.0001
       )
   limit 1;

  if v_exam.id is null then
    raise exception '候補が0件。年度範囲・科目・重複回避の設定を見直して';
  end if;

  if v_room.draw_granularity = 'question' then
    v_question := 1 + floor(random() * v_exam.question_count)::int;
  end if;

  insert into draws (room_id, exam_set_id, question_no, is_redraw)
  values (p_room_id, v_exam.id, v_question, p_is_redraw)
  returning * into v_draw;

  update rooms
     set status           = 'drawn',
         current_draw_id  = v_draw.id,
         timer_started_at = null,
         timer_paused_at  = null,
         timer_paused_ms  = 0
   where id = p_room_id;

  return v_draw;
end;
$$;

-- F6: 共通タイマー。時刻はすべてサーバーの now() で決める
create or replace function timer_control(
  p_room_id   uuid,
  p_member_id uuid,
  p_action    text    -- 'start' | 'pause' | 'resume' | 'finish'
)
returns rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room_id for update;
  if not found then
    raise exception 'room not found';
  end if;
  if v_room.host_member_id is distinct from p_member_id then
    raise exception 'タイマーを操作できるのはホストだけ';
  end if;

  if p_action = 'start' then
    update rooms
       set status = 'running',
           timer_started_at = now(),
           timer_paused_at = null,
           timer_paused_ms = 0
     where id = p_room_id;

  elsif p_action = 'pause' then
    if v_room.timer_paused_at is null then
      update rooms set timer_paused_at = now() where id = p_room_id;
    end if;

  elsif p_action = 'resume' then
    if v_room.timer_paused_at is not null then
      update rooms
         set timer_paused_ms = v_room.timer_paused_ms
                               + (extract(epoch from (now() - v_room.timer_paused_at)) * 1000)::bigint,
             timer_paused_at = null
       where id = p_room_id;
    end if;

  elsif p_action = 'finish' then
    update rooms set status = 'finished' where id = p_room_id;

  else
    raise exception 'unknown action: %', p_action;
  end if;

  select * into v_room from rooms where id = p_room_id;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------- RLS
-- ログインなしで使う前提（SPEC F1）。招待リンクを知っている人が読み書きできる、
-- という粒度に割り切る。ただし抽選とタイマーは上の関数経由に限定して、
-- 「乱数はサーバー側で1回だけ」という要件をクライアントから壊せないようにする。

alter table universities  enable row level security;
alter table exam_sets     enable row level security;
alter table rooms         enable row level security;
alter table members       enable row level security;
alter table draws         enable row level security;
alter table results       enable row level security;
alter table review_items  enable row level security;

drop policy if exists universities_read on universities;
create policy universities_read on universities for select to anon, authenticated using (true);

drop policy if exists exam_sets_read on exam_sets;
create policy exam_sets_read on exam_sets for select to anon, authenticated using (true);

drop policy if exists rooms_read on rooms;
create policy rooms_read on rooms for select to anon, authenticated using (true);
drop policy if exists rooms_insert on rooms;
create policy rooms_insert on rooms for insert to anon, authenticated with check (true);
drop policy if exists rooms_update on rooms;
create policy rooms_update on rooms for update to anon, authenticated using (expires_at > now()) with check (true);

drop policy if exists members_all on members;
create policy members_all on members for all to anon, authenticated using (true) with check (true);

-- draws は読むだけ。書き込みは draw_exam_set（security definer）に限る
drop policy if exists draws_read on draws;
create policy draws_read on draws for select to anon, authenticated using (true);

drop policy if exists results_all on results;
create policy results_all on results for all to anon, authenticated using (true) with check (true);

drop policy if exists review_items_all on review_items;
create policy review_items_all on review_items for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------- Realtime

-- 貼り直しても途中で落ちないように、未登録のテーブルだけ追加する
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['rooms', 'members', 'draws', 'results'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ======================================================================
-- supabase/migrations/0002_history.sql
-- ======================================================================

-- F10 履歴・分析のための追加。0001 を流したあとに実行する。
--
-- members は部屋ごとに別レコードなので、そのままでは部屋をまたいだ履歴が繋がらない。
-- 端末に保存する匿名 id を members に持たせて、同じ端末の演習結果を横串で集計できるようにする。
-- ログインは導入しない（SPEC F1）ので、端末を変えると履歴は引き継がれない。

alter table members
  add column if not exists device_id uuid;

create index if not exists members_device_idx on members (device_id);

-- ======================================================================
-- supabase/seed.sql
-- ======================================================================

-- 大学マスタと過去問セットの投入。0001 と 0002 を流したあとに実行する。
--
-- このファイルは scripts/gen-seed-sql.ts が catalog.ts から生成する。手で編集しない。
-- 中身を変えるときは src/data/catalog.ts を直して npm run gen:seed。
--
-- 何度実行しても同じ結果になる（既にある行は更新される）。
-- universities 10件 / 形式プリセット 13件 → exam_sets 273件

insert into universities (id, name, short_name, default_weight, sort_order) values
  ('kyoto', '京都大学', '京大', 10, 1),
  ('tokyo', '東京大学', '東大', 4, 2),
  ('osaka', '大阪大学', '阪大', 4, 3),
  ('science-tokyo', '東京科学大学（旧 東京工業大学）', '科学大', 4, 4),
  ('tohoku', '東北大学', '東北大', 2, 5),
  ('nagoya', '名古屋大学', '名大', 2, 6),
  ('kyushu', '九州大学', '九大', 2, 7),
  ('hokkaido', '北海道大学', '北大', 2, 8),
  ('waseda', '早稲田大学', '早大', 1, 9),
  ('keio', '慶應義塾大学', '慶大', 1, 10)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  default_weight = excluded.default_weight,
  sort_order = excluded.sort_order;

-- 1プリセット = ある大学・学部・科目の出題形式。year_from〜year_to の各年度に1件ずつ作る。
-- 年度の途中で形式が変わった場合は catalog.ts 側でプリセットを分ける。
insert into exam_sets (
  university_id, faculty, year, curriculum, subject, subject_label,
  duration_min, question_count, total_points, has_solution, access_url, source_url
)
select
  p.university_id,
  p.faculty,
  y.year,
  case when y.year >= 2025 then 'new' else 'old' end,
  p.subject,
  p.subject_label,
  p.duration_min,
  p.question_count,
  p.total_points,
  p.has_solution,
  p.access_url,
  p.source_url
from (values
  ('kyoto', '工学部', 'math', '数学（理系）', 2005, 2025, 150, 6, 200, false, 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq', 'https://www.zkai.co.jp/kyodai-exam/bunseki/rikeisuugaku/'),
  ('kyoto', '工学部', 'english', '英語', 2005, 2025, 120, 4, null::integer, false, 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq', 'https://www.zkai.co.jp/kyodai-exam/bunseki/eigo/'),
  ('kyoto', '工学部', 'physics', '物理', 2005, 2025, 90, 3, null::integer, false, 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq', 'https://www.zkai.co.jp/kyodai-exam/bunseki/butsuri/'),
  ('kyoto', '工学部', 'chemistry', '化学', 2005, 2025, 90, 4, null::integer, false, 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq', 'https://ja.wikibooks.org/wiki/%E4%BA%AC%E5%A4%A7%E5%AF%BE%E7%AD%96/%E7%90%86%E7%A7%91'),
  ('tokyo', '理科', 'math', '数学（理系）', 2005, 2025, 150, 6, 120, false, 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/e01_07_25.html', 'https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_suu2_2.pdf'),
  ('osaka', '理・工・基礎工', 'math', '数学（理系）', 2005, 2025, 150, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://akahon.net/blog/84'),
  ('science-tokyo', '理工学系', 'math', '数学', 2005, 2025, 180, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://teambancho.com/titech-math/'),
  ('tohoku', '理系', 'math', '数学（理系）', 2005, 2025, 150, 6, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://akahon.net/blog/90'),
  ('nagoya', '理系', 'math', '数学（理系）', 2005, 2025, 150, 4, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://rikei-sora.com/nagoyadai-rikei-math-taisaku/'),
  ('kyushu', '理系', 'math', '数学（理系）', 2005, 2025, 150, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://ryubunnkai.com/kyudai-math-trend-difficulty/'),
  ('hokkaido', '理系', 'math', '数学（理系）', 2005, 2025, 120, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/hokkaidodaigaku/suugaku/'),
  ('waseda', '基幹理工学部', 'math', '数学', 2005, 2025, 120, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://logicalteacher.com/post-4273/4273/'),
  ('keio', '理工学部', 'math', '数学', 2005, 2025, 120, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://hiraocafe.com/exam/keio_rikou.html')
) as p (
  university_id, faculty, subject, subject_label, year_from, year_to,
  duration_min, question_count, total_points, has_solution, access_url, source_url
)
cross join lateral generate_series(p.year_from, p.year_to) as y(year)
on conflict (university_id, faculty, year, subject) do update set
  curriculum = excluded.curriculum,
  subject_label = excluded.subject_label,
  duration_min = excluded.duration_min,
  question_count = excluded.question_count,
  total_points = excluded.total_points,
  has_solution = excluded.has_solution,
  access_url = excluded.access_url,
  source_url = excluded.source_url;

-- 確認用。合計 273 件になっていれば成功
select u.short_name, count(*) as sets
  from exam_sets e join universities u on u.id = e.university_id
 group by u.short_name, u.sort_order
 order by u.sort_order;
