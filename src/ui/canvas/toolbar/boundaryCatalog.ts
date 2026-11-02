import { Boxes, Layers, type LucideIcon, MapPin, Shield, SquareDashed, Users } from "lucide-react";
import { type BoundaryKind, boundaryKinds } from "../../../diagram/boundaryKinds";
import type { Boundary } from "../../../diagram/schema";

const icons: Record<BoundaryKind, LucideIcon> = {
  service: Boxes,
  team: Users,
  domain: Layers,
  trustZone: Shield,
  region: MapPin,
};

export const boundaryIcon = (kind: BoundaryKind | undefined): LucideIcon => (kind ? icons[kind] : SquareDashed);

export const unnamedBoundary = (kind: BoundaryKind | undefined) =>
  kind ? `Unnamed ${boundaryKinds[kind].label.toLowerCase()}` : "Unnamed boundary";

export const boundaryName = (boundary: Boundary) => boundary.name || unnamedBoundary(boundary.kind);
