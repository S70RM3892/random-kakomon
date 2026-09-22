"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDuration, remainingMs } from "@/lib/timer";
import type { Draw, ExamSet, Member, Room, University } from "@/lib/types";
import DrawnCard, { SourceLinks } from "./DrawnCard";

type Props = {
  room: Room;
  draw: Draw | null;
  examSet: ExamSet | null;
  members: Member[];
  universities: University[];
  isHost: boolean;
  memberId: string;
  skewMs: number;
  onError: (message: string | null) => void;
};

export default function ExamRunning({
  room,
  draw,
  examSet,
  members,
  universities,
  isHost,
  memberId,
  skewMs,
  onError,
}: Props) {
  const [now, setNow] = useState(() => Date.now() + skewMs);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + skewMs), 250);
    return () => clearInterval(id);
  }, [skewMs]);

  async function control(action: "pause" | "resume" | "finish") {
    setBusy(true);
    onError(null);
    const { error } = await supabase.rpc("timer_control", {
      p_room_id: room.id,
      p_member_id: memberId,
      p_action: action,
    });
    if (error) onError(error.message);
    setBusy(false);
  }

  if (!draw || !examSet) return <p className="sub">読み込み中...</p>;

  // 大問1問だけのときは、制限時間も1問あたりに割る
  const durationMin = draw.question_no
    ? Math.max(1, Math.round(examSet.duration_min / examSet.question_count))
    : examSet.duration_min;

  const left = remainingMs(room, durationMin, now);
  const paused = Boolean(room.timer_paused_at);
  const cls = left < 0 ? "timer over" : left < 5 * 60_000 ? "timer warn" : "timer";

  return (
    <>
      <div className="panel">
        <div className={cls}>{formatDuration(left)}</div>
        <p className="sub" style={{ textAlign: "center" }}>
          {paused ? "一時停止中" : left < 0 ? "時間切れ（延長中）" : `制限 ${durationMin}分`}
        </p>
        <DrawnCard draw={draw} examSet={examSet} universities={universities} />
      </div>

      <SourceLinks examSet={examSet} />

      <div className="panel">
        <h3>参加者 {members.length}人</h3>
        <div className="chips">
          {members.map((m) => (
            <span key={m.id} className={`badge${m.id === room.host_member_id ? " host" : ""}`}>
              {m.display_name}
              {m.id === memberId ? "・自分" : ""}
            </span>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="row">
          <button onClick={() => control(paused ? "resume" : "pause")} disabled={busy}>
            {paused ? "再開" : "一時停止"}
          </button>
          <button
            className="primary"
            style={{ flex: "1 1 200px", minHeight: 52 }}
            onClick={() => control("finish")}
            disabled={busy}
          >
            終了して採点へ
          </button>
        </div>
      ) : (
        <p className="sub">タイマーの操作はホストだけ。全員の残り時間は同じ値になる。</p>
      )}
    </>
  );
}
