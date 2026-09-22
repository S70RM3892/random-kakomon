"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Draw, ExamSet, Room, University } from "@/lib/types";
import DrawnCard, { SourceLinks, universityName } from "./DrawnCard";

type Props = {
  room: Room;
  draw: Draw | null;
  examSet: ExamSet | null;
  universities: University[];
  isHost: boolean;
  memberId: string;
  onError: (message: string | null) => void;
};

/**
 * 抽選そのものはサーバー側で済んでいる（F3）。ここで回っているのは見せ方だけで、
 * 止まる先は最初から決まっている。
 */
export default function Roulette({
  room,
  draw,
  examSet,
  universities,
  isHost,
  memberId,
  onError,
}: Props) {
  const [reeling, setReeling] = useState(true);
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReeling(true);
    const tick = setInterval(() => setFrame((f) => f + 1), 70);
    const stop = setTimeout(() => setReeling(false), 1200);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [draw?.id]);

  async function redraw() {
    setBusy(true);
    onError(null);
    const { error } = await supabase.rpc("draw_exam_set", {
      p_room_id: room.id,
      p_member_id: memberId,
      p_is_redraw: true,
    });
    if (error) onError(error.message);
    setBusy(false);
  }

  async function start() {
    setBusy(true);
    onError(null);
    const { error } = await supabase.rpc("timer_control", {
      p_room_id: room.id,
      p_member_id: memberId,
      p_action: "start",
    });
    if (error) onError(error.message);
    setBusy(false);
  }

  if (!draw || !examSet) {
    return <p className="sub">抽選結果を取得中...</p>;
  }

  if (reeling) {
    const pool = universities.length > 0 ? universities : [{ short_name: "…" } as University];
    const u = pool[frame % pool.length];
    const year = 2005 + ((frame * 7) % 21);
    return (
      <div className="panel">
        <div className="reel">
          {u.short_name} {year}年度
        </div>
        <p className="sub" style={{ textAlign: "center" }}>抽選中...</p>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <DrawnCard draw={draw} examSet={examSet} universities={universities} />
        {draw.is_redraw && <p className="sub" style={{ textAlign: "center" }}>振り直し後の結果</p>}
      </div>

      <SourceLinks examSet={examSet} />

      {isHost ? (
        <div className="row">
          <button
            className="primary"
            style={{ flex: "1 1 200px", minHeight: 52, fontSize: 17 }}
            onClick={start}
            disabled={busy}
          >
            全員でタイマー開始
          </button>
          <button onClick={redraw} disabled={busy || draw.is_redraw}>
            振り直し{draw.is_redraw ? "（使用済み）" : "（1回まで）"}
          </button>
        </div>
      ) : (
        <p className="sub">
          {universityName(universities, examSet.university_id)}の問題を開いて、ホストの開始を待つ。
        </p>
      )}
    </>
  );
}
