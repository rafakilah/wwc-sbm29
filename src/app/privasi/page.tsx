import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-10 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Kebijakan Privasi</h1>
      <p>
        Penjadwal Wawancara Angkatan OS SBM ITB 2026 adalah alat bantu untuk menjadwalkan tugas Wawancara Angkatan
        Termin 1. Halaman ini menjelaskan data apa yang kami simpan dan bagaimana data itu dipakai.
      </p>
      <h2 className="text-lg font-semibold text-slate-900">Data yang disimpan</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Dari akun Google: alamat email dan nama (hanya untuk login).</li>
        <li>Yang kamu isi sendiri: nama lengkap, nama panggilan, NIM, dan ID LINE.</li>
        <li>Data sesi wawancara yang kamu buat atau ikuti, termasuk link voice memo jika kamu isi.</li>
      </ul>
      <h2 className="text-lg font-semibold text-slate-900">Siapa yang bisa melihat</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Nama panggilan dan jalur (IUP/Reguler) terlihat oleh semua peserta yang login.</li>
        <li>
          Nama lengkap, NIM, dan ID LINE hanya terlihat oleh kamu sendiri, admin, dan teman satu sesi wawancara yang
          masih aktif.
        </li>
      </ul>
      <h2 className="text-lg font-semibold text-slate-900">Penggunaan data</h2>
      <p>
        Data hanya dipakai untuk keperluan tugas Wawancara Angkatan. Data tidak dijual, tidak dibagikan ke pihak ketiga,
        dan tidak dipakai untuk iklan. Data disimpan di Supabase (region Singapura).
      </p>
      <h2 className="text-lg font-semibold text-slate-900">Penghapusan data</h2>
      <p>Hubungi admin angkatan jika ingin profil dan datamu dihapus.</p>
      <p>
        <Link href="/login" className="font-medium text-brand-700 underline underline-offset-4">
          Kembali ke halaman masuk
        </Link>
      </p>
    </main>
  );
}
