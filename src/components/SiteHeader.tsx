"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { wedding } from "@/content/wedding";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { cx, navItems, tintBg, tintStrong } from "@/lib/ui";

export function SiteHeader({ name, avatarUrl, isAdmin }: { name: string; avatarUrl: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const first = name.trim().split(/\s+/)[0] || "Me";

  return (
    <header className="relative z-20 flex h-16 items-center justify-between px-4 lg:h-[88px] lg:px-12">
      <Link
        href="/"
        className="font-script text-[22px] font-bold text-ink no-underline hover:text-ink lg:w-40 lg:text-[26px] xl:w-52"
      >
        {wedding.monogram}
      </Link>

      <nav aria-label="Main" className="hidden items-center gap-1.5 lg:flex">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "nav-item flex w-[92px] flex-col items-center gap-1 rounded-[14px] py-1.5 text-[13px] text-ink no-underline hover:text-ink",
                active ? "font-bold" : "font-semibold",
              )}
            >
              <span
                className={cx(
                  "nav-icon flex size-11 items-center justify-center rounded-full",
                  active ? `${tintStrong[item.tint]} text-white` : tintBg[item.tint],
                )}
              >
                <Icon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 lg:w-40 lg:justify-end xl:w-52">
        {isAdmin && (
          <Link
            href="/admin"
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-sea-700 no-underline hover:bg-sea-200 xl:inline"
          >
            Dashboard
          </Link>
        )}
        <Link
          href="/profile"
          aria-label="My profile"
          aria-current={pathname === "/profile" ? "page" : undefined}
          className="flex min-h-11 items-center gap-2.5 rounded-full text-base font-semibold text-ink no-underline hover:text-ink"
        >
          <span className="hidden lg:inline">{first}</span>
          <Avatar name={name || "Me"} url={avatarUrl} size={44} tone="sun" />
        </Link>
      </div>
    </header>
  );
}
