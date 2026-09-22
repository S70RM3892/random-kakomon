"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildup, buzz, fanfareFor, isMuted, lock, setMuted, tick } from "@/lib/sound";
import { rarityOf, type Rarity } from "@/lib/rarity";
import { recordDraw, type Streak } from "@/lib/streak";
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

/** 大学が止まるまで / 年度が止まるまで / 結果を出すまで（ミリ秒） */
const UNI_MS = 1100;
const YEAR_MS = 2200;
const SUSPENSE_MS = 700;

type Phase = "uni" | "year" | "suspense" | "done";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 抽選そのものはサーバー側で済んでいる（F3）。ここで回っているのは見せ方だけで、
 * 止まる先は最初から決まっている。演出（F12）は
 * 大学 → 年度 → 溜め → 結果 の順で、最後にレア度に応じた当たり演出を出す。
 *
 * レア度は実際の抽選確率から出している（rarity.ts）。演出のために数字を盛らない。
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
  const [streak, setStreak] = useState<Streak | null>(null);
  const timers = useRef<number[]>([]);

  const rarity: Rarity | null = useMemo(
    () => (examSet ? rarityOf(room, universities, examSet) : null),
    [room, universities, examSet],
  );

  useEffect(() => setMutedState(isMuted()), []);

  useEffect(() => {
    if (!draw) return;

    const clearAll = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    clearAll();

    const intensity = rarity?.intensity ?? 0;
    const finish = () => {
      setPhase("done");
      setStreak(recordDraw());
      fanfareFor(intensity);
      buzz(intensity);
    };

    if (prefersReducedMotion()) {
      finish();
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
        // 止まってすぐ出さず、一拍おいてから結果を見せる
        phaseRef.current = "suspense";
        setPhase("suspense");
        lock();
        buildup(SUSPENSE_MS);
        timers.current.push(window.setTimeout(finish, SUSPENSE_MS));
        return;
      }
      if (elapsed >= UNI_MS && phaseRef.current === "uni") {
        phaseRef.current = "year";
        setPhase("year");
        lock();
        buzz(0);
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
    const spinningUni = phase === "uni";
    const uniText = spinningUni
      ? pool[frame % pool.length].short_name
      : universityName(universities, examSet.university_id);
    const yearText =
      phase === "uni"
        ? "????"
        : phase === "year"
          ? String(2005 + ((frame * 7) % 21))
          : String(examSet.year);

    return (
      <div className={`panel${phase === "suspense" ? " suspense" : ""}`}>
        <div className="reel">
          <span className={spinningUni ? "spinning" : "locked"}>{uniText}</span>{" "}
          <span className={phase === "year" ? "spinning" : phase === "uni" ? "" : "locked"}>
            {yearText}
          </span>
          <span style={{ fontSize: "0.6em" }}>年度</span>
        </div>
        <p className="sub" style={{ textAlign: "center" }}>
          {phase === "suspense" ? "……" : "抽選中..."}
        </p>
        <div className="row" style={{ justifyContent: "center" }}>{muteButton}</div>
      </div>
    );
  }

  const tierClass = rarity ? `tier-${rarity.tier.toLowerCase()}` : "";

  return (
    <>
      <div className={`panel reveal-panel ${tierClass}`}>
        {rarity && rarity.intensity > 0 && <Burst intensity={rarity.intensity} />}
        {rarity && (
          <div className={`tier-badge ${tierClass}`}>
            <span className="tier-name">{rarity.tier}</span>
            <span className="tier-label">{rarity.label}</span>
            {rarity.probability !== null && (
              <span className="tier-prob">
                この設定で {Math.round(rarity.probability * 100)}% の枠
              </span>
            )}
          </div>
        )}
        <div className="reveal">
          <DrawnCard draw={draw} examSet={examSet} universities={universities} />
        </div>
        {draw.is_redraw && <p className="sub" style={{ textAlign: "center" }}>振り直し後の結果</p>}
        {streak && <StreakLine streak={streak} />}
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

/** 当たりの粒。画像は使わず span を飛ばすだけにする */
function Burst({ intensity }: { intensity: number }) {
  const pieces = useMemo(() => {
    const count = 10 + intensity * 10;
    return Array.from({ length: count }, (_, i) => ({
      // 決め打ちの角度で扇状に散らす。乱数だと描画のたびに変わって落ち着かない
      angle: (360 / count) * i + (i % 3) * 7,
      distance: 70 + ((i * 37) % 90),
      delay: (i % 5) * 28,
    }));
  }, [intensity]);

  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              "--angle": `${p.angle}deg`,
              "--distance": `${p.distance}px`,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function StreakLine({ streak }: { streak: Streak }) {
  return (
    <p className="streak">
      <strong>{streak.days}日連続</strong>
      <span>今日 {streak.today} 回目</span>
      <span>通算 {streak.total} 回</span>
      {streak.best > streak.days && <span>最長 {streak.best}日</span>}
      {streak.days > 0 && streak.days === streak.best && streak.best > 1 && (
        <span className="streak-best">自己ベスト更新中</span>
      )}
    </p>
  );
}
