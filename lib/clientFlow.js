export async function readDraftResponse(response, onStage) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "The request could not finish. Please try again.");
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result;
  const accept = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "stage") onStage(event.stage);
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "result") result = event.data;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop();
      lines.forEach(accept);
      if (done) { accept(pending); break; }
    }
  } finally { reader.releaseLock(); }
  if (!result?.structured) throw new Error("The connection ended before the draft was ready. Your notes are still here.");
  return result;
}
