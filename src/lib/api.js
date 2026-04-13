const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

async function requestJson(path, init) {
  let response;
  const url = buildUrl(path);

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
    });
  } catch {
    throw new Error(
      `Backend unavailable on ${API_BASE_URL || "http://localhost:4021"}.`,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 502 && !data.message) {
      throw new Error(
        `Backend unavailable on ${API_BASE_URL || "http://localhost:4021"}.`,
      );
    }

    throw new Error(data.message || `Request failed for ${path}`);
  }

  return data;
}

export function getAppRuntime() {
  return requestJson("/api/app");
}

export function getRuntimeSnapshot() {
  return requestJson("/api/runtime");
}

export function registerWalletSession(payload) {
  return requestJson("/api/session/wallet", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function evaluatePolicy(payload) {
  return requestJson("/api/policy/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function planPlaygroundTask(payload) {
  return requestJson("/api/playground/plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function savePlaygroundRun(payload) {
  return requestJson("/api/playground/report", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
