export default function Footer({ activeTab, network, onTabChange, paymentRailReady, tabs }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <h2>Sentryx402</h2>
          <p>
            {network || "stellar:testnet"} / x402 exact /{" "}
            {paymentRailReady ? "receipt ledger live" : "finish rail configuration"}
          </p>
          <div className="site-footer-downloads">
            <a className="site-footer-link" download href="/branding/sentryx402-logo.svg">
              Download SVG
            </a>
            <a className="site-footer-link" download href="/branding/sentryx402-logo-480.png">
              Download PNG
            </a>
          </div>
        </div>

        <div className="site-footer-links">
          {tabs.map((tab) => (
            <button
              className={`site-footer-link ${activeTab === tab.id ? "site-footer-link-active" : ""}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
