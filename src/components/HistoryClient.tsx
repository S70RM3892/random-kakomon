"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured, configProblem } from "@/lib/supabase";
import { getDeviceId } from "@/lib/identity";
import { MISS_TAGS } from "@/data/catalog";

type HistoryRow = {
  id: string;
  scores: (number | null)[];
  elapsed_sec: number | null;
  miss_tags: string[];
  created_at: string;
  draws: {
    question_no: number | null;
    exam_set_id: string;
    exam_sets: {
      university_id: string;
      faculty: string;
      year: number;
      subject: string;
      subject_label: string;
      total_points: number | null;
      question_count: number;
    };
  };
};

const SELECT =
  "id, scores, elapsed_sec, miss_tags, created_at, " +
  "members!inner(device_id), " +
  "draws!inner(question_no, exam_set_id, " +
  "exam_sets!inner(university_id, faculty, year, subject, subject_label, total_points, question_count))";

function sum(scores: (number | null)[]) {
  return scores.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export default function HistoryClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [kyotoTotal, setKyotoTotal] = useState(0);
  const [universities, setUniversities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(`Supabase の設定が正しくない。${configProblem ?? ""}`);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const deviceId = getDeviceId();
        const { data, error: e } = await supabase
          .from("results")
          .select(SELECT)
          .eq("members.device_id", deviceId)
          .order("created_at", { ascending: false });
        if (e) throw e;
        setRows((data ?? []) as unknown as HistoryRow[]);

        const { count } = await supabase
          .from("exam_sets")
          .select("id", { count: "exact", head: true })
          .eq("university_id", "kyoto");
        setKyotoTotal(count ?? 0);

        const { data: us } = await supabase.from("universities").select("id, short_name");
        setUniversities(
          Object.fromEntries(
            ((us ?? []) as { id: string; short_name: string }[]).map((u) => [u.id, u.short_name]),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 科目別の平均得点率。1年度まるごと解いて満点が登録されている回だけが母数になる。 */
  const bySubject = useMemo(() => {
    const acc = new Map<
      string,
      { label: string; rated: number; rateSum: number; plain: number; scoreSum: number }
    >();
    for (const r of rows) {
      const es = r.draws.exam_sets;
      const cur = acc.get(es.subject) ?? {
        label: es.subject_label,
        rated: 0,
        rateSum: 0,
        plain: 0,
        scoreSum: 0,
      };
      const total = sum(r.scores);
      if (r.draws.question_no === null && es.total_points) {
        cur.rated += 1;
        cur.rateSum += total / es.total_points;
      } else {
        cur.plain += 1;
        cur.scoreSum += total;
      }
      acc.set(es.subject, cur);
    }
    return [...acc.entries()]
      .map(([subject, v]) => ({
        subject,
        label: v.label,
        rate: v.rated > 0 ? v.rateSum / v.rated : null,
        rated: v.rated,
        unrated: v.plain,
      }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [rows]);

  /** 失点原因の割合。1回の演習で複数タグを付けられるので、合計は100%を超える。 */
  const byMissTag = useMemo(() => {
    const counts = new Map<string, number>(MISS_TAGS.map((t) => [t, 0]));
    for (const r of rows) {
      for (const t of r.miss_tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count, share: rows.length > 0 ? count / rows.length : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  /** 京大過去問の消化率。大問1問だけの回は「消化」に数えない。 */
  const kyotoDone = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.draws.exam_sets.university_id === "kyoto" && r.draws.question_no === null) {
        ids.add(r.draws.exam_set_id);
      }
    }
    return ids.size;
  }, [rows]);

  const kyotoRate = kyotoTotal > 0 ? kyotoDone / kyotoTotal : 0;

  if (loading) {
    return (
      <main>
        <p className="sub">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="viz">
      <div className="spread">
        <h1>履歴・分析</h1>
        <Link href="/">
          <button className="ghost">トップへ</button>
        </Link>
      </div>
      <p className="sub">
        この端末で入力した結果だけを集計する。ログインしないので、端末を変えると引き継がれない。
      </p>

      {error && <div className="err">{error}</div>}

      <div className="panel">
        <h3>京大過去問の消化率</h3>
        <div className="hero">
          {Math.round(kyotoRate * 100)}
          <span className="unit">%</span>
        </div>
        <div className="meter" role="img" aria-label={`京大過去問の消化率 ${Math.round(kyotoRate * 100)}パーセント`}>
          <span style={{ width: `${Math.min(100, kyotoRate * 100)}%` }} />
        </div>
        <p className="sub" style={{ marginTop: 8 }}>
          {kyotoDone} / {kyotoTotal} セット。1年度まるごと解いた回だけを数える。
        </p>
      </div>

      <div className="panel">
        <h3>科目別の平均得点率</h3>
        {bySubject.length === 0 ? (
          <p className="empty">まだ結果がない。</p>
        ) : (
          <>
            {bySubject.map((s) => (
              <div className="viz-row" key={s.subject}>
                <span className="label">{s.label}</span>
                <span className="bar-track" title={`${s.label}: 得点率を出せた回 ${s.rated}件`}>
                  {/* 満点未登録は「0%」ではなく「測れていない」なので、バーを描かない */}
                  {s.rate !== null && (
                    <span className="bar-fill" style={{ width: `${Math.min(100, s.rate * 100)}%` }} />
                  )}
                </span>
                <span className="value">
                  {s.rate === null ? "満点未登録" : `${Math.round(s.rate * 100)}%`}
                </span>
              </div>
            ))}
            <p className="sub" style={{ marginTop: 10 }}>
              満点が登録してある ExamSet を、1年度まるごと解いた回だけが母数。
              大問1問だけの回と満点未登録の分は下の表に出る。
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <h3>失点原因の割合</h3>
        {rows.length === 0 ? (
          <p className="empty">まだ結果がない。</p>
        ) : (
          <>
            {byMissTag.map((t) => (
              <div className="viz-row" key={t.tag}>
                <span className="label">{t.tag}</span>
                <span className="bar-track" title={`${t.tag}: ${t.count}件`}>
                  <span
                    className="bar-fill miss"
                    style={{ width: `${Math.min(100, t.share * 100)}%` }}
                  />
                </span>
                <span className="value">
                  {Math.round(t.share * 100)}% ({t.count})
                </span>
              </div>
            ))}
            <p className="sub" style={{ marginTop: 10 }}>
              全{rows.length}回に対する割合。1回で複数タグを付けられるので合計は100%を超える。
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <h3>直近の演習</h3>
        {rows.length === 0 ? (
          <p className="empty">まだ結果がない。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>内容</th>
                <th className="num">得点</th>
                <th className="num">所要</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => {
                const es = r.draws.exam_sets;
                const total = sum(r.scores);
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleDateString("ja-JP")}</td>
                    <td>
                      {universities[es.university_id] ?? es.university_id} {es.year} {es.subject_label}
                      {r.draws.question_no ? ` 第${r.draws.question_no}問` : ""}
                    </td>
                    <td className="num">
                      {total}
                      {r.draws.question_no === null && es.total_points ? `/${es.total_points}` : ""}
                    </td>
                    <td className="num">{r.elapsed_sec ? `${Math.round(r.elapsed_sec / 60)}分` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
