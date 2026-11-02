import { dataModels } from "./databaseStructure";

interface Choice {
  value: string;
  description: string;
}

interface OptionBase {
  key: string;
  label: string;
  description: string;
  showWhen?: { key: string; is: readonly string[] };
}

export type OptionDefinition = OptionBase &
  (
    | { type: "toggle" }
    | { type: "choice"; choices: readonly Choice[] }
    | { type: "number"; auto?: boolean; min?: number }
    | { type: "text" }
    | { type: "duration"; indefinite?: boolean }
  );

export type OptionValue = boolean | string | number;

export interface ComponentKindDefinition {
  label: string;
  description: string;
  options: readonly OptionDefinition[];
}

export const AUTO = "Auto";
export const INDEFINITE = "Indefinite";
const DURATION = /^\d+(ms|s|m|h|d|w|mo|y)$/;

type ShowWhen = Pick<OptionBase, "showWhen">;

const toggle = (key: string, label: string, description: string): OptionDefinition => ({
  key,
  label,
  description,
  type: "toggle",
});

const choice = (
  key: string,
  label: string,
  description: string,
  choices: readonly (readonly [value: string, description: string])[],
): OptionDefinition => ({
  key,
  label,
  description,
  type: "choice",
  choices: choices.map(([value, about]) => ({ value, description: about })),
});

const count = (
  key: string,
  label: string,
  description: string,
  extra: ShowWhen & { auto?: boolean; min?: number } = {},
): OptionDefinition => ({ key, label, description, type: "number", ...extra });

const text = (key: string, label: string, description: string, extra: ShowWhen = {}): OptionDefinition => ({
  key,
  label,
  description,
  type: "text",
  ...extra,
});

const duration = (
  key: string,
  label: string,
  description: string,
  extra: { indefinite?: boolean } = {},
): OptionDefinition => ({ key, label, description, type: "duration", ...extra });

const deliveries = [
  ["At-most-once", "Each message is handled once or not at all. Nothing is retried, so some can be lost."],
  [
    "At-least-once",
    "Retried until acknowledged, so handlers must cope with duplicates. A message can still be lost if it expires or was not stored durably.",
  ],
  [
    "Effectively-once",
    "Each message takes effect once, through deduplication or transactions. Costs latency and complexity.",
  ],
] as const;

const liveUpdates = choice(
  "updates",
  "Live updates",
  "How it hears about changes made elsewhere, such as a new message.",
  [
    ["Polling", "Asks for changes every few seconds. Simple, but wasteful and never instant."],
    [
      "Long polling",
      "Asks, and the server holds the request open until something changes. Near instant over plain HTTP.",
    ],
    ["Server-sent events", "One long-lived connection the server pushes updates down. Server to client only."],
    ["WebSockets", "A long-lived two-way connection. Instant both ways, but harder to scale and load balance."],
  ],
);

const offline = choice("offline", "Offline support", "What still works without a connection.", [
  ["None", "Needs a connection for everything."],
  ["Read-only", "Shows data it has already loaded, but changes wait for a connection."],
  ["Read-write", "Changes can be made offline and synced later, which means resolving conflicts."],
]);

const instances = count("instances", "Instances", "How many copies run at once.");
const idempotent = toggle(
  "idempotent",
  "Idempotent",
  "Running it twice has the same effect as once, so retries are safe.",
);
const retry = toggle("retry", "Retry", "Failed attempts are tried again automatically.");

const replicatingModes = ["Primary-replica", "Multi-primary", "Leaderless"];
const partitionedModes = ["Hash", "Range", "Directory", "Other"];

const dataModelDescriptions: Record<(typeof dataModels)[number], string> = {
  Relational: "Tables of rows with a fixed schema, joins and transactions.",
  Document: "Self-contained JSON-like documents, read and written whole.",
  "Key-value": "Values looked up by key. Fast and simple; the key design is everything.",
  "Wide-column": "Rows grouped by partition key and sorted within it. Built for huge write volumes.",
  Graph: "Nodes and the relationships between them, for queries that follow connections.",
  "Time-series": "Measurements over time, kept and queried by time range.",
  Vector: "Embeddings searched by similarity, often filtered by metadata.",
  Other: "Something else, described in words.",
};

