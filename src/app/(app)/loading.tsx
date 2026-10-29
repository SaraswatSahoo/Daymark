import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 lg:pt-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-8 h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-5" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
