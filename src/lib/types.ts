export type RoomStatus = "waiting" | "drawn" | "running" | "finished";
export type AvoidDuplicates = "off" | "self" | "room";
export type DrawGranularity = "set" | "question";

export type Pool = {
  universities: string[];
  subjects: string[];
  year_from: number;
  year_to: number;
};

export type Room = {
  id: string;
  host_member_id: string | null;
  status: RoomStatus;
  pool: Pool;
  weights: Record<string, number>;
  avoid_duplicates: AvoidDuplicates;
  draw_granularity: DrawGranularity;
  current_draw_id: string | null;
  timer_started_at: string | null;
  timer_paused_at: string | null;
  timer_paused_ms: number;
  created_at: string;
  expires_at: string;
};

export type Member = {
  id: string;
  room_id: string;
  display_name: string;
  last_seen_at: string;
  created_at: string;
};

export type ExamSet = {
  id: string;
  university_id: string;
  faculty: string;
  year: number;
  curriculum: "old" | "new";
  subject: string;
  subject_label: string;
  duration_min: number;
  question_count: number;
  question_points: number[] | null;
  total_points: number | null;
  has_solution: boolean;
  access_url: string | null;
  source_url: string;
};

export type Draw = {
  id: string;
  room_id: string;
  exam_set_id: string;
  question_no: number | null;
  is_redraw: boolean;
  drawn_at: string;
};

export type Result = {
  id: string;
  member_id: string;
  draw_id: string;
  scores: (number | null)[];
  elapsed_sec: number | null;
  miss_tags: string[];
  note: string | null;
  created_at: string;
};

export type University = {
  id: string;
  name: string;
  short_name: string;
  default_weight: number;
  sort_order: number;
};
