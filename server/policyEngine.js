function createDecisionId() {
  return `POL-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function evaluatePolicy({ config, runtimeStore, input }) {
  const serviceId = String(input?.serviceId || "").trim();
  const service = config.serviceIndex[serviceId];
  const walletAddress = String(input?.walletAddress || "").trim();
  const query = normalizeQuery(input?.query);
  const quotedPriceUsd = Number(input?.quotedPriceUsd ?? service?.priceUsd ?? 0);

  const reasons = [];
  const warnings = [];

  if (!serviceId) {
    reasons.push("service id missing from policy request");
  }

  if (!service) {
    reasons.push("service is not part of the active allowlist");
  }

  if (!walletAddress) {
    reasons.push("wallet connection is required before the agent can approve a payment");
  }

  if (!query) {
    reasons.push("query is required before the agent can request paid access");
  }

  if (quotedPriceUsd > config.policy.maxUsdPerRequest) {
    reasons.push("request exceeds the per-call policy ceiling");
  }

  if (!config.readiness.paymentRailReady) {
    reasons.push("server-side payment rail is not fully configured yet");
  }

  if (quotedPriceUsd > config.policy.dailyUsdCap) {
    warnings.push("single request consumes the full daily session cap");
  }

  const approved = reasons.length === 0;

  const decision = {
    id: createDecisionId(),
    serviceId: serviceId || "pending",
    serviceName: service?.name || "Unknown service",
    walletAddress: walletAddress || null,
    query,
    targetKey: service && query ? `${service.id}:${query.toLowerCase()}` : "pending",
    amountUsd: Number(quotedPriceUsd.toFixed(2)),
    status: approved ? "approved" : "blocked",
    reasons,
    warnings,
    createdAt: new Date().toISOString(),
  };

  runtimeStore.recordPolicyDecision(decision);

  return {
    decision,
    nextAction: approved ? "sign_auth_entry" : "review_policy",
    policy: {
      maxUsdPerRequest: config.policy.maxUsdPerRequest,
      dailyUsdCap: config.policy.dailyUsdCap,
      approvedServiceIds: config.policy.approvedServiceIds,
    },
  };
}
