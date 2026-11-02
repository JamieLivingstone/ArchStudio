import { ShoppingCart } from "lucide-react";
import { boundary, build, component, connection, external, type Template } from "./build";

const objects = [
  component("web", "webClient", "Storefront", { options: { rendering: "Hybrid" }, tags: ["Next.js"] }),
  component("mobile", "mobileApp", "Mobile App", { options: { push: true, offline: "Read-only" } }),

  boundary("edge", "Public edge", "trustZone"),
  component("cdn", "cdn", "CDN", {
    parent: "edge",
    options: { distribution: "Pull", content: "Both", ttl: "1h" },
  }),
  component("storefront-server", "service", "Storefront Server", {
    parent: "edge",
    description: "Renders pages and calls the API for the storefront.",
    options: { state: "Stateless", scaling: "Horizontal" },
    tags: ["Next.js"],
  }),
  component("gateway", "apiGateway", "API Gateway", {
    parent: "edge",
    options: { auth: "Delegated", rateLimiting: "Enabled" },
  }),
  component("identity", "identityProvider", "Customer Identity", {
    options: { identity: "Users", session: "Token", federation: "OAuth / OIDC", mfa: true },
  }),

  boundary("catalog", "Catalog", "domain"),
  component("catalog-service", "service", "Catalog Service", {
    parent: "catalog",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("catalog-search", "search", "Product Search", {
    parent: "catalog",
    options: { freshness: "Near-realtime", sourceOfTruth: false },
  }),
  component("catalog-database", "database", "Catalog Database", {
    parent: "catalog",
    options: { model: "Document", replication: "Primary-replica", replicaCount: 2, failover: "Automatic" },
    structure: {
      model: "Document",
      collections: [{ name: "products", id: "sku", fields: ["name", "price", "currency", "category"] }],
    },
    tags: ["MongoDB"],
  }),

  boundary("orders", "Orders", "domain"),
  component("order-service", "service", "Order Service", {
    parent: "orders",
    description: "Runs checkout as a saga, undoing earlier steps if a later one fails.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("cart", "database", "Cart Store", {
    parent: "orders",
    description: "Carts are customer data, so they live in a database rather than a cache.",
    options: { model: "Key-value", replication: "Managed", failover: "Managed" },
    structure: {
      model: "Key-value",
      patterns: [{ name: "cart", key: "customer_id", value: "items, updated_at", ttl: "30d" }],
    },
    tags: ["DynamoDB"],
  }),
  component("order-database", "database", "Order Database", {
    parent: "orders",
    options: {
      model: "Relational",
      replication: "Primary-replica",
      replicaCount: 1,
      consistency: "Strong",
      failover: "Automatic",
    },
    structure: {
      model: "Relational",
      tables: [
        {
          name: "orders",
          columns: [
            { name: "id", type: "uuid", primaryKey: true },
            { name: "customer_id", type: "uuid" },
            { name: "idempotency_key", type: "text" },
            { name: "status", type: "text" },
            { name: "total", type: "numeric" },
            { name: "currency", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
        {
          name: "order_items",
          columns: [
            { name: "order_id", type: "uuid", primaryKey: true, references: "orders.id" },
            { name: "sku", type: "text", primaryKey: true },
            { name: "quantity", type: "int" },
            { name: "unit_price", type: "numeric" },
          ],
        },
        {
          name: "outbox",
          columns: [
            { name: "id", type: "uuid", primaryKey: true },
            { name: "type", type: "text" },
            { name: "payload", type: "jsonb" },
          ],
        },
      ],
    },
    tags: ["PostgreSQL"],
  }),

  boundary("inventory", "Inventory", "domain"),
  component("inventory-service", "service", "Inventory Service", {
    parent: "inventory",
    description: "Reserves stock at checkout, so two customers cannot buy the last item.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("inventory-database", "database", "Inventory Database", {
    parent: "inventory",
    options: {
      model: "Relational",
      replication: "Primary-replica",
      replicaCount: 1,
      consistency: "Strong",
      failover: "Automatic",
    },
    structure: {
      model: "Relational",
      tables: [
        {
          name: "stock",
          columns: [
            { name: "sku", type: "text", primaryKey: true },
            { name: "on_hand", type: "int" },
            { name: "reserved", type: "int" },
          ],
        },
        {
          name: "reservations",
          columns: [
            { name: "order_id", type: "uuid", primaryKey: true },
            { name: "sku", type: "text", primaryKey: true, references: "stock.sku" },
            { name: "quantity", type: "int" },
            { name: "expires_at", type: "timestamptz" },
          ],
        },
      ],
    },
    tags: ["PostgreSQL"],
  }),

  boundary("payments-zone", "Payments", "trustZone"),
  component("payments", "service", "Payment Service", {
    parent: "payments-zone",
    description: "Only sees processor tokens, and confirms outcomes by webhook.",
    options: { state: "Stateless", scaling: "Horizontal" },
  }),
  component("payment-database", "database", "Payment Database", {
    parent: "payments-zone",
    options: {
      model: "Relational",
      replication: "Primary-replica",
      replicaCount: 1,
      consistency: "Strong",
      failover: "Automatic",
    },
    structure: {
      model: "Relational",
      tables: [
        {
          name: "payments",
          columns: [
            { name: "id", type: "uuid", primaryKey: true },
            { name: "order_id", type: "uuid" },
            { name: "idempotency_key", type: "text" },
            { name: "processor_ref", type: "text" },
            { name: "status", type: "text" },
            { name: "amount", type: "numeric" },
            { name: "currency", type: "text" },
            { name: "created_at", type: "timestamptz" },
          ],
        },
      ],
    },
    tags: ["PostgreSQL"],
  }),
  external(
    "card-processor",
    "Card Processor",
    "Takes card details directly from the customer, keeping them out of our systems.",
    ["Stripe"],
  ),

  component("order-events", "eventStream", "Order Events", {
    options: {
      partitions: 12,
      partitionKey: "order_id",
      replicationFactor: 3,
      retention: "7d",
      delivery: "At-least-once",
      ordering: "Per partition",
    },
    tags: ["Kafka"],
  }),
  component("fulfilment", "worker", "Fulfilment Worker", {
    options: { instances: 3, scaling: "Workload-based", retry: true, idempotent: true },
  }),
  component("notifications", "worker", "Notification Worker", { options: { retry: true, idempotent: true } }),
  external("email", "Email Provider", "Sends order confirmations and delivery updates.", []),
];

const connections = [
  connection("web", "cdn"),
  connection("cdn", "storefront-server"),
  connection("storefront-server", "gateway", "API requests"),
  connection("mobile", "gateway", "HTTPS"),
  connection("gateway", "identity", "verifies tokens", "dashed"),
  connection("gateway", "catalog-service"),
  connection("gateway", "order-service"),
  connection("catalog-service", "catalog-search"),
  connection("catalog-service", "catalog-database"),
  connection("catalog-database", "catalog-search", "indexes changes", "flow"),
  connection("order-service", "cart"),
  connection("order-service", "order-database"),
  connection("order-service", "inventory-service", "reserves stock"),
  connection("inventory-service", "inventory-database"),
  connection("order-service", "payments", "authorise"),
  connection("payments", "payment-database"),
  connection("payments", "card-processor", "authorise and capture"),
  connection("order-database", "order-events", "outbox", "flow"),
  connection("order-events", "fulfilment", "", "flow"),
  connection("order-events", "notifications", "", "flow"),
  connection("notifications", "email"),
];

export const ecommerce: Template = {
  id: "ecommerce",
  name: "E-commerce platform",
  description:
    "Domains that own their data, a saga for checkout, an outbox for events, and cards kept out of your systems.",
  category: "Architectures",
  icon: ShoppingCart,
  diagram: build(objects, connections),
};
