/**
 * catalog.ts から seed 用の SQL を生成する。
 *   npm run gen:seed
 * 出力先は supabase/seed.sql。Supabase の SQL Editor に貼って実行する運用のため、
 * ローカルに Node を用意しなくてもデータを入れられるようにする目的。
 * catalog.ts を直したら流し直す。何度実行しても同じ結果になる（upsert）。
 */
import { writeFileSync } from "node:fs";
import { UNIVERSITIES, buildExamSetSeeds } from "../src/data/catalog";

/** SQL リテラルにする。null と配列と真偽値を型どおりに出す */
function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "null";
    return `array[${v.map((x) => lit(x)).join(", ")}]::integer[]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rows(list: Record<string, unknown>[], cols: string[]): string {
  return list
    .map((r) => `  (${cols.map((c) => lit(r[c])).join(", ")})`)
    .join(",\n");
}

const uniCols = ["id", "name", "short_name", "default_weight", "sort_order"];
const universities = UNIVERSITIES.map((u) => ({
  id: u.id,
  name: u.name,
  short_name: u.shortName,
  default_weight: u.defaultWeight,
  sort_order: u.sortOrder,
}));

const examCols = [
  "university_id", "faculty", "year", "curriculum", "subject", "subject_label",
  "duration_min", "question_count", "question_points", "total_points",
  "has_solution", "access_url", "source_url",
];
const examSets = buildExamSetSeeds() as unknown as Record<string, unknown>[];

const sql = `-- 大学マスタと過去問セットの投入。0001 と 0002 を流したあとに実行する。
--
-- このファイルは scripts/gen-seed-sql.ts が catalog.ts から生成する。手で編集しない。
-- 中身を変えるときは src/data/catalog.ts を直して npm run gen:seed。
--
-- 何度実行しても同じ結果になる（既にある行は更新される）。
-- universities: ${universities.length}件 / exam_sets: ${examSets.length}件

insert into universities (${uniCols.join(", ")}) values
${rows(universities, uniCols)}
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  default_weight = excluded.default_weight,
  sort_order = excluded.sort_order;

insert into exam_sets (${examCols.join(", ")}) values
${rows(examSets, examCols)}
on conflict (university_id, faculty, year, subject) do update set
  curriculum = excluded.curriculum,
  subject_label = excluded.subject_label,
  duration_min = excluded.duration_min,
  question_count = excluded.question_count,
  question_points = excluded.question_points,
  total_points = excluded.total_points,
  has_solution = excluded.has_solution,
  access_url = excluded.access_url,
  source_url = excluded.source_url;

-- 確認用。大学ごとの件数が出れば成功
select u.short_name, count(*) as sets
  from exam_sets e join universities u on u.id = e.university_id
 group by u.short_name, u.sort_order
 order by u.sort_order;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`supabase/seed.sql を生成: universities ${universities.length}件 / exam_sets ${examSets.length}件`);