const componentKinds = {
  webClient: {
    label: "Web Client",
    description: "A website or web app running in the user's browser.",
    options: [
      choice("rendering", "Rendering", "Where pages are built, which affects first load, SEO and server cost.", [
        ["Client-side", "The browser builds pages with JavaScript. Light on the server, slower first load."],
        ["Server-side", "The server builds each page per request. Fast first load and good for SEO."],
        ["Static", "Pages are built ahead of time and served as files, ideal behind a CDN."],
        ["Hybrid", "A mix: some pages static or server-rendered, the rest built in the browser."],
      ]),
      liveUpdates,
      offline,
    ],
  },
  mobileApp: {
    label: "Mobile App",
    description: "An app installed on a phone or tablet.",
    options: [
      liveUpdates,
      toggle(
        "push",
        "Push notifications",
        "The platform's push service can alert the user when something happens, even with the app closed.",
      ),
      offline,
      choice("sync", "Sync", "When local data is brought up to date with the server.", [
        ["Manual", "Only when the user asks, such as pull to refresh."],
        ["Background", "Periodically, or when the app opens, without the user asking."],
        ["Realtime", "Continuously, as changes happen."],
      ]),
    ],
  },
  desktopApp: { label: "Desktop App", description: "An app installed on a computer.", options: [liveUpdates, offline] },
  cli: { label: "CLI", description: "A command-line tool that people or scripts run.", options: [] },
  device: {
    label: "Device / IoT",
    description: "A physical device that sends or receives data, such as a sensor, vehicle or point-of-sale terminal.",
    options: [
      choice("connectivity", "Connectivity", "Whether it can always be reached.", [
        ["Persistent", "Always connected, so it can be reached at any time."],
        ["Intermittent", "Connects now and then, so messages to it must wait."],
      ]),
      choice("communication", "Communication", "Which way data flows.", [
        ["Push", "The device sends data when it has some."],
        ["Pull", "The device fetches what it needs, such as commands or updates."],
        ["Bidirectional", "Both, usually over one long-lived connection."],
      ]),
      toggle("buffering", "Local buffering", "Keeps data while offline and sends it when the connection returns."),
    ],
  },

  service: {
    label: "Service",
    description: "A long-running server that answers requests, such as an API or a web backend.",
    options: [
      choice("state", "State", "Whether instances keep data between requests.", [
        ["Stateless", "Any instance can serve any request, so scaling and failover are easy."],
        ["Stateful", "Instances keep data, so requests are tied to them and scaling is harder."],
      ]),
      instances,
      choice("scaling", "Scaling", "How it grows to meet load.", [
        ["None", "A fixed size."],
        ["Horizontal", "Adds more instances. Needs work to be shared between them."],
        ["Vertical", "Makes each instance bigger, up to the largest machine available."],
        ["Both", "Bigger instances, and more of them."],
      ]),
    ],
  },
  worker: {
    label: "Worker",
    description: "A long-running process that takes jobs from a queue or stream and does them in the background.",
    options: [
      instances,
      count("concurrency", "Concurrency", "How many jobs each instance works on at once.", { min: 1 }),
      choice("scaling", "Scaling", "Whether the number of workers follows the work waiting.", [
        ["Fixed", "A set number of workers, so a backlog grows under load."],
        ["Workload-based", "Workers are added as the backlog grows and removed as it shrinks."],
      ]),
      retry,
      idempotent,
    ],
  },
  function: {
    label: "Serverless Function",
    description: "Code the platform runs on demand for each trigger, with no server to manage. For short tasks.",
    options: [
      choice("trigger", "Trigger", "What makes it run.", [
        ["HTTP", "A web request."],
        ["Queue", "A message arriving on a queue."],
        ["Event", "An event published somewhere else."],
        ["Schedule", "A timer, like a cron job."],
        ["Storage", "A file being added or changed."],
        ["Other", "Something else."],
      ]),
      choice("concurrency", "Concurrency", "How many copies may run at once.", [
        ["Managed", "The platform runs as many as needed."],
        ["Limited", "Capped, for example to protect a database from too many connections."],
      ]),
      count("concurrencyLimit", "Concurrency limit", "The most copies that may run at once.", {
        min: 1,
        showWhen: { key: "concurrency", is: ["Limited"] },
      }),
      duration("timeout", "Timeout", "How long one run may take before it is stopped."),
      choice("warm", "Warm capacity", "Whether some instances are kept ready.", [
        ["None", "Starts on demand, so some requests pay for a cold start."],
        ["Provisioned", "Instances are kept running so requests avoid cold starts, at a cost."],
      ]),
    ],
  },
  scheduledJob: {
    label: "Scheduled Job",
    description: "A task started on a schedule, such as a nightly report or an hourly cleanup.",
    options: [
      text("schedule", "Schedule", "When it runs, such as nightly or every 5 minutes."),
      choice("concurrentRuns", "Concurrent runs", "Whether a run may start while the last one is still going.", [
        ["Allow", "Runs may overlap, so they must not get in each other's way."],
        ["Prevent", "A run waits for, or skips past, one still in progress."],
      ]),
      retry,
      idempotent,
    ],
  },

  dns: {
    label: "DNS",
    description: "Turns domain names into addresses, and can steer users between regions or away from failures.",
    options: [
      choice("routing", "Routing", "How it chooses which address to answer with.", [
        ["Simple", "Always the same answer."],
        ["Weighted", "Splits traffic by percentage, such as for a gradual rollout."],
        ["Latency", "Sends users to the region that answers them fastest."],
        ["Geographic", "Sends users to a region based on where they are."],
        ["Failover", "Answers with a backup when the primary is unhealthy."],
      ]),
      toggle("healthRouting", "Health-aware routing", "Stops answering with addresses whose health checks fail."),
      duration("ttl", "TTL", "How long resolvers cache an answer, and so how quickly a change takes effect."),
    ],
  },
  cdn: {
    label: "CDN",
    description: "Edge servers near users that serve content, mainly static files, without going to the origin.",
    options: [
      choice("distribution", "Distribution model", "How content gets onto the CDN.", [
        ["Pull", "Content is fetched from the origin when first requested."],
        ["Push", "Content is explicitly published to the CDN before users request it."],
        ["Hybrid", "Uses both pushed content and content fetched from an origin."],
      ]),
      choice("content", "Content", "What it serves.", [
        ["Static", "Files that rarely change, such as images, scripts and styles."],
        ["Dynamic", "Responses built per request, cached briefly or not at all."],
        ["Both", "Static files and dynamic responses."],
      ]),
      duration("ttl", "TTL", "How long the edge keeps content before checking the origin."),
      toggle("originFallback", "Origin fallback", "Requests go to the origin when the CDN cannot serve them."),
    ],
  },
  loadBalancer: {
    label: "Load Balancer",
    description: "Spreads incoming traffic across several copies of a service.",
    options: [
      choice("layer", "Layer", "How much of each request it can see when deciding where to send it.", [
        ["Layer 4", "Routes by IP address and port. Fast, but blind to the request itself."],
        ["Layer 7", "Routes by what is in the request, such as its path, headers or cookies."],
      ]),
      choice("algorithm", "Algorithm", "How it picks a server for each request.", [
        ["Round robin", "Each server in turn."],
        ["Weighted round robin", "In turn, but bigger servers get more."],
        ["Least connections", "Whichever server is handling the fewest requests right now."],
        ["Least response time", "Whichever server is answering fastest."],
        [
          "Consistent hashing",
          "The same key, such as a user ID, always goes to the same server, and few keys move when servers change.",
        ],
      ]),
      toggle("healthChecks", "Health checks", "Stops sending traffic to servers that fail checks."),
      toggle(
        "sticky",
        "Sticky sessions",
        "Keeps each user on the same server, so session state can live in that server's memory.",
      ),
      choice("availability", "Availability", "Whether the load balancer itself can fail.", [
        ["Single", "One instance: a single point of failure."],
        ["Redundant", "A standby or pair, so one can fail."],
        ["Managed", "A cloud service that handles its own availability."],
      ]),
    ],
  },
  apiGateway: {
    label: "API Gateway",
    description:
      "The single entry point for API calls, which routes them to services and can authenticate, limit and cache.",
    options: [
      choice("auth", "Authentication", "Whether it checks who is calling before passing requests on.", [
        ["None", "Services behind it check callers themselves, or no one does."],
        ["Delegated", "It asks an identity provider to verify each caller."],
        ["Built-in", "It verifies callers itself, such as with API keys."],
      ]),
      choice("rateLimiting", "Rate limiting", "Whether it limits how often callers can make requests.", [
        ["None", "Callers can send as much as they like."],
        ["Enabled", "Callers over their limit are turned away."],
      ]),
      choice("caching", "Caching", "Whether it answers repeated requests itself.", [
        ["None", "Every request goes through to a service."],
        ["Enabled", "Repeated requests can be answered from its cache."],
      ]),
      toggle("aggregation", "Request aggregation", "Combines calls to several services into one response."),
    ],
  },
  rateLimiter: {
    label: "Rate Limiter",
    description: "Limits how often each caller can make requests, to protect what is behind it.",
    options: [
      choice("algorithm", "Algorithm", "How requests are counted against the limit.", [
        ["Token bucket", "Tokens refill steadily and each request spends one, so short bursts are allowed."],
        ["Leaky bucket", "Requests drain at a steady rate, smoothing out bursts."],
        ["Fixed window", "Counts per minute or hour. Simple, but allows bursts at window edges."],
        ["Sliding window", "Counts over a moving window. Smoother, at a little more cost."],
      ]),
      choice("scope", "Scope", "What each limit applies to.", [
        ["User", "Each signed-in user."],
        ["API key", "Each client application."],
        ["IP", "Each address, which works before sign-in but is shared behind NAT."],
        ["Endpoint", "Each route, protecting expensive ones."],
        ["Global", "Everything together, protecting the whole system."],
      ]),
      choice("state", "State", "Where the counts are kept.", [
        ["Local", "Each instance counts on its own. Fast, but limits are only approximate."],
        ["Distributed", "Counts are shared, usually in a cache. Accurate, but adds a network call."],
      ]),
    ],
  },

  database: {
    label: "Database",
    description: "Stores data durably as the source of truth. Its data model says which kind of database.",
    options: [
      choice(
        "model",
        "Data model",
        "How the data is organised. It decides which structure details are offered.",
        dataModels.map((model) => [model, dataModelDescriptions[model]] as const),
      ),
      choice("replication", "Replication", "How copies of the data are kept.", [
        ["None", "One copy. Losing the machine loses availability, and maybe data."],
        ["Primary-replica", "One copy takes writes; replicas copy it and serve reads."],
        ["Multi-primary", "Several copies take writes, so conflicting writes must be resolved."],
        ["Leaderless", "Any copy can take reads and writes, with no primary."],
        ["Managed", "The provider handles it."],
      ]),
      count("replicaCount", "Replicas", "How many extra copies are kept, beyond the first.", {
        min: 1,
        showWhen: { key: "replication", is: replicatingModes },
      }),
      choice("partitioning", "Partitioning", "How data is split across machines when one is not enough.", [
        ["None", "All data on one machine."],
        ["Hash", "Spread evenly by a hash of the key. Range queries hit every partition."],
        ["Range", "Split by key ranges, such as dates. Range queries stay local, but hot spots can form."],
        ["Directory", "A lookup table says where each key lives. Flexible, but the lookup is critical."],
        ["Other", "Something else."],
      ]),
      text("partitionKey", "Partition key", "What decides which partition a record goes to, such as customer_id.", {
        showWhen: { key: "partitioning", is: partitionedModes },
      }),
      count("partitions", "Partitions / shards", "How many partitions, or Auto if they split as needed.", {
        auto: true,
        min: 1,
        showWhen: { key: "partitioning", is: partitionedModes },
      }),
      choice("consistency", "Consistency", "Whether a read always sees the latest write.", [
        ["Strong", "Every read sees the latest write, at a cost in latency and availability."],
        ["Eventual", "Copies catch up in time, so a read may briefly see old data."],
        ["Quorum", "Reads and writes must reach a majority of copies, trading latency for consistency."],
        ["Tunable", "Chosen per request, trading consistency against speed."],
        ["Causal", "Related writes are seen in order; unrelated ones may not be."],
        ["Other", "Something else."],
      ]),
      choice("failover", "Failover", "What happens when a copy taking writes fails.", [
        ["None", "It is down until fixed."],
        ["Manual", "Someone moves writes to another copy."],
        ["Automatic", "Writes move to another copy on their own, risking split brain if done wrong."],
        ["Managed", "The provider handles it."],
      ]),
    ],
  },
  cache: {
    label: "Cache",
    description: "Keeps copies of frequently read data in memory, so reads are faster and the source is spared.",
    options: [
      choice("strategy", "Strategy", "Who fills the cache, and when writes reach the database.", [
        ["Cache-aside", "The app checks the cache, and on a miss loads from the database and fills it."],
        ["Read-through", "The cache loads missing data from the database itself."],
        ["Write-through", "Writes go to the cache and database together. Consistent, but slower writes."],
        ["Write-behind", "Writes go to the cache and reach the database later. Fast, but can lose data."],
      ]),
      duration("ttl", "TTL", "How long entries live before they expire."),
      choice("invalidation", "Invalidation", "How stale entries are removed when the data changes.", [
        ["Expiry only", "Entries age out, so reads can be stale until then."],
        ["Explicit", "Whatever writes the data also clears the entry."],
        ["Event-driven", "A change event clears the entry, so writers need not know about the cache."],
      ]),
      choice("eviction", "Eviction", "What is thrown out when it is full.", [
        ["LRU", "Least recently used."],
        ["LFU", "Least frequently used."],
        ["FIFO", "Oldest first."],
        ["Other", "Something else."],
      ]),
      choice("replication", "Replication", "Whether there is more than one cache node.", [
        ["None", "One node, so losing it empties the cache."],
        ["Replicated", "Copies on several nodes, so one can fail."],
        ["Clustered", "Data split across nodes, so it can grow beyond one machine."],
      ]),
      choice("onFailure", "On failure", "What callers do when the cache is down.", [
        ["Bypass cache", "Go straight to the database, which may not cope with the extra load."],
        ["Fail request", "Return an error, protecting the database."],
      ]),
    ],
  },
  search: {
    label: "Search",
    description: "An index for full-text and filtered search, usually built from another store.",
    options: [
      count("shards", "Shards", "How many pieces the index is split into.", { min: 1 }),
      count("replicas", "Replicas", "How many copies of each shard, for reads and failover."),
      choice("freshness", "Freshness", "How soon a change appears in results.", [
        ["Realtime", "Immediately."],
        ["Near-realtime", "Within a second or so."],
        ["Batch", "After the next scheduled rebuild."],
      ]),
      toggle(
        "sourceOfTruth",
        "Source of truth",
        "Whether the index is the primary copy, rather than rebuilt from another store.",
      ),
    ],
  },
  objectStorage: {
    label: "Object Storage",
    description: "Stores files and large blobs, such as images, uploads, backups and exports.",
    options: [
      choice("replication", "Replication", "Where copies are kept.", [
        ["None", "One location."],
        ["Regional", "Several places within one region."],
        ["Cross-region", "Copies in another region, surviving a regional outage."],
      ]),
      toggle("versioning", "Versioning", "Keeps old versions of objects that are overwritten or deleted."),
      duration("retention", "Retention", "How long objects are kept, or Indefinite.", { indefinite: true }),
      toggle("immutability", "Immutability", "Objects cannot be changed or deleted until retention ends."),
    ],
  },

  queue: {
    label: "Queue",
    description: "Holds jobs until one consumer takes each, so work is spread out and smoothed over time.",
    options: [
      choice("delivery", "Delivery", "How many times a message may be handled.", deliveries),
      choice("ordering", "Ordering", "Whether messages are handled in the order sent.", [
        ["None", "Any order, which scales better."],
        ["FIFO", "First in, first out, at lower throughput."],
      ]),
      retry,
      toggle(
        "deadLetter",
        "Dead-letter queue",
        "Messages that keep failing are set aside instead of blocking the queue.",
      ),
      duration("retention", "Retention", "How long unhandled messages are kept."),
    ],
  },
  pubSub: {
    label: "Pub/Sub",
    description: "Sends each message to every subscriber, to announce that something happened.",
    options: [
      choice("delivery", "Delivery", "How many times a message may be handled.", deliveries.slice(0, 2)),
      choice("ordering", "Ordering", "Whether subscribers see messages in the order sent.", [
        ["None", "Any order."],
        ["Ordered", "In order, usually per key."],
      ]),
      toggle("filtering", "Filtering", "Subscribers receive only the messages they ask for."),
      toggle("deadLetter", "Dead-letter handling", "Messages no subscriber can handle are set aside."),
    ],
  },
  eventStream: {
    label: "Event Stream",
    description: "A durable, ordered log of events that several consumers read at their own pace and can replay.",
    options: [
      count("partitions", "Partitions", "Units of parallelism; consumers in a group share them.", { min: 1 }),
      text("partitionKey", "Partition key", "What decides an event's partition, and so which events stay in order."),
      count("replicationFactor", "Replication factor", "How many copies of each partition are kept.", { min: 1 }),
      duration("retention", "Retention", "How long events are kept, and so how far back consumers can replay."),
      choice("delivery", "Delivery", "How many times an event may be handled.", deliveries),
      choice("ordering", "Ordering", "Which events are seen in order.", [
        ["Per partition", "Events with the same key stay in order."],
        ["None", "No ordering is relied on."],
      ]),
    ],
  },

  workflow: {
    label: "Workflow / Orchestrator",
    description: "Runs a multi-step process across services, tracking progress and handling failures.",
    options: [
      choice("execution", "Execution", "How its steps are arranged.", [
        ["Sequential", "One step after another."],
        ["Parallel", "Steps run at the same time."],
        ["DAG", "Steps run as soon as the ones they depend on finish."],
        ["State machine", "Steps move between defined states on events."],
      ]),
      toggle(
        "durableState",
        "Durable state",
        "Progress survives restarts, so long-running work resumes where it stopped.",
      ),
      retry,
      choice("compensation", "Compensation", "How completed steps are undone when a later one fails.", [
        ["None", "They are not undone."],
        ["Saga", "Each step has an undo step, run in reverse on failure."],
        ["Custom", "Handled some other way."],
      ]),
      toggle("humanApproval", "Human approval", "Some steps wait for a person to approve them."),
    ],
  },
  streamProcessor: {
    label: "Stream Processor",
    description: "Continuously processes events from a stream: filters, transforms, joins or aggregates them.",
    options: [
      choice("state", "State", "Whether it remembers anything between events.", [
        ["Stateless", "Each event is handled on its own."],
        ["Stateful", "Keeps state such as windows, counts or joins, which must survive failures."],
      ]),
      count("parallelism", "Parallelism", "How many tasks process the stream at once, or Auto.", {
        auto: true,
        min: 1,
      }),
      toggle("checkpointing", "Checkpointing", "Saves progress so it can recover without starting over."),
      choice("guarantee", "Processing guarantee", "How many times each event may take effect.", deliveries),
    ],
  },

  identityProvider: {
    label: "Identity Provider",
    description: "Signs in users or services and issues the sessions or tokens that prove who they are.",
    options: [
      choice("identity", "Identity", "Who it signs in.", [
        ["Users", "People."],
        ["Services", "Other systems, such as with client credentials."],
        ["Both", "People and systems."],
      ]),
      choice("session", "Session model", "How a signed-in caller is recognised afterwards.", [
        ["Server session", "A session ID that the server looks up. Easy to revoke."],
        ["Token", "A signed token checked without a lookup. Scales well, but is hard to revoke."],
        ["Federated", "Sessions come from another identity provider."],
      ]),
      choice("federation", "Federation", "Whether people can sign in with an account from elsewhere.", [
        ["None", "Only accounts it holds itself."],
        ["OAuth / OIDC", "Sign in with another provider, such as Google or a company directory."],
        ["SAML", "Enterprise single sign-on."],
        ["Other", "Something else."],
      ]),
      toggle("mfa", "MFA", "Multi-factor authentication."),
    ],
  },
  authorization: {
    label: "Authorisation Service",
    description: "Decides what an authenticated caller is allowed to do.",
    options: [
      choice("model", "Model", "How permissions are expressed.", [
        ["RBAC", "By role, such as admin or editor."],
        ["ABAC", "By attributes of the user, resource and context."],
        ["ACL", "A list of who may do what, kept on each resource."],
        ["Policy-based", "Rules written as policies and evaluated by an engine."],
        ["Custom", "Something else."],
      ]),
      choice("decisionPoint", "Decision point", "Where access decisions are made.", [
        ["Centralised", "Services ask one place. Consistent, but in the path of every request."],
        ["Distributed", "Services decide locally from shared policy. Fast, but policy must be kept in sync."],
      ]),
      choice("defaultPolicy", "Default policy", "What happens when no rule matches.", [
        ["Allow", "Permitted unless denied."],
        ["Deny", "Denied unless permitted. Safer."],
      ]),
    ],
  },
  secretsManager: {
    label: "Secrets Manager",
    description: "Stores and hands out credentials, keys and other secrets.",
    options: [
      choice("rotation", "Rotation", "How often secrets are replaced.", [
        ["None", "Secrets are never replaced."],
        ["Manual", "Someone replaces them."],
        ["Automatic", "They are replaced on a schedule, and services pick up the new ones."],
      ]),
    ],
  },

  observability: {
    label: "Observability",
    description: "Collects logs, metrics and traces, and alerts when something goes wrong.",
    options: [
      toggle("logs", "Logs", "Records of what happened, searched when investigating."),
      toggle("metrics", "Metrics", "Numbers over time, such as request rate and errors, for dashboards."),
      toggle("traces", "Traces", "The path of each request across services, for finding slow or failing hops."),
      toggle("apm", "APM", "Application performance monitoring."),
      toggle("alerting", "Alerting", "Someone is told when something goes wrong."),
      toggle("slos", "SLOs", "Service-level objectives, with error budgets."),
    ],
  },

  llm: {
    label: "LLM / Model",
    description: "A large language model or other machine learning model that is called for answers.",
    options: [
      choice("hosting", "Hosting", "Where the model runs, which affects cost, latency and where data goes.", [
        ["Cloud", "A provider's API. Data leaves your systems."],
        ["Self-hosted", "On servers you run."],
        ["Local", "On the user's own device."],
      ]),
      choice("input", "Input", "What it accepts.", [
        ["Text", "Text only."],
        ["Multimodal", "Images, audio or files as well as text."],
      ]),
      toggle("toolCalling", "Tool calling", "It can ask to call functions you provide."),
      toggle("structuredOutput", "Structured output", "Answers follow a schema the caller can parse."),
      toggle("fallback", "Fallback", "Another model is used when this one fails or is unavailable."),
    ],
  },
  agent: {
    label: "AI Agent",
    description: "An AI system that plans and acts on its own, calling models and tools to reach a goal.",
    options: [
      choice("memory", "Memory", "What it remembers.", [
        ["None", "Nothing beyond the current request."],
        ["Session", "The current conversation."],
        ["Persistent", "Across conversations."],
      ]),
      choice("approval", "Human approval", "Which actions wait for a person before they happen.", [
        ["None", "It acts on its own."],
        ["Selected actions", "Risky actions wait for approval."],
        ["All actions", "Every action waits for approval."],
      ]),
      choice("state", "State", "Whether a run can be resumed after it stops.", [
        ["Ephemeral", "Lost when the run stops."],
        ["Checkpointed", "Saved at steps, so a run can resume."],
        ["Durable", "Kept safe throughout, surviving crashes and restarts."],
      ]),
      toggle("tools", "Tools", "It can call tools."),
    ],
  },
} as const satisfies Record<string, ComponentKindDefinition>;

