"use client";

/**
 * 「何日続いているか」「今日何回引いたか」を端末に持つ。
 *
 * 引くたびに数字が伸びるのが見えると次に繋がる。ログインしないので端末ローカル。
 * 集計対象は抽選を引いた事実だけで、成績には触れない（そちらは F10 の履歴が持つ）。
 */

const KEY = "kakomon.streak";

export type Streak = {
  /** 連続で引いた日数 */
  days: number;
  /** 今日引いた回数 */
  today: number;
  /** 通算で引いた回数 */
  total: number;
  /** 最長連続日数 */
  best: number;
};

type Stored = Streak & { lastDate: string };

const EMPTY: Streak = { days: 0, today: 0, total: 0, best: 0 };

/** 端末のローカル日付。日付をまたいだかどうかだけ分かればいい */
function today(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (typeof parsed.lastDate !== "string") return null;
    return {
      lastDate: parsed.lastDate,
      days: Number(parsed.days) || 0,
      today: Number(parsed.today) || 0,
      total: Number(parsed.total) || 0,
      best: Number(parsed.best) || 0,
    };
  } catch {
    // 壊れた値が入っていても画面を止める理由にはしない
    return null;
  }
}

/** 今の記録を読むだけ。日付をまたいでいれば today は 0 として返す */
export function peekStreak(): Streak {
  const stored = read();
  if (!stored) return EMPTY;
  if (stored.lastDate === today()) {
    return { days: stored.days, today: stored.today, total: stored.total, best: stored.best };
  }
  // 最後に引いたのが昨日なら連続は途切れていない（今日まだ引いていないだけ）
  const days = stored.lastDate === yesterday() ? stored.days : 0;
  return { days, today: 0, total: stored.total, best: stored.best };
}

/** 抽選を1回引いたことを記録して、更新後の記録を返す */
export function recordDraw(): Streak {
  const stored = read();
  const t = today();

  let days: number;
  let count: number;
  if (!stored) {
    days = 1;
    count = 1;
  } else if (stored.lastDate === t) {
    days = Math.max(1, stored.days);
    count = stored.today + 1;
  } else if (stored.lastDate === yesterday()) {
    days = stored.days + 1;
    count = 1;
  } else {
    days = 1;
    count = 1;
  }

  const next: Stored = {
    lastDate: t,
    days,
    today: count,
    total: (stored?.total ?? 0) + 1,
    best: Math.max(stored?.best ?? 0, days),
  };

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても抽選そのものは成立する
  }
  return { days: next.days, today: next.today, total: next.total, best: next.best };
}
