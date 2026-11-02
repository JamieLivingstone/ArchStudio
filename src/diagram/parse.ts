import { type Diagram, diagramSchema, SCHEMA_VERSION } from "./schema";
import { validateDiagram } from "./validate";

export function parseDiagram(text: string): { diagram: Diagram } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "This file is not valid JSON." };
  }
  const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    return { error: "It was saved by a newer version of ArchStudio. Update the app to open it." };
  }
  const parsed = diagramSchema.safeParse(json);
  if (!parsed.success) return { error: "This file is not an ArchStudio diagram." };
  const [issue] = validateDiagram(parsed.data);
  return issue ? { error: issue.message } : { diagram: parsed.data };
}

export const serializeDiagram = (diagram: Diagram) => `${JSON.stringify(diagram, null, 2)}\n`;
