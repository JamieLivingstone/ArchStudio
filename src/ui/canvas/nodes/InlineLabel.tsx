import { useState } from "react";
import { DESCRIPTION_LENGTH } from "../../../diagram/schema";
import { setDescription, setLabel } from "../../state";

function focusAndSelect(element: HTMLTextAreaElement | null) {
  element?.focus();
  element?.select();
}

const cell = "col-start-1 row-start-1 min-w-0 whitespace-pre-wrap wrap-anywhere";

interface InlineLabelProps {
  id: string;
  label: string;
  field?: "label" | "description";
  placeholder?: string;
  align?: "center" | "start";
  className?: string;
}

export function InlineLabel({
  id,
  label,
  field = "label",
  placeholder,
  align = "center",
  className = "",
}: InlineLabelProps) {
  const [editing, setEditing] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click to edit is a pointer shortcut on a canvas node
    <div
      onDoubleClick={() => setEditing(true)}
      className={`flex size-full items-center ${align === "center" ? "justify-center" : "justify-start"} ${className}`}
    >
      {editing ? (
        <div className="grid w-full min-w-8 grid-cols-[minmax(0,1fr)]">
          <span aria-hidden="true" className={`${cell} invisible`}>
            {label}
            {/* A zero-width space keeps a line's height when the text is empty or ends in a new line. */}
            {"\u200b"}
          </span>
          <textarea
            ref={focusAndSelect}
            aria-label={field === "description" ? "Description" : "Label"}
            rows={1}
            maxLength={field === "description" ? DESCRIPTION_LENGTH : undefined}
            value={label}
            onChange={(event) =>
              field === "description" ? setDescription(id, event.target.value) : setLabel(id, event.target.value)
            }
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              const submit = event.key === "Enter" && (event.metaKey || event.ctrlKey);
              if (submit || event.key === "Escape") event.currentTarget.blur();
            }}
            className={`${cell} nodrag nopan resize-none overflow-hidden border-0 bg-transparent p-0 [text-align:inherit] outline-none`}
          />
        </div>
      ) : (
        <span className="max-w-full whitespace-pre-wrap wrap-anywhere">
          {label || (placeholder && <span className="text-muted">{placeholder}</span>)}
        </span>
      )}
    </div>
  );
}