export type ComponentKind = keyof typeof componentKinds;

export const componentKindNames = Object.keys(componentKinds) as [ComponentKind, ...ComponentKind[]];

export function getKindDefinition(kind: ComponentKind): ComponentKindDefinition {
  return componentKinds[kind];
}

export function isValidOptionValue(option: OptionDefinition, value: OptionValue): boolean {
  switch (option.type) {
    case "toggle":
      return typeof value === "boolean";
    case "choice":
      return option.choices.some((each) => each.value === value);
    case "number":
      return (
        (Number.isInteger(value) && (value as number) >= (option.min ?? 0)) || (option.auto === true && value === AUTO)
      );
    case "text":
      return typeof value === "string" && value.trim() !== "" && value.length <= 80;
    case "duration":
      return (
        typeof value === "string" && (DURATION.test(value) || (option.indefinite === true && value === INDEFINITE))
      );
  }
}

export const isApplicable = (option: OptionDefinition, values: Record<string, OptionValue>) =>
  !option.showWhen || option.showWhen.is.includes(String(values[option.showWhen.key]));

export function withOption(
  kind: ComponentKind,
  values: Record<string, OptionValue>,
  key: string,
  value: OptionValue | undefined,
): Record<string, OptionValue> {
  const next = { ...values };
  if (value === undefined) delete next[key];
  else next[key] = value;
  for (const option of getKindDefinition(kind).options) {
    if (!isApplicable(option, next)) delete next[option.key];
  }
  return next;
}

export function compatibleOptions(
  kind: ComponentKind,
  values: Record<string, OptionValue>,
): Record<string, OptionValue> {
  const { options } = getKindDefinition(kind);
  const kept: Record<string, OptionValue> = {};
  for (const option of options) {
    const value = values[option.key];
    if (value !== undefined && isValidOptionValue(option, value)) kept[option.key] = value;
  }
  for (const option of options) {
    if (!isApplicable(option, kept)) delete kept[option.key];
  }
  return kept;
}

export function summarizeOptions(
  options: readonly OptionDefinition[],
  values: Record<string, OptionValue>,
): { option: OptionDefinition; label: string; value: string }[] {
  return options.flatMap((option) => {
    const value = values[option.key];
    if (value === undefined || !isValidOptionValue(option, value) || !isApplicable(option, values)) return [];
    const shown = typeof value === "boolean" ? (value ? "On" : "Off") : String(value);
    return [{ option, label: option.label, value: shown }];
  });
}

export function describeOptions(kind: ComponentKind, values: Record<string, OptionValue>): string[] {
  return summarizeOptions(getKindDefinition(kind).options, values).map(({ label, value }) => `${label}: ${value}`);
}
