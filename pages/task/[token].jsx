import { useEffect, useState } from "react";

const statuses = [
  ["pending", "Pending"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"]
];

export default function TaskUpdatePage({ token }) {
  const [task, setTask] = useState(null);
  const [status, setStatus] = useState("pending");
  const [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.task) {
          setTask(data.task);
          setStatus(data.task.status || "pending");
          setEvidence(data.task.update_note || "");
        } else {
          setMessage(data.error || "This task link is no longer available.");
        }
      }).catch(() => setMessage("The task could not be loaded. Please refresh and try again.")).finally(() => setLoading(false));
  }, [token]);

  async function saveStatus(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("Saving...");
    try {
    const response = await fetch(`/api/tasks/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, update_note: evidence })
    });
    const data = await response.json();
    if (response.ok) {
      setTask(data.task);
      setMessage("Status updated. Thank you.");
    } else {
      setMessage(data.error || "Could not update status.");
    }
    } catch { setMessage("Your update could not be sent. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Kaarya task update</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{task?.task || (loading ? "Loading task..." : "Task unavailable")}</h1>
        {!task && message && <p role="alert">{message}</p>}
        <p className="mt-3 text-sm leading-6 text-zinc-400">Update your progress here. This will reflect back on the Kaarya dashboard.</p>

        {task && (
          <form onSubmit={saveStatus} className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {statuses.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  disabled={saving}
                  aria-pressed={status === value}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${status === value ? "border-white bg-white text-black" : "border-white/10 bg-black text-zinc-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Update note</span>
              <textarea
                value={evidence}
                maxLength={2000}
                disabled={saving}
                onChange={(event) => setEvidence(event.target.value)}
                className="min-h-[130px] w-full resize-none rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                placeholder="Add progress, blocker, or completion note..."
              />
            </label>
            <button disabled={saving} className="w-full rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black">{saving ? "Saving..." : "Update status"}</button>
            {message && <p className="text-sm text-emerald-300">{message}</p>}
          </form>
        )}
      </section>
    </main>
  );
}

export async function getServerSideProps(context) {
  return {
    props: {
      token: context.params.token
    }
  };
}
