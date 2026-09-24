import { createRoot } from "react-dom/client";
import "./styles.css";

function PointbackIcon({ size = 36 }: { size?: number }) {
  return <img aria-hidden="true" src={`${import.meta.env.BASE_URL}pointback-icon.svg`} width={size} height={size} alt="" />;
}

function PopupIcon({ kind }: { kind: "element" | "region" | "page" | "send" | "queue" | "batch" }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind === "element" && <><path d="M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4m0 6v4a1 1 0 0 1-1 1h-4m-6 0H5a1 1 0 0 1-1-1v-4" /><path d="m10 9 6 4-3.5.5-1.2 3L10 9Z" /></>}
    {kind === "region" && <><rect x="4" y="5" width="16" height="14" rx="2" strokeDasharray="3 2" /><path d="M4 9V7a2 2 0 0 1 2-2h2m8 14h2a2 2 0 0 0 2-2v-2" /></>}
    {kind === "page" && <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>}
    {kind === "send" && <path d="m21 3-8 18-3-7-7-3 18-8ZM10 14 21 3" />}
    {kind === "queue" && <path d="M4 7h10M4 12h8M4 17h8M18 11v8m-4-4h8" />}
    {kind === "batch" && <path d="M4 5h11M4 9h11M4 13h7m7-4 4 4-4 4m4-4H13" />}
  </svg>;
}

function FeatureIcon({ kind }: { kind: "app" | "target" | "loop" }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === "app" && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>}
      {kind === "target" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>}
      {kind === "loop" && <><path d="M20 8a8 8 0 0 0-13-3L4 8m0-4v4h4M4 16a8 8 0 0 0 13 3l3-3m0 4v-4h-4" /></>}
    </svg>
  );
}

const benefits = [
  { icon: "app" as const, title: "Review the real app", text: "See routing, authentication, live data, and responsive behavior exactly as they run in development. No separate preview to maintain." },
  { icon: "target" as const, title: "Point with precision", text: "Select an element, draw a region, or comment on the page. Each note carries the route, DOM context, source location, and a screenshot." },
  { icon: "loop" as const, title: "Keep the loop moving", text: "Send feedback directly to your coding agent. Watch the fix arrive through HMR, then accept it or reopen the comment." },
];

const useCases = [
  { number: "01", title: "UI polish", text: "Call out spacing, hierarchy, colors, and alignment on the exact element that needs attention." },
  { number: "02", title: "Responsive layouts", text: "Mark overflow, wrapping, or awkward composition at the viewport where it actually happens." },
  { number: "03", title: "Real product flows", text: "Review pages that depend on your backend, session state, navigation, and live interactions." },
];

function openReview() {
  if (import.meta.env.PROD) { window.location.href = "https://github.com/tw1nk/pointback#quick-start"; return; }
  const launcher = document.querySelector("pointback-overlay")?.shadowRoot?.querySelector<HTMLButtonElement>("#launcher");
  if (launcher) launcher.click();
  else document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
}

function App() {
  return (
    <div className="site-shell" data-component="PointbackLanding">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Pointback home"><PointbackIcon size={32} /><span>Pointback</span></a>
        <nav aria-label="Main navigation"><a href="#why-pointback">Why Pointback</a><a href="#use-cases">Use cases</a><a href="#how-it-works">How it works</a></nav>
        <span className="local-badge" title="Pointback runs on your machine; no Pointback cloud"><span aria-hidden="true" /> Local only</span>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> LIVE UI REVIEW FOR CODING AGENTS</span>
            <h1 id="hero-title" data-pointback-id="hero-title">Pointback</h1>
            <p className="hero-lede">Point at it. <span>Send it back.</span></p>
            <p className="hero-description">Leave precise feedback inside your running app and send it straight to the agent building it. No screenshots to explain, no context lost in chat.</p>
            <div className="hero-actions">
              <button type="button" className="primary-cta" onClick={openReview}>{import.meta.env.PROD ? "Get started" : "Open review mode"} <span aria-hidden="true">↗</span></button>
              <a className="secondary-cta" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-footnote"><span aria-hidden="true">✦</span> See updates through the HMR you already use.</p>
          </div>

          <figure className="review-preview" aria-label="Preview of the Pointback review popup">
            <div className="preview-panel">
              <div className="popup-header"><PointbackIcon size={29} /><span className="popup-brand"><strong>Pointback</strong><small>Review the running app</small></span><span className="popup-header-actions" aria-hidden="true"><span>?</span><span>×</span></span></div>
              <div className="popup-body">
                <div className="popup-section-heading"><span>TARGET</span><small>No target selected</small></div>
                <div className="popup-modes"><span><PopupIcon kind="element" />Element</span><span><PopupIcon kind="region" />Region</span><span><PopupIcon kind="page" />Page</span></div>
                <label className="popup-label" htmlFor="preview-feedback">YOUR FEEDBACK</label>
                <textarea id="preview-feedback" aria-label="Example feedback in the Pointback popup" readOnly value="lol? what is this. just use the same layout as this popup I'm writing with. Prefill with this exact text" />
                <p className="popup-hint">Tip: <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd> sends immediately</p>
                <div className="popup-actions"><span className="popup-primary"><PopupIcon kind="send" />Send comment</span><span><PopupIcon kind="queue" />Queue comment</span></div>
                <div className="popup-queued"><PopupIcon kind="batch" />Send queued (0)</div>
                <div className="popup-divider" />
                <div className="popup-section-heading"><span>REVIEW COMMENTS</span><small>0 open</small></div>
                <p className="popup-filter"><span className="popup-checkbox" />Hide accepted</p>
              </div>
              <div className="popup-status">Select a target to leave feedback</div>
            </div>
          </figure>
        </section>

        <section id="why-pointback" className="content-section benefits" aria-labelledby="why-title">
          <div className="section-intro"><span className="section-kicker">WHY POINTBACK</span><h2 id="why-title">Feedback with context,<br /><em>not guesswork.</em></h2><p>A faster way to turn “this doesn’t feel right” into a change your agent can actually make.</p></div>
          <div className="benefit-grid">{benefits.map((benefit) => <article className="benefit-card" key={benefit.title}><div className="feature-icon"><FeatureIcon kind={benefit.icon} /></div><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div>
        </section>

        <section id="use-cases" className="content-section use-cases" aria-labelledby="cases-title"><div className="section-intro"><span className="section-kicker">BUILT FOR THE DETAILS</span><h2 id="cases-title">Review what you can see.<br /><em>Fix what matters.</em></h2></div><div className="use-case-list">{useCases.map((item) => <article className="use-case" key={item.number}><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><span aria-hidden="true">↗</span></article>)}</div></section>

        <section id="how-it-works" className="content-section workflow" aria-labelledby="workflow-title"><span className="section-kicker">THE LOOP</span><h2 id="workflow-title">From feedback to fix,<br /><em>without breaking flow.</em></h2><div className="workflow-steps"><div><span>01 / BUILD</span><h3>Agent changes code</h3><p>Your app updates through its existing HMR setup.</p></div><div><span>02 / REVIEW</span><h3>You point at the UI</h3><p>Comment on an element, region, or page.</p></div><div><span>03 / REFINE</span><h3>Feedback reaches the agent</h3><p>See the fix live, then accept or reopen.</p></div></div></section>
      </main>

      <footer className="site-footer"><span className="footer-brand"><PointbackIcon size={24} /> Pointback</span><span>Runs on your machine. No Pointback cloud.</span><code>Point at it. Send it back.</code></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
