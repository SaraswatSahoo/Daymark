"use client";

import { memo } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Rewrites [[Note title]] to a resolver link (keeps line numbers intact for checkbox toggling). */
export function linkifyWikiLinks(md: string): string {
  return md.replace(/\[\[([^\]\n]{1,200})\]\]/g, (_m, title: string) => {
    const t = title.trim();
    return `[${t.replace(/([\[\]])/g, "\\$1")}](/notes/resolve?title=${encodeURIComponent(t)})`;
  });
}

/** Toggles the Markdown checklist item on a 0-based source line. */
export function toggleChecklistLine(md: string, lineIndex: number): string {
  const lines = md.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) return md;
  const m = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/);
  if (!m) return md;
  lines[lineIndex] = `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}`;
  return lines.join("\n");
}

export const MarkdownPreview = memo(function MarkdownPreview({
  content,
  onToggleCheckbox,
  className,
}: {
  content: string;
  onToggleCheckbox?: (lineIndex: number) => void;
  className?: string;
}) {
  const components: Components = {
    a({ href, children, node: _node, ...props }) {
      if (href?.startsWith("/notes/resolve")) {
        return (
          <Link href={href} className="wikilink">
            {children}
          </Link>
        );
      }
      const external = href && /^https?:\/\//.test(href);
      return (
        <a href={href} {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      );
    },
    li({ node, className: liClass, children, ...props }) {
      const isTask = liClass?.includes("task-list-item");
      if (!isTask || !onToggleCheckbox) return <li className={liClass} {...props}>{children}</li>;
      const line = (node?.position?.start.line ?? 1) - 1;
      return (
        <li className={liClass} {...props} data-line={line}>
          {children}
        </li>
      );
    },
    input({ node, type, checked, ...props }) {
      if (type !== "checkbox") return <input type={type} {...props} />;
      const line = (node?.position?.start.line ?? 0) - 1;
      return (
        <input
          type="checkbox"
          checked={!!checked}
          disabled={!onToggleCheckbox}
          aria-label={checked ? "Mark item as not done" : "Mark item as done"}
          onChange={(e) => {
            const li = (e.target as HTMLElement).closest("li[data-line]");
            const idx = li ? Number(li.getAttribute("data-line")) : line;
            if (idx >= 0) onToggleCheckbox?.(idx);
          }}
        />
      );
    },
  };

  return (
    <div className={cn("prose-daymark", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkifyWikiLinks(content)}
      </ReactMarkdown>
    </div>
  );
});
