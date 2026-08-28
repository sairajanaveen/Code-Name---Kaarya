import { ShieldCheck } from "lucide-react";

const items = [
  {
    title: "Notes before sign-in",
    body: "When you start Google sign-in, your draft is temporarily stored on this device so it can be restored on return. It is cleared when Kaarya next opens and is restored only within 30 minutes. Closing the browser does not immediately erase that local copy. Use a trusted device for confidential notes."
  },
  {
    title: "Private meeting history",
    body: "Meeting history requests require a verified Supabase sign-in and are filtered to the meeting creator. Team-wide sharing and enterprise access controls are not included in this release."
  },
  {
    title: "Processing and storage",
    body: "Notes are sent to the configured AI provider to create a draft. Gemini may fall back to OpenAI. Voice notes are sent to Sarvam for transcription. Successful drafts and reviewed output are retained privately in Supabase. These services process data under their own terms; confidential use requires your organization to approve those terms."
  },
  {
    title: "Long transcript uploads",
    body: "Large transcripts are uploaded privately before processing. Completed sections are checkpointed so you can resume for up to 24 hours. Discard removes unfinished content; completed jobs remove temporary copies and retain the meeting in your history. Expired uploads are removed on the next upload in your account or by workspace maintenance."
  },
  {
    title: "User-controlled sharing",
    body: "Generating a draft does not send messages. Opening WhatsApp, Gmail or Outlook transfers the selected draft into that service through a compose link; URLs may appear in browser history. Review sensitive content first. These links do not connect your inbox to Kaarya. Anyone with a task update link can view and update that task; share links only with the intended stakeholder."
  },
  {
    title: "Review for accuracy",
    body: "Source quotes are checked before generated actions appear. This is not a guarantee that every interpretation is correct. Review commitments, names, dates and recipients before sharing."
  },
  {
    title: "Export and deletion",
    body: "Meeting history supports export and confirmed deletion of notes, tasks, cached drafts and task links. Minimal usage records remain to enforce allowances. Previously sent emails and external copies cannot be recalled; backups follow the hosting provider's retention policy. Legacy file attachments and scheduled deliveries require operator assistance before deletion. Task-link expiry and compliance certifications are not included in this release."
  }
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#f8faf9] px-5 py-12 text-[#24332e]">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
          <ShieldCheck size={24} />
        </div>
        <a href="/" className="mb-6 inline-block text-sm text-emerald-700">Back to Kaarya</a>
        <h1 className="text-3xl font-semibold">Privacy and data handling</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
          Understand what is stored, which services process your notes, and what you control before using this workspace.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.title} className="rounded-lg border border-[#dce5e1] bg-white p-5">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
