import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  GatewayPage,
  OverviewPage,
  PlaygroundPage,
  ReceiptsPage,
} from "./components/app/AppPages";
import Footer from "./components/layout/Footer";
import Navbar from "./components/layout/Navbar";
import {
  evaluatePolicy,
  getAppRuntime,
  getRuntimeSnapshot,
  planPlaygroundTask,
  registerWalletSession,
  savePlaygroundRun,
} from "./lib/api";
import { connectFreighter, formatFreighterError } from "./lib/freighter";
import { createPaymentFetcher } from "./lib/paymentClient";
import { createFallbackRuntime, getTabFromHash, mergeRuntime, pageTabs } from "./lib/runtimeState";

const BACKEND_HELP =
  `Backend unavailable on ${import.meta.env.VITE_API_BASE_URL || "http://localhost:4021"}. ${
    import.meta.env.DEV ? "Start `npm run dev:server` in a separate terminal." : "Check your deployed backend URL."
  }`;

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function createTargetKey(serviceId, query) {
  const normalized = normalizeQuery(query).toLowerCase();
  return serviceId && normalized ? `${serviceId}:${normalized}` : "pending";
}

function createPlaygroundLogs(plan) {
  return plan.steps.map((step) => ({
    detail: step.query,
    id: step.id,
    label: step.title,
    status: "pending",
  }));
}

