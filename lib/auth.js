import { config } from "./config.js";
import { AppError, fetchWithTimeout } from "./http.js";

export async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8192) {
    throw new AppError("Sign in with Google to use your private workspace.", 401, "SIGN_IN_REQUIRED");
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new AppError("Sign-in is not configured yet. You can still explore the example.", 503, "AUTH_UNAVAILABLE");
  }
  const response = await fetchWithTimeout(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.supabaseAnonKey, Authorization: authorization }
  }, 8000);
  if (!response.ok) throw new AppError("Your session has expired. Please sign in again.", 401, "SIGN_IN_REQUIRED");
  const user = await response.json();
  if (!/^[0-9a-f-]{36}$/i.test(user?.id || "")) throw new AppError("Please sign in again.", 401);
  return user;
}
