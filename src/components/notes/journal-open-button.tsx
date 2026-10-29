"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/common/fields";
import { act } from "@/lib/client/action";
import { openJournalAction } from "@/server/actions/notes";

export function JournalOpenButton({ existingId }: { existingId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const open = async (d?: string) => {
    if (!d && existingId) return router.push(`/notes/${existingId}`);
    setBusy(true);
    const id = await act(openJournalAction(d));
    setBusy(false);
    if (id) router.push(`/notes/${id}`);
  };
  return (
    <div className="flex items-center gap-2">
      <DateInput value={date} onChange={(d) => { setDate(d); if (d) void open(d); }} aria-label="Open entry for date" className="w-36" />
      <Button size="sm" onClick={() => open()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <BookOpen />} {existingId ? "Open today" : "Start today's entry"}
      </Button>
    </div>
  );
}
