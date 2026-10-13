/** Spreadsheet yang ditampilkan sebagai kartu di bawah kartu deadline (dashboard). */
export const SPREADSHEET_LINK = {
  label: "Spreadsheet Wawancara Angkatan",
  description: "Buka di Google Sheets",
  href: "https://docs.google.com/spreadsheets/d/13pbqDvfNaanBEglj4CkInQDrLd2DtFh3/edit?gid=129307807#gid=129307807",
} as const;

/** Tautan dokumen penting. Ubah label/URL di sini saja. */
export const IMPORTANT_LINKS = [
  {
    label: "SOP Wawancara Angkatan",
    description: "Google Drive",
    href: "https://drive.google.com/file/d/1fQGUN-3NJ8oHYmSaAmGZwW4EhXMGK7TS/view?usp=sharing",
  },
  {
    label: "FAQ Penugasan",
    description: "Google Sheets",
    href: "https://docs.google.com/spreadsheets/d/1MWroYFIAucEmTs-sH8_TLdhZZhZRqWuAvL151eh-S5I/edit?gid=0#gid=0",
  },
  {
    label: "Template Logbook",
    description: "Canva",
    href: "https://www.canva.com/design/DAHXn7zkx8M/Ss47w4Q_rru2hF8711f8Ig/edit",
  },
] as const;
