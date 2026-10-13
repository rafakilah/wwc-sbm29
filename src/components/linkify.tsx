import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

/** Tampilkan teks biasa dengan URL http/https sebagai link yang bisa diklik (tab baru). */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        // Tanda baca di ujung kalimat ("…/abc.") bukan bagian dari link.
        const trailing = part.match(TRAILING_PUNCT)?.[0] ?? "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <Fragment key={i}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-brand-700 underline underline-offset-2"
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
