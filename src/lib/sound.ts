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
  fanfareFor(0);
}

/**
 * レア度に応じたファンファーレ。intensity は rarity.ts の 0〜3。
 * 上ほど音数が増えて高く終わる。当たりの大きさが耳で分かるようにする。
 */
export function fanfareFor(intensity: number) {
  if (isMuted()) return;
  const ac = context();
  if (!ac) return;

  // ドミソド → 上に伸ばしていく
  const scales = [
    [523.25, 659.25, 783.99, 1046.5],
    [523.25, 659.25, 783.99, 1046.5, 1318.5],
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0],
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0, 2093.0],
  ];
  const notes = scales[Math.min(intensity, scales.length - 1)];
  const gain = 0.1 + Math.min(intensity, 3) * 0.015;
  notes.forEach((f, i) => {
    window.setTimeout(() => blip(f, 0.24, "triangle", gain), i * 80);
  });
}

/**
 * 止まる直前の溜め。低音から上がっていき、次に来るものを予告する。
 * durationMs のあいだ鳴らす。
 */
export function buildup(durationMs: number) {
  if (isMuted()) return;
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const sec = durationMs / 1000;
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + sec);
  amp.gain.setValueAtTime(0.0001, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + sec * 0.8);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + sec);
  osc.connect(amp).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + sec + 0.02);
}

/**
 * 端末を短く震わせる。対応していない端末では何も起きない。
 * 音を切っていても手応えは残したいので、ミュート設定とは独立させる。
 */
export function buzz(intensity: number) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns = [[18], [26], [18, 60, 26], [18, 50, 26, 50, 60]];
  try {
    navigator.vibrate(patterns[Math.min(Math.max(intensity, 0), patterns.length - 1)]);
  } catch {
    // 端末が拒否しても演出以外に影響はない
  }
}
