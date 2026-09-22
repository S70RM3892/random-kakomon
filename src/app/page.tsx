"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDisplayName, setDisplayName, setMemberId } from "@/lib/identity";
import { UNIVERSITIES, YEAR_MAX, YEAR_MIN } from "@/data/catalog";

export default function TopPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(getDisplayName()), []);

  async function createRoom() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("表示名を入れて");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDisplayName(trimmed);

      const defaultWeights = Object.fromEntries(
        UNIVERSITIES.map((u) => [u.id, u.defaultWeight]),
      );
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({
          pool: {
            universities: UNIVERSITIES.map((u) => u.id),
            subjects: ["math"],
            year_from: YEAR_MIN,
            year_to: YEAR_MAX,
          },
          weights: defaultWeights,
        })
        .select()
        .single();
      if (roomError) throw roomError;

      const { data: member, error: memberError } = await supabase
        .from("members")
        .insert({ room_id: room.id, display_name: trimmed })
        .select()
        .single();
      if (memberError) throw memberError;

      const { error: hostError } = await supabase
        .from("rooms")
        .update({ host_member_id: member.id })
        .eq("id", room.id);
      if (hostError) throw hostError;

      setMemberId(room.id, member.id);
      router.push(`/room/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>過去問ルーレット</h1>
      <p className="sub">
        通話しながら「大学 × 年度 × 科目」を1タップで決めて、そのまま計測と自己採点まで流す。
      </p>

      {!isSupabaseConfigured && (
        <div className="err" style={{ marginTop: 16 }}>
          Supabase のキーが未設定。<code>.env.example</code> を見て{" "}
          <code>.env.local</code> を作るか、デプロイ先の環境変数に入れる。
        </div>
      )}

      <div className="panel">
        <h3>表示名</h3>
        <div className="row">
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="ニックネーム"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <button className="primary" onClick={createRoom} disabled={busy}>
            {busy ? "作成中..." : "ルームを作る"}
          </button>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          ログインは要らない。作ったら出てくる招待リンクを通話チャットに貼れば全員入れる。
        </p>
      </div>

      <div className="panel">
        <h3>参加する</h3>
        <p className="sub">
          招待リンクをそのまま開く。リンクを開いてから表示名を入れる。
        </p>
      </div>

      {error && <div className="err">{error}</div>}
    </main>
  );
}
