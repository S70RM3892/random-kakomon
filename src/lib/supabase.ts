import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * キーが無い状態でも画面は出したいので、未設定なら明示的に落とす薄いラッパーにする。
 * キーは .env.local とデプロイ先の環境変数に置く。リポジトリには置かない。
 */
// CI では未設定の変数が「未定義」ではなく空文字で渡るので、?? ではなく || で退避する。
// 空文字のまま createClient に渡すと "Invalid supabaseUrl" で例外になり、ビルドが落ちる。
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  { realtime: { params: { eventsPerSecond: 5 } } },
);

export function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定。.env.example を見て .env.local を作る。",
    );
  }
}
