import { IMPORTANT_LINKS } from "@/lib/links";

export function ImportantLinksList() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {IMPORTANT_LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-brand-600 hover:bg-brand-50"
          >
            <span>
              <span className="block font-semibold text-slate-900">{link.label}</span>
              <span className="block text-xs text-slate-500">{link.description}</span>
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
            <span className="sr-only">(buka di tab baru)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function FooterLinks() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {IMPORTANT_LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline underline-offset-4"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
