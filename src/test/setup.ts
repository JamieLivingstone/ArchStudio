import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { emptyDiagram } from "../diagram/schema";
import { loadDiagram } from "../ui/state";

afterEach(() => {
  cleanup();
  loadDiagram(emptyDiagram());
});

class ResizeObserverStub {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect = { width: 100, height: 40 };
    this.callback([{ target, contentRect } as ResizeObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}
Object.defineProperty(globalThis, "DOMMatrixReadOnly", { value: DOMMatrixReadOnlyStub });

Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: { get: () => 100 },
  offsetHeight: { get: () => 40 },
});
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});

Element.prototype.scrollIntoView = () => {};
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
