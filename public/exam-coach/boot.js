// Exam Coach — runs before app.js and without Firebase: names the exam in the title and the views, and moves
// /exam-coach/ to the canonical /exam-coach/<examId>/ so the page and the home-screen app share one URL.

import { examFromPath, examPath } from "./core.js?v=1";

const exam = examFromPath(location.pathname);

document.title = exam.known ? `${exam.name} · Exam Coach` : "Exam Coach";
for (const node of document.querySelectorAll("[data-exam-name]")) {
  node.textContent = exam.known ? exam.name : "Unknown exam";
}

if (exam.known && location.pathname !== examPath(exam.id)) {
  try {
    history.replaceState(null, "", examPath(exam.id) + location.search + location.hash);
  } catch (e) { /* the page works on any path */ }
}
