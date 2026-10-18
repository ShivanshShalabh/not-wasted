"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Theme-styled Markdown for AI-written reports (headings, lists, tables, emphasis). Raw HTML is not rendered. */
const components: Components = {
  h1: ({ children }) => <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 font-display text-xl font-semibold tracking-tight text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 text-base font-semibold text-ink">{children}</h3>,
  p: ({ children }) => <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700 marker:text-brand-500">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700 marker:text-brand-600">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="text-stone-500">{children}</em>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline underline-offset-2">{children}</a>,
  hr: () => <hr className="my-6 border-brand-100" />,
  blockquote: ({ children }) => <blockquote className="mt-4 rounded-2xl bg-brand-50/70 px-4 py-2 text-stone-700 ring-1 ring-brand-100">{children}</blockquote>,
  table: ({ children }) => <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-brand-100"><table className="w-full text-left text-sm">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-brand-50/70 text-stone-600">{children}</thead>,
  th: ({ children, style }) => <th style={style} className="px-4 py-2.5 font-semibold">{children}</th>,
  td: ({ children, style }) => <td style={style} className="tabular border-t border-brand-100/70 px-4 py-2.5 text-stone-700">{children}</td>,
  code: ({ children }) => <code className="rounded bg-brand-50 px-1.5 py-0.5 text-[13px] text-brand-900">{children}</code>,
};

export function Markdown({ children }: { children: string }) {
  return <div className="[&>*:first-child]:mt-0"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown></div>;
}
