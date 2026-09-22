import type { Room } from "./types";

/**
 * F6 共通タイマー。
 * サーバーは「開始時刻」と「一時停止中の累計」だけを配り、残り時間は各端末が計算する。
 * 端末ごとの時計ズレは server_now() との差分（skewMs）で補正する。
 */
export function elapsedMs(room: Room, nowMs: number): number {
  if (!room.timer_started_at) return 0;
  const started = Date.parse(room.timer_started_at);
  const pausedNow = room.timer_paused_at ? nowMs - Date.parse(room.timer_paused_at) : 0;
  return Math.max(0, nowMs - started - room.timer_paused_ms - pausedNow);
}

export function remainingMs(room: Room, durationMin: number, nowMs: number): number {
  return durationMin * 60_000 - elapsedMs(room, nowMs);
}

export function formatDuration(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}
