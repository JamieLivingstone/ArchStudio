import { Check, ChevronDown, X } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import {
  AUTO,
  type ComponentKind,
  getKindDefinition,
  INDEFINITE,
  isApplicable,
  isValidOptionValue,
  type OptionDefinition,
  type OptionValue,
  withOption,
} from "../../diagram/componentKinds";
import {
  type DatabaseStructure,
  describeStructureSize,
  emptyStructure,
  isDataModel,
  structureLabels,
} from "../../diagram/databaseStructure";
import { FloatingMenu } from "../components/FloatingMenu";
import { SegmentedControl } from "../components/SegmentedControl";
import { setOptions, setStructure } from "../state";
import { StructureEditor } from "./StructureEditor";

const control =
  "h-7 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none transition-colors placeholder:text-muted hover:border-muted/50 focus:border-accent";

interface ComponentDetailsProps {
  id: string;
  kind: ComponentKind;
  options: Record<string, OptionValue>;
  structure?: DatabaseStructure;
}

export function ComponentDetails({ id, kind, options, structure }: ComponentDetailsProps) {
  const definition = getKindDefinition(kind);
  const [pendingModel, setPendingModel] = useState<string | null>();

  if (definition.options.length === 0) return null;

  const applicable = definition.options.filter((option) => isApplicable(option, options));
  const model = isDataModel(options.model) ? options.model : undefined;

  function set(key: string, value: OptionValue | undefined, typingIn?: string) {
    if (key === "model" && structure && structure.model !== value) {
      setPendingModel(value === undefined ? null : String(value));
      return;
    }
    setOptions(id, withOption(kind, options, key, value), typingIn);
  }

  function confirmModel() {
    setOptions(id, withOption(kind, options, "model", pendingModel ?? undefined));
    setPendingModel(undefined);
  }

  return (
    <section aria-label={`${definition.label} details`} className="flex flex-col">
      {applicable.map((option) => (
        <div key={option.key}>
          <Row
            label={option.label}
            onClear={options[option.key] === undefined ? undefined : () => set(option.key, undefined)}
          >
            <OptionControl
              option={option}
              value={options[option.key]}
              onChange={(value, typing) => set(option.key, value, typing ? `${id} ${option.key}` : undefined)}
            />
          </Row>
          {option.key === "model" && pendingModel !== undefined && structure && (
            <div role="alert" className="mb-1 rounded-lg bg-amber-500/10 p-2.5 text-xs">
              <p>
                {pendingModel === null ? "Clearing the data model" : `Switching to ${pendingModel}`} removes the{" "}
                {structureLabels[structure.model].toLowerCase()} defined for {structure.model} (
                {describeStructureSize(structure)}).
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={confirmModel}
                  className="rounded-md bg-fg px-2 py-1 font-medium text-surface"
                >
                  {pendingModel === null ? "Clear" : "Switch"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingModel(undefined)}
                  className="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-fg"
                >
                  Keep {structure.model}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {model && (
        <div className="mt-2">
          <Row label={structureLabels[model]} onClear={structure ? () => setStructure(id, null) : undefined} />
          <StructureEditor
            structure={structure?.model === model ? structure : emptyStructure(model)}
            onChange={(next) => setStructure(id, next)}
          />
        </div>
      )}
    </section>
  );
}

function Row({ label, onClear, children }: { label: string; onClear?: () => void; children?: ReactNode }) {
  return (
    <fieldset aria-label={label} className="group min-w-0 py-1">
      <div className="flex min-h-7 items-center gap-2">
        <span title={label} className="min-w-0 flex-1 truncate text-[13px] text-fg">
          {label}
        </span>
        {children && <div className="w-36 shrink-0">{children}</div>}
        {onClear ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={onClear}
            className="-mr-1 shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-hover hover:text-fg focus:opacity-100 group-hover:opacity-100"
          >
            <X size={13} />
          </button>
        ) : (
          <span className="-mr-1 w-[17px] shrink-0" />
        )}
      </div>
    </fieldset>
  );
}

interface OptionControlProps {
  option: OptionDefinition;
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined, typing?: boolean) => void;
}

export function OptionControl({ option, value, onChange }: OptionControlProps) {
  switch (option.type) {
    case "toggle":
      return (
        <SegmentedControl
          segments={[
            { value: "On", label: "On" },
            { value: "Off", label: "Off" },
          ]}
          value={value === true ? "On" : value === false ? "Off" : undefined}
          onChange={(chosen) => onChange(chosen === "On")}
          fill
        />
      );
    case "choice":
      return <ChoiceSelect option={option} value={value} onChange={onChange} />;
    default:
      return <TypedField option={option} value={value} onChange={onChange} />;
  }
}

function ChoiceSelect({ option, value, onChange }: OptionControlProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (option.type !== "choice") return null;

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={option.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${control} flex items-center justify-between gap-1 text-left ${value === undefined ? "text-muted" : ""}`}
      >
        <span className="truncate">{value === undefined ? "Not set" : String(value)}</span>
        <ChevronDown size={13} className="shrink-0 text-muted" />
      </button>
      {open && (
        <FloatingMenu
          anchor={anchor}
          onClose={close}
          role="listbox"
          label={option.label}
          align="right"
          className="w-64"
        >
          {option.choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="option"
              aria-selected={choice.value === value}
              onClick={() => {
                close();
                onChange(choice.value);
              }}
              className={`relative rounded-md py-1.5 pr-7 pl-2 text-left transition-colors hover:bg-hover ${
                choice.value === value ? "bg-accent/5" : ""
              }`}
            >
              <span className="block text-[13px] text-fg">{choice.value}</span>
              <span className="block text-[11px] leading-snug text-muted">{choice.description}</span>
              {choice.value === value && <Check size={14} className="absolute top-2 right-2 text-accent" />}
            </button>
          ))}
        </FloatingMenu>
      )}
    </>
  );
}

const alternativeTo = (option: OptionDefinition) =>
  option.type === "number" && option.auto
    ? AUTO
    : option.type === "duration" && option.indefinite
      ? INDEFINITE
      : undefined;

const examples: Partial<Record<OptionDefinition["type"], string>> = { number: "e.g. 3", duration: "e.g. 15m" };

function TypedField({ option, value, onChange }: OptionControlProps) {
  const shown = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(shown);
  }

  const alternative = alternativeTo(option);
  const parse = (text: string): OptionValue | undefined => {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    if (alternative && trimmed.toLowerCase() === alternative.toLowerCase()) return alternative;
    if (option.type === "number") return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
    return trimmed;
  };
  const parsed = parse(draft);
  const invalid = draft.trim() !== "" && (parsed === undefined || !isValidOptionValue(option, parsed));
  const example = examples[option.type];

  return (
    <input
      aria-label={option.label}
      aria-invalid={invalid}
      title={alternative ? `A value, or ${alternative}` : undefined}
      value={draft}
      placeholder={alternative && example ? `${example} or ${alternative}` : example}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = parse(event.target.value);
        if (!event.target.value.trim()) onChange(undefined, true);
        else if (next !== undefined && isValidOptionValue(option, next)) onChange(next, true);
      }}
      className={`${control} ${invalid ? "border-red-500 focus:border-red-500" : ""}`}
    />
  );
}
