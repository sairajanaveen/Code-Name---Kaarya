import Head from "next/head";
import { ClipboardCheck, ArrowLeft } from "lucide-react";
import PricingContent from "../components/PricingContent";
export default function Pricing() {
  return <div className="kaarya-app"><Head><title>Plans | Kaarya</title><meta name="description" content="Kaarya Free, Pro and Team meeting accountability plans." /></Head><header className="app-header"><a className="brand" href="/"><span className="brand-mark"><ClipboardCheck size={21} /></span>Kaarya</a><a className="button" href="/"><ArrowLeft size={16} />Workspace</a></header><main className="workspace"><PricingContent /></main><footer className="app-footer"><span>Kaarya</span><a href="/security">Privacy & data handling</a></footer></div>;
}
