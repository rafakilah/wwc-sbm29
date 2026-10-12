"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/sessions", label: "Cari sesi" },
    { href: "/partners", label: "Partner" },
    { href: "/profile", label: "Profil" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const isActive = (href: string) =>
    href === "/sessions"
      ? pathname === "/sessions" || (pathname.startsWith("/sessions/") && pathname !== "/sessions/new")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Navigasi utama" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition",
                isActive(item.href) ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
