import brandMark from "../../assets/sentry-mark.svg";

export default function Navbar({ activeTab, connectLabel, onConnect, onTabChange, tabs }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="site-brand" onClick={() => onTabChange("overview")} type="button">
          <img alt="" className="brand-mark" height="18" src={brandMark} width="18" />
          <span>Sentryx402</span>
          <small>/ v1</small>
        </button>

        <nav className="site-nav" aria-label="Primary">
          {tabs.map((tab) => (
            <button
              className={`site-nav-link ${activeTab === tab.id ? "site-nav-link-active" : ""}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button className="site-connect" onClick={onConnect} type="button">
          {connectLabel}
        </button>
      </div>
    </header>
  );
}
