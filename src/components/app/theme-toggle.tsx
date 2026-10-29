"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { updateSettingsAction } from "@/server/actions/settings";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Changes the theme immediately (local) and persists it to settings in the background. */
export function useThemePreference() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const change = (value: string) => {
    setTheme(value);
    void updateSettingsAction({ theme: value as "light" | "dark" | "system" });
  };
  return { theme: theme ?? "system", resolvedTheme, setTheme: change };
}

export function ThemeToggle() {
  const mounted = useMounted();
  const { theme, resolvedTheme, setTheme } = useThemePreference();
  const Icon = !mounted ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
