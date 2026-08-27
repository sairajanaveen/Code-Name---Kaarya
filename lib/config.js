const llmProvider = process.env.STRUCTURED_LLM_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai");

export const config = {
  makeWebhookUrl: process.env.MAKE_WEBHOOK_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "meeting-assets",
  sarvamApiKey: process.env.SARVAM_API_KEY || "",
  llmProvider,
  llmApiKey: (llmProvider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY) || process.env.STRUCTURED_LLM_API_KEY || "",
  llmModel: process.env.STRUCTURED_LLM_MODEL || (llmProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4.1-mini"),
  intakeWebhookSecret: process.env.INTAKE_WEBHOOK_SECRET || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  validatorModel: process.env.VALIDATOR_LLM_MODEL || "gpt-4.1-mini",
  notionToken: process.env.NOTION_TOKEN || "",
  notionMeetingsDatabaseId: process.env.NOTION_MEETINGS_DATABASE_ID || "",
  notionTasksDatabaseId: process.env.NOTION_TASKS_DATABASE_ID || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Kaarya <onboarding@resend.dev>",
  appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL || "",
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ""
};

export function integrationStatus() {
  return {
    make: Boolean(config.makeWebhookUrl),
    supabase: Boolean(config.supabaseUrl && config.supabaseServiceKey),
    auth: Boolean(config.supabaseUrl && config.supabaseAnonKey),
    sarvam: Boolean(config.sarvamApiKey),
    llm: Boolean(config.llmApiKey),
    notion: Boolean(config.notionToken && config.notionTasksDatabaseId),
    email: Boolean(config.resendApiKey),
    teams: Boolean(config.teamsWebhookUrl),
    slack: Boolean(config.slackWebhookUrl)
  };
}
