const sides = {
  right: "top-1/2 left-full ml-3.5 -translate-y-1/2",
  left: "top-1/2 right-full mr-3.5 -translate-y-1/2",
  top: "bottom-full left-1/2 mb-3.5 -translate-x-1/2",
  "top-start": "bottom-full left-0 mb-3.5",
};

interface TooltipProps {
  title: string;
  description?: string;
  side: keyof typeof sides;
}

export function Tooltip({ title, description, side }: TooltipProps) {
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-10 ${sides[side]} rounded-lg bg-fg px-2.5 py-1.5 whitespace-nowrap text-surface opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100`}
    >
      <p className="text-xs font-medium">{title}</p>
      {description && <p className="text-[11px] opacity-70">{description}</p>}
    </div>
  );
}
