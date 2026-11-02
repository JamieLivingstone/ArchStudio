import { Link } from "lucide-react";
import { boundary, build, component, connection, external, type Template } from "./build";

const objects = [
  component("dashboard", "webClient", "Dashboard", { options: { rendering: "Client-side" } }),
  component("visitor", "webClient", "Link Visitor", { description: "Anyone who opens a short link." }),
  component("load-balancer", "loadBalancer", "Load Balancer", {
    options: { layer: "Layer 7", healthChecks: true, availability: "Managed" },
  }),
  component("identity", "identityProvider", "Identity", {
    options: { identity: "Users", session: "Token", federation: "OAuth / OIDC" },
  }),

  boundary("links", "Links", "service"),
  component("link-service", "service", "Link Service", {
    parent: "links",
    description: "Generates random base62 codes, and a conditional write rejects any collision.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("limits", "rateLimiter", "Create Limits", {
    parent: "links",
    description: "Stops one account flooding the service with links.",
    options: { algorithm: "Token bucket", scope: "User", state: "Distributed" },
  }),
  external("url-safety", "URL Safety Check", "Rejects malware and phishing targets before a link is created.", []),

  boundary("redirects", "Redirects", "service"),
  component("redirect-service", "service", "Redirect Service", {
    parent: "redirects",
    description: "Answers with a 302 rather than a 301, so browsers keep coming back and every click is counted.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("link-cache", "cache", "Link Cache", {
    parent: "redirects",
    description: "Serves most redirects, as a small share of links gets most of the traffic.",
    options: {
      strategy: "Cache-aside",
      ttl: "24h",
      invalidation: "Explicit",
      eviction: "LFU",
      replication: "Replicated",
      onFailure: "Bypass cache",
    },
    tags: ["Redis"],
  }),

  component("link-database", "database", "Link Database", {
    options: { model: "Key-value", replication: "Managed", failover: "Managed" },
    structure: {
      model: "Key-value",
      patterns: [
        { name: "link", key: "code", value: "target_url, owner_id, created_at", ttl: "expires_at" },
        { name: "owner's links", key: "owner_id, created_at", value: "code" },
      ],
    },
    tags: ["DynamoDB"],
  }),

  component("click-events", "eventStream", "Click Events", {
    options: {
      partitions: 12,
      partitionKey: "code",
      replicationFactor: 3,
      retention: "7d",
      delivery: "At-least-once",
      ordering: "Per partition",
    },
    tags: ["Kafka"],
  }),
  component("click-aggregator", "streamProcessor", "Click Aggregator", {
    options: { state: "Stateful", checkpointing: true, guarantee: "Effectively-once" },
  }),
  component("analytics", "database", "Click Analytics", {
    options: { model: "Time-series", replication: "Primary-replica", replicaCount: 1, failover: "Automatic" },
    structure: {
      model: "Time-series",
      series: [
        {
          name: "clicks_per_minute",
          timestamp: "minute",
          dimensions: ["code", "country", "referrer"],
          values: ["clicks"],
          retention: "395d",
        },
      ],
    },
    tags: ["ClickHouse"],
  }),
];

const connections = [
  connection("dashboard", "load-balancer", "HTTPS"),
  connection("visitor", "load-balancer", "GET /{code}"),
  connection("load-balancer", "link-service"),
  connection("load-balancer", "redirect-service"),
  connection("link-service", "identity", "verifies tokens", "dashed"),
  connection("link-service", "limits", "", "dashed"),
  connection("link-service", "url-safety", "checks target", "dashed"),
  connection("link-service", "link-database", "conditional write"),
  connection("link-service", "analytics", "reads stats"),
  connection("redirect-service", "link-cache"),
  connection("redirect-service", "link-database", "on a miss"),
  connection("redirect-service", "click-events", "never blocks", "flow"),
  connection("click-events", "click-aggregator", "", "flow"),
  connection("click-aggregator", "analytics", "rolls up", "flow"),
];

export const urlShortener: Template = {
  id: "url-shortener",
  name: "URL shortener",
  description: "A read-heavy redirect path behind a cache, with clicks counted without slowing anyone down.",
  category: "Architectures",
  icon: Link,
  diagram: build(objects, connections),
};
