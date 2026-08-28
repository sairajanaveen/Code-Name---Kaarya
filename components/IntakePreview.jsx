import { ArrowUpRight, Check, FileCheck2 } from "lucide-react";
import { exampleOutput } from "../lib/exampleMeeting";

export default function IntakePreview({ onExample }) {
  return <aside className="intake-preview" aria-label="Example meeting result">
    <div className="preview-label"><FileCheck2 size={17} /><span>Your next steps, together.</span><span className="badge">Example</span></div>
    <div className="preview-document"><p className="document-date">CLIENT LAUNCH REVIEW</p><h2>A meeting that moves<br />the work forward.</h2><h3>Summary</h3><p>The pilot is approved once onboarding is complete. Two deliverables are due this week; vendor setup needs a decision.</p><h3>Action items</h3><div className="preview-task-list">{exampleOutput.action_items.map((task, index) => <div key={task.task}><span className={"preview-check color-" + index}><Check size={13} /></span><span>{task.task}<small>{task.owner} <span aria-hidden="true">/</span> {task.due_date || "Date to confirm"}</small></span></div>)}</div><p className="preview-question">Next meeting: Who can release the vendor documents?</p></div>
    <button className="button subtle preview-example" onClick={onExample}>Explore the complete example<ArrowUpRight size={16} /></button>
  </aside>;
}
