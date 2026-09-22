import { createClient } from "@supabase/supabase-js";

/**
 * 環境変数の値を検査して、使える形なら返す。使えなければ null。
 *
 * 素通しにすると、値が不正なときに createClient が例外を投げてビルドごと落ちる。
 * 値を手で貼ると、前後の空白や改行、スキームの付け忘れ、2つの変数の入れ違いが混ざる。
 * どれもビルドを止める理由にはしないが、画面には何が間違っているか出す。
 */
function normalizeUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  // "txvxx" のような値もURLとしては解釈できてしまうが、接続先にはなりえない。
  // ホスト名にドットが無いものは弾いて、「設定済み」に見えないようにする
  if (!parsed.hostname.includes(".")) return null;
  return parsed.origin;
}

function normalizeKey(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // URL を貼り間違えているケース。キーとしては使えない
  if (/^https?:\/\//i.test(value)) return null;
  return value;
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase の Connect ダイアログは Next.js 向けに PUBLISHABLE_KEY という名前で出す。
// どちらの名前で登録してもそのまま動くように両方見る。
// process.env.X はビルド時に文字列へ置換されるので、分割代入や動的アクセスは使えない。
const rawKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const url = normalizeUrl(rawUrl);
const anonKey = normalizeKey(rawKey);

export const isSupabaseConfigured = Boolean(url && anonKey);

/** 何が間違っているかを画面とログに出すための説明。問題が無ければ null */
export const configProblem: string | null = (() => {
  if (isSupabaseConfigured) return null;
  const problems: string[] = [];

  if (!url) {
    const shown = rawUrl?.trim();
    problems.push(
      shown
        ? `NEXT_PUBLIC_SUPABASE_URL の値が Supabase の URL になっていない（今は「${shown.slice(0, 40)}」）`
        : "NEXT_PUBLIC_SUPABASE_URL が未設定",
    );
  }
  if (!anonKey) {
    const shown = rawKey?.trim();
    problems.push(
      !shown
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY（または NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY）が未設定"
        : /^https?:\/\//i.test(shown)
          ? "NEXT_PUBLIC_SUPABASE_ANON_KEY に URL が入っている（キーを入れる）"
          : "NEXT_PUBLIC_SUPABASE_ANON_KEY の値が不正",
    );
  }
  return problems.join(" / ");
})();

if (configProblem) console.warn(`[supabase] ${configProblem}`);

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  { realtime: { params: { eventsPerSecond: 5 } } },
);
