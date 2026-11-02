import { MessagesSquare } from "lucide-react";
import { boundary, build, component, connection, external, type Template } from "./build";

const objects = [
  component("web", "webClient", "Web App", { options: { updates: "WebSockets" } }),
  component("mobile", "mobileApp", "Mobile App", {
    options: { updates: "WebSockets", push: true, offline: "Read-write", sync: "Realtime" },
  }),
  component("load-balancer", "loadBalancer", "Load Balancer", {
    options: { layer: "Layer 7", algorithm: "Least connections", healthChecks: true, availability: "Managed" },
  }),

  component("identity", "identityProvider", "Identity", {
    options: { identity: "Users", session: "Token", federation: "OAuth / OIDC" },
  }),
  boundary("chat", "Chat", "service"),
  component("connections", "service", "Connection Gateway", {
    parent: "chat",
    description: "Holds open WebSockets, and resends what a client missed.",
    options: { state: "Stateful", scaling: "Horizontal" },
  }),
  component("chat-service", "service", "Chat Service", {
    parent: "chat",
    description: "Gives each message a time-ordered id and stores it before anything else.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("presence", "cache", "Presence", {
    description: "Who is online, and which gateway holds their connection.",
    options: { ttl: "30s", replication: "Clustered", onFailure: "Bypass cache" },
    tags: ["Redis"],
  }),
  component("fan-out", "pubSub", "Message Fan-out", {
    description: "Best effort, as messages are already stored. Clients fill any gap from their last message id.",
    options: { delivery: "At-most-once", ordering: "None" },
  }),
  component("messages", "database", "Message Store", {
    description: "Bucketed by time, so a busy conversation never outgrows one partition.",
    options: {
      model: "Wide-column",
      replication: "Leaderless",
      replicaCount: 3,
      partitioning: "Hash",
      partitionKey: "conversation_id, bucket",
      partitions: "Auto",
      consistency: "Quorum",
    },
    structure: {
      model: "Wide-column",
      tables: [
        {
          name: "messages",
          partitionKey: "conversation_id, bucket",
          sortKey: "message_id",
          columns: ["sender_id", "sent_at", "body"],
        },
        { name: "conversation_members", partitionKey: "conversation_id", sortKey: "user_id", columns: ["joined_at"] },
        {
          name: "user_conversations",
          partitionKey: "user_id",
          sortKey: "conversation_id",
          columns: ["last_message_id"],
        },
      ],
    },
    tags: ["Cassandra"],
  }),

  component("push-queue", "queue", "Push Queue", {
    description: "Holds a push for each member with no open connection.",
    options: { delivery: "At-least-once", retry: true, deadLetter: true, retention: "1d" },
  }),
  component("push-worker", "worker", "Push Worker", {
    options: { scaling: "Workload-based", retry: true, idempotent: true },
  }),
  external("push-services", "Push Services", "Reach phones that are not connected.", ["APNs", "FCM"]),
];

const connections = [
  connection("web", "load-balancer", "WebSocket"),
  connection("mobile", "load-balancer", "WebSocket"),
  connection("load-balancer", "connections"),
  connection("connections", "identity", "verifies tokens", "dashed"),
  connection("connections", "chat-service"),
  connection("connections", "presence", "heartbeats"),
  connection("chat-service", "messages", "stores first"),
  connection("chat-service", "fan-out", "publishes", "flow"),
  connection("connections", "fan-out", "subscribes", "flow"),
  connection("chat-service", "push-queue", "offline users"),
  connection("push-queue", "push-worker"),
  connection("push-worker", "push-services"),
];

export const chat: Template = {
  id: "realtime-chat",
  name: "Real-time chat",
  description: "WebSocket gateways, best-effort fan-out over a durable message store, and push for offline users.",
  category: "Architectures",
  icon: MessagesSquare,
  diagram: build(objects, connections),
};
