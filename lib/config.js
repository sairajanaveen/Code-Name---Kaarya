export const config = {
  makeWebhookUrl: process.env.MAKE_WEBHOOK_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "meeting-assets",
  sarvamApiKey: process.env.SARVAM_API_KEY || "",
  llmProvider: process.env.STRUCTURED_LLM_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai"),
  llmApiKey: process.env.STRUCTURED_LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "",
  llmModel: process.env.STRUCTURED_LLM_MODEL || (process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "gpt-4.1-mini"),
  notionToken: process.env.NOTION_TOKEN || "",
  notionMeetingsDatabaseId: process.env.NOTION_MEETINGS_DATABASE_ID || "",
  notionTasksDatabaseId: process.env.NOTION_TASKS_DATABASE_ID || "",
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL || "",
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ""
};

export function integrationStatus() {
  return {
    make: Boolean(config.makeWebhookUrl),
    supabase: Boolean(config.supabaseUrl && config.supabaseServiceKey),
    sarvam: Boolean(config.sarvamApiKey),
    llm: Boolean(config.llmApiKey),
    notion: Boolean(config.notionToken && config.notionTasksDatabaseId),
    email: Boolean(config.emailWebhookUrl),
    teams: Boolean(config.teamsWebhookUrl),
    slack: Boolean(config.slackWebhookUrl)
  };
}
