"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SUBJECTS, YEAR_MAX, YEAR_MIN } from "@/data/catalog";
import type { AvoidDuplicates, DrawGranularity, Member, Pool, Room, University } from "@/lib/types";
import InviteLink from "./InviteLink";

type Props = {
  room: Room;
  members: Member[];
  universities: University[];
  isHost: boolean;
  memberId: string;
  onError: (message: string | null) => void;
};

export default function Lobby({ room, members, universities, isHost, memberId, onError }: Props) {
  const [pool, setPool] = useState<Pool>({
    universities: room.pool.universities ?? [],
    subjects: room.pool.subjects ?? ["math"],
    year_from: room.pool.year_from ?? YEAR_MIN,
    year_to: room.pool.year_to ?? YEAR_MAX,
  });
  const [weights, setWeights] = useState<Record<string, number>>(room.weights ?? {});
  const [avoid, setAvoid] = useState<AvoidDuplicates>(room.avoid_duplicates);
  const [granularity, setGranularity] = useState<DrawGranularity>(room.draw_granularity);
  const [candidateCount, setCandidateCount] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  // ホスト以外の画面にも設定変更が伝わるようにする
  useEffect(() => {
    setPool({
      universities: room.pool.universities ?? [],
      subjects: room.pool.subjects ?? ["math"],
      year_from: room.pool.year_from ?? YEAR_MIN,
      year_to: room.pool.year_to ?? YEAR_MAX,
    });
    setWeights(room.weights ?? {});
    setAvoid(room.avoid_duplicates);
    setGranularity(room.draw_granularity);
  }, [room]);

  // 候補が0件のまま回して例外になるのを防ぐ
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("exam_sets")
        .select("id", { count: "exact", head: true })
        .gte("year", pool.year_from)
        .lte("year", pool.year_to);
      if (pool.universities.length > 0) query = query.in("university_id", pool.universities);
      if (pool.subjects.length > 0) query = query.in("subject", pool.subjects);
      const { count } = await query;
      if (!cancelled) setCandidateCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [pool]);

  async function save(next: Partial<Room>) {
    if (!isHost) return;
    const { error } = await supabase.from("rooms").update(next).eq("id", room.id);
    if (error) onError(error.message);
  }

  function toggleUniversity(id: string) {
    const next = pool.universities.includes(id)
      ? pool.universities.filter((u) => u !== id)
      : [...pool.universities, id];
    setPool({ ...pool, universities: next });
    void save({ pool: { ...pool, universities: next } });
  }

  function toggleSubject(id: string) {
    // 1回の演習は1科目。ただし候補としては複数入れておき、抽選で1科目に決まる
    const next = pool.subjects.includes(id)
      ? pool.subjects.filter((s) => s !== id)
      : [...pool.subjects, id];
    setPool({ ...pool, subjects: next });
    void save({ pool: { ...pool, subjects: next } });
  }

  function setYear(key: "year_from" | "year_to", value: number) {
    const next = { ...pool, [key]: value };
    setPool(next);
    void save({ pool: next });
  }

  function setWeight(id: string, value: number) {
    const next = { ...weights, [id]: value };
    setWeights(next);
    void save({ weights: next });
  }

  async function spin() {
    setSpinning(true);
    onError(null);
    const { error } = await supabase.rpc("draw_exam_set", {
      p_room_id: room.id,
      p_member_id: memberId,
      p_is_redraw: false,
    });
    if (error) {
      onError(error.message);
      setSpinning(false);
    }
    // 成功時は rooms の realtime 更新で画面が切り替わる
  }

  return (
    <>
      <div className="panel">
        <h3>参加者 {members.length}人</h3>
        <div className="chips">
          {members.map((m) => (
            <span key={m.id} className={`badge${m.id === room.host_member_id ? " host" : ""}`}>
              {m.display_name}
              {m.id === room.host_member_id ? "（ホスト）" : ""}
              {m.id === memberId ? "・自分" : ""}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <InviteLink roomId={room.id} />
        </div>
      </div>

      <div className="panel">
        <h3>大学</h3>
        <div className="chips">
          {universities.map((u) => {
            const on = pool.universities.includes(u.id);
            return (
              <label key={u.id} className={`check${on ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!isHost}
                  onChange={() => toggleUniversity(u.id)}
                />
                {u.short_name}
              </label>
            );
          })}
        </div>

        <h3>科目</h3>
        <div className="chips">
          {SUBJECTS.map((s) => {
            const on = pool.subjects.includes(s.id);
            return (
              <label key={s.id} className={`check${on ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!isHost}
                  onChange={() => toggleSubject(s.id)}
                />
                {s.label}
              </label>
            );
          })}
        </div>
        <p className="sub">1回の演習は1科目。複数チェックした場合は抽選で1科目に決まる。</p>

        <h3>年度</h3>
        <div className="row">
          <input
            type="number"
            value={pool.year_from}
            min={YEAR_MIN}
            max={YEAR_MAX}
            disabled={!isHost}
            onChange={(e) => setYear("year_from", Number(e.target.value))}
          />
          <span className="sub">〜</span>
          <input
            type="number"
            value={pool.year_to}
            min={YEAR_MIN}
            max={YEAR_MAX}
            disabled={!isHost}
            onChange={(e) => setYear("year_to", Number(e.target.value))}
          />
          <span className="sub">
            候補 {candidateCount === null ? "…" : `${candidateCount}件`}
          </span>
        </div>
      </div>

      <div className="panel">
        <h3>重み（ルーム共通・ホストが設定）</h3>
        <p className="sub">数字が大きいほど出やすい。既定は京大を最大にしてある。</p>
        <div className="chips">
          {universities
            .filter((u) => pool.universities.includes(u.id))
            .map((u) => (
              <label key={u.id} className="check">
                {u.short_name}
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={weights[u.id] ?? u.default_weight}
                  disabled={!isHost}
                  onChange={(e) => setWeight(u.id, Math.max(1, Number(e.target.value)))}
                  style={{ width: 64, minHeight: 30, padding: "2px 6px" }}
                />
              </label>
            ))}
        </div>

        <h3>抽選の粒度</h3>
        <div className="chips">
          {(
            [
              ["set", "1年度まるごと"],
              ["question", "大問1問だけ"],
            ] as [DrawGranularity, string][]
          ).map(([value, label]) => (
            <label key={value} className={`check${granularity === value ? " on" : ""}`}>
              <input
                type="radio"
                name="granularity"
                checked={granularity === value}
                disabled={!isHost}
                onChange={() => {
                  setGranularity(value);
                  void save({ draw_granularity: value });
                }}
              />
              {label}
            </label>
          ))}
        </div>

        <h3>重複回避</h3>
        <div className="chips">
          {(
            [
              ["room", "ルームで出た分を外す"],
              ["self", "自分が解いた分を外す"],
              ["off", "外さない"],
            ] as [AvoidDuplicates, string][]
          ).map(([value, label]) => (
            <label key={value} className={`check${avoid === value ? " on" : ""}`}>
              <input
                type="radio"
                name="avoid"
                checked={avoid === value}
                disabled={!isHost}
                onChange={() => {
                  setAvoid(value);
                  void save({ avoid_duplicates: value });
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          className="primary"
          style={{ width: "100%", minHeight: 56, fontSize: 18 }}
          onClick={spin}
          disabled={spinning || candidateCount === 0}
        >
          {spinning ? "抽選中..." : "ルーレットを回す"}
        </button>
      ) : (
        <p className="sub">ホストが回すのを待つ。設定はホストだけが変えられる。</p>
      )}
      {candidateCount === 0 && (
        <p className="sub">候補が0件。大学・科目・年度範囲を広げる。</p>
      )}
    </>
  );
}
