export function withActionIds(output, previous = [], createId = () => crypto.randomUUID()) {
  const used = new Set();
  const match = (old, task) => old.task === task.task && !used.has(old.id);
  return { ...output, action_items: output.action_items.map((task) => {
    const old = previous.find((row) => match(row, task) && row.owner === task.owner && row.due_date === task.due_date)
      || previous.find((row) => match(row, task));
    const id = old?.id || createId();
    used.add(id);
    return { ...task, id };
  }) };
}
