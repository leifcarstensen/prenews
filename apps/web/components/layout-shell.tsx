"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_NAV } from "@/lib/categories";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/moved", label: "Headlines" },
  ...CATEGORY_NAV.map((item) => ({ href: item.href, label: item.label })),
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex min-h-12 max-w-5xl items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-baseline gap-2">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-text"
            >
              PreNews
            </Link>
            <span className="hidden sm:inline text-xs text-text-muted">
              The news before it happens
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href
                || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
