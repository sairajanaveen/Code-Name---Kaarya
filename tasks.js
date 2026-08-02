import { samplePrepQuestions, sampleTasks } from "../../../lib/mockData";
import { listDeliveryLogs, listPrepQuestions, listTasks } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [data, prepData, deliveryData] = await Promise.all([listTasks(), listPrepQuestions(), listDeliveryLogs()]);
    return res.status(200).json({
      tasks: data?.skipped ? sampleTasks : data,
      prep_questions: prepData?.skipped ? samplePrepQuestions : prepData,
      delivery_logs: deliveryData?.skipped ? [] : deliveryData,
      demo: Boolean(data?.skipped)
    });
  } catch (error) {
    return res.status(200).json({
      tasks: sampleTasks,
      prep_questions: samplePrepQuestions,
      demo: true,
      warning: error.message
    });
  }
}
