export const overlayMarkup = `
<style>
  :host { position:fixed; inset:0; z-index:2147483647; pointer-events:none; font:14px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#e9f0f4; color-scheme:dark; }
  * { box-sizing:border-box; }
  [hidden] { display:none !important; }
  button, textarea { font:inherit; }
  button { cursor:pointer; }
  button:disabled { cursor:not-allowed; opacity:.48; }
  button:focus-visible, textarea:focus-visible, input:focus-visible { outline:2px solid #83b7ff; outline-offset:2px; }
  svg { display:block; flex:none; }
  .icon { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  #launcher { position:absolute; right:16px; bottom:16px; display:grid; place-items:center; width:44px; height:44px; padding:0; border:1px solid #5593f6; border-radius:14px; background:#172b43; color:white; box-shadow:0 8px 26px #0009,0 0 0 4px #234e8188; pointer-events:auto; transition:transform .18s,box-shadow .18s; }
  #launcher:hover { transform:translateY(-2px); box-shadow:0 12px 30px #000a,0 0 0 4px #376db188; }
  #launcher[aria-expanded="true"] { background:#1b3858; }
  #launcher .icon { width:36px; height:36px; }
  #panel { position:absolute; right:16px; bottom:68px; display:flex; flex-direction:column; width:min(328px,calc(100vw - 24px)); max-height:min(540px,calc(100vh - 88px)); border:1px solid #3c5270; border-radius:18px; background:#121e2d; box-shadow:0 28px 80px #000a,0 2px 14px #0008; pointer-events:auto; overflow:hidden; }
  .panel-header { display:flex; align-items:center; gap:8px; padding:11px 14px; border-bottom:1px solid #293c57; background:linear-gradient(130deg,#1c3658,#172b47 50%,#172437); cursor:grab; user-select:none; touch-action:none; }
  .panel-header:active { cursor:grabbing; }
  .panel-header button { cursor:pointer; }
  .brand-mark { display:grid; place-items:center; width:29px; height:29px; border-radius:8px; background:transparent; color:white; }
  .brand-mark .icon { width:29px; height:29px; }
  .brand-name { display:block; font-size:14px; font-weight:750; letter-spacing:-.025em; line-height:1.1; }
  .brand-subtitle { display:block; margin-top:1px; color:#aebed5; font-size:10px; }
  .header-actions { display:flex; gap:4px; margin-left:auto; }
  .icon-button { display:grid; place-items:center; width:28px; height:28px; padding:0; border:1px solid transparent; border-radius:8px; background:transparent; color:#bbcee8; }
  .icon-button:hover { background:#ffffff18; border-color:#ffffff22; color:#fff; }
  .panel-body { min-height:0; overflow-y:auto; padding:12px 14px 10px; scrollbar-color:#49607d transparent; }
  .section-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; }
  .eyebrow { font-size:10px; font-weight:750; letter-spacing:.13em; color:#9daec6; }
  #target-summary { overflow:hidden; max-width:180px; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:#9ac5ff; }
  .mode-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-bottom:12px; }
  .mode { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:54px; padding:6px 4px; border:1px solid #3a506d; border-radius:11px; background:#1c2c40; color:#dbe8f9; font-size:12px; font-weight:600; transition:background .16s,border-color .16s,transform .16s; }
  .mode:hover { border-color:#6694ce; background:#263b58; transform:translateY(-1px); }
  .mode[aria-pressed="true"] { border-color:#6daaff; background:#1f3e69; color:#d0e6ff; box-shadow:inset 0 0 0 1px #6daaff33; }
  .mode .icon { width:18px; height:18px; }
  .field-label { display:block; margin-bottom:6px; font-size:10px; font-weight:750; letter-spacing:.13em; color:#9daec6; }
  textarea { display:block; width:100%; min-height:68px; padding:8px 10px; resize:vertical; border:1px solid #455c7b; border-radius:11px; background:#0c1725; color:#e9f0f4; line-height:1.5; }
  textarea::placeholder { color:#879db9; }
  .hint { margin:4px 0 8px; color:#9daec6; font-size:11px; }
  .actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .action { display:flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:6px 8px; border:1px solid #4c6180; border-radius:10px; background:#263850; color:#e1eeff; font-weight:650; font-size:12px; }
  .action:hover:not(:disabled) { background:#344b6b; }
  .action.primary { border-color:#6aabff; background:#2f80ff; color:#fff; }
  .action.primary:hover:not(:disabled) { background:#4c95ff; }
  .action .icon { width:16px; height:16px; }
  #send { width:100%; margin-top:6px; border-color:#3d5372; background:#1c2d42; color:#c6d8ee; }
  .divider { height:1px; margin:12px 0 11px; background:#30445f; }
  #progress { color:#afc5dd; font-size:10px; text-align:right; }
  .filter-row { display:flex; align-items:center; gap:7px; margin:7px 0; color:#afc3dd; font-size:11px; cursor:pointer; }
  .filter-row input { margin:0; accent-color:#2f80ff; }
  .records { display:flex; flex-direction:column; gap:6px; margin:6px 0 0; padding:0; list-style:none; }
  .records li { position:relative; display:flex; flex-wrap:wrap; gap:5px; padding:7px; border:1px solid #354c67; border-radius:10px; background:#1a2a3c; overflow-wrap:anywhere; font-size:11px; }
  .records li button { display:inline-flex; align-items:center; gap:4px; padding:4px 7px; border:1px solid #456180; border-radius:7px; background:#263a51; color:#dceaff; font-size:11px; }
  .records li button:hover { background:#35557a; }
  .records li button .icon { width:13px; height:13px; }
  .records .comment-link { flex-basis:100%; width:100%; padding:7px 34px 7px 8px; text-align:left; font-size:12px; }
  .records li .target-type { position:absolute; top:-8px; right:-8px; display:grid; place-items:center; width:23px; height:23px; border:1px solid #4d709c; border-radius:6px; background:#294669; color:#c5ddff; pointer-events:none; }
  .records li .target-type .icon { width:16px; height:16px; }
  .comment-link[aria-current="true"] { border-color:#8fbdff; background:#254975; }
  #status { display:block; min-height:30px; padding:7px 14px; border-top:1px solid #2e425d; background:#19283a; color:#afc2db; font-size:11px; }
  #tooltip { position:absolute; z-index:10; max-width:230px; padding:7px 10px; border:1px solid #6889bc; border-radius:8px; background:#273e5d; color:#f0f6ff; box-shadow:0 10px 24px #0009; font-size:11px; line-height:1.4; pointer-events:none; }
  #highlight { position:absolute; display:none; border:2px solid #6ba9ff; background:#2f80ff33; box-shadow:0 0 0 2px #102948; pointer-events:none; transition:opacity .25s; }
  .marker { position:absolute; display:grid; place-items:center; width:28px; height:28px; padding:0; border:2px solid #6ba9ff; border-radius:50%; background:#23466b; color:#eef6ff; font-size:12px; font-weight:700; pointer-events:auto; cursor:pointer; transition:background .25s,box-shadow .25s,opacity .25s; }
  .marker.resolved { opacity:.45; }
  .marker.selected { opacity:1; background:#2f80ff; outline:2px solid #d5e8ff; box-shadow:0 0 0 6px #3f8fff55; }
  #help { width:min(440px,calc(100vw - 32px)); max-height:min(660px,calc(100vh - 32px)); padding:0; border:1px solid #456080; border-radius:18px; background:#152235; color:#e9f0f4; box-shadow:0 28px 80px #000b; pointer-events:auto; overflow:auto; }
  #help::backdrop { background:#050b10bb; backdrop-filter:blur(5px); }
  .help-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid #344c6b; background:#1c3454; }
  .help-header h2 { margin:0; font-size:18px; letter-spacing:-.03em; }
  .help-body { padding:18px 20px 22px; font-size:13px; line-height:1.55; color:#c5d6eb; }
  .help-body h3 { margin:19px 0 5px; color:#f0f8f5; font-size:12px; letter-spacing:.03em; }
  .help-body h3:first-child { margin-top:0; }
  .help-body p { margin:0 0 8px; }
  .help-body kbd { padding:2px 5px; border:1px solid #536d90; border-radius:4px; background:#253c5a; color:#fff; font:11px ui-monospace,monospace; }
  @media(max-width:480px) { #launcher { right:12px; bottom:12px; } #panel { right:12px; bottom:64px; max-height:calc(100vh - 80px); } }
</style>
<svg aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden;pointer-events:none">
  <symbol id="pb-mark" viewBox="0 0 128 128"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="57" cy="59" r="38" fill="#2F80FF" stroke="none"/><circle cx="57" cy="59" r="23" stroke="#FFFFFF" stroke-width="11"/><path d="M84 28 C101 31 112 43 114 58 C116 70 112 82 103 91" stroke="#1746B3" stroke-width="10"/><path d="M83 28 L94 18 M83 28 L95 36" stroke="#1746B3" stroke-width="10"/><path d="M55 52 L88 73 L72 78 L63 96 Z" fill="#1746B3" stroke="#FFFFFF" stroke-width="6"/></g></symbol>
  <symbol id="pb-element" viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4m0 6v4a1 1 0 0 1-1 1h-4m-6 0H5a1 1 0 0 1-1-1v-4"/><path d="m10 9 6 4-3.5.5-1.2 3L10 9Z"/></symbol>
  <symbol id="pb-region" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="3 2"/><path d="M4 9V7a2 2 0 0 1 2-2h2m8 14h2a2 2 0 0 0 2-2v-2"/></symbol>
  <symbol id="pb-page" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></symbol>
  <symbol id="pb-send" viewBox="0 0 24 24"><path d="m21 3-8 18-3-7-7-3 18-8ZM10 14 21 3"/></symbol>
  <symbol id="pb-queue" viewBox="0 0 24 24"><path d="M4 7h10M4 12h8M4 17h8M18 11v8m-4-4h8"/></symbol>
  <symbol id="pb-batch" viewBox="0 0 24 24"><path d="M4 5h11M4 9h11M4 13h7m7-4 4 4-4 4m4-4H13"/></symbol>
  <symbol id="pb-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/></symbol>
  <symbol id="pb-close" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19"/></symbol>
  <symbol id="pb-edit" viewBox="0 0 24 24"><path d="m4 17 10-10 3 3L7 20H4v-3Zm11-11 2-2a2 2 0 0 1 3 3l-2 2"/></symbol>
  <symbol id="pb-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></symbol>
  <symbol id="pb-check" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></symbol>
  <symbol id="pb-reopen" viewBox="0 0 24 24"><path d="M4 11a8 8 0 1 1 2 6m-2 2v-6h6"/></symbol>
</svg>
<button id="launcher" type="button" aria-label="Open Pointback review" aria-controls="panel" aria-expanded="false" title="Open Pointback review (Cmd/Ctrl+Shift+R)"><svg class="icon" aria-hidden="true"><use href="#pb-mark"/></svg></button>
<div id="highlight"></div><div id="markers"></div><div id="tooltip" role="tooltip" hidden></div>
<section id="panel" role="region" aria-label="Pointback review" hidden>
  <header class="panel-header" tabindex="0" aria-label="Drag to move Pointback review; double-click to reset" title="Drag to move · double-click to reset">
    <span class="brand-mark"><svg class="icon" aria-hidden="true"><use href="#pb-mark"/></svg></span>
    <span><span class="brand-name">Pointback</span><span class="brand-subtitle">Review the running app</span></span>
    <span class="header-actions">
      <button id="help-button" class="icon-button" type="button" aria-label="Help with Pointback" title="How Pointback works"><svg class="icon" aria-hidden="true"><use href="#pb-help"/></svg></button>
      <button id="close-panel" class="icon-button" type="button" aria-label="Close Pointback review" title="Close review (Cmd/Ctrl+Shift+R)"><svg class="icon" aria-hidden="true"><use href="#pb-close"/></svg></button>
    </span>
  </header>
  <div class="panel-body">
    <div class="section-header"><span class="eyebrow">TARGET</span><span id="target-summary" aria-live="polite">No target selected</span></div>
    <div class="mode-grid" role="group" aria-label="Annotation type">
      <button id="element" class="mode" type="button" aria-pressed="false" title="Select a DOM element and capture its source, selector, and position"><svg class="icon" aria-hidden="true"><use href="#pb-element"/></svg>Element</button>
      <button id="region" class="mode" type="button" aria-pressed="false" title="Draw a rectangle around an area that needs changes"><svg class="icon" aria-hidden="true"><use href="#pb-region"/></svg>Region</button>
      <button id="page" class="mode" type="button" aria-pressed="false" title="Leave general feedback about the current page"><svg class="icon" aria-hidden="true"><use href="#pb-page"/></svg>Page</button>
    </div>
    <label class="field-label" for="message">YOUR FEEDBACK</label>
    <textarea id="message" placeholder="What should change?" aria-label="Review comment"></textarea>
    <p class="hint">Tip: <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd> sends immediately</p>
    <div class="actions">
      <button id="send-one" class="action primary" type="button" title="Send this comment directly to the active agent"><svg class="icon" aria-hidden="true"><use href="#pb-send"/></svg>Send comment</button>
      <button id="queue" class="action" type="button" title="Save this comment locally to send with other feedback"><svg class="icon" aria-hidden="true"><use href="#pb-queue"/></svg>Queue comment</button>
    </div>
    <button id="send" class="action" type="button" title="Send all queued comments together as one review" disabled><svg class="icon" aria-hidden="true"><use href="#pb-batch"/></svg><span id="send-label">Send queued (0)</span></button>
    <ul id="drafts" class="records" aria-label="Queued comments"></ul>
    <div class="divider"></div>
    <div class="section-header"><span class="eyebrow">REVIEW COMMENTS</span><span id="progress"></span></div>
    <label class="filter-row" title="Hide accepted comments and their page markers; keep resolved comments visible"><input id="hide-accepted" type="checkbox"> Hide accepted</label>
    <ul id="comments" class="records" aria-label="Review comments"></ul>
  </div>
  <small id="status" role="status" aria-live="polite">Select a target to leave feedback</small>
</section>
<dialog id="help" aria-labelledby="help-title">
  <div class="help-header"><h2 id="help-title">Using Pointback</h2><button id="help-close" class="icon-button" type="button" aria-label="Close help" title="Close help"><svg class="icon" aria-hidden="true"><use href="#pb-close"/></svg></button></div>
  <div class="help-body">
    <h3>Pick what you want to review</h3>
    <p><strong>Element</strong> selects a UI element and includes its DOM and source location. <strong>Region</strong> draws a rectangle for layout feedback. <strong>Page</strong> comments on the whole route.</p>
    <h3>Send feedback</h3>
    <p>Write a comment, then choose <strong>Send comment</strong> for immediate delivery. Use <strong>Queue comment</strong> and <strong>Send queued</strong> to send several comments as one review. <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd> sends the current comment.</p>
    <h3>Follow the review</h3>
    <p>Click a numbered marker to jump to its matching task in this popup and highlight the target. Click a task to scroll the page to its marker and highlight it; click again to clear it, or wait three seconds. An agent can resolve comments after fixing them. You can accept a resolution or reopen it with more feedback.</p>
    <h3>Keep things tidy</h3>
    <p>Hide accepted comments without deleting them; resolved comments stay visible so you can accept or reopen them. Delete permanently removes a resolved or accepted comment after confirmation. The review panel and drafts survive page reloads in this tab.</p>
    <h3>Move the popup</h3>
    <p>Drag the Pointback header to uncover anything beneath the menu. Double-click the header to return it to the bottom-right corner. With the header focused, use arrow keys to nudge it or <kbd>Home</kbd> to reset.</p>
    <h3>Shortcut &amp; privacy</h3>
    <p>Open or close Pointback with <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>. Screenshots exclude Pointback's UI and redact elements marked <code>data-pointback-private</code> and form inputs.</p>
  </div>
</dialog>
`;
