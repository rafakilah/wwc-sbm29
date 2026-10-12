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

export type PartnerRow = {
  partner_id: string;
  full_name: string;
  nickname: string;
  nim: string;
  track: Track;
  line_id: string;
  session_id: string;
  starts_at: string;
  ends_at: string;
  mode: SessionMode;
  session_status: SessionStatus;
  voice_memo_url: string | null;
};