export default function App() {
  const baseRuntime = useMemo(() => createFallbackRuntime(), []);
  const [activeTab, setActiveTab] = useState(getTabFromHash);
  const [appData, setAppData] = useState(baseRuntime);
  const [runtimeError, setRuntimeError] = useState("");
  const [walletState, setWalletState] = useState({
    address: "",
    network: "",
    networkPassphrase: "",
    status: "idle",
    warning: "",
    error: "",
  });
  const [gatewayInput, setGatewayInput] = useState({
    serviceId: "search_gateway",
    query: "stellar x402 docs",
    limit: 5,
  });
  const [gatewayPolicyState, setGatewayPolicyState] = useState({
    status: "idle",
    decision: null,
    error: "",
  });
  const [gatewayState, setGatewayState] = useState({
    status: "idle",
    result: null,
    error: "",
  });
  const [playgroundInput, setPlaygroundInput] = useState(
    "Find the latest Stellar x402 updates and summarize the most important ones.",
  );
  const [agentBudgetUsd, setAgentBudgetUsd] = useState(0.3);
  const [playgroundState, setPlaygroundState] = useState({
    status: "idle",
    plan: null,
    run: null,
    logs: [],
    outputs: [],
    error: "",
  });

  useEffect(() => {
    function handleHashChange() {
      setActiveTab(getTabFromHash());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    let timeoutId = 0;

    async function syncRuntime(delayOnNextSuccess = 4000, delayOnNextFailure = 0) {
      try {
        const data = await getAppRuntime();
        if (active) {
          setAppData(mergeRuntime(baseRuntime, data));
          setRuntimeError("");
        }

        if (active) {
          timeoutId = window.setTimeout(() => {
            void syncRuntime(4000, 15000);
          }, delayOnNextSuccess);
        }
      } catch {
        if (active) {
          setRuntimeError(`${BACKEND_HELP} The local overview is still available.`);
        }

        if (active && delayOnNextFailure > 0) {
          timeoutId = window.setTimeout(() => {
            void syncRuntime(4000, 15000);
          }, delayOnNextFailure);
        }
      }
    }

    void syncRuntime(4000, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [baseRuntime]);

  useEffect(() => {
    setGatewayPolicyState({
      status: "idle",
      decision: null,
      error: "",
    });
    setGatewayState({
      status: "idle",
      result: null,
      error: "",
    });
  }, [gatewayInput.limit, gatewayInput.query, gatewayInput.serviceId]);

  const serviceMap = useMemo(
    () => Object.fromEntries(appData.serviceRegistry.map((service) => [service.id, service])),
    [appData.serviceRegistry],
  );
  const activeService = serviceMap[gatewayInput.serviceId] || appData.serviceRegistry[0] || null;

  function buildGatewayRequest(service, input) {
    if (!service) {
      return {
        params: {},
        policyQuery: "",
      };
    }

    return {
      params: {
        limit: String(input.limit),
        q: normalizeQuery(input.query),
      },
      policyQuery: normalizeQuery(input.query),
    };
  }

  const activeGatewayRequest = activeService ? buildGatewayRequest(activeService, gatewayInput) : null;

  function switchPage(nextTab) {
    setActiveTab(nextTab);
    window.location.hash = nextTab === "overview" ? "" : nextTab;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshRuntime() {
    try {
      const data = await getRuntimeSnapshot();
      setAppData((current) => mergeRuntime(current, data));
      setRuntimeError("");
    } catch {
      setRuntimeError(`${BACKEND_HELP} The local overview is still available.`);
    }
  }

  async function handleConnectWallet() {
    setWalletState((current) => ({
      ...current,
      status: "pending",
      error: "",
      warning: "",
    }));

    try {
      const session = await connectFreighter(appData.runtimeSummary.networkPassphrase);
      setWalletState({
        address: session.address,
        network: session.network,
        networkPassphrase: session.networkPassphrase,
        status: "connected",
        warning: session.networkMismatch
          ? `Freighter is connected, but the wallet should switch to ${appData.runtimeSummary.network}.`
          : "",
        error: "",
      });

      try {
        await registerWalletSession(session);
        await refreshRuntime();
      } catch {
        setRuntimeError(`${BACKEND_HELP} The local overview is still available.`);
        setWalletState((current) => ({
          ...current,
          status: "connected",
          warning: current.warning
            ? `${current.warning} ${BACKEND_HELP}`
            : BACKEND_HELP,
          error: "",
        }));
      }
    } catch (error) {
      setWalletState((current) => ({
        ...current,
        status: "error",
        error: formatFreighterError(error),
      }));
    }
  }

  async function handleGatewayPolicyCheck() {
    if (!walletState.address || !activeService) {
      setGatewayPolicyState({
        status: "error",
        decision: null,
        error: "Connect Freighter before running a policy check.",
      });
      return;
    }

    setGatewayPolicyState({
      status: "pending",
      decision: null,
      error: "",
    });

    try {
      const result = await evaluatePolicy({
        query: activeGatewayRequest?.policyQuery || "",
        quotedPriceUsd: activeService.priceUsd,
        serviceId: activeService.id,
        walletAddress: walletState.address,
      });

      setGatewayPolicyState({
        status: "done",
        decision: result.decision,
        error: "",
      });

      await refreshRuntime();
    } catch (error) {
      setGatewayPolicyState({
        status: "error",
        decision: null,
        error: error instanceof Error ? error.message : "Policy evaluation failed.",
      });
    }
  }

  function createFetchPaidResource() {
    return createPaymentFetcher({
      address: walletState.address,
      network: appData.runtimeSummary.network,
      networkPassphrase: walletState.networkPassphrase,
      rpcUrl: appData.runtimeSummary.rpcUrl,
    });
  }

  async function runPaidGatewayCall(service, request) {
    const fetchPaidResource = createFetchPaidResource();
    const params = new URLSearchParams();

    Object.entries(request?.params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).length > 0) {
        params.set(key, String(value));
      }
    });

    const { response, settlement } = await fetchPaidResource(`${service.route}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      method: service.method,
    });

    const rawBody = await response.text();
    let body = {};

    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = {
          message: rawBody,
        };
      }
    }

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error("This step still needs a fresh Freighter approval. Approve the next prompt, then continue.");
      }

      throw new Error(body.message || "The paid route returned an unexpected response.");
    }

    return {
      body,
      settlement,
    };
  }

  async function handleGatewayExecute() {
    switchPage("gateway");

    if (!walletState.address || !activeService) {
      setGatewayState({
        status: "error",
        result: null,
        error: "Connect Freighter before attempting the paid route.",
      });
      return;
    }

    const decision = gatewayPolicyState.decision || appData.latestDecision;
    const targetKey = createTargetKey(activeService.id, activeGatewayRequest?.policyQuery || "");

    if (!decision || decision.status !== "approved" || decision.targetKey !== targetKey) {
      setGatewayState({
        status: "error",
        result: null,
        error: "Check policy for this exact query first.",
      });
      return;
    }

    if (walletState.warning) {
      setGatewayState({
        status: "error",
        result: null,
        error: walletState.warning,
      });
      return;
    }

    if (!appData.paymentRail.ready) {
      setGatewayState({
        status: "error",
        result: null,
        error: "Live settlement is waiting on the remaining .env setup.",
      });
      return;
    }

    setGatewayState({
      status: "pending",
      result: null,
      error: "",
    });

    try {
      const result = await runPaidGatewayCall(activeService, activeGatewayRequest);

      setGatewayState({
        status: "done",
        result,
        error: "",
      });

      await refreshRuntime();
    } catch (error) {
      setGatewayState({
        status: "error",
        result: null,
        error: error instanceof Error ? error.message : "Paid route failed.",
      });
    }
  }

  function setPlaygroundLog(stepId, status, detail) {
    setPlaygroundState((current) => ({
      ...current,
      logs: current.logs.map((item) =>
        item.id === stepId
          ? {
              ...item,
              detail: detail ?? item.detail,
              status,
            }
          : item,
      ),
    }));
  }

  async function ensurePlaygroundPlan() {
    if (playgroundState.plan) {
      return playgroundState.plan;
    }

    const result = await planPlaygroundTask({ task: playgroundInput });
    const logs = createPlaygroundLogs(result.plan);

    setPlaygroundState((current) => ({
      ...current,
      error: "",
      logs,
      outputs: [],
      plan: result.plan,
      run: null,
      status: "planned",
    }));

    return result.plan;
  }

  async function handlePlanPlayground() {
    setPlaygroundState((current) => ({
      ...current,
      error: "",
      logs: [],
      outputs: [],
      plan: null,
      run: null,
      status: "pending",
    }));

    try {
      const plan = await planPlaygroundTask({ task: playgroundInput });
      const logs = createPlaygroundLogs(plan.plan);

      setPlaygroundState({
        error: "",
        logs,
        outputs: [],
        plan: plan.plan,
        run: null,
        status: "planned",
      });
    } catch (error) {
      setPlaygroundState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Could not build the task plan.",
        status: "error",
      }));
    }
  }

  async function handleRunPlayground() {
    switchPage("playground");

    if (!walletState.address) {
      setPlaygroundState((current) => ({
        ...current,
        error: "Connect Freighter before running the playground.",
        status: "error",
      }));
      return;
    }

    if (walletState.warning) {
      setPlaygroundState((current) => ({
        ...current,
        error: walletState.warning,
        status: "error",
      }));
      return;
    }

    if (!appData.paymentRail.ready) {
      setPlaygroundState((current) => ({
        ...current,
        error: "Live settlement is waiting on the remaining .env setup.",
        status: "error",
      }));
      return;
    }

    setPlaygroundState((current) => ({
      ...current,
      error: "",
      run: null,
      status: "running",
    }));

    try {
      let plan = await ensurePlaygroundPlan();
      let outputs = playgroundState.outputs || [];

      if (playgroundState.run && outputs.length >= (plan.steps?.length || 0)) {
        const resetLogs = createPlaygroundLogs(plan);
        outputs = [];

        setPlaygroundState((current) => ({
          ...current,
          error: "",
          logs: resetLogs,
          outputs: [],
          run: null,
          status: "planned",
        }));

        plan = {
          ...plan,
          steps: [...plan.steps],
        };
      }

      const completedStepIds = new Set(outputs.map((item) => item.stepId));
      const nextStep = plan.steps.find((step) => !completedStepIds.has(step.id));

      if (!nextStep) {
        if (!outputs.length) {
          throw new Error("No paid step has completed yet.");
        }

        const report = await savePlaygroundRun({
          budgetUsd: agentBudgetUsd,
          completedAllSteps: outputs.length >= plan.steps.length,
          outputs,
          plan,
          task: playgroundInput,
        });

        setPlaygroundState((current) => ({
          ...current,
          error: "",
          plan,
          run: report.run,
          status: "done",
        }));

        await refreshRuntime();
        return;
      }

      const service = serviceMap[nextStep.serviceId];

      if (!service) {
        throw new Error(`Unknown service: ${nextStep.serviceId}`);
      }

      const spentUsd = Number(outputs.reduce((sum, item) => sum + (item.priceUsd || 0), 0).toFixed(2));
      const remainingBudgetUsd = Number((agentBudgetUsd - spentUsd).toFixed(2));

      if (remainingBudgetUsd <= 0 || service.priceUsd > remainingBudgetUsd) {
        if (!outputs.length) {
          throw new Error(
            `The agent budget is too low for the first step. Raise it above $${service.priceUsd.toFixed(2)}.`,
          );
        }

        const report = await savePlaygroundRun({
          budgetUsd: agentBudgetUsd,
          completedAllSteps: false,
          outputs,
          plan,
          task: playgroundInput,
        });

        setPlaygroundState((current) => ({
          ...current,
          error: "",
          plan,
          run: report.run,
          status: "done",
        }));

        await refreshRuntime();
        return;
      }

      setPlaygroundLog(nextStep.id, "checking", "policy evaluation");

      const policy = await evaluatePolicy({
        query: nextStep.query,
        quotedPriceUsd: service.priceUsd,
        serviceId: service.id,
        walletAddress: walletState.address,
      });

      if (policy.decision.status !== "approved") {
        setPlaygroundLog(nextStep.id, "blocked", policy.decision.reasons[0] || "blocked");
        throw new Error(policy.decision.reasons[0] || "Playground policy blocked the step.");
      }

      setPlaygroundLog(nextStep.id, "paying", service.price);

      const stepRequest = buildGatewayRequest(service, {
        ...gatewayInput,
        limit: nextStep.limit || gatewayInput.limit,
        query: nextStep.query,
      });
      const result = await runPaidGatewayCall(service, stepRequest);

      const nextOutput = {
        itemCount: result.body.result.itemCount,
        priceUsd: service.priceUsd,
        provider: result.body.result.provider,
        query: nextStep.query,
        result: result.body.result,
        serviceId: service.id,
        settlement: result.settlement,
        stepId: nextStep.id,
        title: nextStep.title,
      };
      const nextOutputs = [...outputs, nextOutput];

      setPlaygroundLog(nextStep.id, "done", `${result.body.result.itemCount} results`);

      if (nextOutputs.length < plan.steps.length) {
        setPlaygroundState((current) => ({
          ...current,
          error: "",
          outputs: nextOutputs,
          run: null,
          status: "planned",
        }));

        await refreshRuntime();
        return;
      }

      const report = await savePlaygroundRun({
        budgetUsd: agentBudgetUsd,
        completedAllSteps: true,
        outputs: nextOutputs,
        plan,
        task: playgroundInput,
      });

      setPlaygroundState((current) => ({
        ...current,
        error: "",
        outputs: nextOutputs,
        plan,
        run: report.run,
        status: "done",
      }));

      await refreshRuntime();
    } catch (error) {
      setPlaygroundState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Playground run failed.",
        status: current.outputs.length ? "planned" : "error",
      }));
    }
  }

  const connectLabel =
    walletState.status === "pending"
      ? "Connecting..."
      : walletState.address
        ? `${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}`
        : "Connect Wallet";

  const pageProps = {
    activeService,
    appData,
    gatewayInput,
    gatewayPolicyState,
    gatewayState,
    onConnect: handleConnectWallet,
    onEvaluateGateway: handleGatewayPolicyCheck,
    onExecuteGateway: handleGatewayExecute,
    onPlanPlayground: handlePlanPlayground,
    onRunPlayground: handleRunPlayground,
    onSwitchToGateway: () => switchPage("gateway"),
    agentBudgetUsd,
    playgroundInput,
    playgroundState,
    runtimeError,
    setAgentBudgetUsd,
    setGatewayInput,
    setPlaygroundInput,
    walletState,
  };

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        connectLabel={connectLabel}
        onConnect={handleConnectWallet}
        onTabChange={switchPage}
        tabs={pageTabs}
      />

      <main>
        {activeTab === "overview" ? <OverviewPage {...pageProps} /> : null}
        {activeTab === "gateway" ? <GatewayPage {...pageProps} /> : null}
        {activeTab === "playground" ? <PlaygroundPage {...pageProps} /> : null}
        {activeTab === "receipts" ? <ReceiptsPage {...pageProps} /> : null}
      </main>

      <Footer
        activeTab={activeTab}
        network={appData.runtimeSummary.network}
        onTabChange={switchPage}
        paymentRailReady={appData.paymentRail.ready}
        tabs={pageTabs}
      />
    </div>
  );
}
