import { describe, expect, test } from "vitest";
import {
  AUTO,
  type ComponentKind,
  compatibleOptions,
  componentKindNames,
  describeOptions,
  getKindDefinition,
  INDEFINITE,
  isValidOptionValue,
  type OptionDefinition,
  type OptionValue,
  summarizeOptions,
  withOption,
} from "../componentKinds";
import { emptyDiagram } from "../schema";
import { validateOperation } from "../validate";

function optionIssues(kind: ComponentKind, options: Record<string, OptionValue>) {
  const object = { type: "component", id: "x", position: { x: 0, y: 0 }, kind, name: "", options } as const;
  return validateOperation(emptyDiagram(), { type: "object.add", object }).map((issue) => issue.code);
}

const option = (kind: ComponentKind, key: string) =>
  getKindDefinition(kind).options.find((candidate) => candidate.key === key) as OptionDefinition;
const choicesOf = (kind: ComponentKind, key: string) => {
  const found = option(kind, key);
  return found.type === "choice" ? found.choices.map((choice) => choice.value) : [];
};
const summary = (kind: ComponentKind, values: Record<string, OptionValue>) =>
  summarizeOptions(getKindDefinition(kind).options, values).map(({ label, value }) => ({ label, value }));

test("offers the agreed catalogue", () => {
  expect(componentKindNames).toEqual([
    "webClient",
    "mobileApp",
    "desktopApp",
    "cli",
    "device",
    "service",
    "worker",
    "function",
    "scheduledJob",
    "dns",
    "cdn",
    "loadBalancer",
    "apiGateway",
    "rateLimiter",
    "database",
    "cache",
    "search",
    "objectStorage",
    "queue",
    "pubSub",
    "eventStream",
    "workflow",
    "streamProcessor",
    "identityProvider",
    "authorization",
    "secretsManager",
    "observability",
    "llm",
    "agent",
  ]);
});

describe.each(componentKindNames)("%s", (kind) => {
  const { label, options } = getKindDefinition(kind);

  test("is complete with no details at all", () => {
    expect(label).toBeTruthy();
    expect(optionIssues(kind, {})).toEqual([]);
    expect(summary(kind, {})).toEqual([]);
  });

  test("explains every option and choice", () => {
    for (const each of options) {
      expect(each.description).toBeTruthy();
      if (each.type === "choice") for (const choice of each.choices) expect(choice.description).toBeTruthy();
    }
  });

  test("has well-formed options", () => {
    const keys = options.map((each) => each.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const each of options) {
      if (each.type === "choice") {
        expect(each.choices.length).toBeGreaterThan(1);
        expect(new Set(each.choices.map((choice) => choice.value)).size).toBe(each.choices.length);
      }
      if (each.showWhen) {
        const parent = options.find((candidate) => candidate.key === each.showWhen?.key);
        expect(parent?.type).toBe("choice");
        for (const value of each.showWhen.is) expect(choicesOf(kind, parent?.key ?? "")).toContain(value);
      }
    }
  });
});

describe("option values", () => {
  const number: OptionDefinition = { key: "n", label: "Replicas", description: "", type: "number" };
  const auto: OptionDefinition = { key: "n", label: "Shards", description: "", type: "number", auto: true };
  const text: OptionDefinition = { key: "t", label: "Partition key", description: "", type: "text" };
  const duration: OptionDefinition = { key: "d", label: "TTL", description: "", type: "duration" };
  const forever: OptionDefinition = {
    key: "d",
    label: "Retention",
    description: "",
    type: "duration",
    indefinite: true,
  };

  test("numbers are whole and not negative, with Auto only where offered", () => {
    expect(isValidOptionValue(number, 3)).toBe(true);
    expect(isValidOptionValue(number, 0)).toBe(true);
    expect(isValidOptionValue(number, -1)).toBe(false);
    expect(isValidOptionValue(number, 1.5)).toBe(false);
    expect(isValidOptionValue(number, "3")).toBe(false);
    expect(isValidOptionValue(number, AUTO)).toBe(false);
    expect(isValidOptionValue(auto, AUTO)).toBe(true);
  });

  test("text is short and not blank", () => {
    expect(isValidOptionValue(text, "customer_id")).toBe(true);
    expect(isValidOptionValue(text, "  ")).toBe(false);
    expect(isValidOptionValue(text, "x".repeat(81))).toBe(false);
  });

  test("durations are a number and a unit, with Indefinite only where offered", () => {
    for (const value of ["30s", "15m", "12h", "7d", "4w", "6mo", "1y", "250ms"]) {
      expect(isValidOptionValue(duration, value)).toBe(true);
    }
    for (const value of ["15", "m", "15 minutes", "1.5h", INDEFINITE]) {
      expect(isValidOptionValue(duration, value)).toBe(false);
    }
    expect(isValidOptionValue(forever, INDEFINITE)).toBe(true);
  });
});

