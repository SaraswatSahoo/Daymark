import { describe, expect, it } from "vitest";
import { continueList, prefixLines, wrapSelection } from "@/components/notes/editor-commands";
import { linkifyWikiLinks, toggleChecklistLine } from "@/components/notes/markdown-preview";

describe("markdown editor commands", () => {
  it("wraps and unwraps a selection", () => {
    const r = wrapSelection("hello world", 6, 11, "**");
    expect(r.value).toBe("hello **world**");
    const back = wrapSelection(r.value, r.selectionStart, r.selectionEnd, "**");
    expect(back.value).toBe("hello world");
  });

  it("toggles line prefixes", () => {
    const r = prefixLines("a\nb", 0, 3, "- [ ] ");
    expect(r.value).toBe("- [ ] a\n- [ ] b");
    expect(prefixLines(r.value, 0, r.value.length, "- [ ] ").value).toBe("a\nb");
    expect(prefixLines("x\ny", 0, 3, (i) => `${i + 1}. `).value).toBe("1. x\n2. y");
  });

  it("continues and ends lists on Enter", () => {
    expect(continueList("- [x] done", 10)?.value).toBe("- [x] done\n- [ ] ");
    expect(continueList("3. item", 7)?.value).toBe("3. item\n4. ");
    expect(continueList("text\n- ", 7)?.value).toBe("text\n");
    expect(continueList("plain", 5)).toBeNull();
  });
});

describe("markdown preview helpers", () => {
  it("toggles a checklist line by index", () => {
    const md = "# Title\n- [ ] one\n- [x] two";
    expect(toggleChecklistLine(md, 1)).toBe("# Title\n- [x] one\n- [x] two");
    expect(toggleChecklistLine(md, 2)).toBe("# Title\n- [ ] one\n- [ ] two");
    expect(toggleChecklistLine(md, 0)).toBe(md);
  });

  it("converts wiki links without changing line structure", () => {
    const out = linkifyWikiLinks("See [[Project Plan]]\nand more");
    expect(out).toBe("See [Project Plan](/notes/resolve?title=Project%20Plan)\nand more");
    expect(out.split("\n")).toHaveLength(2);
  });
});
