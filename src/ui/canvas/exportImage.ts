import { toBlob } from "html-to-image";

const PADDING = 40;
const MAX_SIDE = 8000;

// Measured from the canvas, as what is drawn is the only place a node's size is known.
function boundsOfNodes(viewport: HTMLElement) {
  const origin = viewport.getBoundingClientRect();
  const zoom = new DOMMatrix(getComputedStyle(viewport).transform).a;
  const boxes = [...viewport.querySelectorAll(".react-flow__node")].map((node) => node.getBoundingClientRect());
  const x = (Math.min(...boxes.map((box) => box.left)) - origin.left) / zoom;
  const y = (Math.min(...boxes.map((box) => box.top)) - origin.top) / zoom;
  const right = (Math.max(...boxes.map((box) => box.right)) - origin.left) / zoom;
  const bottom = (Math.max(...boxes.map((box) => box.bottom)) - origin.top) / zoom;
  return { x, y, width: right - x, height: bottom - y };
}

export async function renderImage(): Promise<Blob> {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) throw new Error("The canvas is not ready.");

  const bounds = boundsOfNodes(viewport);
  const width = Math.ceil(bounds.width + 2 * PADDING);
  const height = Math.ceil(bounds.height + 2 * PADDING);
  // Drawn at full size whatever the zoom, by replacing the viewport's own transform in the copy.
  const options = {
    width,
    height,
    skipFonts: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    pixelRatio: Math.min(2, MAX_SIDE / Math.max(width, height)),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
  };

  viewport.classList.add("exporting");
  try {
    const blob = await toBlob(viewport, options);
    if (!blob) throw new Error("The image came out empty.");
    return blob;
  } finally {
    viewport.classList.remove("exporting");
  }
}
