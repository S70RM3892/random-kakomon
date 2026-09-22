"use client";

import type { Draw, ExamSet, Member, Result } from "@/lib/types";

type Props = {
  draw: Draw;
  examSet: ExamSet;
  members: Member[];
  results: Result[];
  memberId: string;
  questionNos: number[];
};

function sum(scores: (number | null)[]) {
  return scores.reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * F9 結果共有。終了後に全員の点数を並べて出す。
 * 入力は任意（SPEC「結果入力: 未入力でも次に進める」）なので、未入力の人も行として残す。
 */
export default function SharedResults({
  draw,
  examSet,
  members,
  results,
  memberId,
  questionNos,
}: Props) {
  const rows = members
    .map((m) => {
      const result = results.find((r) => r.member_id === m.id) ?? null;
      return { member: m, result, total: result ? sum(result.scores) : null };
    })
    .sort((a, b) => {
      if (a.total === null && b.total === null) return 0;
      if (a.total === null) return 1; // 未入力は後ろ
      if (b.total === null) return -1;
      return b.total - a.total;
    });

  const done = rows.filter((r) => r.result).length;
  // 1年度まるごと解いた回だけ得点率を出せる（大問1問は満点が割り出せない）
  const denominator = draw.question_no === null ? examSet.total_points : null;

  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>結果</h3>
        <span className="sub">
          {done}/{members.length}人が入力済み
        </span>
      </div>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>参加者</th>
              {questionNos.map((no) => (
                <th key={no} className="num">
                  {no}
                </th>
              ))}
              <th className="num">合計</th>
              {denominator && <th className="num">得点率</th>}
              <th className="num">所要</th>
              <th>落とした原因</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, result, total }) => (
              <tr key={member.id} className={member.id === memberId ? "me" : undefined}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {member.display_name}
                  {member.id === memberId ? "・自分" : ""}
                </td>
                {questionNos.map((no, i) => (
                  <td key={no} className="num">
                    {result?.scores?.[i] ?? "-"}
                  </td>
                ))}
                <td className="num">
                  <strong>{total ?? "-"}</strong>
                </td>
                {denominator && (
                  <td className="num">
                    {total === null ? "-" : `${Math.round((total / denominator) * 100)}%`}
                  </td>
                )}
                <td className="num">
                  {result?.elapsed_sec ? `${Math.round(result.elapsed_sec / 60)}分` : "-"}
                </td>
                <td>
                  {result && result.miss_tags.length > 0 ? (
                    <span className="chips">
                      {result.miss_tags.map((t) => (
                        <span key={t} className="badge">
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : result ? (
                    "-"
                  ) : (
                    <span className="sub">未入力</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!denominator && (
        <p className="sub" style={{ marginTop: 10 }}>
          この回は満点が割り出せないので得点率は出さない
          {draw.question_no ? "（大問1問だけの回）" : "（満点が未登録の ExamSet）"}。
        </p>
      )}
    </div>
  );
}
