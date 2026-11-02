import { Bot } from "lucide-react";
import { boundary, build, component, connection, type Template } from "./build";

const objects = [
  component("web", "webClient", "Chat UI", { options: { updates: "Server-sent events" } }),
  component("identity", "identityProvider", "Identity", {
    options: { identity: "Users", session: "Token", federation: "OAuth / OIDC" },
  }),
  component("api", "service", "Assistant API", {
    description: "Works out who is asking, so every search stays inside their tenant.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("limits", "rateLimiter", "Usage Limits", {
    description: "Caps tokens per user, so one runaway loop cannot run up the bill.",
    options: { algorithm: "Token bucket", scope: "User", state: "Distributed" },
  }),
  component("agent", "agent", "Assistant", {
    description: "Answers with sources, and treats retrieved text as data rather than instructions.",
    options: { memory: "Session", approval: "Selected actions", state: "Checkpointed", tools: true },
  }),
  component("conversations", "database", "Conversations", {
    options: { model: "Document", replication: "Managed" },
    structure: {
      model: "Document",
      collections: [
        { name: "conversations", id: "conversation_id", fields: ["tenant_id", "user_id", "title", "updated_at"] },
        { name: "messages", id: "message_id", fields: ["conversation_id", "role", "content", "sources", "created_at"] },
      ],
    },
  }),
  component("knowledge", "database", "Knowledge Base", {
    options: { model: "Vector", replication: "Managed" },
    structure: {
      model: "Vector",
      collections: [
        {
          name: "chunks",
          id: "chunk_id",
          metadata: ["document_id", "title", "embedding_model", "updated_at"],
          filterable: ["tenant_id", "document_id"],
          source: "Documents",
        },
      ],
    },
    tags: ["pgvector"],
  }),

  boundary("provider", "Model provider", "trustZone"),
  component("model", "llm", "Models", {
    parent: "provider",
    description: "A chat model for answers and an embedding model for search.",
    options: { hosting: "Cloud", input: "Multimodal", toolCalling: true, structuredOutput: true, fallback: true },
  }),

  boundary("ingestion", "Ingestion", "service"),
  component("documents", "objectStorage", "Documents", {
    parent: "ingestion",
    options: { versioning: true, retention: "Indefinite" },
  }),
  component("ingestion-queue", "queue", "Ingestion Queue", {
    parent: "ingestion",
    options: { delivery: "At-least-once", retry: true, deadLetter: true },
  }),
  component("embedder", "worker", "Chunk & Embed Worker", {
    parent: "ingestion",
    options: { scaling: "Workload-based", retry: true, idempotent: true },
  }),

  component("observability", "observability", "Tracing & Evals", { options: { logs: true, traces: true } }),
];

const connections = [
  connection("web", "api", "streams answers"),
  connection("web", "identity", "signs in", "dashed"),
  connection("api", "identity", "verifies tokens", "dashed"),
  connection("api", "limits", "checks budget", "dashed"),
  connection("api", "agent"),
  connection("agent", "model", "prompts"),
  connection("agent", "knowledge", "retrieves"),
  connection("agent", "conversations"),
  connection("agent", "observability", "", "dashed"),
  connection("documents", "ingestion-queue", "on change", "flow"),
  connection("ingestion-queue", "embedder", "", "flow"),
  connection("embedder", "model", "embeds"),
  connection("embedder", "knowledge", "indexes"),
];

export const assistant: Template = {
  id: "ai-assistant",
  name: "AI assistant with retrieval",
  description:
    "An agent answering from your documents, scoped per tenant, with usage limits and an ingestion pipeline.",
  category: "Architectures",
  icon: Bot,
  diagram: build(objects, connections),
};
