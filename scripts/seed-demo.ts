/**
 * Optional demo data for trying Daymark out. Never runs automatically.
 *
 *   npm run db:seed-demo              # refuses if the database already has content
 *   npm run db:seed-demo -- --force   # add demo content anyway
 *
 * Tip: point DATABASE_URL at a separate file to keep demo data away from your real data:
 *   DATABASE_URL="file:./demo.db" npx prisma migrate deploy && DATABASE_URL="file:./demo.db" npm run db:seed-demo
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function iso(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}

async function main() {
  const existing = (await db.task.count()) + (await db.note.count()) + (await db.project.count());
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error("The database already has data. Re-run with --force to add demo content anyway.");
    process.exit(1);
  }

  const course = await db.project.create({ data: { name: "Distributed Systems", icon: "📘", color: "indigo", description: "CS 4510 — fall semester" } });
  const internship = await db.project.create({ data: { name: "Internship search", icon: "💼", color: "green", description: "Summer internship applications" } });
  const side = await db.project.create({ data: { name: "Plant watering app", icon: "🌱", color: "teal" } });

  const tag = (name: string) => ({ where: { name }, create: { name } });

  const lecture = await db.note.create({
    data: {
      title: "Lecture 7 — Consensus and Raft",
      projectId: course.id,
      pinned: true,
      tags: { connectOrCreate: [tag("lecture")] },
      content:
        "## Key ideas\n- Leader election uses randomized timeouts\n- Log replication: leader appends, followers acknowledge\n- A log entry is **committed** once a majority stores it\n\n## Questions\n- [ ] Why can't a stale leader commit entries from a previous term?\n- [x] Read section 5.4 of the paper\n\nSee also [[Problem set 3 plan]].",
    },
  });
  await db.note.create({
    data: {
      title: "Problem set 3 plan",
      projectId: course.id,
      content: "1. Re-read the Raft paper sections 5.2–5.4\n2. Implement leader election\n3. Write tests for split votes\n\n> Due next Friday. Office hours Tuesday 3pm.",
    },
  });
  await db.note.create({
    data: {
      title: "Companies to apply to",
      projectId: internship.id,
      tags: { connectOrCreate: [tag("career")] },
      content: "| Company | Deadline | Status |\n|---|---|---|\n| Acme Robotics | Nov 15 | Drafting |\n| Northwind | Dec 1 | Not started |",
    },
  });
  await db.note.create({ data: { title: "Brain dump", inbox: true, content: "- try a standing desk\n- ask Sam about the hackathon\n- renew library card" } });

  const tasks = [
    { title: "Finish problem set 3", dueDate: iso(3), priority: 2, projectId: course.id, noteId: lecture.id, myDayDate: iso(0) },
    { title: "Review Raft lecture notes", dueDate: iso(0), priority: 1, projectId: course.id },
    { title: "Update résumé with research project", dueDate: iso(1), priority: 3, projectId: internship.id },
    { title: "Apply to Acme Robotics", dueDate: iso(5), priority: 2, projectId: internship.id },
    { title: "Sketch the watering schedule screen", projectId: side.id, priority: 1 },
    { title: "Pay phone bill", dueDate: iso(-1), priority: 2 },
    { title: "Call grandma", dueDate: iso(2), priority: 1 },
    { title: "Water the plants", dueDate: iso(0), priority: 0, recurrence: JSON.stringify({ freq: "weekly", interval: 1 }) },
  ];
  for (const t of tasks) await db.task.create({ data: t });
  await db.task.create({
    data: {
      title: "Prepare for mock interview",
      dueDate: iso(4),
      priority: 2,
      projectId: internship.id,
      subtasks: { create: [{ title: "Review system design basics", done: true }, { title: "Practice two LeetCode mediums" }, { title: "Prepare questions for the interviewer" }] },
    },
  });
  const done = await db.task.create({ data: { title: "Submit course registration", status: "done", completedAt: new Date() } });
  void done;

  const at = (days: number, h: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  await db.reminder.create({ data: { title: "Office hours with Prof. Lee", remindAt: at(1, 14), projectId: course.id } });
  await db.reminder.create({ data: { title: "Weekly review", remindAt: at(3, 18), recurrence: JSON.stringify({ freq: "weekly", interval: 1 }) } });
  await db.inboxItem.create({ data: { content: "Idea: a CLI that turns lecture slides into flashcards" } });

  console.log("Demo data added. Open the app and look around!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
