/**
 * ExamSet と University を Supabase に流し込む。
 *   1. .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を置く
 *   2. npm run seed
 * 何度流しても同じ結果になる（upsert）ので、catalog.ts を直したら流し直す。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { UNIVERSITIES, buildExamSetSeeds } from "../src/data/catalog";

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // 環境変数を直接渡す運用でもよい
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要");
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const universities = UNIVERSITIES.map((u) => ({
    id: u.id,
    name: u.name,
    short_name: u.shortName,
    default_weight: u.defaultWeight,
    sort_order: u.sortOrder,
  }));
  const { error: uError } = await db.from("universities").upsert(universities);
  if (uError) throw uError;
  console.log(`universities: ${universities.length}件`);

  const examSets = buildExamSetSeeds();
  for (let i = 0; i < examSets.length; i += 200) {
    const chunk = examSets.slice(i, i + 200);
    const { error } = await db
      .from("exam_sets")
      .upsert(chunk, { onConflict: "university_id,faculty,year,subject" });
    if (error) throw error;
  }
  console.log(`exam_sets: ${examSets.length}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
