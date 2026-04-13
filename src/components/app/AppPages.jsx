import {
  AgentFlowDiagram,
  FlowCard,
  HeroStat,
  SafeguardCard,
  StatusBadge,
  TerminalPanel,
} from "./RuntimePanels";

function SectionLabel({ children }) {
  return <p className="section-label">{children}</p>;
}

function PageIntro({ eyebrow, title, copy }) {
  return (
    <div className="page-intro">
      <p className="section-label">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function SimpleList({ empty, items, renderItem }) {
  if (!items.length) {
    return <p className="state-copy">{empty}</p>;
  }

  return <div className="simple-list">{items.map(renderItem)}</div>;
}

function SetupNotice({ appData, runtimeError }) {
  const missing = appData.readiness.missingConfiguration;

  if (!runtimeError && appData.paymentRail.ready) {
    return null;
  }

  return (
    <div className="setup-note">
      <strong>{runtimeError ? "Live runtime offline." : "Live settlement setup is incomplete."}</strong>
      <p>
        {runtimeError
          ? "Using the local overview while the backend reconnects."
          : `Add ${missing.join(" / ")} to .env to enable live settlement.`}
      </p>
    </div>
  );
}

function shortenValue(value, start = 6, end = 4) {
  if (!value || value.length <= start + end + 3) {
    return value || "pending";
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatTimestamp(value) {
  if (!value) {
    return "pending";
  }

  return new Date(value).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function formatUsd(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "$0.00";
  }

  return `$${parsed.toFixed(2)}`;
}

function EmptyStateIcon() {
  return (
    <svg aria-hidden="true" className="empty-state-icon" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="18" />
      <path d="M24 14v14" />
      <circle cx="24" cy="31.5" r="1.5" className="empty-state-dot" />
    </svg>
  );
}

function EmptyState({ copy }) {
  return (
    <div className="empty-state">
      <EmptyStateIcon />
      <p>{copy}</p>
    </div>
  );
}

function ReceiptPanel({ appData }) {
  return (
    <article className="control-panel control-panel-wide">
      <div className="control-panel-head">
        <span>receipts</span>
        <span>{appData.receiptLedger.length} entries</span>
      </div>

      <div className="control-panel-body">
        <h3>Settlement history</h3>

        {appData.receiptLedger.length ? (
          <div className="receipt-list">
            {appData.receiptLedger.map((receipt) => (
              <div className="receipt-row" key={receipt.id}>
                <div>
                  <strong>{receipt.serviceName || receipt.serviceId}</strong>
                  <p>{shortenValue(receipt.payer, 7, 5)}</p>
                </div>
                <div>
                  <strong>{receipt.network}</strong>
                  <p>{receipt.amount}</p>
                </div>
                <div>
                  <strong>{shortenValue(receipt.transaction, 8, 6)}</strong>
                  <p>{formatTimestamp(receipt.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState copy="No receipts yet." />
        )}
      </div>
    </article>
  );
}

function GatewayFormPanel({ activeService, gatewayInput, setGatewayInput, services }) {
  function updateField(field, value) {
    setGatewayInput((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <article className="control-panel">
      <div className="control-panel-head">
        <span>gateway</span>
        <span>{activeService?.upstream || "provider"}</span>
      </div>

      <div className="control-panel-body">
        <h3>Query setup</h3>
        <p className="state-copy">{activeService?.description}</p>
        <div className="form-stack">
          <label className="field-block">
            <span>Service</span>
            <select
              className="field-input"
              onChange={(event) => updateField("serviceId", event.target.value)}
              value={gatewayInput.serviceId}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Query</span>
            <input
              className="field-input"
              onChange={(event) => updateField("query", event.target.value)}
              placeholder={activeService?.id === "news_gateway" ? "latest stellar x402 updates" : "stellar x402 docs"}
              type="text"
              value={gatewayInput.query}
            />
          </label>

          <label className="field-block">
            <span>Result limit</span>
            <input
              className="field-input"
              max="8"
              min="1"
              onChange={(event) => updateField("limit", Number(event.target.value))}
              type="number"
              value={gatewayInput.limit}
            />
          </label>
        </div>
      </div>
    </article>
  );
}

function GatewayActionPanel({
  activeService,
  appData,
  gatewayInput,
  gatewayPolicyState,
  gatewayState,
  onEvaluateGateway,
  onExecuteGateway,
  walletState,
}) {
  const decision = gatewayPolicyState.decision || appData.latestDecision;
  const requestLabel = gatewayInput.query || "pending";

  return (
    <article className="control-panel">
      <div className="control-panel-head">
        <span>payment</span>
        <span>{appData.paymentRail.ready ? "ready" : "setup"}</span>
      </div>

      <div className="control-panel-body">
        <h3>{activeService?.name || "Gateway"}</h3>

        <div className="panel-kv">
          <span>Route</span>
          <strong>{activeService?.path || "/x402/gateway/search"}</strong>
        </div>
        <div className="panel-kv">
          <span>Price</span>
          <strong>{activeService?.price || "$0.01"}</strong>
        </div>
        <div className="panel-kv">
          <span>Request</span>
          <strong>{requestLabel}</strong>
        </div>
        <div className="panel-kv">
          <span>Wallet</span>
          <strong>{walletState.address ? shortenValue(walletState.address) : "not connected"}</strong>
        </div>

        <div className="control-actions">
          <button
            className="secondary-button control-button"
            disabled={!walletState.address || gatewayPolicyState.status === "pending"}
            onClick={onEvaluateGateway}
            type="button"
          >
            {gatewayPolicyState.status === "pending" ? "Checking..." : "Check Policy"}
          </button>
          <button
            className="primary-button control-button"
            disabled={
              !walletState.address ||
              gatewayState.status === "pending" ||
              decision?.status !== "approved"
            }
            onClick={onExecuteGateway}
            type="button"
          >
            {gatewayState.status === "pending" ? "Paying..." : "Run Paid Query"}
          </button>
        </div>

        {gatewayPolicyState.error ? <p className="state-copy state-copy-error">{gatewayPolicyState.error}</p> : null}
        {gatewayState.error ? <p className="state-copy state-copy-error">{gatewayState.error}</p> : null}
        {decision ? (
          <p className={`state-copy ${decision.status === "approved" ? "state-copy-success" : "state-copy-warning"}`}>
            {decision.status === "approved"
              ? `Approved ${decision.serviceId} at $${decision.amountUsd.toFixed(2)}.`
              : decision.reasons[0]}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function describeGatewayResult(result) {
  if (!result) {
    return "";
  }

  if (result.summary) {
    return result.summary;
  }

  const lead = result.items?.[0];
  if (!lead) {
    return "No result returned yet.";
  }
  const snippet = lead.snippet ? ` - ${lead.snippet}` : "";
  return `${lead.title}${snippet}`;

}

function ResultCard({ item }) {
  return (
    <a className="result-card" href={item.url} rel="noreferrer" target="_blank">
      <strong>{item.title}</strong>
      <p>{item.snippet}</p>
      <span>{item.meta}</span>
    </a>
  );
}

function GatewayResultsPanel({ appData, gatewayState }) {
  const result = gatewayState.result?.body?.result || appData.latestGatewayResult;
  const history = appData.gatewayHistory || [];

  return (
    <div className="page-stack">
      <article className="control-panel control-panel-wide">
        <div className="control-panel-head">
          <span>results</span>
          <span>{result?.itemCount || 0} items</span>
        </div>

        <div className="control-panel-body">
          <h3>{result ? result.provider : "Latest query"}</h3>
          {result ? (
            <>
              <p className="state-copy">{describeGatewayResult(result)}</p>
              <div className="panel-kv">
                <span>Query</span>
                <strong>{result.query}</strong>
              </div>
              <div className="panel-kv">
                <span>Matches</span>
                <strong>{result.itemCount}</strong>
              </div>
              <div className="result-card-grid">
                {result.items.map((item) => (
                  <ResultCard item={item} key={item.id} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState copy="No paid query yet." />
          )}
        </div>
      </article>

      <article className="control-panel control-panel-wide">
        <div className="control-panel-head">
          <span>history</span>
          <span>{history.length}</span>
        </div>

        <div className="control-panel-body">
          <h3>Recent paid queries</h3>

          <SimpleList
            empty="No gateway history yet."
            items={history}
            renderItem={(item) => (
              <div className="simple-row simple-row-stack" key={item.id}>
                <div>
                  <strong>{item.serviceName}</strong>
                  <p>{item.query}</p>
                </div>
                <span>{item.price}</span>
              </div>
            )}
          />
        </div>
      </article>
    </div>
  );
}

function getPlaygroundActionLabel(playgroundState) {
  const totalSteps = playgroundState.plan?.steps.length || 0;
  const completedSteps = playgroundState.outputs?.length || 0;

  if (playgroundState.status === "pending") {
    return "Planning...";
  }

  if (playgroundState.status === "running") {
    return totalSteps > 1 ? `Approve Step ${Math.min(completedSteps + 1, totalSteps)}...` : "Awaiting Approval...";
  }

  if (!totalSteps) {
    return "Deploy Agent";
  }

  if (completedSteps === 0) {
    return "Deploy Agent";
  }

  if (completedSteps < totalSteps) {
    return `Continue Agent (${completedSteps + 1}/${totalSteps})`;
  }

  return "Run Again";
}

function SpendMeter({ budgetUsd, spentUsd }) {
  const safeBudget = Math.max(Number(budgetUsd) || 0, 0);
  const safeSpent = Math.max(Number(spentUsd) || 0, 0);
  const remaining = Math.max(0, safeBudget - safeSpent);
  const progress = safeBudget > 0 ? Math.min((safeSpent / safeBudget) * 100, 100) : 0;

  return (
    <div className="budget-meter">
      <div className="budget-meter-head">
        <strong>{formatUsd(safeSpent)} spent</strong>
        <span>{formatUsd(remaining)} remaining</span>
      </div>
      <div className="budget-meter-track" aria-hidden="true">
        <div className="budget-meter-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="budget-meter-meta">
        <span>Budget cap {formatUsd(safeBudget)}</span>
        <span>{progress >= 100 ? "cap reached" : "within cap"}</span>
      </div>
    </div>
  );
}

function PlaygroundTaskPanel({
  agentBudgetUsd,
  onPlanPlayground,
  onRunPlayground,
  playgroundInput,
  playgroundState,
  setAgentBudgetUsd,
  setPlaygroundInput,
}) {
  const totalSteps = playgroundState.plan?.steps.length || 0;
  const completedSteps = playgroundState.outputs?.length || 0;
  const spentUsd =
    playgroundState.run?.totalSpendUsd ||
    playgroundState.outputs?.reduce((sum, item) => sum + (item.priceUsd || 0), 0) ||
    0;

  return (
    <article className="control-panel">
      <div className="control-panel-head">
        <span>task</span>
        <span>{totalSteps ? `${completedSteps}/${totalSteps} done` : "idle"}</span>
      </div>

      <div className="control-panel-body">
        <h3>Agent mission</h3>

        <div className="form-stack">
          <label className="field-block">
            <span>Task</span>
            <textarea
              className="field-input field-input-textarea"
              onChange={(event) => setPlaygroundInput(event.target.value)}
              placeholder="Find the latest Stellar x402 updates and summarize them."
              value={playgroundInput}
            />
          </label>

          <label className="field-block">
            <span>Agent budget (USDC)</span>
            <input
              className="field-input"
              min="0.01"
              onChange={(event) => setAgentBudgetUsd(Number(event.target.value))}
              step="0.01"
              type="number"
              value={agentBudgetUsd}
            />
          </label>
        </div>

        <SpendMeter budgetUsd={agentBudgetUsd} spentUsd={spentUsd} />

        <div className="control-actions">
          <button
            className="secondary-button control-button"
            disabled={playgroundState.status === "pending" || playgroundState.status === "running"}
            onClick={onPlanPlayground}
            type="button"
          >
            {playgroundState.status === "pending" ? "Planning..." : "Plan Agent"}
          </button>
          <button
            className="primary-button control-button"
            disabled={playgroundState.status === "running"}
            onClick={onRunPlayground}
            type="button"
          >
            {getPlaygroundActionLabel(playgroundState)}
          </button>
        </div>

        <p className="state-copy">Each paid step asks for its own Freighter approval and stops when the budget runs out.</p>
        {playgroundState.error ? <p className="state-copy state-copy-error">{playgroundState.error}</p> : null}
      </div>
    </article>
  );
}

function PlaygroundPlanPanel({ plan, logs }) {
  return (
    <article className="control-panel">
      <div className="control-panel-head">
        <span>plan</span>
        <span>{plan?.estimatedSpendUsd ? `$${plan.estimatedSpendUsd.toFixed(2)}` : "idle"}</span>
      </div>

      <div className="control-panel-body">
        <h3>{plan?.objective || "Planned steps"}</h3>

        {plan ? (
          <div className="trace-list">
            {logs.map((item) => (
              <div className="trace-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>{item.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState copy="No task planned yet." />
        )}
      </div>
    </article>
  );
}

function PlaygroundReportPanel({ appData, playgroundState }) {
  const run = playgroundState.run || ((playgroundState.outputs || []).length ? null : appData.latestTaskRun);
  const previewSources = (playgroundState.outputs || [])
    .flatMap((output) =>
      (output?.result?.items || []).slice(0, 3).map((item) => ({
        provider: output.provider || output?.result?.provider || output.serviceId,
        title: item.title,
        url: item.url,
      })),
    )
    .slice(0, 6);
  const previewResults = (playgroundState.outputs || []).reduce(
    (sum, output) => sum + (output.itemCount || output?.result?.itemCount || 0),
    0,
  );
  const hasPreview = !run && previewSources.length > 0;

  return (
    <article className="control-panel control-panel-wide">
      <div className="control-panel-head">
        <span>report</span>
        <span>{run ? `$${run.totalSpendUsd.toFixed(2)}` : "idle"}</span>
      </div>

        <div className="control-panel-body">
        <h3>{run ? run.summary : "Latest run"}</h3>

        {run ? (
          <>
            {run.finalAnswer ? (
              <div className="answer-block">
                <div className="answer-section">
                  <span>Final answer</span>
                  <strong>{run.finalAnswer.headline}</strong>
                  <p>{run.finalAnswer.summary}</p>
                </div>
                <div className="answer-grid">
                  <div className="answer-section">
                    <span>Why this is useful</span>
                    <div className="report-highlight-list">
                      {run.finalAnswer.usefulness.map((item) => (
                        <div className="report-highlight" key={item}>
                          <span />
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="answer-section">
                    <span>How to use it</span>
                    <div className="report-highlight-list">
                      {run.finalAnswer.nextActions.map((item) => (
                        <div className="report-highlight" key={item}>
                          <span />
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="answer-grid">
              <div className="answer-section">
                <span>Budget</span>
                <strong>
                  {formatUsd(run.totalSpendUsd)} spent
                  {run.budgetUsd !== null && run.budgetUsd !== undefined ? ` of ${formatUsd(run.budgetUsd)}` : ""}
                </strong>
                <p>
                  {run.remainingBudgetUsd !== null && run.remainingBudgetUsd !== undefined
                    ? `${formatUsd(run.remainingBudgetUsd)} remaining after this run.`
                    : "No budget cap recorded for this run."}
                </p>
              </div>
              <div className="answer-section">
                <span>Execution</span>
                <strong>{run.completedAllSteps ? "All planned steps completed" : "Agent stopped at the budget cap"}</strong>
                <p>{run.objective}</p>
              </div>
            </div>
            <div className="panel-kv">
              <span>Objective</span>
              <strong>{run.objective}</strong>
            </div>
            <div className="panel-kv">
              <span>Total results</span>
              <strong>{run.totalResults}</strong>
            </div>
            {run.highlights?.length ? (
              <div className="report-highlight-list">
                {run.highlights.map((item) => (
                  <div className="report-highlight" key={item}>
                    <span />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {run.steps?.length ? (
              <div className="trace-list">
                {run.steps.map((step) => (
                  <div className="trace-row" key={step.stepId}>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.query}</p>
                    </div>
                    <span>{`${formatUsd(step.priceUsd)} / ${step.settlement?.transaction ? shortenValue(step.settlement.transaction, 8, 6) : "pending"}`}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="result-card-grid">
              {run.sources.map((source, index) => (
                <a className="result-card" href={source.url} key={`${source.provider}-${source.url}`} rel="noreferrer" target="_blank">
                  <strong>{`[${index + 1}] ${source.title}`}</strong>
                  <p>{source.provider}</p>
                  <span>open source</span>
                </a>
              ))}
            </div>
          </>
        ) : hasPreview ? (
          <>
            <div className="panel-kv">
              <span>Progress</span>
              <strong>
                {playgroundState.outputs.length}/{playgroundState.plan?.steps.length || playgroundState.outputs.length} steps complete
              </strong>
            </div>
            <div className="panel-kv">
              <span>Total results</span>
              <strong>{previewResults}</strong>
            </div>
            <div className="result-card-grid">
              {previewSources.map((source) => (
                <a className="result-card" href={source.url} key={`${source.provider}-${source.url}`} rel="noreferrer" target="_blank">
                  <strong>{source.title}</strong>
                  <p>{source.provider}</p>
                  <span>open source</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <EmptyState copy="No playground run yet." />
        )}
      </div>
    </article>
  );
}

export function OverviewPage({ appData, onConnect, onSwitchToGateway, walletState }) {
  return (
    <>
      <section className="hero-section grid-bg">
        <div className="hero-inner">
          <StatusBadge />

          <div className="hero-copy anim-up">
            <h1>{appData.app.name}</h1>
            <p>{appData.app.summary}</p>
          </div>

          <div className="hero-actions anim-up">
            <button className="primary-button" onClick={onConnect} type="button">
              {walletState.address ? "Wallet Connected" : "Connect Freighter"}
            </button>
            <button className="secondary-button" onClick={onSwitchToGateway} type="button">
              Open agent gateways
            </button>
          </div>

          <p className="hero-caption anim-up">
            Freighter browser extension / stellar:testnet / x402 exact / operator receipts
          </p>
          {walletState.warning ? <p className="hero-warning anim-up">{walletState.warning}</p> : null}
          {walletState.error ? <p className="hero-warning anim-up">{walletState.error}</p> : null}

          <div className="hero-stats-strip anim-up">
            {appData.heroStats.map((item) => (
              <HeroStat item={item} key={item.label} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-inner">
          <SectionLabel>PAYMENT FLOW</SectionLabel>
          <div
            className="connected-strip"
            style={{ "--connected-columns": appData.settlementFlow.length }}
          >
            {appData.settlementFlow.map((item) => (
              <FlowCard item={item} key={item.step} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-inner">
          <SectionLabel>AGENTIC RUNTIME</SectionLabel>
          <div className="runtime-layout">
            <AgentFlowDiagram
              nodes={appData.agentFlowNodes}
              supportNodes={appData.agentSupportNodes}
            />
            <TerminalPanel
              terminalEvents={appData.terminalEvents}
              terminalPhrases={appData.terminalPhrases}
            />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-inner">
          <SectionLabel>CORE SAFEGUARDS</SectionLabel>
          <div className="safeguard-grid">
            {appData.keySafeguards.map((item) => (
              <SafeguardCard item={item} key={item.title} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function GatewayPage({
  activeService,
  appData,
  gatewayInput,
  gatewayPolicyState,
  gatewayState,
  onEvaluateGateway,
  onExecuteGateway,
  runtimeError,
  setGatewayInput,
  walletState,
}) {
  return (
    <section className="app-page">
      <div className="page-shell">
        <PageIntro
          eyebrow="GATEWAY"
          title="Run agent-callable search and news"
          copy="Choose search or news, approve the spend, and get a clear answer back."
        />
        <SetupNotice appData={appData} runtimeError={runtimeError} />

        <div className="page-grid">
          <GatewayFormPanel
            activeService={activeService}
            gatewayInput={gatewayInput}
            services={appData.serviceRegistry}
            setGatewayInput={setGatewayInput}
          />
          <GatewayActionPanel
            activeService={activeService}
            appData={appData}
            gatewayInput={gatewayInput}
            gatewayPolicyState={gatewayPolicyState}
            gatewayState={gatewayState}
            onEvaluateGateway={onEvaluateGateway}
            onExecuteGateway={onExecuteGateway}
            walletState={walletState}
          />
        </div>

        <GatewayResultsPanel appData={appData} gatewayState={gatewayState} />
      </div>
    </section>
  );
}

export function PlaygroundPage({
  agentBudgetUsd,
  appData,
  onPlanPlayground,
  onRunPlayground,
  playgroundInput,
  playgroundState,
  runtimeError,
  setAgentBudgetUsd,
  setPlaygroundInput,
}) {
  return (
    <section className="app-page">
      <div className="page-shell">
        <PageIntro
          eyebrow="AGENT RUNNER"
          title="Deploy an autonomous research agent"
          copy="Give the agent a task and a budget, let it pay for live data, and review the answer with receipts."
        />
        <SetupNotice appData={appData} runtimeError={runtimeError} />

        <div className="page-grid">
          <PlaygroundTaskPanel
            agentBudgetUsd={agentBudgetUsd}
            onPlanPlayground={onPlanPlayground}
            onRunPlayground={onRunPlayground}
            playgroundInput={playgroundInput}
            playgroundState={playgroundState}
            setAgentBudgetUsd={setAgentBudgetUsd}
            setPlaygroundInput={setPlaygroundInput}
          />
          <PlaygroundPlanPanel logs={playgroundState.logs} plan={playgroundState.plan} />
        </div>

        <div className="page-stack">
          <PlaygroundReportPanel appData={appData} playgroundState={playgroundState} />
        </div>
      </div>
    </section>
  );
}

export function ReceiptsPage({ appData, runtimeError }) {
  return (
    <section className="app-page">
      <div className="page-shell">
        <PageIntro
          eyebrow="RECEIPTS"
          title="Review payment receipts"
          copy="Completed settlements appear here."
        />
        <SetupNotice appData={appData} runtimeError={runtimeError} />

        <ReceiptPanel appData={appData} />
      </div>
    </section>
  );
}
