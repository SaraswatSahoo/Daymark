"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Menu, NotebookPen, Plus, Search, Settings, Sun } from "lucide-react";
import { useApp } from "./app-context";
import { LIBRARY_NAV, PRIMARY_NAV, REVIEW_NAV, isActive, type NavItem } from "./nav";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/colors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

function BottomLink({ href, label, icon: Icon }: { href: string; label: string; icon: NavItem["icon"] }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium text-muted-foreground",
        active && "text-brand",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Mobile/tablet: top bar with search, bottom tab bar with a central capture button, and a full menu sheet. */
export function MobileNav() {
  const { openCapture, setPaletteOpen, inboxCount, dueReminderCount, projects } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const badgeFor = (item: NavItem) =>
    item.badge === "inbox" ? inboxCount : item.badge === "reminders" ? dueReminderCount : 0;

  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md md:hidden">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link href="/" className="flex items-center gap-2" aria-label={`${brand.name} home`}>
            <Logo className="size-6" />
            <span className="font-display text-lg font-semibold tracking-tight">{brand.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-lg" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <Search />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-[var(--mobile-nav-h)] max-w-lg items-stretch px-2">
          <BottomLink href="/" label="Home" icon={Home} />
          <BottomLink href="/today" label="My Day" icon={Sun} />
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => openCapture()}
              aria-label="Quick capture"
              className="-mt-5 flex size-13 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="size-6" />
            </button>
          </div>
          <BottomLink href="/notes" label="Notes" icon={NotebookPen} />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium text-muted-foreground"
            aria-label={`Menu${inboxCount ? `, ${inboxCount} in inbox` : ""}`}
          >
            <Menu className="size-5" aria-hidden />
            <span>Menu</span>
            {inboxCount + dueReminderCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-14px)] size-2 rounded-full bg-brand" aria-hidden />
            )}
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-safe">
          <SheetHeader className="pb-0">
            <SheetTitle className="font-display text-lg">Go to</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            {[PRIMARY_NAV, LIBRARY_NAV, REVIEW_NAV].map((group, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5 border-b py-3 last:border-0 sm:grid-cols-3">
                {group.map((item) => {
                  const Icon = item.icon;
                  const badge = badgeFor(item);
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-muted",
                        active && "bg-muted font-medium",
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-brand" : "text-muted-foreground")} aria-hidden />
                      <span className="truncate">{item.label}</span>
                      {badge ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{badge}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
            {projects.length > 0 && (
              <div className="border-b py-3">
                <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Projects</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-muted"
                    >
                      <span className={cn("size-2 rounded-full", colorClasses(p.color).dot)} aria-hidden />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="mt-3 flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-muted"
            >
              <Settings className="size-4 text-muted-foreground" aria-hidden /> Settings
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
