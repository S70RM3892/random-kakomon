import { createClient } from "@supabase/supabase-js";

/**
 * 環境変数の値を URL として使える形に直す。使えなければ null。
 *
 * ここを素通しにすると、値が不正なときに createClient が例外を投げてビルドごと落ちる。
 * CI では未設定の変数が空文字で渡るし、値を手で貼ると前後の空白や改行、
 * スキーム(https://)の付け忘れが混ざる。どれもビルドを止める理由にはしない。
 */
function normalizeUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const url = normalizeUrl(rawUrl);
const anonKey = rawKey?.trim() || null;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (rawUrl?.trim() && !url) {
  // 値は入っているのに URL として読めない。ビルドは通すが気づけるようにする
  console.warn(
    `[supabase] NEXT_PUBLIC_SUPABASE_URL が URL として読めない: ${JSON.stringify(rawUrl)}。` +
      "Supabase の Project URL（https://xxxxxxxx.supabase.co の形）を入れる。",
  );
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  { realtime: { params: { eventsPerSecond: 5 } } },
);

export function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定、または値が不正。",
    );
  }
}
