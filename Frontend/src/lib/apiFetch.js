let pendingRefresh;

const unavailable = () => new Error("The app is temporarily unavailable. Try again in a moment.");

export async function readApiJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw unavailable();
  }
}

async function request(input, options) {
  try {
    return await fetch(input, options);
  } catch (error) {
    if (options?.signal?.aborted || error.name === "AbortError") throw error;
    throw unavailable();
  }
}

export function refreshSession() {
  if (pendingRefresh) return pendingRefresh;
  async function refresh() {
    const current = await request("/api/auth/session", { cache: "no-store" });
    if (current.ok) return true;
    if (current.status !== 401) return false;
    const rotated = await request("/api/auth/refresh", { method: "POST", cache: "no-store" });
    if (rotated.status === 401) window.dispatchEvent(new Event("dayline-session-ended"));
    return rotated.ok;
  }
  // Cookies are shared across tabs. Serialize rotation and check if another tab
  // already obtained a fresh access token before consuming the refresh token.
  pendingRefresh = (navigator.locks ? navigator.locks.request("dayline-refresh", refresh) : refresh())
    .finally(() => { pendingRefresh = undefined; });
  return pendingRefresh;
}

export async function apiFetch(input, options) {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  const eligible = url.origin === location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/");
  const retry = eligible && input instanceof Request ? input.clone() : input;
  const response = await request(input, options);
  if (!eligible || response.status !== 401 || options?.signal?.aborted) return response;
  if (!(await refreshSession()) || options?.signal?.aborted) return response;
  return request(retry, options);
}
