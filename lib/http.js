export class AppError extends Error {
  constructor(message, status = 502, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  try {
    return await fetch(url, { ...options, signal });
  } catch (error) {
    if (signal.aborted) throw new AppError("The service took too long. Your notes are still here; please try again.", 504, "TIMEOUT");
    throw new AppError("The service could not be reached. Please try again.", 502, "NETWORK_ERROR");
  }
}

export function sendError(res, error) {
  const known = error instanceof AppError;
  return res.status(known ? error.status : 500).json({
    error: known ? error.message : "We could not finish this request. Your draft has not been sent.",
    code: known ? error.code : "REQUEST_FAILED"
  });
}
