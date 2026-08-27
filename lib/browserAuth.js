import { publicSupabaseConfig } from "./publicConfig.js";

let client;
let pending;
export async function getAuthClient() {
  const { url, key } = publicSupabaseConfig();
  if (!url || !key) return null;
  if (!client) {
    pending ||= import("@supabase/supabase-js").then(({ createClient }) => createClient(url, key)).catch((error) => { pending = null; throw error; });
    client = await pending;
  }
  return client;
}

export async function authHeaders() {
  const auth = await getAuthClient();
  const { data } = await auth?.auth.getSession() || {};
  return data?.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
