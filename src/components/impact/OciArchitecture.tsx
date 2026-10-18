"use client";

import { Boxes, Brain, Database, Eye, MapPinned, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge, Card, fadeUp, SectionTitle } from "../ui";

const SERVICES = [
  { icon: Eye, name: "OCI Generative AI — Vision", desc: "Multimodal chat model tags food allergens & shelf life, furniture condition & lift needs, clothing type & season from a photo." },
  { icon: Brain, name: "OCI Generative AI — Text", desc: "Forecast rationale for pre-event surplus prediction and executive impact narratives." },
  { icon: Database, name: "Oracle AI Database 26ai", desc: "Atomic claim decrement (remaining_qty >= :claim_qty), JSON attributes, AI Vector Search to match batches to recipient need profiles." },
  { icon: MapPinned, name: "Oracle Spatial", desc: "SDO_WITHIN_DISTANCE finds verified recipients in range that accept the batch category." },
  { icon: Boxes, name: "Select AI (DBMS_CLOUD_AI)", desc: "NARRATE natural-language ESG / Good Samaritan reports straight from claim tables." },
  { icon: Server, name: "OCI Container Instances / OKE", desc: "Next.js standalone image pushed to OCIR; resource or instance principals sign GenAI calls." },
];

export function OciArchitecture() {
  const [status, setStatus] = useState<{ enabled: boolean; region: string } | null>(null);
  useEffect(() => {
    fetch("/api/ai/impact").then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);
  return (
    <Card>
      <SectionTitle hint="The Oracle Cloud services behind each feature"
        action={status && (status.enabled ? <Badge tone="blue">OCI GenAI live · {status.region}</Badge> : <Badge>Local fallback mode (set OCI_GENAI_ENABLED=true)</Badge>)}>OCI architecture</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(({ icon: Icon, name, desc }, i) => (
          <motion.div key={name} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} className="group rounded-3xl border border-white/70 bg-white/70 p-5 ring-1 ring-brand-900/[0.04] transition duration-500 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-lift hover:ring-brand-200">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"><Icon className="h-4 w-4" /></span>
            <div className="mt-3 text-sm font-semibold">{name}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{desc}</p>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
