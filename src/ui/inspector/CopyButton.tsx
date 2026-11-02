import { Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "../components/IconButton";

const looks = {
  idle: { label: "Copy message", icon: Copy },
  copied: { label: "Copied", icon: Check },
  failed: { label: "Could not copy", icon: X },
};

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<keyof typeof looks>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <IconButton
      {...looks[state]}
      title={looks[state].label}
      size="xs"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setState("copied"),
          () => setState("failed"),
        )
      }
    />
  );
}
