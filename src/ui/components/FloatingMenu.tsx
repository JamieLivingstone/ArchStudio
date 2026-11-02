import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const GAP = 4;
const MAX_HEIGHT = 288;

interface FloatingMenuProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  role: "menu" | "listbox";
  label: string;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}

export function FloatingMenu({
  anchor,
  onClose,
  role,
  label,
  align = "left",
  className = "",
  children,
}: FloatingMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (target: EventTarget | null) =>
      !ref.current?.contains(target as Node) && !anchor?.contains(target as Node);
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    const onScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;
  const box = anchor.getBoundingClientRect();
  const below = window.innerHeight - box.bottom;
  const upwards = below < MAX_HEIGHT && box.top > below;
  const style: CSSProperties = {
    ...(align === "right" ? { right: window.innerWidth - box.right } : { left: box.left }),
    ...(upwards ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
    maxHeight: Math.min(MAX_HEIGHT, (upwards ? box.top : below) - 2 * GAP),
  };

  const shared = {
    ref,
    style,
    className: `floating fixed z-50 flex flex-col overflow-y-auto rounded-lg p-1 text-sm ${className}`,
    children,
  };
  return createPortal(
    role === "menu" ? (
      <div role="menu" aria-label={label} {...shared} />
    ) : (
      <div role="listbox" aria-label={label} {...shared} />
    ),
    document.body,
  );
}
