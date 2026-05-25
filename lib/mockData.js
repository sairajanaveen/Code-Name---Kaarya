export const sampleMeetings = [
  {
    id: "demo-meeting-1",
    title: "Q3 Revenue Readiness",
    meeting_date: "2026-05-25",
    source: "website",
    language: "en-IN",
    summary: "Owners aligned on pricing, rollout dependencies, and renewal risk.",
    readiness_score: 82,
    status: "publishing",
    created_at: new Date().toISOString()
  },
  {
    id: "demo-meeting-2",
    title: "South Region Ops Review",
    meeting_date: "2026-05-23",
    source: "tally",
    language: "hi-IN",
    summary: "Pending branch data and hiring approvals are blocking the next review.",
    readiness_score: 64,
    status: "follow_up_due",
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

export const sampleTasks = [
  {
    id: "task-1",
    meeting_id: "demo-meeting-1",
    task: "Finalize enterprise pricing table before the investor review.",
    owner: "Ravi",
    team: "Growth",
    due_date: "2026-05-27",
    priority: "High",
    status: "in_progress",
    evidence: "Pricing delta discussed in Q3 sync.",
    follow_up_count: 1
  },
  {
    id: "task-2",
    meeting_id: "demo-meeting-1",
    task: "Share renewal risk list with customer success leads.",
    owner: "Meera",
    team: "CS",
    due_date: "2026-05-28",
    priority: "Medium",
    status: "pending",
    evidence: "Three accounts need owner confirmation.",
    follow_up_count: 0
  },
  {
    id: "task-3",
    meeting_id: "demo-meeting-2",
    task: "Collect missing store performance data from south region managers.",
    owner: "Operations Team",
    team: "Ops",
    due_date: "2026-05-29",
    priority: "High",
    status: "blocked",
    evidence: "Data availability was the blocker for next planning call.",
    follow_up_count: 2
  }
];

export const samplePrepQuestions = [
  {
    id: "prep-1",
    question: "Which owner is accountable for each renewal-risk account by Friday?",
    intended_owner: "CS",
    reason: "The previous meeting identified risk but not complete ownership.",
    next_meeting_date: "2026-05-29"
  },
  {
    id: "prep-2",
    question: "What decision is needed to unblock south region hiring approvals?",
    intended_owner: "Ops",
    reason: "Approval dependency is blocking execution progress.",
    next_meeting_date: "2026-05-29"
  }
];
