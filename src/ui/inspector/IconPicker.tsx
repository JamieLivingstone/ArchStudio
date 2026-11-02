import type { LucideIcon } from "lucide-react";
import { iconChoices } from "../icons";

interface IconPickerProps {
  value: string | undefined;
  fallback: LucideIcon;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, fallback: Fallback, onChange }: IconPickerProps) {
  const cell = (chosen: boolean) =>
    `flex aspect-square items-center justify-center rounded-md transition-colors ${
      chosen ? "bg-accent/15 text-accent" : "text-muted hover:bg-hover hover:text-fg"
    }`;

  return (
    <fieldset aria-label="Icon" className="grid min-w-0 grid-cols-8 gap-0.5">
      <button
        type="button"
        aria-label="Default icon"
        aria-pressed={!value}
        title="Default"
        onClick={() => onChange(undefined)}
        className={cell(!value)}
      >
        <Fallback size={16} strokeWidth={1.75} />
      </button>
      {Object.entries(iconChoices).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          aria-pressed={value === name}
          title={name}
          onClick={() => onChange(name)}
          className={cell(value === name)}
        >
          <Icon size={16} strokeWidth={1.75} />
        </button>
      ))}
    </fieldset>
  );
}
