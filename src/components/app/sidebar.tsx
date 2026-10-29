"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Plus, Search, Settings } from "lucide-react";
import { useApp } from "./app-context";
import { ALL_NAV, LIBRARY_NAV, PRIMARY_NAV, REVIEW_NAV, isActive, type NavItem } from "./nav";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/common/kbd";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";

function NavLink({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.84rem] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && badge ? (
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      {collapsed && badge ? <span className="sr-only">({badge})</span> : null}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {badge ? ` · ${badge}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { sidebarCollapsed: collapsed, setSidebarCollapsed, openCapture, setPaletteOpen, projects, inboxCount, dueReminderCount } =
    useApp();
  const pathname = usePathname();
  const badgeFor = (item: NavItem) =>
    item.badge === "inbox" ? inboxCount : item.badge === "reminders" ? dueReminderCount : undefined;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[3.75rem]" : "w-60",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-14 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1" aria-label={`${brand.name} home`}>
          <Logo className="size-6" />
          {!collapsed && <span className="font-display text-[1.15rem] font-semibold tracking-tight">{brand.name}</span>}
        </Link>
      </div>

      <div className={cn("space-y-1.5 px-3 pb-3", collapsed && "px-2")}>
        {collapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="w-full" onClick={() => openCapture()} aria-label="Quick capture">
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Quick capture (Q)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="w-full" onClick={() => setPaletteOpen(true)} aria-label="Search">
                  <Search />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (Ctrl K)</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Button className="w-full justify-start gap-2" onClick={() => openCapture()}>
              <Plus /> Quick capture
              <Kbd className="ml-auto border-white/20 bg-white/10 text-current">Q</Kbd>
            </Button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-full items-center gap-2 rounded-lg border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Search className="size-4" aria-hidden /> Search
              <Kbd className="ml-auto">Ctrl K</Kbd>
            </button>
          </>
        )}
      </div>

      <nav className={cn("scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 pb-3", collapsed && "px-2")}>
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} badge={badgeFor(item)} />
          ))}
        </div>
        <div className="space-y-0.5">
          {!collapsed && <p className="px-2 pb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/80">Library</p>}
          {LIBRARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} badge={badgeFor(item)} />
          ))}
        </div>
        {!collapsed && projects.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-2 pb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/80">Projects</p>
            {projects.slice(0, 12).map((p) => {
              const href = `/projects/${p.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={p.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-2.5 rounded-md px-2 text-[0.82rem] text-sidebar-foreground/85 hover:bg-sidebar-accent",
                    active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  {p.icon ? (
                    <span className="w-4 text-center text-xs" aria-hidden>
                      {p.icon}
                    </span>
                  ) : (
                    <span className={cn("ml-1 size-2 rounded-full", colorClasses(p.color).dot)} aria-hidden />
                  )}
                  <span className="truncate">{p.name}</span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="space-y-0.5">
          {!collapsed && <p className="px-2 pb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/80">Review</p>}
          {REVIEW_NAV.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className={cn("flex items-center gap-1 border-t border-sidebar-border p-2", collapsed && "flex-col")}>
        <NavLink item={{ href: "/settings", label: "Settings", icon: Settings }} collapsed={collapsed} />
        <div className={cn("flex items-center gap-1", !collapsed && "ml-auto")}>
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

export { ALL_NAV };
