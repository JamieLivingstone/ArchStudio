import type { LucideIcon } from "lucide-react";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  iconOnly?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  fill?: boolean;
}

export function SegmentedControl<T extends string>({ segments, value, onChange, fill }: SegmentedControlProps<T>) {
  return (
    <div
      className={`rounded-lg p-0.5 ${fill ? "grid auto-cols-fr grid-flow-col" : "flex w-fit"} ${
        value === undefined ? "border border-dashed border-line" : "border border-transparent bg-hover"
      }`}
    >
      {segments.map(({ value: segment, label, icon: Icon, iconOnly, title }) => (
        <button
          key={segment}
          type="button"
          aria-pressed={value === segment}
          aria-label={iconOnly ? label : undefined}
          title={title ?? (iconOnly ? label : undefined)}
          onClick={() => onChange(segment)}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
            value === segment ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {Icon && <Icon size={iconOnly ? 15 : 13} />}
          {!iconOnly && label}
        </button>
      ))}
    </div>
  );
}
