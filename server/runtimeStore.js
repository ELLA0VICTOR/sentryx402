function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function shortenAddress(address) {
  if (!address || address.length < 12) {
    return address || "pending";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenText(value, maxLength = 64) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function createRuntimeStore(config) {
  const walletSessions = [];
  const policyDecisions = [];
  const receiptLedger = [];
  const gatewayHistory = [];
  const taskRuns = [];
  const terminalEvents = [];

  function pushTerminalEvent(event) {
    terminalEvents.unshift({
      id: createId("EVT"),
      createdAt: new Date().toISOString(),
      ...event,
    });
    terminalEvents.splice(8);
  }

  function seedTerminal() {
    pushTerminalEvent({
      label: "boot_sequence",
      copy: `loaded ${config.network} rails for ${config.gatewayServices.length} paid services`,
      state: "DONE",
      tone: "done",
    });

    pushTerminalEvent({
      label: "service_registry",
      copy: config.gatewayServices
        .map((service) => `${service.method} ${service.path}`)
        .join(" / "),
      state: "LIVE",
      tone: "live",
    });

    pushTerminalEvent({
      label: "orchestrator",
      copy: "ready to plan paid search and news tasks",
      state: "READY",
      tone: "done",
    });

    pushTerminalEvent({
      label: "receipt_writer",
      copy: "ledger waits for the next paid settlement",
      state: "READY",
      tone: "done",
    });
  }

  function registerWalletSession(session) {
    const normalized = {
      id: createId("SES"),
      address: session.address,
      network: session.network,
      networkPassphrase: session.networkPassphrase,
      networkUrl: session.networkUrl || null,
      sorobanRpcUrl: session.sorobanRpcUrl || null,
      connectedAt: new Date().toISOString(),
    };

    walletSessions.unshift(normalized);
    walletSessions.splice(4);

    pushTerminalEvent({
      label: "wallet_session",
      copy: `${shortenAddress(normalized.address)} connected on ${normalized.network}`,
      state: "LIVE",
      tone: "live",
    });

    return normalized;
  }

  function recordPolicyDecision(decision) {
    policyDecisions.unshift(decision);
    policyDecisions.splice(8);

    pushTerminalEvent({
      label: "policy_router",
      copy:
        decision.status === "approved"
          ? `approved ${decision.serviceId} for "${shortenText(decision.query, 36)}"`
          : decision.reasons[0] || "policy rejected the request",
      state: decision.status === "approved" ? "DONE" : "BLOCKED",
      tone: decision.status === "approved" ? "done" : "warn",
    });
  }

  function recordReceipt(receipt) {
    const normalized = {
      id: createId("RCPT"),
      createdAt: new Date().toISOString(),
      ...receipt,
    };

    receiptLedger.unshift(normalized);
    receiptLedger.splice(10);

    pushTerminalEvent({
      label: "receipt_writer",
      copy: `settled ${normalized.amount} for ${normalized.serviceName || normalized.serviceId}`,
      state: "DONE",
      tone: "done",
    });

    return normalized;
  }

  function recordGatewayResult(result) {
    const normalized = {
      id: createId("QRY"),
      createdAt: new Date().toISOString(),
      ...result,
    };

    gatewayHistory.unshift(normalized);
    gatewayHistory.splice(10);

    pushTerminalEvent({
      label: normalized.serviceId,
      copy: `"${shortenText(normalized.query, 38)}" returned ${normalized.itemCount} results`,
      state: "DONE",
      tone: "done",
    });

    return normalized;
  }

  function recordTaskRun(run) {
    const normalized = {
      id: createId("RUN"),
      createdAt: new Date().toISOString(),
      ...run,
    };

    taskRuns.unshift(normalized);
    taskRuns.splice(6);

    pushTerminalEvent({
      label: "playground_run",
      copy: `${normalized.steps.length} paid step${normalized.steps.length === 1 ? "" : "s"} finished for "${shortenText(
        normalized.task,
        34,
      )}"`,
      state: "DONE",
      tone: "live",
    });

    return normalized;
  }

  function buildHeroStats() {
    return [
      { value: `${config.gatewayServices.length}`, label: "Paid gateway services" },
      { value: config.gatewayServices[0]?.price || "$0.01", label: "Base query price" },
      { value: "Freighter", label: "Live browser signer" },
    ];
  }

  function buildSettlementFlow() {
    return [
      {
        step: "01",
        token: "WAL",
        title: "Connect Wallet",
        copy: "Attach Freighter so the session has a live Stellar signer for x402 auth-entry approval.",
      },
      {
        step: "02",
        token: "API",
        title: "Pick Gateway",
        copy: "Use the search or news gateway before the agent spends on the next call.",
      },
      {
        step: "03",
        token: "POL",
        title: "Check Policy",
        copy: "Review the query, service id, and budget before any paid retry can proceed.",
      },
      {
        step: "04",
        token: "402",
        title: "Pay Per Query",
        copy: "The client signs the auth entry, retries the request, and the facilitator settles on Stellar.",
      },
      {
        step: "05",
        token: "RUN",
        title: "Return Report",
        copy: "Agent results and receipts stay visible for the operator after every run.",
      },
    ];
  }

  function getSnapshot() {
    const latestSession = walletSessions[0] || null;
    const latestDecision = policyDecisions[0] || null;
    const latestGatewayResult = gatewayHistory[0] || null;
    const latestTaskRun = taskRuns[0] || null;

    return {
      app: {
        name: config.appName,
        summary:
          "Sentryx402 turns search and news into paid agent services on Stellar, then gives the operator policy control, wallet approval, and receipts for every query.",
        explainer: [
          "Gateway wraps live search and news behind x402 so agents pay only when they actually query.",
          "Agent Runner plans natural-language tasks into paid steps, runs them through the approved gateways, and returns a clearer final answer with sources.",
          "Every successful call leaves a visible receipt trail so operator spend is easy to verify during the demo.",
        ],
      },
      heroStats: buildHeroStats(),
      settlementFlow: buildSettlementFlow(),
      agentFlowNodes: [
        {
          token: "REQ",
          kind: "task",
          tone: "muted",
          title: "Task Brief",
          copy: "captures the research request before any paid call is attempted",
        },
        {
          token: "ORC",
          kind: "planner",
          tone: "orange",
          title: "Orchestrator",
          copy: "splits the task into gateway steps and checks the active payment policy",
        },
        {
          token: "SRC",
          kind: "search",
          tone: "green",
          title: "Search Agent",
          copy: "runs paid search to collect the strongest references for the task",
        },
        {
          token: "NWS",
          kind: "news",
          tone: "green",
          title: "News Agent",
          copy: "pulls current coverage when the task needs the latest updates",
        },
        {
          token: "RPT",
          kind: "report",
          tone: "cyan",
          title: "Report Writer",
          copy: "merges sources, current signals, and receipts into one operator-facing answer",
        },
      ],
      agentSupportNodes: [
        {
          token: "REG",
          kind: "registry",
          tone: "muted",
          title: "Service Registry",
          copy: config.gatewayServices.map((service) => service.id).join(" / "),
        },
        {
          token: "CAP",
          kind: "limits",
          tone: "muted",
          title: "Budget Guard",
          copy: `$${config.policy.maxUsdPerRequest.toFixed(2)} per request / $${config.policy.dailyUsdCap.toFixed(
            2,
          )} daily`,
        },
      ],
      keySafeguards: [
        {
          token: "DST",
          tag: "Allowlist",
          title: "Approved gateways only",
          copy: "Only the registered search and news routes are allowed to trigger payment prompts.",
        },
        {
          token: "CAP",
          tag: "Budget",
          title: "Per-query spend caps",
          copy: `Each request is checked against the $${config.policy.maxUsdPerRequest.toFixed(
            2,
          )} operator ceiling before the wallet signs.`,
        },
        {
          token: "LOG",
          tag: "Audit",
          title: "Readable receipt ledger",
          copy: "Every paid call records the route, payer, amount, network, and transaction reference.",
        },
      ],
      terminalPhrases: [
        "plan_task --goal 'latest Stellar x402 updates'",
        "pay_query --service search_gateway --amount 0.01_usdc",
        "fetch_news --service news_gateway --topic stellar",
        "write_receipt --scope operator_ledger",
      ],
      terminalEvents: terminalEvents.map(({ label, copy, state, tone }) => ({
        label,
        copy,
        state,
        tone,
      })),
      serviceRegistry: config.gatewayServices.map((service) => ({
        ...service,
        host: new URL(service.route).host,
        route: service.path,
        status: config.readiness.paymentRailReady ? "live" : "configuration_required",
      })),
      policyDecisions,
      receiptLedger,
      gatewayHistory,
      latestGatewayResult,
      taskRuns,
      latestTaskRun,
      walletSession: latestSession,
      latestDecision,
      runtimeSummary: {
        network: config.network,
        networkPassphrase: config.networkPassphrase,
        rpcUrl: config.rpcUrl,
        facilitatorUrl: config.facilitatorUrl,
        asset: config.asset,
        payTo: config.payTo || null,
        compatibleWallets: config.walletSupport.compatible,
        liveWalletSupport: config.walletSupport.live,
      },
      readiness: config.readiness,
    };
  }

  seedTerminal();

  return {
    getSnapshot,
    recordGatewayResult,
    recordPolicyDecision,
    recordReceipt,
    recordTaskRun,
    registerWalletSession,
  };
}
