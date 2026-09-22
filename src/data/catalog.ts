/**
 * ExamSet の元データ。SPEC.md「過去問データの集め方」に従い、
 * 制限時間・大問数には必ず出典URLを付ける。出典のない数字は入れない。
 *
 * 京大工学部の配点と試験時間は京大公式PDFで確認済み:
 *   個別学力検査 国語100 / 数学250 / 理科250 / 外国語200 = 800、共通テスト225、計1025
 *   工学部の実施時間  国語 9:30-11:00(90分) / 数学 13:30-16:00(150分)
 *                    外国語 9:30-11:30(120分) / 理科 13:30-16:30(180分・物理化学の2科目)
 *   出典: 令和7年度京都大学一般選抜における配点等について（予告）,
 *         令和7年度 京都大学 入学者選抜要項 Ⅳ 個別学力検査等実施期日・時間
 */

export const UNIVERSITIES = [
  { id: "kyoto", name: "京都大学", shortName: "京大", defaultWeight: 10, sortOrder: 1 },
  { id: "tokyo", name: "東京大学", shortName: "東大", defaultWeight: 4, sortOrder: 2 },
  { id: "osaka", name: "大阪大学", shortName: "阪大", defaultWeight: 4, sortOrder: 3 },
  { id: "science-tokyo", name: "東京科学大学（旧 東京工業大学）", shortName: "科学大", defaultWeight: 4, sortOrder: 4 },
  { id: "tohoku", name: "東北大学", shortName: "東北大", defaultWeight: 2, sortOrder: 5 },
  { id: "nagoya", name: "名古屋大学", shortName: "名大", defaultWeight: 2, sortOrder: 6 },
  { id: "kyushu", name: "九州大学", shortName: "九大", defaultWeight: 2, sortOrder: 7 },
  { id: "hokkaido", name: "北海道大学", shortName: "北大", defaultWeight: 2, sortOrder: 8 },
  { id: "waseda", name: "早稲田大学", shortName: "早大", defaultWeight: 1, sortOrder: 9 },
  { id: "keio", name: "慶應義塾大学", shortName: "慶大", defaultWeight: 1, sortOrder: 10 },
] as const;

export type UniversityId = (typeof UNIVERSITIES)[number]["id"];

