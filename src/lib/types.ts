import type { Track } from "./nim";

export type SessionStatus = "open" | "done" | "cancelled";
export type SessionMode = "online" | "offline";
export type TrackPref = "BEBAS" | "IUP" | "REGULER";

export type PublicMember = { nickname: string; track: Track; is_host: boolean };

export type OpenSessionRow = {
  id: string;
  host_id: string;
  host_nickname: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  mode: SessionMode;
  location: string;
  capacity: number;
  track_pref: TrackPref;
  notes: string | null;
  member_count: number;
  members: PublicMember[];
  blocker: string | null;
  /** Jumlah anggota yang sudah pernah wawancara denganku (tidak dihitung dobel). */
  repeat_count: number;
};

export type MySessionRow = {
  id: string;
  host_id: string;
  host_nickname: string;
  is_host: boolean;
  starts_at: string;
  ends_at: string;
  mode: SessionMode;
  location: string;
  capacity: number;
  track_pref: TrackPref;
  status: SessionStatus;
  member_count: number;
};

export type Progress = {
  iup_scheduled: number;
  iup_done: number;
  reguler_scheduled: number;
  reguler_done: number;
};

/** Satu catatan wawancara: dari sesi aktif atau dicatat manual. */
export type InterviewRecord = {
  source: "session" | "manual";
  /** id sesi (source=session) atau id catatan manual (source=manual). */
  record_id: string;
  partner_id: string | null;
  full_name: string;
  nickname: string | null;
  nim: string;
  track: Track;
  line_id: string | null;
  happened_at: string;
  mode: SessionMode | null;
  status: SessionStatus;
  voice_memo_url: string | null;
  notes: string | null;
};
