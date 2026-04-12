import { useEffect, useState } from "react";

export function StatusBadge() {
  return (
    <div className="status-badge anim-up">
      <span className="dot-live" />
      <span>PAYMENT-NATIVE AGENT INFRASTRUCTURE</span>
    </div>
  );
}

export function HeroStat({ item }) {
  return (
    <div className="hero-stat" key={item.label}>
      <strong>{item.value}</strong>
      <span>{item.label}</span>
    </div>
  );
}

export function FlowCard({ item }) {
  return (
    <article className="flow-card" key={item.step}>
      <div className="flow-head">
        <span className="flow-step">{item.step}</span>
        <span className="flow-icon">{item.token}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
    </article>
  );
}

export function SafeguardCard({ item }) {
  return (
    <article className="safeguard-card" key={item.title}>
      <div className="safeguard-head">
        <span className="safeguard-icon">{item.token}</span>
        <span className="safeguard-tag">{item.tag}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
    </article>
  );
}

function DiagramNode({ className = "", compact = false, item }) {
  return (
    <article
      className={`diagram-node diagram-node-${item.tone} ${
        compact ? "diagram-node-compact" : ""
      } ${className}`}
    >
      <div className="diagram-node-head">
        <span className="diagram-node-token">{item.token}</span>
        <span className="diagram-node-kind">{item.kind}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
    </article>
  );
}

function DiagramPill({ children }) {
  return <div className="diagram-pill">{children}</div>;
}

export function AgentFlowDiagram({ nodes, supportNodes }) {
  const [request, router, signer, facilitator, receipt] = nodes;
  const [registry, budget] = supportNodes;

  return (
    <div className="runtime-panel runtime-panel-diagram">
      <div className="runtime-panel-head">
        <span>agent_execution_graph</span>
        <span>policy topology</span>
      </div>

      <div className="diagram-shell">
        <div className="diagram-stage">
          <svg
            aria-hidden="true"
            className="diagram-wires"
            preserveAspectRatio="none"
            viewBox="0 0 1000 420"
          >
            <defs>
              <marker id="diagram-arrow-muted" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0 0L8 4L0 8Z" fill="rgba(255,255,255,0.18)" />
              </marker>
              <marker id="diagram-arrow-orange" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0 0L8 4L0 8Z" fill="#f97316" />
              </marker>
              <marker id="diagram-arrow-green" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0 0L8 4L0 8Z" fill="#34d399" />
              </marker>
            </defs>

            <path className="diagram-wire diagram-wire-muted" d="M300 210H360" markerEnd="url(#diagram-arrow-muted)" />
            <path
              className="diagram-wire diagram-wire-muted diagram-wire-dashed"
              d="M480 124V164"
              markerEnd="url(#diagram-arrow-muted)"
            />
            <path
              className="diagram-wire diagram-wire-muted diagram-wire-dashed"
              d="M480 352V302"
              markerEnd="url(#diagram-arrow-muted)"
            />
            <path
              className="diagram-wire diagram-wire-orange diagram-wire-dashed"
              d="M600 232C634 232 648 132 668 132"
              markerEnd="url(#diagram-arrow-orange)"
            />
            <path
              className="diagram-wire diagram-wire-green"
              d="M730 176V286"
              markerEnd="url(#diagram-arrow-green)"
            />
            <path className="diagram-wire diagram-wire-green" d="M820 340H850" markerEnd="url(#diagram-arrow-green)" />
          </svg>

          <DiagramNode className="diagram-node-request" item={request} />
          <DiagramNode className="diagram-node-router" item={router} />
          <DiagramNode className="diagram-node-signer" item={signer} />
          <DiagramNode className="diagram-node-facilitator" item={facilitator} />
          <DiagramNode className="diagram-node-receipt" item={receipt} />
          <DiagramNode className="diagram-node-registry" compact item={registry} />
          <DiagramNode className="diagram-node-budget" compact item={budget} />
        </div>

        <div className="diagram-pill-row">
          <DiagramPill>allowlisted hosts</DiagramPill>
          <DiagramPill>per-request USDC caps</DiagramPill>
          <DiagramPill>operator receipt log</DiagramPill>
        </div>
      </div>
    </div>
  );
}

function TerminalEvent({ item }) {
  return (
    <div className="terminal-event" key={item.label}>
      <div>
        <strong>{item.label}</strong>
        <p>{item.copy}</p>
      </div>
      <span className={`terminal-state terminal-state-${item.tone}`}>{item.state}</span>
    </div>
  );
}

export function TerminalPanel({ terminalEvents, terminalPhrases }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = terminalPhrases[phraseIndex % terminalPhrases.length];
    const atFullLength = display === phrase;
    const atEmpty = display.length === 0;
    const delay = deleting ? (atEmpty ? 260 : 28) : atFullLength ? 1100 : 56;

    const timeoutId = window.setTimeout(() => {
      if (!deleting && !atFullLength) {
        setDisplay(phrase.slice(0, display.length + 1));
        return;
      }

      if (!deleting && atFullLength) {
        setDeleting(true);
        return;
      }

      if (deleting && !atEmpty) {
        setDisplay(phrase.slice(0, display.length - 1));
        return;
      }

      setDeleting(false);
      setPhraseIndex((current) => (current + 1) % terminalPhrases.length);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [deleting, display, phraseIndex, terminalPhrases]);

  return (
    <div className="runtime-panel runtime-panel-terminal">
      <div className="runtime-panel-head">
        <span>sentry_terminal</span>
        <span>session output</span>
      </div>

      <div className="terminal-shell">
        <div className="terminal-shell-head">
          <div className="terminal-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>policy_trace.log</span>
          <span>stellar:testnet</span>
        </div>

        <div className="terminal-line">
          <span className="terminal-prompt">sentryx402@agent:~$</span>
          <span className="terminal-typed">{display}</span>
          <span className="terminal-caret" />
        </div>

        <div className="terminal-event-list">
          {terminalEvents.map((item) => (
            <TerminalEvent item={item} key={item.label} />
          ))}
        </div>
      </div>
    </div>
  );
}
