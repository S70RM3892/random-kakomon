/**
 * catalog.ts から seed 用の SQL を生成する。
 *   npm run gen:seed
 *
 * 出力先は supabase/seed.sql。Supabase の SQL Editor に貼って実行する前提なので、
 * 273行を並べるのではなく、14件の「形式プリセット」を SQL 側で年度展開する。
 * 貼る量が10分の1で済み、コピー漏れが起きにくい。
 * catalog.ts を直したら流し直す。何度実行しても同じ結果になる（upsert）。
 */
import { writeFileSync } from "node:fs";
import {
  UNIVERSITIES,
  FORMAT_PRESETS,
  NEW_CURRICULUM_FROM,
  buildExamSetSeeds,
} from "../src/data/catalog";

function lit(v: unknown, cast?: string): string {
  if (v === null || v === undefined) return cast ? `null::${cast}` : "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const uniCols = ["id", "name", "short_name", "default_weight", "sort_order"];
const universities = UNIVERSITIES.map((u) => [
  u.id, u.name, u.shortName, u.defaultWeight, u.sortOrder,
]);

const presetRows = FORMAT_PRESETS.map((p) =>
  `  (${[
    lit(p.universityId), lit(p.faculty), lit(p.subject), lit(p.subjectLabel),
    lit(p.yearFrom), lit(p.yearTo), lit(p.durationMin), lit(p.questionCount),
    lit(p.totalPoints ?? null, "integer"), lit(p.hasSolution),
    lit(p.accessUrl), lit(p.sourceUrl),
  ].join(", ")})`,
).join(",\n");

const expected = buildExamSetSeeds().length;

const sql = `-- 大学マスタと過去問セットの投入。0001 と 0002 を流したあとに実行する。
--
-- このファイルは scripts/gen-seed-sql.ts が catalog.ts から生成する。手で編集しない。
-- 中身を変えるときは src/data/catalog.ts を直して npm run gen:seed。
--
-- 何度実行しても同じ結果になる（既にある行は更新される）。
-- universities ${universities.length}件 / 形式プリセット ${FORMAT_PRESETS.length}件 → exam_sets ${expected}件

insert into universities (${uniCols.join(", ")}) values
${universities.map((r) => `  (${r.map((v) => lit(v)).join(", ")})`).join(",\n")}
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
  case when y.year >= ${NEW_CURRICULUM_FROM} then 'new' else 'old' end,
  p.subject,
  p.subject_label,
  p.duration_min,
  p.question_count,
  p.total_points,
  p.has_solution,
  p.access_url,
  p.source_url
from (values
${presetRows}
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

-- 確認用。合計 ${expected} 件になっていれば成功
select u.short_name, count(*) as sets
  from exam_sets e join universities u on u.id = e.university_id
 group by u.short_name, u.sort_order
 order by u.sort_order;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(
  `supabase/seed.sql を生成: ${sql.split("\n").length}行 ` +
    `(universities ${universities.length}件 / プリセット ${FORMAT_PRESETS.length}件 → exam_sets ${expected}件)`,
);
