export const boundaryKinds = {
  service: { label: "Service", description: "Components deployed and run together as one service." },
  team: { label: "Team", description: "What one team owns and is on call for." },
  domain: { label: "Domain", description: "A business area or bounded context, such as Payments or Search." },
  trustZone: {
    label: "Trust zone",
    description: "A network or trust boundary, such as a VPC, DMZ or private subnet. Traffic across it needs securing.",
  },
  region: {
    label: "Region",
    description: "A geographic region or data centre, which affects latency, failover and where data lives.",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type BoundaryKind = keyof typeof boundaryKinds;

export const boundaryKindNames = Object.keys(boundaryKinds) as [BoundaryKind, ...BoundaryKind[]];
