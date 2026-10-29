import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-16">
      <EmptyState icon={SearchX} title="Not found" description="This item may have been deleted, or the link is wrong.">
        <Button asChild variant="outline" size="sm">
          <Link href="/">Go home</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
