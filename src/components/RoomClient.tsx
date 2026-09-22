"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDeviceId, getDisplayName, getMemberId, setDisplayName, setMemberId } from "@/lib/identity";
import type { Draw, ExamSet, Member, Result, Room, University } from "@/lib/types";
import Lobby from "./Lobby";
import Roulette from "./Roulette";
import ExamRunning from "./ExamRunning";
import ResultInput from "./ResultInput";

export default function RoomClient({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [examSet, setExamSet] = useState<ExamSet | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** サーバー時計とのズレ。タイマーはこれで補正する */
  const [skewMs, setSkewMs] = useState(0);
  const joiningRef = useRef(false);

  const isHost = Boolean(room && memberId && room.host_member_id === memberId);

  const fetchRoom = useCallback(async () => {
    const { data, error: e } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (e) throw e;
    setRoom(data as Room);
    return data as Room;
  }, [roomId]);

  const fetchMembers = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("members")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at");
    if (e) throw e;
    setMembers((data ?? []) as Member[]);
  }, [roomId]);

  const fetchDraw = useCallback(async (drawId: string | null) => {
    if (!drawId) {
      setDraw(null);
      setExamSet(null);
      setResults([]);
      return;
    }
    const { data: d, error: de } = await supabase.from("draws").select("*").eq("id", drawId).single();
    if (de) throw de;
    setDraw(d as Draw);

    const { data: es, error: ee } = await supabase
      .from("exam_sets")
      .select("*")
      .eq("id", (d as Draw).exam_set_id)
      .single();
    if (ee) throw ee;
    setExamSet(es as ExamSet);

    const { data: rs } = await supabase.from("results").select("*").eq("draw_id", drawId);
    setResults((rs ?? []) as Result[]);
  }, []);

  // 初回ロード
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError("Supabase のキーが未設定。.env.example を見て設定する。");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRoom();
        if (cancelled) return;
        await fetchMembers();
        const { data: us } = await supabase.from("universities").select("*").order("sort_order");
        if (cancelled) return;
        setUniversities((us ?? []) as University[]);
        await fetchDraw(r.current_draw_id);
        const { data: t } = await supabase.rpc("server_now");
        if (t) setSkewMs(Date.parse(t as string) - Date.now());
        setMemberIdState(getMemberId(roomId));
        setJoinName(getDisplayName());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, fetchRoom, fetchMembers, fetchDraw]);

  // リアルタイム購読。ルーム状態・抽選結果・タイマーが全員に届く
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as Room;
          setRoom(next);
          setDraw((prev) => {
            if (next.current_draw_id && next.current_draw_id !== prev?.id) {
              void fetchDraw(next.current_draw_id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `room_id=eq.${roomId}` },
        () => void fetchMembers(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draws", filter: `room_id=eq.${roomId}` },
        (payload) => void fetchDraw((payload.new as Draw).id),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, (payload) => {
        const r = payload.new as Result;
        setDraw((current) => {
          if (current && r.draw_id === current.id) {
            setResults((prev) => [...prev.filter((x) => x.id !== r.id), r]);
          }
          return current;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, fetchMembers, fetchDraw]);

  const joined = useMemo(
    () => Boolean(memberId && members.some((m) => m.id === memberId)),
    [memberId, members],
  );

  async function join() {
    const trimmed = joinName.trim();
    if (!trimmed) {
      setError("表示名を入れて");
      return;
    }
    if (joiningRef.current) return;
    joiningRef.current = true;
    try {
      setDisplayName(trimmed);
      const { data, error: e } = await supabase
        .from("members")
        .insert({ room_id: roomId, display_name: trimmed, device_id: getDeviceId() })
        .select()
        .single();
      if (e) throw e;
      setMemberId(roomId, (data as Member).id);
      setMemberIdState((data as Member).id);
      await fetchMembers();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      joiningRef.current = false;
    }
  }

  if (loading) {
    return (
      <main>
        <p className="sub">読み込み中...</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main>
        <h1>ルームが見つからない</h1>
        {error && <div className="err">{error}</div>}
        <p className="sub">リンクが間違っているか、24時間で期限切れになった可能性がある。</p>
      </main>
    );
  }

  if (!joined) {
    return (
      <main>
        <h1>ルームに参加</h1>
        <p className="sub">表示名だけで入れる。ログインは要らない。</p>
        <div className="panel">
          <div className="row">
            <input
              type="text"
              value={joinName}
              maxLength={20}
              placeholder="ニックネーム"
              onChange={(e) => setJoinName(e.target.value)}
              style={{ flex: "1 1 200px" }}
            />
            <button className="primary" onClick={join}>
              参加する
            </button>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            先に入っている人: {members.map((m) => m.display_name).join("、") || "まだ誰もいない"}
          </p>
        </div>
        {error && <div className="err">{error}</div>}
      </main>
    );
  }

  const expired = Date.parse(room.expires_at) < Date.now() + skewMs;

  return (
    <main>
      <div className="spread">
        <h1>過去問ルーレット</h1>
        <span className="badge">{isHost ? "ホスト" : "参加者"}</span>
      </div>

      {expired && (
        <div className="err">このルームは期限切れ（作成から24時間）。新しく作り直して。</div>
      )}
      {error && <div className="err">{error}</div>}

      {room.status === "waiting" && (
        <Lobby
          room={room}
          members={members}
          universities={universities}
          isHost={isHost}
          memberId={memberId!}
          onError={setError}
        />
      )}

      {room.status === "drawn" && (
        <Roulette
          room={room}
          draw={draw}
          examSet={examSet}
          universities={universities}
          isHost={isHost}
          memberId={memberId!}
          onError={setError}
        />
      )}

      {room.status === "running" && (
        <ExamRunning
          room={room}
          draw={draw}
          examSet={examSet}
          members={members}
          universities={universities}
          isHost={isHost}
          memberId={memberId!}
          skewMs={skewMs}
          onError={setError}
        />
      )}

      {room.status === "finished" && (
        <ResultInput
          room={room}
          draw={draw}
          examSet={examSet}
          members={members}
          results={results}
          universities={universities}
          isHost={isHost}
          memberId={memberId!}
          skewMs={skewMs}
          onError={setError}
        />
      )}
    </main>
  );
}
