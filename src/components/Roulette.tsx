"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fanfare, isMuted, lock, setMuted, tick } from "@/lib/sound";
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

/** 大学が止まるまで / 年度が止まるまで（ミリ秒） */
const UNI_MS = 1100;
const YEAR_MS = 2200;

type Phase = "uni" | "year" | "done";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 抽選そのものはサーバー側で済んでいる（F3）。ここで回っているのは見せ方だけで、
 * 止まる先は最初から決まっている。演出（F12）は大学 → 年度の2段階で減速して止まる。
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
  const [phase, setPhase] = useState<Phase>("uni");
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false);
  const [muted, setMutedState] = useState(true);
  const timers = useRef<number[]>([]);

  useEffect(() => setMutedState(isMuted()), []);

  useEffect(() => {
    if (!draw) return;

    const clearAll = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    clearAll();

    if (prefersReducedMotion()) {
      setPhase("done");
      fanfare();
      return clearAll;
    }

    setPhase("uni");
    setFrame(0);
    const startedAt = performance.now();
    const phaseRef = { current: "uni" as Phase };

    // 経過とともにコマ送りを遅くして「減速して止まる」ようにする
    const step = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= YEAR_MS) {
        setPhase("done");
        lock();
        fanfare();
        return;
      }
      if (elapsed >= UNI_MS && phaseRef.current === "uni") {
        phaseRef.current = "year";
        setPhase("year");
        lock();
      }
      const progress = Math.min(1, elapsed / YEAR_MS);
      setFrame((f) => f + 1);
      tick();
      timers.current.push(window.setTimeout(step, 45 + progress ** 3 * 260));
    };

    timers.current.push(window.setTimeout(step, 45));
    return clearAll;
  }, [draw?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) lock(); // 解除した瞬間に音量が分かるように一度鳴らす
  }

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

  const muteButton = (
    <button className="ghost" onClick={toggleMute} aria-pressed={!muted}>
      {muted ? "効果音オフ" : "効果音オン"}
    </button>
  );

  if (phase !== "done") {
    const pool = universities.length > 0 ? universities : [{ short_name: "…" } as University];
    const uniText =
      phase === "uni"
        ? pool[frame % pool.length].short_name
        : universityName(universities, examSet.university_id);
    const yearText = phase === "uni" ? "????" : String(2005 + ((frame * 7) % 21));

    return (
      <div className="panel">
        <div className="reel">
          <span className={phase === "uni" ? "spinning" : "locked"}>{uniText}</span>{" "}
          <span className={phase === "uni" ? "" : "spinning"}>{yearText}</span>
          <span style={{ fontSize: "0.6em" }}>年度</span>
        </div>
        <p className="sub" style={{ textAlign: "center" }}>抽選中...</p>
        <div className="row" style={{ justifyContent: "center" }}>{muteButton}</div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="reveal">
          <DrawnCard draw={draw} examSet={examSet} universities={universities} />
        </div>
        {draw.is_redraw && <p className="sub" style={{ textAlign: "center" }}>振り直し後の結果</p>}
        <div className="row" style={{ justifyContent: "center" }}>{muteButton}</div>
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
