import { type EditOperation, toDiagramOperations } from "../agents/editOperations";
import type { ComponentKind } from "../diagram/componentKinds";
import type { DiagramOperation } from "../diagram/operations";
import type { Component, Diagram } from "../diagram/schema";

export function exampleProposal(diagram: Diagram): DiagramOperation[] {
  const id = () => crypto.randomUUID();
  const add = (newId: string, kind: ComponentKind, name: string, extra: Partial<Component> = {}): EditOperation => ({
    type: "object.add",
    object: { type: "component", id: newId, kind, name, options: {}, ...extra },
  });
  const connect = (from: string, to: string, label = "", line: "solid" | "dashed" = "solid"): EditOperation => ({
    type: "connection.add",
    connection: { id: id(), from, to, label, direction: "forward", line },
  });
  const putInFront = (target: Component, through: string, onward: string): EditOperation[] => [
    ...diagram.connections
      .filter((connection) => connection.to === target.id)
      .flatMap((connection): EditOperation[] => [
        { type: "connection.remove", id: connection.id },
        connect(connection.from, through, connection.label),
      ]),
    connect(through, target.id, onward),
  ];
  const beside = (component: Component) => (component.parent ? { parent: component.parent } : {});

  const components = diagram.objects.filter((object) => object.type === "component");
  const database = components.find((component) => component.kind === "database");
  const edits = (): EditOperation[] => {
    if (components.length === 0) {
      const [web, api, orders] = [id(), id(), id()];
      return [
        add(web, "webClient", "Web"),
        add(api, "service", "API", { options: { state: "Stateless" } }),
        add(orders, "database", "Orders database", { tags: ["PostgreSQL"], options: { model: "Relational" } }),
        connect(web, api, "HTTPS"),
        connect(api, orders, "SQL"),
      ];
    }

    if (database && !components.some((component) => component.kind === "cache")) {
      const [cache, balancer] = [id(), id()];
      const reader = components.find((component) =>
        diagram.connections.some((connection) => connection.from === component.id && connection.to === database.id),
      );
      return [
        add(cache, "cache", "Redis cache", { tags: ["Redis"], ...beside(database) }),
        ...putInFront(database, cache, "On a miss"),
        {
          type: "object.update",
          id: database.id,
          changes: {
            description: "The source of truth. Reads go through the cache first.",
            options: { replication: "Primary-replica", replicaCount: 1 },
          },
        },
        ...(reader
          ? [add(balancer, "loadBalancer", "Load balancer", beside(reader)), ...putInFront(reader, balancer, "")]
          : []),
      ];
    }

    const [first] = components;
    const monitoring = id();
    return [
      add(monitoring, "observability", "Monitoring", beside(first)),
      connect(first.id, monitoring, "Metrics and logs", "dashed"),
      { type: "object.update", id: first.id, changes: { tags: [...new Set([...(first.tags ?? []), "monitored"])] } },
    ];
  };
  return toDiagramOperations(diagram, edits());
}
