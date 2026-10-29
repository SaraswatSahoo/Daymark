import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeeklyReview } from "@/server/services/dashboard";
import { taskContext } from "@/server/actions/context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { ReviewView } from "@/components/review/review-view";
import { formatISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Weekly Review" };

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const sp = await searchParams;
  const offset = Math.max(-52, Math.min(0, Number(typeof sp.week === "string" ? sp.week : 0) || 0));
  const ctx = await taskContext();
  const data = await getWeeklyReview(ctx, offset);
  const range = `${formatISO(data.start, "MMM d")} – ${formatISO(data.end, "MMM d, yyyy")}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        eyebrow={offset === 0 ? "This week" : offset === -1 ? "Last week" : `${-offset} weeks ago`}
        title="Weekly Review"
        description={range}
        actions={
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Previous week">
              <Link href={`/review?week=${offset - 1}`}>
                <ChevronLeft />
              </Link>
            </Button>
            {offset !== 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/review">This week</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon-sm" aria-label="Next week" aria-disabled={offset === 0} className={offset === 0 ? "pointer-events-none opacity-40" : undefined}>
              <Link href={`/review?week=${Math.min(0, offset + 1)}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />
      <ReviewView
        key={data.start}
        range={range}
        start={data.start}
        completed={data.completed}
        open={data.open}
        notes={data.notes}
        createdCount={data.createdCount}
      />
    </div>
  );
}
