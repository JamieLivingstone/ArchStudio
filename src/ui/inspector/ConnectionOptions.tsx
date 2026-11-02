import { ArrowLeft, ArrowLeftRight, ArrowRight, Minus } from "lucide-react";
import type { Connection } from "../../diagram/schema";
import { type Segment, SegmentedControl } from "../components/SegmentedControl";
import { setConnectionStyle } from "../state";

const directions: Segment<Connection["direction"]>[] = [
  { value: "forward", label: "Forward", icon: ArrowRight, iconOnly: true },
  { value: "backward", label: "Backward", icon: ArrowLeft, iconOnly: true },
  { value: "both", label: "Both directions", icon: ArrowLeftRight, iconOnly: true },
  { value: "none", label: "No arrowheads", icon: Minus, iconOnly: true },
];

const lines: Segment<Connection["line"]>[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "flow", label: "Flow" },
];

const legend = "pb-1.5 text-xs font-medium text-muted";

export function ConnectionOptions({ connection }: { connection: Connection }) {
  const { id, direction, line } = connection;

  return (
    <section aria-label="Connection options" className="flex flex-col gap-4">
      <fieldset>
        <legend className={legend}>Arrowheads</legend>
        <SegmentedControl
          segments={directions}
          value={direction}
          onChange={(next) => setConnectionStyle(id, { direction: next })}
          fill
        />
      </fieldset>
      <fieldset>
        <legend className={legend}>Line</legend>
        <SegmentedControl
          segments={lines}
          value={line}
          onChange={(next) => setConnectionStyle(id, { line: next })}
          fill
        />
      </fieldset>
    </section>
  );
}
