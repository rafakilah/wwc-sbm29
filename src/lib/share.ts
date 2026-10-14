import { formatDateTimeWib } from "./time";

/** Link undangan: membuka detail sesi dengan popup preview. */
export function inviteUrl(origin: string, sessionId: string): string {
  return `${origin}/sessions/${sessionId}?undangan=1`;
}

/** Teks ajakan untuk dibagikan ke LINE/WhatsApp. Link meeting tidak ikut disebar. */
export function buildShareText(input: {
  startsAt: string;
  mode: "online" | "offline";
  location: string;
  seats: number;
}): string {
  const where = input.mode === "online" ? "Online" : `Offline, ${input.location}`;
  const seats = input.seats > 0 ? `sisa ${input.seats} kursi` : "kursi penuh";
  return `Yuk gabung sesi Wawancara Angkatan: ${formatDateTimeWib(input.startsAt)} · ${where} · ${seats}`;
}
