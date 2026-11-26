// Requests box: lets a player write down what they would like added or changed.
// Inside a Claude artifact the request is saved to the artifact's shared store (when this viewer is allowed to write);
// everywhere else, and whenever saving is not possible, the text can be copied or posted as a GitHub issue.
import { $ } from './state.js';

const ISSUES = "https://github.com/oin72/fractal-terrain-lab/issues/new";
const el = (tag, props = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e };

export function bindRequests() {
  const btn = $("rq"); if (!btn) return;
  const ta = el("textarea", { id: "rqt", maxLength: 2000, placeholder: "What would you like added or changed?" }), msg = el("p", { id: "rqm" });
  const send = el("button", { id: "rqs", textContent: "Send" }), copy = el("button", { id: "rqc", textContent: "Copy" }), close = el("button", { id: "rqx", textContent: "Close" });
  const link = el("a", { href: ISSUES, target: "_blank", rel: "noopener", textContent: "Post it on GitHub instead" });
  const panel = el("div", { id: "rqp", hidden: true }, [el("b", { textContent: "Requests" }), ta, el("div", { className: "rqr" }, [send, copy, close]), msg, link]);
  $("w").append(panel);
  const say = t => msg.textContent = t;
  btn.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) ta.focus() };
  close.onclick = () => panel.hidden = true;
  copy.onclick = async () => { try { await navigator.clipboard.writeText(ta.value); say("Copied. Paste it into a message to whoever shared this with you.") } catch (e) { ta.select(); say("Select the text and copy it (Ctrl+C).") } };
  const fallback = () => say("This copy can't save requests for you. Use Copy and send the text to whoever shared this, or post it on GitHub.");
  send.onclick = async () => {
    const text = ta.value.trim(); if (!text) { say("Write your request first."); return }
    const c = window.claude; if (!c || !c.use) { fallback(); return }
    send.disabled = true; say("Sending…");
    try {
      const [db, user] = await Promise.all([c.use("db"), c.use("user")]), id = user && await user.id();
      if (!db || !id) { fallback(); return }
      const ref = db.doc("requests/" + id), snap = await ref.get(), items = snap.exists ? [...(snap.data().items || [])] : [];
      items.push({ at: new Date().toISOString(), version: $("ver").textContent, text }); await ref.set({ items: items.slice(-100) });
      ta.value = ""; say("Sent. Thank you. (" + items.length + " request" + (items.length == 1 ? "" : "s") + " from you so far.)")
    } catch (e) { fallback() } finally { send.disabled = false }
  }
}
