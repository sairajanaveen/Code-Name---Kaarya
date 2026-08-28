import { ArrowLeft, ArrowRight } from "lucide-react";

export const REVIEW_PAGE_SIZE = 25;
export default function PageControls({ count, page, onChange, label, busy = false }) {
  const pages = Math.ceil(count / REVIEW_PAGE_SIZE);
  if (pages <= 1) return null;
  return <nav className="page-controls" aria-label={label + " pages"}>
    <span>{page * REVIEW_PAGE_SIZE + 1}-{Math.min(count, (page + 1) * REVIEW_PAGE_SIZE)} of {count} {label}</span>
    <button className="icon-button" type="button" title="Previous page" aria-label={"Previous " + label + " page"} disabled={busy || page === 0} onClick={() => onChange(page - 1)}><ArrowLeft size={16} /></button>
    <button className="icon-button" type="button" title="Next page" aria-label={"Next " + label + " page"} disabled={busy || page >= pages - 1} onClick={() => onChange(page + 1)}><ArrowRight size={16} /></button>
  </nav>;
}