describe("unset, off and none", () => {
  test("an explicit Off or None is kept apart from an unset value", () => {
    expect(optionIssues("queue", { retry: false, ordering: "None" })).toEqual([]);
    expect(describeOptions("queue", { retry: false, ordering: "None" })).toEqual(["Ordering: None", "Retry: Off"]);
    expect(describeOptions("queue", {})).toEqual([]);
  });

  test("the node shows each set value with its label, including an explicit Off or None", () => {
    expect(summary("queue", { retry: false, ordering: "None" })).toEqual([
      { label: "Ordering", value: "None" },
      { label: "Retry", value: "Off" },
    ]);
    expect(summary("queue", { retention: "4d", retry: true })).toEqual([
      { label: "Retry", value: "On" },
      { label: "Retention", value: "4d" },
    ]);
  });

  test("the summary ignores values that are invalid or do not apply", () => {
    expect(summary("database", { replicaCount: 3 })).toEqual([]);
    expect(summary("database", { replication: "Carrier pigeon" })).toEqual([]);
  });
});

describe("dependent details", () => {
  test("setting one drops those that no longer apply", () => {
    const configured = { replication: "Primary-replica", replicaCount: 3, consistency: "Strong" };
    expect(withOption("database", configured, "replication", "None")).toEqual({
      replication: "None",
      consistency: "Strong",
    });
    expect(withOption("database", configured, "replication", undefined)).toEqual({ consistency: "Strong" });
  });

  test("a value that does not apply is rejected", () => {
    expect(optionIssues("database", { replicaCount: 3 })).toEqual(["option_not_applicable"]);
    expect(optionIssues("database", { replication: "None", replicaCount: 3 })).toEqual(["option_not_applicable"]);
  });
});

test("a new kind keeps only the details it also has, with valid values", () => {
  const service = { state: "Stateless", instances: 3, scaling: "Horizontal" };
  expect(compatibleOptions("worker", service)).toEqual({ instances: 3 });
  expect(compatibleOptions("cli", service)).toEqual({});
});

