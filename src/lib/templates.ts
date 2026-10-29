import { format } from "date-fns";
import { parseISODateUTCAsLocal } from "./dates";

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  title: (today: string) => string;
  content: (today: string) => string;
}

const longDate = (iso: string) => format(parseISODateUTCAsLocal(iso), "EEEE, MMMM d, yyyy");

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Blank note",
    description: "Start from an empty page.",
    title: () => "",
    content: () => "",
  },
  {
    id: "journal",
    name: "Daily Journal",
    description: "Intentions, gratitude and reflection.",
    title: (d) => longDate(d),
    content: () =>
      `## Today's intention\n\n\n## Top three\n- [ ] \n- [ ] \n- [ ] \n\n## Grateful for\n- \n\n## Notes\n\n\n## Reflection\n_What went well? What would I change?_\n`,
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    description: "Attendees, agenda, decisions and action items.",
    title: (d) => `Meeting — ${format(parseISODateUTCAsLocal(d), "MMM d")}`,
    content: () =>
      `**Date:** \n**Attendees:** \n\n## Agenda\n1. \n\n## Discussion\n\n\n## Decisions\n- \n\n## Action items\n- [ ] \n`,
  },
  {
    id: "study",
    name: "Study Notes",
    description: "Key concepts, questions and a summary (Cornell style).",
    title: () => "Study notes — ",
    content: () =>
      `**Course / topic:** \n**Source:** \n\n## Key concepts\n- \n\n## Notes\n\n\n## Questions to review\n- \n\n## Summary\n_In my own words…_\n`,
  },
  {
    id: "project",
    name: "Project Notes",
    description: "Goal, scope, milestones and open questions.",
    title: () => "Project — ",
    content: () =>
      `## Goal\n\n\n## Why it matters\n\n\n## Scope\n- In: \n- Out: \n\n## Milestones\n- [ ] \n\n## Open questions\n- \n\n## Resources\n- \n`,
  },
  {
    id: "braindump",
    name: "Brain Dump",
    description: "Get everything out of your head, sort later.",
    title: (d) => `Brain dump — ${format(parseISODateUTCAsLocal(d), "MMM d")}`,
    content: () => `_Write everything on your mind. Don't organize yet._\n\n- \n`,
  },
];

export function getTemplate(id: string | undefined | null): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0];
}

export function journalTemplate(date: string) {
  const t = getTemplate("journal");
  return { title: t.title(date), content: t.content(date) };
}
