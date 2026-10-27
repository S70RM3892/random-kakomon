-- 大学マスタと過去問セットの投入。0001 と 0002 を流したあとに実行する。
--
-- このファイルは scripts/gen-seed-sql.ts が catalog.ts から生成する。手で編集しない。
-- 中身を変えるときは src/data/catalog.ts を直して npm run gen:seed。
--
-- 何度実行しても同じ結果になる（既にある行は更新され、catalog.ts から消した行は削除される）。
-- universities 11件 / 形式プリセット 20件 → exam_sets 420件

-- 一橋は科目を 'math' から 'math-bunkei' に移した。消して入れ直すと解いた履歴まで消えるので、
-- 行はそのまま科目だけ書き換える
update exam_sets set subject = 'math-bunkei', subject_label = '数学（文系）'
 where university_id = 'hitotsubashi' and subject = 'math';

insert into universities (id, name, short_name, default_weight, sort_order) values
  ('kyoto', '京都大学', '京大', 10, 1),
  ('osaka', '大阪大学', '阪大', 4, 2),
  ('science-tokyo', '東京科学大学（旧 東京工業大学）', '科学大', 4, 3),
  ('tohoku', '東北大学', '東北大', 2, 4),
  ('nagoya', '名古屋大学', '名大', 2, 5),
  ('kyushu', '九州大学', '九大', 2, 6),
  ('hokkaido', '北海道大学', '北大', 2, 7),
  ('kobe', '神戸大学', '神大', 2, 8),
  ('hitotsubashi', '一橋大学', '一橋', 1, 9),
  ('waseda', '早稲田大学', '早大', 1, 10),
  ('keio', '慶應義塾大学', '慶大', 1, 11)
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
  ('osaka', '理・工・基礎工', 'math', '数学（理系）', 2005, 2025, 150, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://akahon.net/blog/84'),
  ('science-tokyo', '理工学系', 'math', '数学', 2005, 2025, 180, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://teambancho.com/titech-math/'),
  ('tohoku', '理系', 'math', '数学（理系）', 2005, 2025, 150, 6, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://akahon.net/blog/90'),
  ('nagoya', '理系', 'math', '数学（理系）', 2005, 2025, 150, 4, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://rikei-sora.com/nagoyadai-rikei-math-taisaku/'),
  ('kyushu', '理系', 'math', '数学（理系）', 2005, 2025, 150, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://ryubunnkai.com/kyudai-math-trend-difficulty/'),
  ('hokkaido', '理系', 'math', '数学（理系）', 2005, 2025, 120, 5, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/hokkaidodaigaku/suugaku/'),
  ('kobe', '理系', 'math', '数学（理系）', 2005, 2025, 120, 5, 150, false, 'https://www.kobe-u.ac.jp/ja/admissions/undergraduate/examinations/', 'https://jyuke-labo.com/daigakujyukentaisaku/kobedaigaku/suugaku/'),
  ('kyoto', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 120, 5, 150, false, 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq', 'https://ja.wikibooks.org/wiki/%E4%BA%AC%E5%A4%A7%E5%AF%BE%E7%AD%96/%E6%95%B0%E5%AD%A6'),
  ('osaka', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 90, 3, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/osakadaigaku/suugaku/'),
  ('tohoku', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 100, 4, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/touhokudaigaku/suugaku/'),
  ('nagoya', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 90, 3, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/nagoyadaigaku/suugaku/'),
  ('kyushu', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 120, 4, 200, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/kyushudaigaku/suugaku/'),
  ('hokkaido', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 90, 4, null::integer, false, 'https://www.toshin-kakomon.com/', 'https://jyuke-labo.com/daigakujyukentaisaku/hokkaidodaigaku/suugaku/'),
  ('hitotsubashi', '文系', 'math-bunkei', '数学（文系）', 2005, 2025, 120, 5, null::integer, false, 'https://juken.hit-u.ac.jp/admission/info/ito.html', 'https://jyuke-labo.com/daigakujyukentaisaku/hitotsubashidaigaku/kamokubetsu/'),
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

-- catalog.ts から消した大学・プリセットを消す。その過去問を引いた抽選と自己採点も一緒に消える
delete from exam_sets e
 where not exists (
   select 1 from (values
     ('kyoto', '工学部', 'math'),
     ('kyoto', '工学部', 'english'),
     ('kyoto', '工学部', 'physics'),
     ('kyoto', '工学部', 'chemistry'),
     ('osaka', '理・工・基礎工', 'math'),
     ('science-tokyo', '理工学系', 'math'),
     ('tohoku', '理系', 'math'),
     ('nagoya', '理系', 'math'),
     ('kyushu', '理系', 'math'),
     ('hokkaido', '理系', 'math'),
     ('kobe', '理系', 'math'),
     ('kyoto', '文系', 'math-bunkei'),
     ('osaka', '文系', 'math-bunkei'),
     ('tohoku', '文系', 'math-bunkei'),
     ('nagoya', '文系', 'math-bunkei'),
     ('kyushu', '文系', 'math-bunkei'),
     ('hokkaido', '文系', 'math-bunkei'),
     ('hitotsubashi', '文系', 'math-bunkei'),
     ('waseda', '基幹理工学部', 'math'),
     ('keio', '理工学部', 'math')
   ) as p (university_id, faculty, subject)
    where p.university_id = e.university_id
      and p.faculty = e.faculty
      and p.subject = e.subject
 );

delete from universities
 where id not in ('kyoto', 'osaka', 'science-tokyo', 'tohoku', 'nagoya', 'kyushu', 'hokkaido', 'kobe', 'hitotsubashi', 'waseda', 'keio');

-- 確認用。合計 420 件になっていれば成功
select u.short_name, count(*) as sets
  from exam_sets e join universities u on u.id = e.university_id
 group by u.short_name, u.sort_order
 order by u.sort_order;
