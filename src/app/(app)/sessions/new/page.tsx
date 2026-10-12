import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { DEADLINE } from "@/lib/constants";
import { formatDateTimeWib, wibDateKey } from "@/lib/time";
import { NewSessionForm } from "./new-session-form";

export const metadata: Metadata = { title: "Buat sesi" };

export default function NewSessionPage() {
  const today = wibDateKey(new Date());
  const deadlineDate = wibDateKey(DEADLINE);

  return (
    <>
      <PageHeader
        title="Buat sesi"
        description={
          <>
            Kamu otomatis jadi host dan anggota pertama. Semua waktu dalam <strong>WIB</strong>. Sesi harus selesai
            sebelum {formatDateTimeWib(DEADLINE)}.
          </>
        }
      />
      <NewSessionForm minDate={today} maxDate={deadlineDate} />
    </>
  );
}
