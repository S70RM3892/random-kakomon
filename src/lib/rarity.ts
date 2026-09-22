import type { ExamSet, Room, University } from "@/lib/types";

/**
 * 出た結果の「珍しさ」。演出の強さを決めるためだけに使う。
 *
 * 数字は飾りではなく、実際の抽選確率から出す。draw_exam_set は大学ごとの重み w の
 * 指数レースで1件選ぶので、ある大学が選ばれる確率は w / Σw になる。
 * 重みを下げた大学が出たときほど珍しく、演出を強くする。
 *
 * 京大の重みは既定で10と高いので、京大はよく出る＝レア度は低い。
 * 本命がレアに見えないのは正しい。ここで嘘をつくと数字の意味がなくなる。
 */

export type Tier = "N" | "R" | "SR" | "SSR";

export type Rarity = {
  tier: Tier;
  /** その大学が選ばれる確率（0〜1）。候補が不明なら null */
  probability: number | null;
  label: string;
  /** 演出の強さ。0〜3 */
  intensity: number;
};

const TIERS: Record<Tier, { label: string; intensity: number }> = {
  N: { label: "よく出る", intensity: 0 },
  R: { label: "やや珍しい", intensity: 1 },
  SR: { label: "珍しい", intensity: 2 },
  SSR: { label: "大当たり", intensity: 3 },
};

/**
 * 確率の絶対値では判定しない。候補が12大学あれば1件あたりは自然に小さくなり、
 * 絞り込めば大きくなるので、同じ「珍しさ」が設定次第で別の階級になってしまう。
 *
 * そのルームで一番出やすい大学に対する比で見る。
 * 一番出やすいものが出れば N、その1/5未満なら SSR。
 */
function tierOf(probability: number, maxProbability: number): Tier {
  const relative = maxProbability > 0 ? probability / maxProbability : 1;
  if (relative >= 0.8) return "N";
  if (relative >= 0.45) return "R";
  if (relative >= 0.2) return "SR";
  return "SSR";
}

/** ルームの重み設定。未指定なら大学マスタの既定値を使う（SQL 側と同じ規則） */
function weightOf(room: Room, universities: University[], id: string): number {
  const fromRoom = room.weights?.[id];
  if (typeof fromRoom === "number" && fromRoom > 0) return fromRoom;
  return universities.find((u) => u.id === id)?.default_weight ?? 1;
}

export function rarityOf(
  room: Room,
  universities: University[],
  examSet: ExamSet,
): Rarity {
  // 候補プールが空なら全大学が対象（SQL 側の条件と同じ）
  const pool = room.pool?.universities?.length
    ? universities.filter((u) => room.pool.universities.includes(u.id))
    : universities;

  if (pool.length === 0) {
    return { tier: "N", probability: null, ...TIERS.N };
  }

  const total = pool.reduce((sum, u) => sum + weightOf(room, universities, u.id), 0);
  if (total <= 0) {
    return { tier: "N", probability: null, ...TIERS.N };
  }

  const probability = weightOf(room, universities, examSet.university_id) / total;
  const maxProbability =
    Math.max(...pool.map((u) => weightOf(room, universities, u.id))) / total;
  const tier = tierOf(probability, maxProbability);
  return { tier, probability, ...TIERS[tier] };
}
