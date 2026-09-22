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
