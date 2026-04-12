export const pageTabs = [
  { id: "overview", label: "Overview" },
  { id: "gateway", label: "Gateway" },
  { id: "playground", label: "Playground" },
  { id: "receipts", label: "Receipts" },
];

export function getTabFromHash() {
  if (typeof window === "undefined") {
    return "overview";
  }

  const id = window.location.hash.replace("#", "");
  return pageTabs.some((tab) => tab.id === id) ? id : "overview";
}

export function createFallbackRuntime() {
  return {
    app: {
      name: "Sentryx402",
      summary:
        "Payment-native research infrastructure on Stellar. Run paid search and news queries, let an agent complete tasks step by step, and keep receipts visible.",
    },
    heroStats: [
      { value: "2", label: "Paid gateway services" },
      { value: "$0.01", label: "Base query price" },
      { value: "Freighter", label: "Live browser signer" },
    ],
    settlementFlow: [
      {
        step: "01",
        token: "WAL",
        title: "Connect Wallet",
        copy: "Attach Freighter so the app has a real Stellar signer for x402 auth-entry approval.",
      },
      {
        step: "02",
        token: "API",
        title: "Pick Gateway",
        copy: "Choose the paid search or news service the agent needs to call.",
      },
      {
        step: "03",
        token: "POL",
        title: "Check Policy",
        copy: "Review the query, service id, and spend cap before the retry is allowed to proceed.",
      },
      {
        step: "04",
        token: "402",
        title: "Pay Per Query",
        copy: "If approved, the wallet signs the auth entry and the x402 client retries the paid request.",
      },
      {
        step: "05",
        token: "RUN",
        title: "Return Report",
        copy: "Gateway results and receipts stay visible for both the operator and the agent run.",
      },
    ],
    keySafeguards: [
      {
        token: "DST",
        tag: "Allowlist",
        title: "Approved services only",
        copy: "The agent can only spend against the search and news gateways that the operator approved.",
      },
      {
        token: "CAP",
        tag: "Budget",
        title: "Per-query spend caps",
        copy: "Policy checks block anything above the operator ceiling before a signature prompt appears.",
      },
      {
        token: "LOG",
        tag: "Audit",
        title: "Visible receipt ledger",
        copy: "Every successful paid query leaves a readable operator trail instead of vanishing into wallet history.",
      },
    ],
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
        copy: "search_gateway / news_gateway",
      },
      {
        token: "CAP",
        kind: "limits",
        tone: "muted",
        title: "Budget Guard",
        copy: "$0.05 per request / $1.00 daily operator cap",
      },
    ],
    terminalPhrases: [
      "plan_task --goal 'latest Stellar x402 updates'",
      "pay_query --service search_gateway --amount 0.01_usdc",
      "fetch_news --service news_gateway --topic stellar",
      "write_receipt --scope operator_ledger",
    ],
    terminalEvents: [
      {
        label: "service_registry",
        copy: "allowlisted search and news x402 routes",
        state: "LIVE",
        tone: "live",
      },
      {
        label: "orchestrator",
        copy: "ready to plan paid search and news tasks",
        state: "READY",
        tone: "done",
      },
      {
        label: "wallet_signer",
        copy: "auth-entry signing becomes available once Freighter is connected",
        state: "READY",
        tone: "done",
      },
      {
        label: "receipt_writer",
        copy: "ledger updates after every successful settlement",
        state: "READY",
        tone: "done",
      },
    ],
    serviceRegistry: [
      {
        id: "search_gateway",
        name: "Search Gateway",
        method: "GET",
        path: "/x402/gateway/search",
        route: "/x402/gateway/search",
        host: "localhost:4021",
        description: "Paid search gateway for docs and references.",
        price: "$0.01",
        priceUsd: 0.01,
        upstream: "DuckDuckGo / Wikipedia",
        status: "configuration_required",
      },
      {
        id: "news_gateway",
        name: "News Gateway",
        method: "GET",
        path: "/x402/gateway/news",
        route: "/x402/gateway/news",
        host: "localhost:4021",
        description: "Paid news gateway for current signals.",
        price: "$0.02",
        priceUsd: 0.02,
        upstream: "Google News RSS / Hacker News",
        status: "configuration_required",
      },
    ],
    policyDecisions: [],
    receiptLedger: [],
    gatewayHistory: [],
    latestGatewayResult: null,
    taskRuns: [],
    latestTaskRun: null,
    latestDecision: null,
    walletSession: null,
    runtimeSummary: {
      network: "stellar:testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      facilitatorUrl: "https://channels.openzeppelin.com/x402/testnet",
      asset: "USDC",
      payTo: null,
      compatibleWallets: [
        "Freighter Browser Extension",
        "Albedo",
        "Hana",
        "HOT",
        "Klever",
        "OneKey",
      ],
      liveWalletSupport: ["Freighter Browser Extension"],
    },
    readiness: {
      paymentRailReady: false,
      missingConfiguration: [],
    },
    paymentRail: {
      ready: false,
      reason: "awaiting_server",
    },
  };
}

export function mergeRuntime(base, data) {
  const next = data || {};

  return {
    ...base,
    ...next,
    app: { ...base.app, ...(next.app || {}) },
    runtimeSummary: { ...base.runtimeSummary, ...(next.runtimeSummary || {}) },
    readiness: { ...base.readiness, ...(next.readiness || {}) },
    paymentRail: { ...base.paymentRail, ...(next.paymentRail || {}) },
    heroStats: next.heroStats?.length ? next.heroStats : base.heroStats,
    settlementFlow: next.settlementFlow?.length ? next.settlementFlow : base.settlementFlow,
    keySafeguards: next.keySafeguards?.length ? next.keySafeguards : base.keySafeguards,
    agentFlowNodes: next.agentFlowNodes?.length ? next.agentFlowNodes : base.agentFlowNodes,
    agentSupportNodes: next.agentSupportNodes?.length
      ? next.agentSupportNodes
      : base.agentSupportNodes,
    terminalPhrases: next.terminalPhrases?.length ? next.terminalPhrases : base.terminalPhrases,
    terminalEvents: next.terminalEvents?.length ? next.terminalEvents : base.terminalEvents,
    serviceRegistry: next.serviceRegistry?.length ? next.serviceRegistry : base.serviceRegistry,
    policyDecisions: next.policyDecisions || base.policyDecisions,
    receiptLedger: next.receiptLedger || base.receiptLedger,
    gatewayHistory: next.gatewayHistory || base.gatewayHistory,
    latestGatewayResult: next.latestGatewayResult || base.latestGatewayResult,
    taskRuns: next.taskRuns || base.taskRuns,
    latestTaskRun: next.latestTaskRun || base.latestTaskRun,
    latestDecision: next.latestDecision || base.latestDecision,
  };
}
