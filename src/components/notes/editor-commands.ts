/** Pure text transforms for the Markdown toolbar. Each returns the new value and selection. */
export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(value: string, start: number, end: number, before: string, after = before, placeholder = "text"): EditResult {
  const selected = value.slice(start, end) || placeholder;
  // Toggle off if already wrapped.
  if (value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after && end > start) {
    const v = value.slice(0, start - before.length) + value.slice(start, end) + value.slice(end + after.length);
    return { value: v, selectionStart: start - before.length, selectionEnd: end - before.length };
  }
  const v = value.slice(0, start) + before + selected + after + value.slice(end);
  return { value: v, selectionStart: start + before.length, selectionEnd: start + before.length + selected.length };
}

/** Adds (or removes, if every line already has it) a prefix on each selected line. */
export function prefixLines(value: string, start: number, end: number, prefix: string | ((i: number) => string)): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const pfx = (i: number) => (typeof prefix === "function" ? prefix(i) : prefix);
  const pattern = typeof prefix === "string" ? null : /^\d+\.\s/;
  const all = lines.every((l, i) => (pattern ? pattern.test(l) : l.startsWith(pfx(i))));
  const next = lines.map((l, i) => (all ? (pattern ? l.replace(pattern, "") : l.slice(pfx(i).length)) : pfx(i) + l));
  const replaced = next.join("\n");
  const v = value.slice(0, lineStart) + replaced + value.slice(lineEnd);
  return { value: v, selectionStart: lineStart, selectionEnd: lineStart + replaced.length };
}

export function insertText(value: string, start: number, end: number, text: string): EditResult {
  const v = value.slice(0, start) + text + value.slice(end);
  return { value: v, selectionStart: start + text.length, selectionEnd: start + text.length };
}

/** Continues lists/checklists when pressing Enter at the end of a list item. Returns null if not applicable. */
export function continueList(value: string, caret: number): EditResult | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  const m = line.match(/^(\s*)([-*+]\s\[[ xX]\]\s|[-*+]\s|(\d+)\.\s)(.*)$/);
  if (!m) return null;
  const [, indent, marker, num, rest] = m;
  if (!rest.trim()) {
    // Empty item: end the list.
    const v = value.slice(0, lineStart) + value.slice(caret);
    return { value: v, selectionStart: lineStart, selectionEnd: lineStart };
  }
  let nextMarker = marker;
  if (num) nextMarker = `${Number(num) + 1}. `;
  else if (/\[[ xX]\]/.test(marker)) nextMarker = marker.replace(/\[[xX]\]/, "[ ]");
  return insertText(value, caret, caret, `\n${indent}${nextMarker}`);
}
