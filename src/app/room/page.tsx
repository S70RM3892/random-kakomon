"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RoomClient from "@/components/RoomClient";

/**
 * 静的書き出し（GitHub Pages）にするため、ルームIDはパスではなくクエリで受ける。
 * /room/?id=<uuid> が招待リンクの形。
 */
function Room() {
  const roomId = useSearchParams().get("id");

  if (!roomId) {
    return (
      <main>
        <h1>ルームIDがない</h1>
        <p className="sub">招待リンクをそのまま開く。リンクの末尾に ?id=... が付いているはず。</p>
      </main>
    );
  }
  return <RoomClient roomId={roomId} />;
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <main>
          <p className="sub">読み込み中...</p>
        </main>
      }
    >
      <Room />
    </Suspense>
  );
}
