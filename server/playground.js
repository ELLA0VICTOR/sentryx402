function createRunId() {
  return `RUN-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildTaskQuery(task) {
  const cleaned = normalizeText(task)
    .replace(/\band summarize(?: them| it)?\b/gi, " ")
    .replace(/\bsummarize(?: them| it)?\b/gi, " ")
    .replace(/\b(find|show|fetch|get|give|explain|research|look up|please|the|me)\b/gi, " ")
    .replace(/[?.!]+$/g, "");

  return normalizeText(cleaned) || normalizeText(task);
}

function shouldUseSearch(task) {
  return /\b(doc|docs|documentation|guide|explain|what|how|overview|research|compare|find|reference|references)\b/i.test(task);
}

function isCurrentEventsTask(task) {
  return /\b(news|latest|recent|headline|headlines|update|updates|today|current)\b/i.test(task);
}

function buildSearchQuery(task) {
  const normalized = normalizeText(task);
  const repoHint = normalized.match(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/)?.[0];

  if (repoHint && /\breadme(?:\.md)?\b/i.test(normalized)) {
    return `${repoHint} README GitHub`;
  }

  if (repoHint && /\bgithub|repository|repo\b/i.test(normalized)) {
    return `${repoHint} GitHub`;
  }

  if (/\breadme(?:\.md)?\b/i.test(normalized) && /\bgithub|repository|repo\b/i.test(normalized)) {
    return `${buildTaskQuery(normalized)} github readme`;
  }

  return buildTaskQuery(normalized);
}

function makeStep(service, query, index, reason, overrides = {}) {
  return {
    agent:
      service.id === "news_gateway" ? "news_agent" : "search_agent",
    id: `STEP-${index + 1}`,
    limit: overrides.limit || 5,
    price: service.price,
    priceUsd: service.priceUsd,
    query,
    reason,
    route: service.path,
    serviceId: service.id,
    title:
      overrides.title ||
      (service.id === "news_gateway" ? "Collect current signals" : "Collect reference material"),
  };
}

function createSummary(outputs, task) {
  const serviceCount = outputs.length;
  const totalResults = outputs.reduce(
    (sum, output) => sum + (output.itemCount || output?.result?.itemCount || 0),
    0,
  );
  return `${serviceCount} paid ${serviceCount === 1 ? "query" : "queries"} returned ${totalResults} source result${totalResults === 1 ? "" : "s"} for "${task}".`;
}

function getLeadItem(outputs, serviceId) {
  return outputs.find((output) => output.serviceId === serviceId)?.result?.items?.[0] || null;
}

function buildFinalAnswer(outputs, completedAllSteps) {
  const newsLead = getLeadItem(outputs, "news_gateway");
  const searchLead = getLeadItem(outputs, "search_gateway");

  const summaryParts = [];

  if (newsLead) {
    summaryParts.push(`Top current update: ${newsLead.title}.`);
  }

  if (searchLead) {
    summaryParts.push(
      searchLead.snippet ? `Best supporting source: ${searchLead.title}. ${searchLead.snippet}` : `Best supporting source: ${searchLead.title}.`,
    );
  }

  const usefulness = [
    newsLead
      ? "The news step tells you what is happening right now."
      : "The search step gives you a quick starting point for the topic.",
    "The search step gives you links you can open and verify yourself.",
    "The receipts show exactly which paid queries were used to produce the answer.",
  ];

  const nextActions = [
    "Open the top source first if you want more detail.",
    "Rerun the task with a narrower prompt if you want a tighter answer.",
    newsLead ? "Use Gateway for a direct search or news lookup when you only need one paid step." : "Use News in Gateway if you need the latest updates instead of background references.",
  ];

  return {
    headline: completedAllSteps ? "Paid research run completed." : "Agent stopped at the budget cap.",
    summary:
      summaryParts.join(" ") ||
      "The paid run completed and returned source material you can open and verify.",
    usefulness,
    nextActions,
  };
}

export function createPlaygroundPlan({ services, task }) {
  const normalizedTask = normalizeText(task);

  if (!normalizedTask) {
    return {
      ok: false,
      status: 400,
      message: "Task is required.",
    };
  }

  const query = buildTaskQuery(normalizedTask);
  const wantsNews = isCurrentEventsTask(normalizedTask);
  const wantsSearch = shouldUseSearch(normalizedTask) || !wantsNews;
  const steps = [];

  if (wantsNews && services.news_gateway) {
    steps.push(makeStep(services.news_gateway, query, steps.length, "collect current coverage"));
  }

  if (wantsSearch && services.search_gateway) {
    steps.push(
      makeStep(
        services.search_gateway,
        buildSearchQuery(normalizedTask),
        steps.length,
        "collect reference context",
      ),
    );
  }

  return {
    ok: true,
    plan: {
      createdAt: new Date().toISOString(),
      estimatedSpendUsd: Number(steps.reduce((sum, step) => sum + step.priceUsd, 0).toFixed(2)),
      mode: steps.length > 1 ? "research" : wantsNews ? "news" : "search",
      objective: `Resolve "${query}" with paid x402 services.`,
      steps,
      task: normalizedTask,
    },
  };
}

export function createPlaygroundRun({ budgetUsd: rawBudgetUsd, completedAllSteps: rawCompletedAllSteps, outputs, plan, task }) {
  const normalizedTask = normalizeText(task || plan?.task);
  const budgetUsd = Number.isFinite(Number(rawBudgetUsd)) ? Number(rawBudgetUsd) : null;
  const completedAllSteps =
    typeof rawCompletedAllSteps === "boolean" ? rawCompletedAllSteps : outputs.length >= plan.steps.length;

  if (!normalizedTask) {
    return {
      ok: false,
      status: 400,
      message: "Task is required.",
    };
  }

  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) {
    return {
      ok: false,
      status: 400,
      message: "A valid plan is required before saving a run.",
    };
  }

  if (!Array.isArray(outputs) || !outputs.length) {
    return {
      ok: false,
      status: 400,
      message: "At least one paid output is required.",
    };
  }

  const highlights = outputs
    .flatMap((output) => (output?.result?.items || []).slice(0, 2))
    .map((item) => item.title || item.url)
    .filter(Boolean)
    .slice(0, 4);

  const sources = outputs
    .flatMap((output) =>
      (output?.result?.items || []).slice(0, 3).map((item) => ({
        provider: output.provider || output?.result?.provider || output.serviceId,
        title: item.title,
        url: item.url,
      })),
    )
    .slice(0, 6);

  return {
    ok: true,
    run: {
      id: createRunId(),
      budgetUsd,
      completedAllSteps,
      finalAnswer: buildFinalAnswer(outputs, completedAllSteps),
      highlights,
      objective: plan.objective,
      sources,
      status: "completed",
      steps: outputs.map((output) => ({
        itemCount: output.itemCount || output?.result?.itemCount || 0,
        provider: output.provider || output?.result?.provider || output.serviceId,
        query: output.query,
        priceUsd: Number(output.priceUsd || 0),
        serviceId: output.serviceId,
        settlement: output.settlement
          ? {
              network: output.settlement.network,
              transaction: output.settlement.transaction,
            }
          : null,
        stepId: output.stepId,
        title: output.title,
      })),
      summary: completedAllSteps
        ? createSummary(outputs, normalizedTask)
        : `The agent spent its budget and stopped after ${outputs.length} paid ${outputs.length === 1 ? "query" : "queries"}.`,
      task: normalizedTask,
      totalResults: outputs.reduce(
        (sum, output) => sum + (output.itemCount || output?.result?.itemCount || 0),
        0,
      ),
      totalSpendUsd: Number(outputs.reduce((sum, output) => sum + (output.priceUsd || 0), 0).toFixed(2)),
      remainingBudgetUsd:
        budgetUsd === null
          ? null
          : Number(
              Math.max(0, budgetUsd - outputs.reduce((sum, output) => sum + (output.priceUsd || 0), 0)).toFixed(2),
            ),
    },
  };
}
