"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MISS_TAGS } from "@/data/catalog";
import { elapsedMs } from "@/lib/timer";
import type { Draw, ExamSet, Member, Result, Room, University } from "@/lib/types";
import DrawnCard from "./DrawnCard";
import SharedResults from "./SharedResults";

type Props = {
  room: Room;
  draw: Draw | null;
  examSet: ExamSet | null;
  members: Member[];
  results: Result[];
  universities: University[];
  isHost: boolean;
  memberId: string;
  skewMs: number;
  onError: (message: string | null) => void;
};

export default function ResultInput({
  room,
  draw,
  examSet,
  members,
  results,
  universities,
  isHost,
  memberId,
  skewMs,
  onError,
}: Props) {
  const questionNos = useMemo(() => {
    if (!examSet) return [];
    if (draw?.question_no) return [draw.question_no];
    return Array.from({ length: examSet.question_count }, (_, i) => i + 1);
  }, [examSet, draw]);

  const mine = results.find((r) => r.member_id === memberId);
  const [scores, setScores] = useState<(number | null)[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [elapsedMin, setElapsedMin] = useState<number>(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mine) {
      setScores(mine.scores ?? []);
      setTags(mine.miss_tags ?? []);
      setElapsedMin(Math.round((mine.elapsed_sec ?? 0) / 60));
      setSaved(true);
      return;
    }
    setScores(questionNos.map(() => null));
    setTags([]);
    setElapsedMin(Math.round(elapsedMs(room, Date.now() + skewMs) / 60_000));
    // 保存前の初期化なので room の毎秒更新には追従しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.id, questionNos.length]);

  async function save() {
    if (!draw) return;
    setBusy(true);
    onError(null);
    const payload = {
      member_id: memberId,
      draw_id: draw.id,
      scores,
      elapsed_sec: Math.max(0, Math.round(elapsedMin * 60)),
      miss_tags: tags,
    };
    const { error } = await supabase
      .from("results")
      .upsert(payload, { onConflict: "member_id,draw_id" });
    if (error) onError(error.message);
    else setSaved(true);
    setBusy(false);
  }

  async function nextRound() {
    const { error } = await supabase
      .from("rooms")
      .update({
        status: "waiting",
        current_draw_id: null,
        timer_started_at: null,
        timer_paused_at: null,
        timer_paused_ms: 0,
      })
      .eq("id", room.id);
    if (error) onError(error.message);
  }

  if (!draw || !examSet) {
    return (
      <div className="panel">
        <p className="sub">この回は終了した。</p>
        {isHost && (
          <button className="primary" onClick={nextRound}>
            ロビーに戻る
          </button>
        )}
      </div>
    );
  }

  const total = scores.reduce<number>((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <div className="panel">
        <DrawnCard draw={draw} examSet={examSet} universities={universities} />
      </div>

      <div className="panel">
        <h3>自己採点</h3>
        <table>
          <thead>
            <tr>
              <th>大問</th>
              <th className="num">得点</th>
            </tr>
          </thead>
          <tbody>
            {questionNos.map((no, i) => (
              <tr key={no}>
                <td>第{no}問</td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={scores[i] ?? ""}
                    placeholder="-"
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setScores((prev) => prev.map((s, j) => (j === i ? v : s)));
                      setSaved(false);
                    }}
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td>合計</td>
              <td className="num">
                {total}
                {examSet.total_points ? ` / ${examSet.total_points}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <h3>所要時間（分）</h3>
        <input
          type="number"
          min={0}
          value={elapsedMin}
          onChange={(e) => {
            setElapsedMin(Number(e.target.value));
            setSaved(false);
          }}
        />

        <h3>落とした原因</h3>
        <div className="chips">
          {MISS_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <label key={t} className={`check${on ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    setTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]));
                    setSaved(false);
                  }}
                />
                {t}
              </label>
            );
          })}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={save} disabled={busy}>
            {saved ? "保存済み" : "保存する"}
          </button>
          <span className="sub">未入力のままでも次に進める。</span>
        </div>
      </div>

      <SharedResults
        draw={draw}
        examSet={examSet}
        members={members}
        results={results}
        memberId={memberId}
        questionNos={questionNos}
      />

      {isHost && (
        <button
          className="primary"
          style={{ width: "100%", minHeight: 52 }}
          onClick={nextRound}
        >
          次の抽選へ
        </button>
      )}
    </>
  );
}
