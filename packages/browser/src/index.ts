import type { ReviewTarget } from "@pointback/protocol";
import { toCanvas } from "html-to-image";
import { overlayMarkup } from "./ui.js";

const makeIcon = (name: string): SVGSVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#pb-${name}`);
  svg.append(use);
  return svg;
};
const labelButton = (button: HTMLButtonElement, icon: string, label: string, tooltip: string) => {
  button.replaceChildren(makeIcon(icon), document.createTextNode(label));
  button.title = tooltip;
};

declare global { interface Window { __POINTBACK__?: { project: string; token: string; port: number; git?: { branch: string; commit: string; dirty: boolean } } } }
type Draft = { url: string; message: string; target: ReviewTarget; viewport: { width: number; height: number } };
const rect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
function selector(el: Element): string {
  for (const key of ["data-pointback-id", "data-testid", "id"]) {
    const value = key === "id" ? el.id : el.getAttribute(key);
    if (value) return key === "id" ? `#${CSS.escape(value)}` : `[${key}="${CSS.escape(value)}"]`;
  }
  const role = el.getAttribute("role") ?? (el.matches("button") ? "button" : el.matches("a[href]") ? "link" : null);
  const label = el.getAttribute("aria-label");
  if (role && label) {
    const candidate = `[role="${CSS.escape(role)}"][aria-label="${CSS.escape(label)}"]`;
    if (document.querySelectorAll(candidate).length === 1) return candidate;
  }
  if (role && el.textContent?.trim()) {
    const candidate = el.tagName.toLowerCase() + (el.hasAttribute("role") ? `[role="${CSS.escape(role)}"]` : "");
    if (document.querySelectorAll(candidate).length === 1) return candidate;
  }
  const parts: string[] = [];
  for (let node: Element | null = el; node && parts.length < 5; node = node.parentElement) {
    const siblings = node.parentElement ? [...node.parentElement.children].filter((child) => child.tagName === node!.tagName) : [];
    parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ""));
  }
  return parts.join(" > ");
}
function cleanFragment(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  const originals = [el, ...el.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  copies.forEach((node, index) => {
    const original = originals[index];
    if (node.matches("[data-pointback-private],input,textarea,select,[contenteditable],script,style") || getComputedStyle(original).display === "none" || getComputedStyle(original).visibility === "hidden") {
      node.replaceWith(document.createTextNode("[REDACTED]"));
      return;
    }
    for (const attr of [...node.attributes]) if (!/^(id|class|role|aria-label|data-pointback-id|data-pointback-source|data-pointback-component|data-component)$/.test(attr.name)) node.removeAttribute(attr.name);
  });
  return clone.outerHTML.slice(0, 8192);
}
function elementTarget(el: Element): ReviewTarget {
  return {
    type: "element", rect: rect(el.getBoundingClientRect()), scroll: { x: scrollX, y: scrollY },
    element: {
      source: (() => {
        const value = el.getAttribute("data-pointback-source");
        const match = value && /^(.*):(\d+):(\d+)$/.exec(value);
        return match ? { file: decodeURI(match[1]), line: Number(match[2]), column: Number(match[3]), component: el.getAttribute("data-pointback-component") ?? undefined } : undefined;
      })(),
      tag: el.tagName.toLowerCase(), text: el.closest("[data-pointback-private]") ? "[REDACTED]" : new DOMParser().parseFromString(cleanFragment(el), "text/html").body.textContent?.trim().slice(0, 300) ?? "",
      role: el.getAttribute("role"), ariaLabel: el.getAttribute("aria-label"), selector: selector(el),
      ancestors: [...(function* () { for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) yield node; })()].slice(0, 5).map((node) => ({ tag: node.tagName.toLowerCase(), ...(node.id ? { id: node.id } : {}), ...(node.getAttribute("data-component") ? { dataComponent: node.getAttribute("data-component")! } : {}) })),
      html: el.closest("[data-pointback-private]") ? "[REDACTED]" : cleanFragment(el),
    },
  };
}
function start() {
  if (document.querySelector("pointback-overlay") || !window.__POINTBACK__) return;
  const settings = window.__POINTBACK__;
  const storageKey = `pointback:${settings.project}:review-ui`;
  const saved = (() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      return value && typeof value === "object" ? value as {
        open?: boolean; route?: string; mode?: string; target?: ReviewTarget; drafts?: Draft[]; pending?: Draft[][]; text?: string; editing?: number | null; hideAccepted?: boolean; selectedCommentId?: string | null; panelPosition?: { x: number; y: number } | null;
      } : null;
    } catch { return null; }
  })();
  const host = document.createElement("pointback-overlay");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = overlayMarkup;
  document.body.append(host);
  const panel = shadow.querySelector<HTMLElement>("#panel")!;
  const launcher = shadow.querySelector<HTMLButtonElement>("#launcher")!;
  const panelHeader = shadow.querySelector<HTMLElement>(".panel-header")!;
  let panelPosition = saved?.panelPosition && Number.isFinite(saved.panelPosition.x) && Number.isFinite(saved.panelPosition.y) ? saved.panelPosition : null;
  const placePanel = () => {
    if (!panelPosition) return;
    const width = panel.offsetWidth || Math.min(328, innerWidth - 24);
    const height = panel.offsetHeight || Math.min(540, innerHeight - 88);
    panelPosition = {
      x: Math.max(8, Math.min(panelPosition.x, Math.max(8, innerWidth - width - 8))),
      y: Math.max(8, Math.min(panelPosition.y, Math.max(8, innerHeight - height - 8))),
    };
    Object.assign(panel.style, { left: `${panelPosition.x}px`, top: `${panelPosition.y}px`, right: "auto", bottom: "auto" });
  };
  const resetPanel = () => {
    panelPosition = null;
    for (const property of ["left", "top", "right", "bottom"] as const) panel.style[property] = "";
    persist();
  };
  const highlight = shadow.querySelector<HTMLElement>("#highlight")!;
  const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
  const status = shadow.querySelector<HTMLElement>("#status")!;
  const tooltip = shadow.querySelector<HTMLElement>("#tooltip")!;
  let tooltipButton: HTMLButtonElement | null = null;
  const hideTooltip = () => { tooltip.hidden = true; tooltipButton = null; };
  const showTooltip = (event: Event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[title]") : null;
    if (!button || button.disabled || !button.title) return;
    tooltipButton = button;
    tooltip.textContent = button.title;
    tooltip.hidden = false;
    const r = button.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, r.left + r.width / 2 - tooltip.offsetWidth / 2))}px`;
    tooltip.style.top = `${r.top > tooltip.offsetHeight + 12 ? r.top - tooltip.offsetHeight - 7 : r.bottom + 7}px`;
  };
  shadow.addEventListener("pointerover", showTooltip);
  shadow.addEventListener("focusin", showTooltip);
  shadow.addEventListener("pointerout", (event) => {
    const next = (event as PointerEvent).relatedTarget;
    if (!tooltipButton || (next instanceof Node && tooltipButton.contains(next))) return;
    hideTooltip();
  });
  shadow.addEventListener("focusout", (event) => {
    const next = (event as FocusEvent).relatedTarget;
    if (!tooltipButton || (next instanceof Node && tooltipButton.contains(next))) return;
    hideTooltip();
  });
  panel.hidden = saved?.open !== true;
  if (!panel.hidden) placePanel();
  launcher.setAttribute("aria-expanded", String(!panel.hidden));
  launcher.setAttribute("aria-label", panel.hidden ? "Open Pointback review" : "Close Pointback review");
  const drafts: Draft[] = Array.isArray(saved?.drafts) ? saved.drafts.filter((draft) => draft && typeof draft.message === "string" && typeof draft.url === "string" && draft.target && draft.viewport).slice(0, 50) : [];
  const pending: Draft[][] = Array.isArray(saved?.pending) ? saved.pending.filter((batch) => Array.isArray(batch) && batch.every((draft) => draft && typeof draft.message === "string" && typeof draft.url === "string" && draft.target && draft.viewport)) : [];
  let editing: number | null = typeof saved?.editing === "number" && saved.editing >= 0 && saved.editing < drafts.length ? saved.editing : null;
  let busy = false;
  let hideAccepted = saved?.hideAccepted === true;
  let selectedCommentId = typeof saved?.selectedCommentId === "string" ? saved.selectedCommentId : null;
  const hideAcceptedInput = shadow.querySelector<HTMLInputElement>("#hide-accepted")!;
  hideAcceptedInput.checked = hideAccepted;
  const renderDrafts = () => {
    const list = shadow.querySelector("#drafts")!;
    list.replaceChildren();
    drafts.forEach((draft, index) => {
      const item = document.createElement("li");
      item.textContent = `${draft.target.type}: ${draft.message.slice(0, 60)} `;
      const edit = document.createElement("button"); labelButton(edit, "edit", "Edit", "Edit this queued comment before sending");
      edit.addEventListener("click", () => { editing = index; textarea.value = draft.message; target = draft.target; renderTarget(); status.textContent = "Editing draft"; persist(); });
      const remove = document.createElement("button"); labelButton(remove, "trash", "Remove", "Remove this unsent comment from the queue");
      remove.addEventListener("click", () => { drafts.splice(index, 1); if (editing === index) editing = null; else if (editing !== null && editing > index) editing--; renderDrafts(); persist(); });
      item.append(edit, remove); list.append(item);
    });
    const sendQueued = shadow.querySelector<HTMLButtonElement>("#send")!;
    sendQueued.querySelector("#send-label")!.textContent = `Send queued (${drafts.length})`;
    sendQueued.disabled = !drafts.length || busy;
  };
  let mode: "element" | "region" | "page" | null = saved?.mode === "element" || saved?.mode === "region" || saved?.mode === "page" ? saved.mode : null;
  let target: ReviewTarget | null = saved?.route === location.pathname && saved.target && ["element", "region", "page"].includes(saved.target.type) ? saved.target : null;
  textarea.value = typeof saved?.text === "string" ? saved.text : "";
  const persist = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ open: !panel.hidden, route: location.pathname, mode, target, drafts, pending, text: textarea.value, editing, hideAccepted, selectedCommentId, panelPosition })); }
    catch { /* Storage can be unavailable or full; review remains usable in memory. */ }
  };
  textarea.addEventListener("input", persist);
  let drag: { x: number; y: number } | null = null;
  const paint = (r?: { x: number; y: number; width: number; height: number }) => {
    highlight.style.display = r ? "block" : "none";
    if (r) Object.assign(highlight.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px`, opacity: "1" });
  };
  const renderTarget = () => {
    const summary = shadow.querySelector("#target-summary")!;
    summary.textContent = target?.type === "element" ? `${target.element.tag} · ${target.element.text.slice(0, 24) || target.element.selector}`
      : target?.type === "region" ? `Region · ${Math.round(target.rect.width)} × ${Math.round(target.rect.height)}`
      : target?.type === "page" ? `Page · ${location.pathname}`
      : mode ? `${mode === "element" ? "Click an element" : "Draw a region"}` : "No target selected";
    for (const key of ["element", "region", "page"] as const) shadow.querySelector(`#${key}`)!.setAttribute("aria-pressed", String(mode === key));
  };
  const setMode = (next: typeof mode) => { if (selectedCommentId) clearSelection(false); mode = next; target = next === "page" ? { type: "page" } : null; paint(); renderTarget(); status.textContent = next === "page" ? "Page selected" : `Click or drag to select ${next}`; persist(); };
  renderTarget();
  shadow.querySelector("#element")!.addEventListener("click", () => setMode("element"));
  shadow.querySelector("#region")!.addEventListener("click", () => setMode("region"));
  shadow.querySelector("#page")!.addEventListener("click", () => setMode("page"));
  const toggle = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) placePanel();
    launcher.setAttribute("aria-expanded", String(!panel.hidden));
    launcher.setAttribute("aria-label", panel.hidden ? "Open Pointback review" : "Close Pointback review");
    renderMarkers();
    if (panel.hidden) setMode(null);
    persist();
  };
  launcher.addEventListener("click", toggle);
  let dragging: { pointerId: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null = null;
  panelHeader.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const r = panel.getBoundingClientRect();
    dragging = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: r.x, y: r.y, moved: false };
    panelHeader.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  panelHeader.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragging.startX, dy = event.clientY - dragging.startY;
    if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    dragging.moved = true;
    panelPosition = { x: dragging.x + dx, y: dragging.y + dy };
    placePanel();
  });
  const endDrag = (event: PointerEvent) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    if (panelHeader.hasPointerCapture(event.pointerId)) panelHeader.releasePointerCapture(event.pointerId);
    if (dragging.moved) persist();
    dragging = null;
  };
  panelHeader.addEventListener("pointerup", endDrag);
  panelHeader.addEventListener("pointercancel", endDrag);
  panelHeader.addEventListener("dblclick", (event) => { if (!(event.target instanceof Element && event.target.closest("button"))) resetPanel(); });
  panelHeader.addEventListener("keydown", (event) => {
    if (event.key === "Home") { event.preventDefault(); resetPanel(); return; }
    const delta: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (!delta[event.key]) return;
    event.preventDefault();
    const r = panel.getBoundingClientRect();
    panelPosition = { x: r.x + delta[event.key][0], y: r.y + delta[event.key][1] };
    placePanel(); persist();
  });
  shadow.querySelector("#close-panel")!.addEventListener("click", toggle);
  const help = shadow.querySelector<HTMLDialogElement>("#help")!;
  shadow.querySelector("#help-button")!.addEventListener("click", () => { hideTooltip(); help.showModal(); });
  shadow.querySelector("#help-close")!.addEventListener("click", () => help.close());
  help.addEventListener("click", (event) => {
    const r = help.getBoundingClientRect();
    if (event.target === help && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) help.close();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "r") {
      event.preventDefault(); toggle();
    }
  });
  document.addEventListener("pointermove", (event) => {
    if (panel.hidden || host.contains(event.target as Node)) return;
    if (mode === "region" && drag) paint({ x: Math.min(drag.x, event.clientX), y: Math.min(drag.y, event.clientY), width: Math.abs(drag.x - event.clientX), height: Math.abs(drag.y - event.clientY) });
    if (mode === "element") paint(rect((event.target as Element).getBoundingClientRect()));
  }, true);
  document.addEventListener("pointerdown", (event) => { if (mode === "region" && !panel.hidden && !host.contains(event.target as Node)) { drag = { x: event.clientX, y: event.clientY }; event.preventDefault(); } }, true);
  document.addEventListener("pointerup", (event) => {
    if (!drag) return;
    const r = { x: Math.min(drag.x, event.clientX), y: Math.min(drag.y, event.clientY), width: Math.abs(drag.x - event.clientX), height: Math.abs(drag.y - event.clientY) };
    drag = null; if (r.width > 4 && r.height > 4) { target = { type: "region", rect: r, scroll: { x: scrollX, y: scrollY } }; paint(r); status.textContent = "Region selected"; mode = null; renderTarget(); persist(); }
  }, true);
  document.addEventListener("click", (event) => {
    if (mode !== "element" || panel.hidden || host.contains(event.target as Node)) return;
    event.preventDefault(); event.stopPropagation(); target = elementTarget(event.target as Element); if (target.type === "element") paint(target.rect); mode = null; renderTarget(); status.textContent = "Element selected"; persist();
  }, true);
  const currentDraft = (): Draft | null => {
    if (!target || !textarea.value.trim()) { status.textContent = "Select a target and write a comment"; return null; }
    return { url: location.href, message: textarea.value.trim(), target, viewport: { width: innerWidth, height: innerHeight } };
  };
  const clearEditor = () => { editing = null; textarea.value = ""; target = null; paint(); renderTarget(); };
  shadow.querySelector("#queue")!.addEventListener("click", () => {
    if (busy) return;
    const draft = currentDraft(); if (!draft) return;
    if (editing === null) drafts.push(draft); else drafts[editing] = draft;
    clearEditor(); status.textContent = `${drafts.length} queued comment(s)`;
    renderDrafts(); persist();
  });
  const request = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${settings.port}${path}`, { method, headers: { "content-type": "application/json", "x-pointback-project": settings.project, "x-pointback-token": settings.token }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error((await response.json()).error ?? `HTTP ${response.status}`);
    return response.json();
  };
  type DisplayComment = { id: string; message: string; status: string; target: ReviewTarget };
  let knownComments: DisplayComment[] = [];
  const initialScroll = { x: scrollX, y: scrollY };
  const lastKnownDocRects = new Map<string, { x: number; y: number; width: number; height: number }>();
  const completed = (comment: DisplayComment) => comment.status === "resolved" || comment.status === "accepted";
  const locate = (comment: DisplayComment) => {
    if (comment.target.type === "page") return null;
    if (comment.target.type === "element") {
      try {
        const current = document.querySelector(comment.target.element.selector);
        if (current && current.tagName.toLowerCase() === comment.target.element.tag) {
          const currentRect = rect(current.getBoundingClientRect());
          lastKnownDocRects.set(comment.id, { ...currentRect, x: currentRect.x + scrollX, y: currentRect.y + scrollY });
          return currentRect;
        }
      } catch { /* Fall back to the element's last known document position. */ }
    }
    const anchor = lastKnownDocRects.get(comment.id) ?? {
      ...comment.target.rect,
      x: comment.target.rect.x + (comment.target.scroll?.x ?? initialScroll.x),
      y: comment.target.rect.y + (comment.target.scroll?.y ?? initialScroll.y),
    };
    return { ...anchor, x: anchor.x - scrollX, y: anchor.y - scrollY };
  };
  let highlightTimer: number | undefined;
  let fadeTimer: number | undefined;
  let restoringSelection = selectedCommentId !== null;
  const cancelHighlightTimers = () => {
    window.clearTimeout(highlightTimer);
    window.clearTimeout(fadeTimer);
    highlightTimer = undefined; fadeTimer = undefined;
  };
  const clearSelection = (animate = true) => {
    cancelHighlightTimers();
    selectedCommentId = null;
    highlight.style.opacity = "0";
    shadow.querySelectorAll(".marker.selected").forEach((marker) => marker.classList.remove("selected"));
    shadow.querySelectorAll(".comment-link").forEach((button) => button.setAttribute("aria-current", "false"));
    if (animate) fadeTimer = window.setTimeout(() => { if (!selectedCommentId) paint(); fadeTimer = undefined; }, 250);
    else paint();
    persist();
  };
  const scheduleHighlightFade = (commentId: string) => {
    cancelHighlightTimers();
    highlightTimer = window.setTimeout(() => {
      if (selectedCommentId === commentId) clearSelection();
    }, 3000);
  };
  const selectComment = (comment: DisplayComment) => {
    restoringSelection = false;
    if (selectedCommentId === comment.id) { clearSelection(); return; }
    cancelHighlightTimers();
    selectedCommentId = comment.id;
    const r = locate(comment);
    if (r && (r.x < 0 || r.y < 0 || r.x + 28 > innerWidth || r.y + 28 > innerHeight)) {
      window.scrollTo({
        left: scrollX + r.x - innerWidth * 0.35,
        top: scrollY + r.y - innerHeight * 0.35,
        behavior: "smooth",
      });
    }
    paint(r ?? undefined);
    status.textContent = comment.message;
    renderMarkers();
    shadow.querySelectorAll(".comment-link").forEach((button) => button.setAttribute("aria-current", String(button.getAttribute("data-comment-id") === comment.id)));
    scheduleHighlightFade(comment.id);
    persist();
  };
  const renderMarkers = () => {
    const container = shadow.querySelector<HTMLElement>("#markers")!;
    container.hidden = panel.hidden;
    container.replaceChildren();
    let pageMarkerIndex = 0;
    knownComments.forEach((comment, index) => {
      if (hideAccepted && comment.status === "accepted") return;
      const r = comment.target.type === "page"
        ? { x: innerWidth - 52, y: 16 + pageMarkerIndex++ * 34, width: 0, height: 0 }
        : locate(comment);
      if (!r) return;
      const marker = document.createElement("button");
      marker.className = `marker ${completed(comment) ? "resolved" : ""} ${selectedCommentId === comment.id ? "selected" : ""}`;
      marker.textContent = String(index + 1);
      marker.title = comment.message;
      marker.setAttribute("aria-label", `Show comment ${index + 1}: ${comment.message}`);
      marker.setAttribute("data-comment-id", comment.id);
      marker.style.left = `${r.x}px`; marker.style.top = `${r.y}px`;
      marker.addEventListener("click", () => {
        panel.hidden = false;
        placePanel();
        launcher.setAttribute("aria-expanded", "true");
        launcher.setAttribute("aria-label", "Close Pointback review");
        selectComment(comment);
        const row = [...shadow.querySelectorAll<HTMLElement>("#comments li")]
          .find((item) => item.querySelector(".comment-link")?.getAttribute("data-comment-id") === comment.id);
        if (row) {
          const body = shadow.querySelector<HTMLElement>(".panel-body")!;
          const area = body.getBoundingClientRect();
          const task = row.getBoundingClientRect();
          body.scrollTo({ top: body.scrollTop + task.top - area.top - Math.max(8, (area.height - task.height) / 2), behavior: "smooth" });
        }
      });
      container.append(marker);
    });
  };
  renderDrafts();
  renderMarkers();
  if (target && target.type !== "page") paint(target.rect);
  const syncMarkerPositions = () => {
    renderMarkers();
    if (selectedCommentId) {
      const selected = knownComments.find((comment) => comment.id === selectedCommentId);
      if (selected) paint(locate(selected) ?? undefined);
    }
  };
  document.addEventListener("scroll", syncMarkerPositions, true);
  window.addEventListener("resize", () => { placePanel(); syncMarkerPositions(); });
  async function refreshComments() {
    const list = shadow.querySelector("#comments")!;
    const comments = await request("/comments", "GET") as DisplayComment[];
    knownComments = comments;
    placePanel();
    if (selectedCommentId && !comments.some((comment) => comment.id === selectedCommentId && (!hideAccepted || comment.status !== "accepted"))) clearSelection();
    if (restoringSelection && selectedCommentId) {
      const selected = comments.find((comment) => comment.id === selectedCommentId);
      if (selected) { paint(locate(selected) ?? undefined); scheduleHighlightFade(selected.id); }
      restoringSelection = false;
    }
    renderMarkers();
    const open = comments.filter((c) => c.status === "open").length;
    const addressing = comments.filter((c) => c.status === "acknowledged").length;
    const done = comments.filter((c) => c.status === "resolved" || c.status === "accepted").length;
    shadow.querySelector("#progress")!.textContent = `${done} resolved · ${addressing} addressing · ${open} open`;
    list.replaceChildren();
    for (const [index, comment] of comments.entries()) {
      if (hideAccepted && comment.status === "accepted") continue;
      const item = document.createElement("li");
      item.style.opacity = completed(comment) ? "0.5" : "1";
      const link = document.createElement("button");
      link.className = "comment-link";
      link.setAttribute("data-comment-id", comment.id);
      link.setAttribute("aria-current", String(selectedCommentId === comment.id));
      const targetType = document.createElement("span");
      targetType.className = "target-type";
      targetType.setAttribute("role", "img");
      targetType.setAttribute("aria-label", `${comment.target.type} target`);
      targetType.title = `${comment.target.type} target`;
      targetType.append(makeIcon(comment.target.type));
      const commentText = document.createElement("span");
      commentText.className = "comment-text";
      commentText.textContent = `${index + 1}. ${comment.status}: ${comment.message}`;
      link.append(commentText);
      link.title = "Highlight this comment's marker; click again to dismiss";
      link.addEventListener("click", () => selectComment(comment));
      item.append(targetType, link);
      if (comment.status === "resolved") {
        const accept = document.createElement("button"); labelButton(accept, "check", "Accept", "Confirm the agent's fix looks correct");
        accept.addEventListener("click", async () => { await request(`/comments/${comment.id}/accept`, "POST"); await refreshComments(); });
        item.append(accept);
      }
      if (completed(comment)) {
        const remove = document.createElement("button"); labelButton(remove, "trash", "Delete", "Permanently delete this completed comment");
        remove.setAttribute("aria-label", `Delete completed comment: ${comment.message}`);
        remove.addEventListener("click", async () => {
          if (!window.confirm("Permanently delete this completed comment?")) return;
          try { await request(`/comments/${comment.id}`, "DELETE"); await refreshComments(); status.textContent = "Comment deleted"; }
          catch (error) { status.textContent = `Delete failed: ${error instanceof Error ? error.message : error}`; }
        });
        item.append(remove);
      }
      if (comment.status !== "accepted") {
        const reopen = document.createElement("button"); labelButton(reopen, "reopen", "Reopen", "Send follow-up feedback to the agent");
        reopen.addEventListener("click", async () => {
          const message = window.prompt("What still needs to change?");
          if (!message?.trim()) return;
          await request(`/comments/${comment.id}/reopen`, "POST", { message: message.trim() }); await refreshComments();
        });
        item.append(reopen);
      }
      list.append(item);
    }
  }
  hideAcceptedInput.addEventListener("change", () => {
    hideAccepted = hideAcceptedInput.checked;
    persist();
    void refreshComments().catch((error) => { status.textContent = `Could not load comments: ${error instanceof Error ? error.message : error}`; });
  });
  void refreshComments().catch(() => { /* Daemon may not be running yet. */ });
  void request("/agents", "GET").then((agents: unknown) => { if (Array.isArray(agents) && agents.length) status.textContent = "Pi agent connected"; }).catch(() => {});
  let retry: number;
  let flushPending = () => {};
  const connect = () => {
    const socket = new WebSocket(`ws://127.0.0.1:${settings.port}/events?project=${settings.project}&token=${settings.token}`);
    socket.addEventListener("open", () => { void refreshComments().catch(() => {}); flushPending(); });
    socket.addEventListener("message", (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type.startsWith("comment.") || event.type === "review.submitted") void refreshComments().catch(() => {});
        if (event.type === "review.requested") {
          panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); launcher.setAttribute("aria-label", "Close Pointback review"); renderMarkers(); persist();
          status.textContent = "Agent requested a Pointback Review";
        } else if (event.type === "agent.connected") status.textContent = "Pi agent connected";
        else if (event.type === "agent.disconnected") status.textContent = "Agent disconnected; MCP polling is still available";
        else if (event.type === "comment.acknowledged") status.textContent = "✓ Agent received review";
        else if (event.type === "comment.resolved") status.textContent = "Agent resolved a comment; verify the live UI";
      } catch { /* Ignore malformed events. */ }
    });
    socket.addEventListener("close", () => { retry = window.setTimeout(connect, 2000); });
  };
  connect();
  window.addEventListener("beforeunload", () => clearTimeout(retry));
  async function screenshot(): Promise<string> {
    const rootBackground = getComputedStyle(document.documentElement).backgroundColor;
    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    const backgroundColor = [rootBackground, bodyBackground].find((color) => color !== "rgba(0, 0, 0, 0)" && color !== "transparent") ?? "#fff";
    const canvas = await toCanvas(document.documentElement, {
      width: innerWidth, height: innerHeight, pixelRatio: 1, backgroundColor,
      filter: (node) => {
        if (!(node instanceof Element)) return true;
        if (node.matches("pointback-overlay,[data-pointback-private],input,textarea,select,[contenteditable],script,style")) return false;
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden";
      },
    });
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#000";
    document.querySelectorAll("[data-pointback-private]").forEach((node) => {
      const r = node.getBoundingClientRect(); context.fillRect(r.x, r.y, r.width, r.height);
    });
    const data = canvas.toDataURL("image/png");
    return data.substring(data.indexOf(",") + 1);
  }
  const sendOne = shadow.querySelector<HTMLButtonElement>("#send-one")!;
  const queue = shadow.querySelector<HTMLButtonElement>("#queue")!;
  const sendQueued = shadow.querySelector<HTMLButtonElement>("#send")!;
  const submit = async (comments: Draft[], onSuccess: () => void, fromPending = false) => {
    if (busy || !comments.length) return false;
    busy = true; sendOne.disabled = true; queue.disabled = true; sendQueued.disabled = true;
    status.textContent = "Sending review…";
    try {
      const sessions = await request("/sessions", "GET");
      const session = sessions.find((s: { status: string }) => s.status === "active") ?? await request("/sessions", "POST", { git: settings.git });
      let screenshotId: string | undefined;
      try {
        const image = await screenshot();
        ({ id: screenshotId } = await request(`/sessions/${session.id}/screenshots`, "POST", { image }));
      } catch (error) {
        console.warn("Pointback: screenshot unavailable; sending comments without it", error);
      }
      await request(`/sessions/${session.id}/submit`, "POST", comments.map((comment) => ({ ...comment, ...(screenshotId ? { screenshotId } : {}) })));
      onSuccess(); persist();
      await refreshComments().catch(() => {});
      status.textContent = `${comments.length} comment(s) sent; waiting for agent receipt (MCP fallback available)`;
      return true;
    } catch (error) {
      if (!fromPending && error instanceof TypeError) {
        pending.push(comments);
        onSuccess(); persist();
        status.textContent = `${comments.length} comment(s) queued; will send when Pointback reconnects`;
      } else status.textContent = `Not sent: ${error instanceof Error ? error.message : String(error)}`;
    }
    finally { busy = false; sendOne.disabled = false; queue.disabled = false; renderDrafts(); }
    return false;
  };
  flushPending = () => {
    if (busy || !pending.length) return;
    const batch = pending[0];
    void submit(batch, () => { pending.shift(); }, true).then((sent) => {
      if (sent && pending.length) flushPending();
    });
  };
  sendOne.addEventListener("click", () => {
    const draft = currentDraft(); if (!draft) return;
    const editingIndex = editing;
    void submit([draft], () => { if (editingIndex !== null) drafts.splice(editingIndex, 1); clearEditor(); });
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); sendOne.click(); }
  });
  sendQueued.addEventListener("click", () => {
    if (!drafts.length) return;
    void submit([...drafts], () => { drafts.length = 0; clearEditor(); });
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