const catalogue: {
  kind: ComponentKind;
  label: string;
  keys: string[];
  valid: Record<string, OptionValue>;
  invalid: Record<string, OptionValue>;
}[] = [
  {
    kind: "webClient",
    label: "Web Client",
    keys: ["rendering", "updates", "offline"],
    valid: { rendering: "Server-side", updates: "WebSockets", offline: "Read-only" },
    invalid: { rendering: "Isomorphic" },
  },
  {
    kind: "mobileApp",
    label: "Mobile App",
    keys: ["updates", "push", "offline", "sync"],
    valid: { push: false, offline: "Read-write", sync: "Background" },
    invalid: { sync: "Hourly" },
  },
  {
    kind: "desktopApp",
    label: "Desktop App",
    keys: ["updates", "offline"],
    valid: { updates: "Polling", offline: "None" },
    invalid: { offline: "Sometimes" },
  },
  { kind: "cli", label: "CLI", keys: [], valid: {}, invalid: { auth: "API token" } },
  {
    kind: "device",
    label: "Device / IoT",
    keys: ["connectivity", "communication", "buffering"],
    valid: { connectivity: "Intermittent", communication: "Push", buffering: true },
    invalid: { connectivity: "Satellite" },
  },
  {
    kind: "service",
    label: "Service",
    keys: ["state", "instances", "scaling"],
    valid: { state: "Stateless", instances: 4, scaling: "Horizontal" },
    invalid: { instances: -1 },
  },
  {
    kind: "worker",
    label: "Worker",
    keys: ["instances", "concurrency", "scaling", "retry", "idempotent"],
    valid: { concurrency: 10, scaling: "Workload-based", retry: true, idempotent: true },
    invalid: { scaling: "Horizontal" },
  },
  {
    kind: "function",
    label: "Serverless Function",
    keys: ["trigger", "concurrency", "concurrencyLimit", "timeout", "warm"],
    valid: { trigger: "Queue", concurrency: "Limited", concurrencyLimit: 50, timeout: "30s" },
    invalid: { timeout: "30" },
  },
  {
    kind: "scheduledJob",
    label: "Scheduled Job",
    keys: ["schedule", "concurrentRuns", "retry", "idempotent"],
    valid: { schedule: "Nightly at 02:00", concurrentRuns: "Prevent", retry: true },
    invalid: { schedule: "" },
  },
  {
    kind: "dns",
    label: "DNS",
    keys: ["routing", "healthRouting", "ttl"],
    valid: { routing: "Latency", healthRouting: true, ttl: "60s" },
    invalid: { routing: "Random" },
  },
  {
    kind: "cdn",
    label: "CDN",
    keys: ["distribution", "content", "ttl", "originFallback"],
    valid: { distribution: "Pull", content: "Both", ttl: "1h", originFallback: true },
    invalid: { distribution: "Pushed" },
  },
  {
    kind: "loadBalancer",
    label: "Load Balancer",
    keys: ["layer", "algorithm", "healthChecks", "sticky", "availability"],
    valid: { layer: "Layer 7", algorithm: "Least connections", healthChecks: true, availability: "Redundant" },
    invalid: { layer: "Layer 3" },
  },
  {
    kind: "apiGateway",
    label: "API Gateway",
    keys: ["auth", "rateLimiting", "caching", "aggregation"],
    valid: { auth: "Delegated", rateLimiting: "Enabled", caching: "None" },
    invalid: { caching: "On" },
  },
  {
    kind: "rateLimiter",
    label: "Rate Limiter",
    keys: ["algorithm", "scope", "state"],
    valid: { algorithm: "Token bucket", scope: "API key", state: "Distributed" },
    invalid: { scope: "Country" },
  },
  {
    kind: "database",
    label: "Database",
    keys: [
      "model",
      "replication",
      "replicaCount",
      "partitioning",
      "partitionKey",
      "partitions",
      "consistency",
      "failover",
    ],
    valid: {
      replication: "Primary-replica",
      replicaCount: 3,
      consistency: "Strong",
      partitioning: "Hash",
      partitionKey: "customer_id",
    },
    invalid: { consistency: "Mostly" },
  },
  {
    kind: "cache",
    label: "Cache",
    keys: ["strategy", "ttl", "invalidation", "eviction", "replication", "onFailure"],
    valid: { strategy: "Cache-aside", ttl: "15m", invalidation: "Event-driven" },
    invalid: { eviction: "Random" },
  },
  {
    kind: "search",
    label: "Search",
    keys: ["shards", "replicas", "freshness", "sourceOfTruth"],
    valid: { shards: 5, replicas: 1, freshness: "Near-realtime", sourceOfTruth: false },
    invalid: { shards: "five" },
  },
  {
    kind: "objectStorage",
    label: "Object Storage",
    keys: ["replication", "versioning", "retention", "immutability"],
    valid: { replication: "Cross-region", versioning: true, retention: INDEFINITE },
    invalid: { retention: "forever" },
  },
  {
    kind: "queue",
    label: "Queue",
    keys: ["delivery", "ordering", "retry", "deadLetter", "retention"],
    valid: { delivery: "At-least-once", ordering: "FIFO", deadLetter: true, retention: "4d" },
    invalid: { delivery: "Exactly-once" },
  },
  {
    kind: "pubSub",
    label: "Pub/Sub",
    keys: ["delivery", "ordering", "filtering", "deadLetter"],
    valid: { delivery: "At-most-once", ordering: "Ordered", filtering: true },
    invalid: { delivery: "Effectively-once" },
  },
  {
    kind: "eventStream",
    label: "Event Stream",
    keys: ["partitions", "partitionKey", "replicationFactor", "retention", "delivery", "ordering"],
    valid: { partitions: 12, retention: "7d", ordering: "Per partition" },
    invalid: { partitions: AUTO },
  },
  {
    kind: "workflow",
    label: "Workflow / Orchestrator",
    keys: ["execution", "durableState", "retry", "compensation", "humanApproval"],
    valid: { execution: "DAG", durableState: true, compensation: "Saga" },
    invalid: { execution: "Random" },
  },
  {
    kind: "streamProcessor",
    label: "Stream Processor",
    keys: ["state", "parallelism", "checkpointing", "guarantee"],
    valid: { state: "Stateful", parallelism: AUTO, checkpointing: true, guarantee: "Effectively-once" },
    invalid: { parallelism: "lots" },
  },
  {
    kind: "identityProvider",
    label: "Identity Provider",
    keys: ["identity", "session", "federation", "mfa"],
    valid: { identity: "Users", session: "Token", federation: "OAuth / OIDC", mfa: true },
    invalid: { federation: "Kerberos" },
  },
  {
    kind: "authorization",
    label: "Authorisation Service",
    keys: ["model", "decisionPoint", "defaultPolicy"],
    valid: { model: "RBAC", decisionPoint: "Centralised", defaultPolicy: "Deny" },
    invalid: { defaultPolicy: "Maybe" },
  },
  {
    kind: "secretsManager",
    label: "Secrets Manager",
    keys: ["rotation"],
    valid: { rotation: "Automatic" },
    invalid: { rotation: "Weekly" },
  },
  {
    kind: "observability",
    label: "Observability",
    keys: ["logs", "metrics", "traces", "apm", "alerting", "slos"],
    valid: { logs: true, metrics: true, traces: false },
    invalid: { logs: "yes" },
  },
  {
    kind: "llm",
    label: "LLM / Model",
    keys: ["hosting", "input", "toolCalling", "structuredOutput", "fallback"],
    valid: { hosting: "Cloud", input: "Multimodal", toolCalling: true },
    invalid: { hosting: "Edge" },
  },
  {
    kind: "agent",
    label: "AI Agent",
    keys: ["memory", "approval", "state", "tools"],
    valid: { memory: "Session", approval: "Selected actions", state: "Checkpointed" },
    invalid: { memory: "Infinite" },
  },
];

