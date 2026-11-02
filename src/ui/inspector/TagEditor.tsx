import { X } from "lucide-react";
import { useState } from "react";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  noun?: string;
}

export function TagEditor({ tags, onChange, noun = "tag" }: TagEditorProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const tag = draft.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 transition-colors focus-within:border-accent">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-full bg-accent/10 py-0.5 pr-1 pl-2 text-xs text-accent"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((other) => other !== tag))}
            className="rounded-full p-0.5 hover:bg-accent/20"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        aria-label={`Add a ${noun}`}
        value={draft}
        placeholder={tags.length === 0 ? `Add a ${noun}` : ""}
        onChange={(event) => setDraft(event.target.value.replace(/,/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        className="min-w-16 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}
