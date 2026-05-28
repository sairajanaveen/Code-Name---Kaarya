import { buildHistoricalInsights } from "../../../lib/scoring";
import { listMeetings, listTasks } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [meetings, tasks] = await Promise.all([listMeetings(), listTasks()]);
  if (meetings?.skipped || tasks?.skipped) {
    return res.status(200).json({
      insights: buildHistoricalInsights({ meetings: [], tasks: [] }),
      demo: true
    });
  }

  return res.status(200).json({
    insights: buildHistoricalInsights({ meetings, tasks }),
    demo: false
  });
}