test("the catalogue table covers every kind", () => {
  expect(catalogue.map((entry) => entry.kind)).toEqual(componentKindNames);
});

for (const entry of catalogue) {
  describe(entry.label, () => {
    const { options } = getKindDefinition(entry.kind);

    test("offers its details in order", () => {
      expect(getKindDefinition(entry.kind).label).toBe(entry.label);
      expect(options.map((each) => each.key)).toEqual(entry.keys);
    });

    test("accepts its own values", () => {
      expect(optionIssues(entry.kind, entry.valid)).toEqual([]);
    });

    test("rejects other values and details it does not have", () => {
      expect(optionIssues(entry.kind, entry.invalid)).not.toEqual([]);
      expect(optionIssues(entry.kind, { notADetail: true })).toEqual(["unknown_option"]);
    });

    test("shows what is set on the node, each with its label", () => {
      const shown = summary(entry.kind, entry.valid);
      expect(shown.map((row) => row.label)).toEqual(
        options.filter((each) => entry.valid[each.key] !== undefined).map((each) => each.label),
      );
    });
  });
}

describe("Web Client", () => {
  test("has no CDN switch: a CDN is its own component", () => {
    expect(optionIssues("webClient", { cdn: true })).toEqual(["unknown_option"]);
  });
});

describe("Serverless Function", () => {
  test("offers a concurrency limit only once concurrency is limited", () => {
    expect(optionIssues("function", { concurrency: "Managed", concurrencyLimit: 10 })).toEqual([
      "option_not_applicable",
    ]);
    expect(summary("function", { concurrency: "Limited", concurrencyLimit: 10 })).toEqual([
      { label: "Concurrency", value: "Limited" },
      { label: "Concurrency limit", value: "10" },
    ]);
  });
});

describe("Database", () => {
  test("offers data models, which decide the structure details", () => {
    expect(choicesOf("database", "model")).toEqual([
      "Relational",
      "Document",
      "Key-value",
      "Wide-column",
      "Graph",
      "Time-series",
      "Vector",
      "Other",
    ]);
  });

  test("offers a replica count only for replication modes with replicas", () => {
    for (const replication of ["Primary-replica", "Multi-primary", "Leaderless"]) {
      expect(optionIssues("database", { replication, replicaCount: 2 })).toEqual([]);
    }
    for (const replication of ["None", "Managed"]) {
      expect(optionIssues("database", { replication, replicaCount: 2 })).toEqual(["option_not_applicable"]);
    }
  });

  test("offers a partition key and shard count only once it is partitioned", () => {
    expect(optionIssues("database", { partitioning: "Range", partitionKey: "created_at", partitions: AUTO })).toEqual(
      [],
    );
    expect(optionIssues("database", { partitioning: "None", partitionKey: "id" })).toEqual(["option_not_applicable"]);
    expect(summary("database", { partitioning: "Hash", partitions: AUTO })).toEqual([
      { label: "Partitioning", value: "Hash" },
      { label: "Partitions / shards", value: "Auto" },
    ]);
  });
});

test.each([
  ["database", { replication: "Leaderless", replicaCount: 0 }],
  ["database", { partitioning: "Hash", partitions: 0 }],
  ["eventStream", { partitions: 0 }],
  ["eventStream", { replicationFactor: 0 }],
  ["search", { shards: 0 }],
  ["worker", { concurrency: 0 }],
  ["function", { concurrency: "Limited", concurrencyLimit: 0 }],
  ["streamProcessor", { parallelism: 0 }],
] as const)("%s needs at least one of %j", (kind, options) => {
  expect(optionIssues(kind, options)).toEqual(["invalid_option_value"]);
});

test.each([
  ["service", { instances: 0 }],
  ["search", { replicas: 0 }],
] as const)("%s may have none of %j", (kind, options) => {
  expect(optionIssues(kind, options)).toEqual([]);
});

describe("Object Storage", () => {
  test("can keep objects indefinitely", () => {
    expect(summary("objectStorage", { retention: INDEFINITE, immutability: true })).toEqual([
      { label: "Retention", value: "Indefinite" },
      { label: "Immutability", value: "On" },
    ]);
  });
});
