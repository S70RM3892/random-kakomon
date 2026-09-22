"use client";

import { useEffect, useState } from "react";

export default function InviteLink({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/room/${roomId}`);
  }, [roomId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="row">
      <code style={{ flex: "1 1 240px" }}>{url}</code>
      <button onClick={copy}>{copied ? "コピーした" : "招待リンクをコピー"}</button>
    </div>
  );
}
