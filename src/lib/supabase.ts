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

/**
 * Supabase の公開キーは sb_publishable_... か eyJ... の長い一続きの文字列で、
 * 空白もスラッシュも含まない。URL や説明文を貼り間違えたものはここで弾く。
 */
function normalizeKey(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return null; // URL を貼っている
  if (/[\s/]/.test(value)) return null; // 空白やパス区切りを含む = キーではない
  if (value.length < 20) return null; // 短すぎる
  return value;
}

/**
 * このアプリが使う Supabase プロジェクトの URL。
 *
 * 秘密ではない（ブラウザに配られる値で、アクセス制御は RLS 側でやる）ので直接書く。
 * 環境変数があればそちらが優先されるので、別プロジェクトに向けたいときはそれで差し替える。
 */
const DEFAULT_URL = "https://zcwqgnlcigkieymhbnvh.supabase.co";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;

// Supabase の Connect ダイアログは Next.js 向けに PUBLISHABLE_KEY という名前で出すので、
// どちらの名前で登録してもそのまま動くように両方見る。
// process.env.X はビルド時に文字列へ置換されるので、分割代入や動的アクセスは使えない。
//
// 単純に || で繋ぐと、片方に消し忘れの値が残っているだけで、
// もう片方に正しく入れたキーが無視される。キーとして通る方を採る。
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rawPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const rawKey = normalizeKey(rawAnonKey)
  ? rawAnonKey
  : normalizeKey(rawPublishableKey)
    ? rawPublishableKey
    : // どちらも使えない。診断で中身を示すため、値が入っている方を残す
      rawAnonKey?.trim()
      ? rawAnonKey
      : rawPublishableKey;

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
        ? "キーが未設定（NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY に入れる）"
        : /^https?:\/\//i.test(shown)
          ? `キーの変数に URL が入っている（今は「${shown.slice(0, 50)}」）。Supabase の Settings > API Keys にある sb_publishable_ で始まる値を入れる`
          : `キーの値が Supabase のキーの形になっていない（今は「${shown.slice(0, 50)}」）`,
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
