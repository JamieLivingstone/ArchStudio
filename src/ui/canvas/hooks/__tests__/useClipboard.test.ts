import { renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { component, connection, diagram, ids, seed, selection, undoLabels } from "../../../../test/diagram";
import { getAppState, remove, undo } from "../../../state";
import { copySelection, pasteClip, useClipboard } from "../useClipboard";

const at = (x: number) => ({ position: { x, y: 10 } });
const start = (selected = ["a", "b"]) =>
  seed(
    [
      component("a", "A", "loadBalancer", at(0)),
      component("b", "B", "loadBalancer", at(100)),
      component("c", "C", "loadBalancer", at(200)),
    ],
    [connection("ab", "a", "b"), connection("bc", "b", "c")],
    selected,
  );

test("copies the selected objects and only the connections between them", () => {
  start();
  const clip = copySelection(getAppState());
  expect(clip.objects.map((object) => object.id)).toEqual(["a", "b"]);
  expect(clip.connections.map((line) => line.id)).toEqual(["ab"]);
});

test("pasted objects get new ids, are moved and keep their content", () => {
  start();
  const pasted = pasteClip(copySelection(getAppState()), 24);
  expect(pasted.objects).toHaveLength(2);
  expect(pasted.objects.map((object) => object.id)).not.toContain("a");
  expect(pasted.objects[0]).toMatchObject({ name: "A", position: { x: 24, y: 34 } });
  expect(pasted.objects[1].position).toEqual({ x: 124, y: 34 });
});

test("pasted connections join the pasted objects, not the originals", () => {
  start();
  const pasted = pasteClip(copySelection(getAppState()), 24);
  const [a, b] = pasted.objects;
  expect(pasted.connections).toHaveLength(1);
  expect(pasted.connections[0]).toMatchObject({ from: a.id, to: b.id });
  expect(pasted.connections[0].id).not.toBe("ab");
});

const clipboard = () => renderHook(() => useClipboard()).result.current;

test("there is nothing to paste before a copy, or to copy without a selection", () => {
  start([]);
  const { copy, cut, paste } = clipboard();
  expect(paste()).toBe(false);
  expect(copy()).toBe(false);
  expect(cut()).toBe(false);
  expect(ids()).toEqual(["a", "b", "c"]);
});

test("copy then paste adds copies and selects them, as one undo step", () => {
  start();
  const { copy, paste } = clipboard();
  expect(copy()).toBe(true);
  expect(paste()).toBe(true);
  expect(diagram().objects).toHaveLength(5);
  expect(diagram().connections).toHaveLength(3);
  expect(selection()).toEqual(ids().slice(3));

  undo();
  expect(ids()).toEqual(["a", "b", "c"]);
  expect(diagram().connections).toHaveLength(2);
});

test("each further paste lands a step further away", () => {
  start(["a"]);
  const { copy, paste } = clipboard();
  copy();
  paste();
  paste();
  expect(
    diagram()
      .objects.slice(3)
      .map((object) => object.position.x),
  ).toEqual([24, 48]);
});

test("cut removes the selection and its connections; paste puts it back in place", () => {
  start();
  const { cut, paste } = clipboard();
  expect(cut()).toBe(true);
  expect(ids()).toEqual(["c"]);
  expect(diagram().connections).toEqual([]);
  expect(undoLabels()).toEqual(["Cut"]);

  paste();
  expect(diagram().objects).toHaveLength(3);
  expect(diagram().objects[1].position).toEqual({ x: 0, y: 10 });
  expect(diagram().connections).toHaveLength(1);
});

test("copying a group takes what it contains, and the pasted copies sit in the pasted group", () => {
  seed(
    [
      {
        type: "boundary",
        id: "payments",
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        name: "Payments",
      },
      component("api", "API", "service", { parent: "payments" }),
    ],
    [],
    ["payments"],
  );
  const pasted = pasteClip(copySelection(getAppState()), 24);
  expect(pasted.objects.map((object) => object.type)).toEqual(["boundary", "component"]);
  expect(pasted.objects[1].parent).toBe(pasted.objects[0].id);
});

test("a copy pastes onto the canvas if its boundary was deleted since", () => {
  seed(
    [
      { type: "boundary", id: "payments", position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, name: "" },
      component("api", "API", "service", { parent: "payments" }),
    ],
    [],
    ["api"],
  );
  const { copy, paste } = clipboard();
  copy();
  remove(["payments"]);
  expect(paste()).toBe(true);
  expect(diagram().objects[1]).not.toHaveProperty("parent");
});
