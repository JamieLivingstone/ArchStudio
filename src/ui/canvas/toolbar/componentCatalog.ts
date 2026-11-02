import {
  Activity,
  Archive,
  Bot,
  BrainCircuit,
  CalendarClock,
  Cog,
  Combine,
  Cpu,
  Database,
  FingerprintPattern,
  Gauge,
  Globe,
  ListOrdered,
  LockKeyhole,
  type LucideIcon,
  MemoryStick,
  Monitor,
  Radio,
  Router,
  Satellite,
  Search,
  Server,
  ShieldCheck,
  Signpost,
  Smartphone,
  Split,
  SquareFunction,
  SquareTerminal,
  WavesHorizontal,
  Workflow,
} from "lucide-react";
import { type ComponentKind, type ComponentKindDefinition, getKindDefinition } from "../../../diagram/componentKinds";

const icons: Record<ComponentKind, LucideIcon> = {
  webClient: Globe,
  mobileApp: Smartphone,
  desktopApp: Monitor,
  cli: SquareTerminal,
  device: Cpu,
  service: Server,
  worker: Cog,
  function: SquareFunction,
  scheduledJob: CalendarClock,
  dns: Signpost,
  cdn: Satellite,
  loadBalancer: Split,
  apiGateway: Router,
  rateLimiter: Gauge,
  database: Database,
  cache: MemoryStick,
  search: Search,
  objectStorage: Archive,
  queue: ListOrdered,
  pubSub: Radio,
  eventStream: WavesHorizontal,
  workflow: Workflow,
  streamProcessor: Combine,
  identityProvider: FingerprintPattern,
  authorization: ShieldCheck,
  secretsManager: LockKeyhole,
  observability: Activity,
  llm: BrainCircuit,
  agent: Bot,
};

const categories: { title: string; tone: string; kinds: ComponentKind[] }[] = [
  {
    title: "Clients",
    tone: "bg-sky-500/10 text-sky-500",
    kinds: ["webClient", "mobileApp", "desktopApp", "cli", "device"],
  },
  {
    title: "Compute",
    tone: "bg-indigo-500/10 text-indigo-500",
    kinds: ["service", "worker", "function", "scheduledJob"],
  },
  {
    title: "Traffic & Edge",
    tone: "bg-teal-500/10 text-teal-500",
    kinds: ["dns", "cdn", "loadBalancer", "apiGateway", "rateLimiter"],
  },
  { title: "Data", tone: "bg-amber-500/10 text-amber-500", kinds: ["database", "cache", "search", "objectStorage"] },
  { title: "Messaging", tone: "bg-pink-500/10 text-pink-500", kinds: ["queue", "pubSub", "eventStream"] },
  { title: "Processing", tone: "bg-orange-500/10 text-orange-500", kinds: ["workflow", "streamProcessor"] },
  {
    title: "Identity & Security",
    tone: "bg-emerald-500/10 text-emerald-500",
    kinds: ["identityProvider", "authorization", "secretsManager"],
  },
  { title: "Operations", tone: "bg-slate-500/10 text-slate-500", kinds: ["observability"] },
  { title: "AI", tone: "bg-violet-500/10 text-violet-500", kinds: ["llm", "agent"] },
];

interface ComponentDefinition extends ComponentKindDefinition {
  kind: ComponentKind;
  icon: LucideIcon;
  tone: string;
}

const NEUTRAL = "bg-accent/10 text-accent";

export function getComponentDefinition(kind: ComponentKind): ComponentDefinition {
  const tone = categories.find((category) => category.kinds.includes(kind))?.tone ?? NEUTRAL;
  return { kind, icon: icons[kind], tone, ...getKindDefinition(kind) };
}

export const componentCatalog = categories.map(({ title, kinds }) => ({
  title,
  items: kinds.map(getComponentDefinition),
}));
