import type { Metadata } from "next";
import { getInbox } from "@/server/services/inbox";
import { PageHeader } from "@/components/common/page-header";
import { InboxView } from "@/components/inbox/inbox-view";
import { InboxCaptureButton } from "@/components/inbox/inbox-capture-button";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const inbox = await getInbox();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        title="Inbox"
        description={
          inbox.count
            ? `${inbox.count} ${inbox.count === 1 ? "item" : "items"} to organize. Give each a home — or let it go.`
            : "Capture first, organize later."
        }
        actions={<InboxCaptureButton />}
      />
      <InboxView ideas={inbox.ideas} tasks={inbox.tasks} notes={inbox.notes} />
    </div>
  );
}
