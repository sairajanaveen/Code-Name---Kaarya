export const exampleInput = {
  meeting_name: "Client launch review", meeting_date: "2026-08-27", attendees: "Asha, Rohan, Priya",
  agenda: "Confirm the pilot launch and resolve blockers", output_focus: "actions",
  raw_notes: "We agreed to launch the pilot after onboarding is complete. Asha will send the onboarding checklist on 2026-08-28. Rohan will fix the dashboard loading issue on 2026-08-29. Priya is blocked on vendor setup because the GST documents have not arrived. We have not agreed a due date for vendor setup. Before the next review, the team needs a decision on who can release the vendor documents.",
  source: "website", email: ""
};
export const exampleOutput = {
  summary: "The pilot can launch once onboarding is complete. Dashboard loading and missing vendor GST documents remain open.",
  language: "English", readiness_score: 83,
  decisions: ["Launch the pilot after onboarding is complete."],
  blockers: ["Vendor setup is waiting on GST documents."],
  action_items: [
    { task: "Send the onboarding checklist", owner: "Asha", team: "", due_date: "2026-08-28", status: "pending", priority: "High", evidence: "Asha will send the onboarding checklist on 2026-08-28." },
    { task: "Fix the dashboard loading issue", owner: "Rohan", team: "", due_date: "2026-08-29", status: "pending", priority: "High", evidence: "Rohan will fix the dashboard loading issue on 2026-08-29." },
    { task: "Complete vendor setup", owner: "Priya", team: "", due_date: "", status: "blocked", priority: "Medium", evidence: "Priya is blocked on vendor setup because the GST documents have not arrived." }
  ],
  prep_questions: [
    { question: "Who can release the missing GST documents so Priya can complete vendor setup?", intended_owner: "Priya", reason: "Vendor setup is blocked and has no agreed deadline.", next_meeting_date: "" },
    { question: "Can Rohan show the loading fix working before pilot approval?", intended_owner: "Rohan", reason: "The dashboard issue is still open.", next_meeting_date: "" }
  ]
};

export function createExampleReview(makeId = () => crypto.randomUUID()) {
  const structured = JSON.parse(JSON.stringify(exampleOutput));
  structured.action_items = structured.action_items.map((item) => ({ ...item, id: makeId() }));
  return {
    meeting: { id: makeId(), title: exampleInput.meeting_name, meeting_date: exampleInput.meeting_date },
    structured, warnings: [], saved: false, revision: 0, example: true
  };
}
