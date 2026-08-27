import { ShieldCheck } from "lucide-react";

const items = [
  {
    title: "Private meeting history",
    body: "Meeting history requests require a verified Supabase sign-in and are filtered to the meeting creator. Team-wide sharing and enterprise access controls are not included in this release."
  },
  {
    title: "Processing and storage",
    body: "Notes are sent to the configured AI provider to create a draft. Gemini may fall back to OpenAI. Voice notes are sent to Sarvam for transcription. Saving a review stores the source notes and output in Supabase. These services process data under their own terms."
  },
  {
    title: "User-controlled sharing",
    body: "Generating a draft does not send email or publish to connected channels. You review and approve sharing. Anyone with a task update link can view and update that task; only share links with the intended stakeholder."
  },
  {
    title: "Review for accuracy",
    body: "Source quotes are checked before generated actions appear. This is not a guarantee that every interpretation is correct. Review commitments, names, dates and recipients before sharing."
  },
  {
    title: "Current limits",
    body: "Self-service data deletion, configurable retention, task-link expiry and compliance certifications are not available yet. Contact your workspace operator for deletion. Avoid regulated or highly sensitive information until your organization has approved this deployment."
  }
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-5 py-12 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
          <ShieldCheck size={24} />
        </div>
        <a href="/" className="mb-6 inline-block text-sm text-emerald-200">Back to Kaarya</a>
        <h1 className="text-3xl font-semibold">Privacy and data handling</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Understand what is stored, which services process your notes, and what you control before using this workspace.
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
