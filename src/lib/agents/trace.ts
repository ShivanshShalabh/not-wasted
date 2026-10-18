/** Shared shape every agent returns so the UI can show "what the agent did" consistently. */
export interface AgentStep {
  title: string;
  detail: string[];
  /** Public dataset or model used in this step, shown as a source chip. */
  source?: string;
}

export const step = (title: string, detail: string[] = [], source?: string): AgentStep => ({ title, detail, source });
