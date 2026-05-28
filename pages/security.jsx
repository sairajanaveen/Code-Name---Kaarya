import { ShieldCheck } from "lucide-react";

const items = [
  {
    title: "Tenant-isolated workspace design",
    body: "Kaarya is being structured around organizations, members, and row-level access controls so each customer only sees their own meeting data."
  },
  {
    title: "Backend-only service credentials",
    body: "Sensitive service keys are stored in deployment environment variables and are never exposed in browser code or public repositories."
  },
  {
    title: "User-controlled sharing",
    body: "Stakeholder nudges are drafted for review. Teams can copy, share, or send updates deliberately instead of allowing uncontrolled automatic spam."
  },
  {
    title: "Human-readable outputs",
    body: "Emails, WhatsApp nudges, and summaries are professional, clean, and free from AI watermark language."
  },
  {
    title: "Deletion and retention ready",
    body: "The data model supports meeting-level ownership so retention controls, exports, and deletion workflows can be added cleanly as customers mature."
  }
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-5 py-12 text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); body { font-family: Inter, system-ui, sans-serif; background: #050505; }`}</style>
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Security and data trust</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Kaarya is built for teams that discuss sensitive execution, finance, HR, client, and program data. The product design keeps customer control, isolation, and auditability at the center.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
