import { Bot, CalendarClock, FileText, LifeBuoy, MessageSquarePlus, Route, Split, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";

export type AgentId = "outreach" | "rescue" | "route" | "intake" | "forecast" | "report" | "split";

export interface AgentInfo { id: AgentId; name: string; tagline: string; icon: LucideIcon; roles: Role[]; endpoint: string }

/** The agent console's catalog; endpoints match GET /api/agents. */
export const AGENTS: AgentInfo[] = [
  { id: "rescue", name: "Pickup rescue", tagline: "Saves food when a pickup is about to fall through", icon: LifeBuoy, roles: ["donor", "recipient"], endpoint: "/api/agents/rescue" },
  { id: "intake", name: "Donor intake", tagline: "Turns a quick message into a posted donation", icon: MessageSquarePlus, roles: ["donor"], endpoint: "/api/agents/intake" },
  { id: "split", name: "Capacity splitter", tagline: "Divides a donation too big for one food bank", icon: Split, roles: ["donor", "recipient"], endpoint: "/api/agents/split" },
  { id: "route", name: "Route planner", tagline: "Plans a food bank's pickup run", icon: Route, roles: ["recipient", "donor"], endpoint: "/api/agents/route" },
  { id: "forecast", name: "Event forecaster", tagline: "Learns from past events to order less catering", icon: CalendarClock, roles: ["donor"], endpoint: "/api/agents/forecast" },
  { id: "report", name: "Weekly impact report", tagline: "Network summary and donor tax letters", icon: FileText, roles: ["donor", "recipient"], endpoint: "/api/agents/report" },
  { id: "outreach", name: "Event outreach", tagline: "Finds events and drafts emails to organizers", icon: Bot, roles: ["donor", "recipient"], endpoint: "/api/agent/scout" },
];

