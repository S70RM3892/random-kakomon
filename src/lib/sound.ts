"use client";

/**
 * F12 の効果音。音声ファイルは持たず WebAudio で鳴らす（リポジトリに binary を置かない）。
 * ブラウザの自動再生制限があるので、AudioContext はユーザー操作のあとに作られる前提。
 */

const MUTE_KEY = "kakomon.muted";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function blip(freq: number, durationSec: number, type: OscillatorType, gain: number) {
  if (isMuted()) return;
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0.0001, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationSec);
  osc.connect(amp).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + durationSec + 0.02);
}

/** ルーレットが1コマ進むたびの音 */
export function tick() {
  blip(1180, 0.035, "square", 0.045);
}

/** 大学・年度が1つ確定したときの音 */
export function lock() {
  blip(420, 0.12, "triangle", 0.12);
}

/** 抽選結果が出そろったときの音 */
export function fanfare() {
  if (isMuted()) return;
  const ac = context();
  if (!ac) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    window.setTimeout(() => blip(f, 0.24, "triangle", 0.1), i * 90);
  });
}
