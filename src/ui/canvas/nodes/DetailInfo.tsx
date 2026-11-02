import { Info } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { OptionDefinition } from "../../../diagram/componentKinds";

const MIN_WIDTH = 220;
const GAP = 6;

function placeCard(icon: Element) {
  const node = (icon.closest(".react-flow__node") ?? icon).getBoundingClientRect();
  const width = Math.max(node.width, MIN_WIDTH);
  return { node, left: Math.min(node.left, window.innerWidth - width - GAP), width };
}

export function DetailInfo({ option, value }: { option: OptionDefinition; value: string }) {
  const [place, setPlace] = useState<ReturnType<typeof placeCard>>();
  const chosen = option.type === "choice" ? option.choices.find((choice) => choice.value === value) : undefined;

  return (
    <>
      <span
        role="img"
        aria-label={`About ${option.label}`}
        onPointerEnter={(event) => setPlace(placeCard(event.currentTarget))}
        onPointerLeave={() => setPlace(undefined)}
        className={`inline-flex shrink-0 cursor-help rounded-full p-px transition-colors ${
          place ? "bg-accent/15 text-accent" : "text-muted/60 hover:bg-accent/15 hover:text-accent"
        }`}
      >
        <Info size={11} />
      </span>
      {place &&
        createPortal(
          <div
            role="tooltip"
            style={{
              width: place.width,
              left: place.left,
              ...(window.innerHeight - place.node.bottom < 160
                ? { bottom: window.innerHeight - place.node.top + GAP }
                : { top: place.node.bottom + GAP }),
            }}
            className="floating pointer-events-none fixed z-50 rounded-lg px-3 py-2 text-left"
          >
            <p className="text-[13px] font-medium text-fg">{option.label}</p>
            <p className="text-[11px] leading-snug text-muted">{option.description}</p>
            {chosen && (
              <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] leading-snug text-muted">
                <span className="font-medium text-fg">{chosen.value}: </span>
                {chosen.description}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
