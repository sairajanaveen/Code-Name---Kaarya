export function calculateMeetingScores({ meeting = {}, tasks = [], prepQuestions = [] }) {
  const totalTasks = tasks.length;
  const tasksWithOwner = tasks.filter((task) => task.owner && task.owner !== "Unassigned").length;
  const tasksWithDueDate = tasks.filter((task) => task.due_date).length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const hasSummary = Boolean(meeting.summary);

  const ownership = totalTasks ? Math.round((tasksWithOwner / totalTasks) * 30) : 0;
  const deadlines = totalTasks ? Math.round((tasksWithDueDate / totalTasks) * 25) : 0;
  const preparation = Math.min(20, prepQuestions.length * 4);
  const clarity = hasSummary ? 15 : 0;
  const decisions = totalTasks ? 10 : 0;

  const qualityScore = Math.max(0, Math.min(100, ownership + deadlines + preparation + clarity + decisions));
  const productivityScore = Math.max(0, Math.min(100, totalTasks * 12 + doneTasks * 8 - blockedTasks * 10 + clarity));
  const preparednessScore = Math.max(0, Math.min(100, preparation + deadlines + Math.max(0, 35 - blockedTasks * 8)));

  return {
    quality_score: qualityScore,
    productivity_score: productivityScore,
    preparedness_score: preparednessScore,
    efficiency_score: Math.round((qualityScore + productivityScore + preparednessScore) / 3)
  };
}

export function buildHistoricalInsights({ meetings = [], tasks = [] }) {
  const totalMeetings = meetings.length;
  const openTasks = tasks.filter((task) => task.status !== "done");
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const ownerCounts = tasks.reduce((acc, task) => {
    const owner = task.owner || "Unassigned";
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});

  const topOwner = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];
  const averageReadiness = totalMeetings
    ? Math.round(meetings.reduce((sum, meeting) => sum + Number(meeting.readiness_score || 0), 0) / totalMeetings)
    : 0;

  return {
    total_meetings: totalMeetings,
    open_tasks: openTasks.length,
    blocked_tasks: blockedTasks.length,
    average_readiness: averageReadiness,
    most_loaded_owner: topOwner ? topOwner[0] : "None yet",
    insights: [
      totalMeetings ? `${totalMeetings} meetings are now part of Kaarya's execution memory.` : "Start by submitting one real meeting note.",
      openTasks.length ? `${openTasks.length} action items still need follow-through.` : "No open action items are pending.",
      blockedTasks.length ? `${blockedTasks.length} tasks are blocked and should be discussed before the next meeting.` : "No blocked tasks are visible right now.",
      topOwner ? `${topOwner[0]} currently owns the most action items.` : "Ownership patterns will appear after more meetings."
    ]
  };
}
