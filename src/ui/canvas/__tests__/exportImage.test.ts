import { toBlob } from "html-to-image";
import { afterEach, expect, test, vi } from "vitest";
import { renderImage } from "../exportImage";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height }) as DOMRect;

// At half zoom, with the viewport panned to (10, 20).
const nodes = [rect(60, 45, 60, 30), rect(110, 65, 50, 30)];

function canvas(boxes = nodes, zoom = 0.5) {
  vi.stubGlobal(
    "DOMMatrix",
    class {
      a = zoom;
    },
  );
  const viewport = document.createElement("div");
  viewport.className = "react-flow__viewport";
  viewport.getBoundingClientRect = () => rect(10, 20, 0, 0);
  for (const box of boxes) {
    const node = document.createElement("div");
    node.className = "react-flow__node";
    node.getBoundingClientRect = () => box;
    viewport.append(node);
  }
  document.body.append(viewport);
  return viewport;
}

test("draws every node at full size, with a margin, whatever the zoom", async () => {
  const viewport = canvas();
  const image = new Blob(["image"]);
  vi.mocked(toBlob).mockResolvedValue(image);
  expect(await renderImage()).toBe(image);
  const [element, options] = vi.mocked(toBlob).mock.calls[0];
  expect(element).toBe(viewport);
  expect(options).toMatchObject({
    width: 280,
    height: 180,
    pixelRatio: 2,
    style: { width: "280px", height: "180px", transform: "translate(-60px, -10px) scale(1)" },
  });
});

test("a very large diagram is drawn smaller rather than past what a canvas can hold", async () => {
  canvas([rect(100, 50, 7920, 60)], 1);
  vi.mocked(toBlob).mockResolvedValue(new Blob(["x"]));
  await renderImage();
  expect(vi.mocked(toBlob).mock.calls[0][1]?.pixelRatio).toBe(1);
});

test("is marked as exporting only while the image is drawn, even when that fails", async () => {
  const viewport = canvas();
  vi.mocked(toBlob).mockImplementationOnce(async () => {
    expect(viewport.classList.contains("exporting")).toBe(true);
    return new Blob(["x"]);
  });
  await renderImage();
  expect(viewport.classList.contains("exporting")).toBe(false);

  vi.mocked(toBlob).mockRejectedValueOnce(new Error("Out of memory."));
  await expect(renderImage()).rejects.toThrow("Out of memory.");
  expect(viewport.classList.contains("exporting")).toBe(false);
});

test("says so when there is no canvas, or no image comes back", async () => {
  await expect(renderImage()).rejects.toThrow("The canvas is not ready.");
  canvas();
  vi.mocked(toBlob).mockResolvedValue(null);
  await expect(renderImage()).rejects.toThrow("The image came out empty.");
});
