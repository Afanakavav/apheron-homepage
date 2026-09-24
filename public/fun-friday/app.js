// Wheel of Facts · FUN Friday — entry point
// Routes on the hash: no hash = launcher, #control / #board = the two game windows,
// #demo-control / #demo-board = the same windows with invented data kept apart from the real game.

const ROUTES = {
  "#control": { view: "control", demo: false },
  "#board": { view: "board", demo: false },
  "#demo-control": { view: "control", demo: true },
  "#demo-board": { view: "board", demo: true },
};

import { openBoard } from "./store.js";

const TITLES = {
  control: "CONTROL — Wheel of Facts (do not share)",
  board: "BOARD — Wheel of Facts",
};

function mountLauncher(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;
    const what = btn.dataset.open;
    if (what === "control") location.hash = "#control";
    else if (what === "board") openBoard(false);
    else if (what === "demo") {
      openBoard(true);
      location.hash = "#demo-control";
    }
  });
}

function route() {
  const { view, demo } = ROUTES[location.hash] || { view: "launcher", demo: false };
  document.body.dataset.view = view;
  if (demo) document.body.dataset.demo = "";
  if (TITLES[view]) document.title = (demo ? "DEMO · " : "") + TITLES[view];
  const root = document.getElementById(view);
  root.hidden = false;
  const failed = (e) => {
    console.error(e);
    root.textContent = "The game could not be loaded. Check the connection and reload the page.";
    root.classList.add("load-error");
  };
  if (view === "control") import("./control.js").then((m) => m.mountControl(root, { demo })).catch(failed);
  else if (view === "board") import("./board.js").then((m) => m.mountBoard(root, { demo })).catch(failed);
  else mountLauncher(root);
}

// Each view mounts once; switching hash gives a clean page.
window.addEventListener("hashchange", () => location.reload());
route();
