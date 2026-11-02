import { useEffect, useRef } from "react";

export function isTyping(event: KeyboardEvent): boolean {
  return (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  );
}

export const inDialog = () => document.querySelector("dialog[open]") !== null;

export function hasCommandKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function useKeyDown(handler: (event: KeyboardEvent) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => latest.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
