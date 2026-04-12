async function requestJson(path, init) {
  let response;

  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
    });
  } catch {
    throw new Error(
      "Backend unavailable on http://localhost:4021. Start `npm run dev:server` in a separate terminal.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error(
        "Backend unavailable on http://localhost:4021. Start `npm run dev:server` in a separate terminal.",
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
