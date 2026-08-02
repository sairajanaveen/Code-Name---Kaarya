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

  useEffect(() => {
    fetch(`/api/tasks/${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.task) {
          setTask(data.task);
          setStatus(data.task.status || "pending");
          setEvidence(data.task.evidence || "");
        }
      });
  }, [token]);

  async function saveStatus(event) {
    event.preventDefault();
    setMessage("Saving...");
    const response = await fetch(`/api/tasks/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, evidence })
    });
    const data = await response.json();
    if (response.ok) {
      setTask(data.task);
      setMessage("Status updated. Thank you.");
    } else {
      setMessage(data.error || "Could not update status.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-10 text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); body { font-family: Inter, system-ui, sans-serif; background: #050505; }`}</style>
      <section className="mx-auto max-w-2xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Kaarya task update</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{task?.task || "Loading task..."}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Update your progress here. This will reflect back on the Kaarya dashboard.</p>

        {task && (
          <form onSubmit={saveStatus} className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {statuses.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
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
                onChange={(event) => setEvidence(event.target.value)}
                className="min-h-[130px] w-full resize-none rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                placeholder="Add progress, blocker, or completion note..."
              />
            </label>
            <button className="w-full rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black">Update status</button>
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
