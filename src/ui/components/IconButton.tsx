import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./Tooltip";

const sizes = {
  xs: { button: "size-6", icon: 13 },
  sm: { button: "size-8", icon: 16 },
  md: { button: "size-9", icon: 18 },
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: LucideIcon;
  description?: string;
  tooltip?: "left" | "right" | "top" | "top-start";
  size?: keyof typeof sizes;
  active?: boolean;
  children?: ReactNode;
}

export function IconButton({
  label,
  icon: Icon,
  description,
  tooltip,
  size = "md",
  active,
  children,
  ...button
}: IconButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        {...button}
        className={`flex ${sizes[size].button} items-center justify-center rounded-lg transition-colors disabled:opacity-35 ${
          active ? "bg-hover text-fg" : "text-muted enabled:hover:bg-hover enabled:hover:text-fg"
        }`}
      >
        <Icon size={sizes[size].icon} strokeWidth={1.75} />
      </button>
      {tooltip && <Tooltip title={label} description={description} side={tooltip} />}
      {children}
    </div>
  );
}