export const SUBJECTS = [
  { id: "math", label: "数学（理系）" },
  { id: "physics", label: "物理" },
  { id: "chemistry", label: "化学" },
  { id: "english", label: "英語" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

/** 新課程は2025年度入試から。それ以前の年度は「旧」として区別する（SPEC「過去問データの集め方」）。 */
export const NEW_CURRICULUM_FROM = 2025;

export const YEAR_MIN = 2005;
export const YEAR_MAX = 2025;

/**
 * 1行 = ある大学・学部・科目の「形式プリセット」。
 * yearFrom〜yearTo の各年度に同じ形式の ExamSet を作る。
 * 年度ごとに形式が変わったら行を分ける。
 */
export type FormatPreset = {
  universityId: UniversityId;
  faculty: string;
  subject: SubjectId;
  subjectLabel: string;
  yearFrom: number;
  yearTo: number;
  durationMin: number;
  questionCount: number;
  /** 素点の満点。学部換算の配点とは別物。不明なら未設定 */
  totalPoints?: number;
  /** 制限時間・大問数の出典 */
  sourceUrl: string;
  /** 問題を開く先 */
  accessUrl: string;
  hasSolution: boolean;
  note?: string;
};

const TOSHIN = "https://www.toshin-kakomon.com/";
const KYODAI_OFFICIAL = "https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq";
const TODAI_OFFICIAL = "https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/e01_07_25.html";

export const FORMAT_PRESETS: FormatPreset[] = [
  // ---- 京都大学 工学部（本命。公式資料と照合済み） ----
  {
    universityId: "kyoto",
    faculty: "工学部",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 6,
    totalPoints: 200,
    sourceUrl: "https://www.zkai.co.jp/kyodai-exam/bunseki/rikeisuugaku/",
    accessUrl: KYODAI_OFFICIAL,
    hasSolution: false,
    note: "150分・6題。工学部の実施時間13:30-16:00は令和7年度入学者選抜要項で確認。学部換算配点は250点",
  },
  {
    universityId: "kyoto",
    faculty: "工学部",
    subject: "english",
    subjectLabel: "英語",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 120,
    questionCount: 4,
    sourceUrl: "https://www.zkai.co.jp/kyodai-exam/bunseki/eigo/",
    accessUrl: KYODAI_OFFICIAL,
    hasSolution: false,
    note: "長文読解2題＋和文英訳＋自由英作文の4題。実施時間9:30-11:30は選抜要項で確認。学部換算配点は200点",
  },
  {
    universityId: "kyoto",
    faculty: "工学部",
    subject: "physics",
    subjectLabel: "物理",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 90,
    questionCount: 3,
    sourceUrl: "https://www.zkai.co.jp/kyodai-exam/bunseki/butsuri/",
    accessUrl: KYODAI_OFFICIAL,
    hasSolution: false,
    note: "理科は物理・化学の2科目で180分。物理は大問3題で、1科目あたりの目安90分で計測する",
  },
  {
    universityId: "kyoto",
    faculty: "工学部",
    subject: "chemistry",
    subjectLabel: "化学",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 90,
    questionCount: 4,
    sourceUrl: "https://ja.wikibooks.org/wiki/%E4%BA%AC%E5%A4%A7%E5%AF%BE%E7%AD%96/%E7%90%86%E7%A7%91",
    accessUrl: KYODAI_OFFICIAL,
    hasSolution: false,
    note: "化学は〔1〕〜〔4〕の4題。理科180分の半分90分を目安に計測する",
  },

  // ---- 他大学（数学のみ。二次情報可。気づいたズレはその都度直す） ----
  {
    universityId: "tokyo",
    faculty: "理科",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 6,
    totalPoints: 120,
    sourceUrl: "https://www2.sundai.ac.jp/sokuhou/assets/pdf/tky1_suu2_2.pdf",
    accessUrl: TODAI_OFFICIAL,
    hasSolution: false,
    note: "駿台の入試問題分析シートで試験時間150分。理科各類の数学は120点満点・6題",
  },
  {
    universityId: "osaka",
    faculty: "理・工・基礎工",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 5,
    sourceUrl: "https://akahon.net/blog/84",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "science-tokyo",
    faculty: "理工学系",
    subject: "math",
    subjectLabel: "数学",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 180,
    questionCount: 5,
    sourceUrl: "https://teambancho.com/titech-math/",
    accessUrl: TOSHIN,
    hasSolution: false,
    note: "2025年度に東京工業大学から東京科学大学（理工学系）へ。それ以前の年度も同じ枠で扱う",
  },
  {
    universityId: "tohoku",
    faculty: "理系",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 6,
    sourceUrl: "https://akahon.net/blog/90",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "nagoya",
    faculty: "理系",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 4,
    sourceUrl: "https://rikei-sora.com/nagoyadai-rikei-math-taisaku/",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "kyushu",
    faculty: "理系",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 150,
    questionCount: 5,
    sourceUrl: "https://ryubunnkai.com/kyudai-math-trend-difficulty/",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "hokkaido",
    faculty: "理系",
    subject: "math",
    subjectLabel: "数学（理系）",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 120,
    questionCount: 5,
    sourceUrl: "https://jyuke-labo.com/daigakujyukentaisaku/hokkaidodaigaku/suugaku/",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "waseda",
    faculty: "基幹理工学部",
    subject: "math",
    subjectLabel: "数学",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 120,
    questionCount: 5,
    sourceUrl: "https://logicalteacher.com/post-4273/4273/",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
  {
    universityId: "keio",
    faculty: "理工学部",
    subject: "math",
    subjectLabel: "数学",
    yearFrom: YEAR_MIN,
    yearTo: YEAR_MAX,
    durationMin: 120,
    questionCount: 5,
    sourceUrl: "https://hiraocafe.com/exam/keio_rikou.html",
    accessUrl: TOSHIN,
    hasSolution: false,
  },
];

export type ExamSetSeed = {
  university_id: string;
  faculty: string;
  year: number;
  curriculum: "old" | "new";
  subject: string;
  subject_label: string;
  duration_min: number;
  question_count: number;
  total_points: number | null;
  has_solution: boolean;
  access_url: string;
  source_url: string;
};

export function buildExamSetSeeds(): ExamSetSeed[] {
  const rows: ExamSetSeed[] = [];
  for (const p of FORMAT_PRESETS) {
    for (let year = p.yearFrom; year <= p.yearTo; year++) {
      rows.push({
        university_id: p.universityId,
        faculty: p.faculty,
        year,
        curriculum: year >= NEW_CURRICULUM_FROM ? "new" : "old",
        subject: p.subject,
        subject_label: p.subjectLabel,
        duration_min: p.durationMin,
        question_count: p.questionCount,
        total_points: p.totalPoints ?? null,
        has_solution: p.hasSolution,
        access_url: p.accessUrl,
        source_url: p.sourceUrl,
      });
    }
  }
  return rows;
}

export const MISS_TAGS = ["計算ミス", "方針不明", "時間切れ", "知識不足"] as const;
