"use client";

import type { Draw, ExamSet, University } from "@/lib/types";

export function universityName(universities: University[], id: string) {
  return universities.find((u) => u.id === id)?.short_name ?? id;
}

export default function DrawnCard({
  draw,
  examSet,
  universities,
}: {
  draw: Draw;
  examSet: ExamSet;
  universities: University[];
}) {
  return (
    <div className="drawn">
      <div className="uni">
        {universityName(universities, examSet.university_id)} {examSet.year}年度
      </div>
      <div className="uni" style={{ fontSize: "clamp(18px, 5vw, 24px)" }}>
        {examSet.subject_label}
        {draw.question_no ? ` 第${draw.question_no}問` : ""}
      </div>
      <div className="meta">
        {examSet.faculty} ・ {examSet.curriculum === "old" ? "旧課程" : "新課程"} ・ 全
        {examSet.question_count}問 ・ 制限 {examSet.duration_min}分
        {draw.question_no ? `（大問1問なので目安 ${Math.round(examSet.duration_min / examSet.question_count)}分）` : ""}
      </div>
    </div>
  );
}

export function SourceLinks({ examSet }: { examSet: ExamSet }) {
  return (
    <div className="panel">
      <h3>問題を開く</h3>
      <div className="row">
        {examSet.access_url && (
          <a href={examSet.access_url} target="_blank" rel="noreferrer">
            <button>入手元を開く</button>
          </a>
        )}
        <a href="https://www.toshin-kakomon.com/" target="_blank" rel="noreferrer">
          <button className="ghost">東進 過去問DB</button>
        </a>
      </div>
      <p className="sub" style={{ marginTop: 10 }}>
        問題そのものはこのアプリに保存していない。各自が入手元で開く（東進DBは無料の会員登録が必要）。
        制限時間・大問数の出典:{" "}
        <a href={examSet.source_url} target="_blank" rel="noreferrer">
          {new URL(examSet.source_url).hostname}
        </a>
      </p>
    </div>
  );
}
