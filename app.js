"use strict";

const Core = window.LifeAdminCore;
const Inbox = window.SmartInbox;
const STORAGE_KEY = "orbit-abroad-tasks-v1";
const SETTINGS_KEY = "orbit-abroad-settings-v1";
const state = { tasks: [], view: "active", category: "all", query: "" };
let settings = { region: "US", dateOrder: "MDY", onboarded: false };
let deferredInstall = null;
const experience = { analysisRun: 0, analysisState: "idle" };
window.__orbitPlusExperience = experience;
window.__orbitAbroadExperience = experience;

const $ = (selector) => document.querySelector(selector);
const elements = {
  list: $("#taskList"), dialog: $("#taskDialog"), form: $("#taskForm"),
  title: $("#titleInput"), category: $("#categoryInput"), date: $("#dateInput"),
  time: $("#timeInput"), reminder: $("#reminderInput"), notes: $("#notesInput"),
  search: $("#searchInput"), categoryFilter: $("#categoryFilter"), tabs: $("#viewTabs"),
  toast: $("#toast"), notificationButton: $("#notificationButton"),
  inboxText: $("#inboxText"), smartReview: $("#smartReview")
};

const EXAMPLES = {
  utility: "Subject: Electricity bill reminder\nYour electricity bill of $128.44 is due in 14 days. Please reference account ending 4821.",
  visa: "Subject: Visa renewal reminder\nYour visa renewal documents are due in 30 days. Reference VISA-DEMO. Review official government guidance before taking action.",
  appointment: "Subject: Clinic appointment confirmed\nYour appointment with Dr. Chen is tomorrow at 10:30 AM. Confirmation DEMO123.",
  university: "Subject: Enrollment document required\nPlease submit the signed enrollment form in 10 days. Reference FORM-DEMO."
};

function toDateInput(date) {
  return Core.dayKey(date);
}

function relativeDate(days, hour) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { date: toDateInput(date), time: hour || "" };
}

function sampleTasks() {
  const energy = relativeDate(2);
  const dentist = relativeDate(7, "10:30");
  const passport = relativeDate(38);
  const insurance = relativeDate(14);
  return [
    { id: crypto.randomUUID(), title: "Pay electricity bill", category: "bill", ...energy, reminder: "1440", notes: "Check this month’s meter reading", completed: false, sample: true },
    { id: crypto.randomUUID(), title: "Dentist check-up", category: "appointment", ...dentist, reminder: "60", notes: "Bring insurance card", completed: false, sample: true },
    { id: crypto.randomUUID(), title: "Renew passport", category: "renewal", ...passport, reminder: "10080", notes: "Prepare a new passport photo", completed: false, sample: true },
    { id: crypto.randomUUID(), title: "File insurance letter", category: "document", ...insurance, reminder: "0", notes: "Save the policy confirmation PDF", completed: false, sample: true }
  ];
}

function migrateSampleTasks(tasks) {
  const legacySamples = new Set(["Pay electricity bill", "Dentist check-up", "Renew passport", "File insurance letter"]);
  return tasks.map((task) => task.sample || task.createdAt || !legacySamples.has(task.title) ? task : { ...task, sample: true });
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    state.tasks = Array.isArray(saved) ? migrateSampleTasks(saved) : sampleTasks();
  } catch (_) {
    state.tasks = sampleTasks();
  }
  saveTasks();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && typeof saved === "object") settings = { ...settings, ...saved };
  } catch (_) { /* Keep safe defaults. */ }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function categoryName(category) {
  return ({ bill: "Bill", renewal: "Renewal", appointment: "Appointment", document: "Document" })[category] || category;
}

function dueText(task, now = new Date()) {
  const status = Core.statusOf(task, now);
  const days = Core.daysUntil(task, now);
  if (status === "overdue") return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, className: "overdue" };
  if (status === "today") return { text: task.time ? `Today at ${formatTime(task.time)}` : "Due today", className: "soon" };
  if (days === 1) return { text: "Due tomorrow", className: "soon" };
  const date = Core.parseDeadline(task);
  return { text: `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${task.time ? ` · ${formatTime(task.time)}` : ""}`, className: days <= 7 ? "soon" : "" };
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function render() {
  const now = new Date();
  const tasks = Core.filterTasks(state.tasks, state, now);
  elements.list.innerHTML = tasks.length ? tasks.map((task, index) => {
    const due = dueText(task, now);
    return `<article class="task-card ${task.completed ? "is-complete" : ""}" style="animation-delay:${Math.min(index * 35, 210)}ms">
      <button class="check-button" data-action="toggle" data-id="${task.id}" aria-label="${task.completed ? "Mark active" : "Mark complete"}">✓</button>
      <div class="task-main">
        <div class="task-topline"><span class="category-pill">${categoryName(task.category)}</span>${task.sample ? '<span class="sample-pill">Sample</span>' : ""}<h3 class="task-title">${escapeHtml(task.title)}</h3></div>
        ${task.notes ? `<p class="task-note">${escapeHtml(task.notes)}</p>` : ""}
      </div>
      <div class="task-side">
        <span class="due-label ${due.className}">${task.completed ? "Completed" : due.text}</span>
        <div class="task-actions">
          ${!task.completed ? `<button class="mini-button" data-action="calendar" data-id="${task.id}">Add to calendar</button>` : ""}
          <button class="mini-button" data-action="delete" data-id="${task.id}">Delete</button>
        </div>
      </div>
    </article>`;
  }).join("") : `<div class="empty-state"><strong>Clear skies.</strong><span>No tasks match this view.</span></div>`;

  $("#sampleNotice").hidden = !state.tasks.some((task) => task.sample);

  const active = state.tasks.filter((task) => !task.completed);
  $("#dueSoonCount").textContent = active.filter((task) => Core.daysUntil(task, now) <= 7).length;
  $("#upcomingCount").textContent = active.filter((task) => Core.statusOf(task, now) === "upcoming").length;
  $("#completedCount").textContent = state.tasks.filter((task) => task.completed).length;
  const priority = Core.sortTasks(active)[0];
  $("#briefIssue").textContent = `No. ${String(active.length).padStart(3, "0")}`;
  if (priority) {
    const due = dueText(priority, now);
    $("#briefHeadline").textContent = priority.title;
    $("#briefCopy").textContent = `${due.text}. ${active.length === 1 ? "It is the only active item on your desk." : `${active.length - 1} more active items follow.`}`;
  } else {
    $("#briefHeadline").textContent = "The desk is clear.";
    $("#briefCopy").textContent = "Nothing needs your attention right now.";
  }
}

function renderSmartReview(result) {
  if (result.error) { showToast(result.error); elements.inboxText.focus(); return; }
  const findings = result.findings.map((finding) => `<span class="finding-chip" title="${escapeHtml(finding.label)}">${escapeHtml(finding.value)}</span>`).join("");
  const categories = ["bill", "renewal", "appointment", "document"].map((category) => `<option value="${category}" ${category === result.category ? "selected" : ""}>${categoryName(category)}</option>`).join("");
  elements.smartReview.classList.add("has-result");
  elements.smartReview.innerHTML = `
    <div class="review-topline">
      <p>Review suggestion</p>
      <span class="confidence"><span class="confidence-meter"><i style="width:${result.confidence}%"></i></span>${result.confidence}% confidence</span>
    </div>
    <div class="finding-list" aria-label="Detected details">${findings}</div>
    <div class="smart-fields">
      <label class="smart-field wide">Task title<input id="smartTitle" maxlength="80" value="${escapeHtml(result.title)}"></label>
      <label class="smart-field">Category<select id="smartCategory">${categories}</select></label>
      <label class="smart-field">Deadline<input id="smartDate" type="date" value="${escapeHtml(result.date)}"></label>
      <label class="smart-field">Time<input id="smartTime" type="time" value="${escapeHtml(result.time)}"></label>
      <label class="smart-field">Reminder<select id="smartReminder"><option value="60" ${result.category === "appointment" ? "selected" : ""}>1 hour before</option><option value="1440" ${result.category !== "appointment" ? "selected" : ""}>1 day before</option><option value="10080">1 week before</option><option value="none">No reminder</option></select></label>
      <label class="smart-field wide">Useful details<input id="smartNotes" maxlength="240" value="${escapeHtml(result.notes)}" placeholder="Add a reference or note"></label>
    </div>
    ${result.needsDate ? '<p class="smart-warning">Orbit could not find a deadline. Please choose one before saving.</p>' : ""}
    <div class="review-actions"><small>Nothing is added until you confirm.</small><button class="button button-coral" id="smartSaveButton" type="button">Create task</button></div>`;
  $("#smartSaveButton").addEventListener("click", saveSmartTask);
  experience.analysisState = "review";
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function analyzeInbox() {
  const result = Inbox.analyze(elements.inboxText.value, new Date(), { dateOrder: settings.dateOrder });
  if (result.error) { renderSmartReview(result); return; }
  const run = ++experience.analysisRun;
  const steps = ["Reading document structure", "Locating dates and amounts", "Classifying the request", "Preparing your review"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const analyzeButton = $("#analyzeButton");
  analyzeButton.disabled = true;
  analyzeButton.innerHTML = "Reading… <span aria-hidden=\"true\">↗</span>";
  $("#smartInbox").classList.add("is-scanning");
  elements.smartReview.classList.remove("has-result");
  experience.analysisState = "scanning";
  elements.smartReview.innerHTML = `<div class="analysis-stage">
    <div class="analysis-kicker"><i></i> Local analysis in progress</div>
    <strong>Reading between the lines.</strong>
    <div class="analysis-steps">${steps.map((step, index) => `<div class="analysis-step" data-step="${index}"><span>0${index + 1}</span><span>${step}</span></div>`).join("")}</div>
    <div class="analysis-progress"><i></i></div>
  </div>`;

  if (!reducedMotion) {
    for (let index = 0; index < steps.length; index += 1) {
      if (run !== experience.analysisRun) return;
      const step = elements.smartReview.querySelector(`[data-step="${index}"]`);
      step.classList.add("active");
      elements.smartReview.querySelector(".analysis-progress i").style.width = `${(index + 1) * 25}%`;
      await pause(310);
      step.classList.remove("active");
      step.classList.add("done");
    }
    await pause(180);
  }
  if (run !== experience.analysisRun) return;
  $("#smartInbox").classList.remove("is-scanning");
  analyzeButton.disabled = false;
  analyzeButton.innerHTML = "Find the task <span aria-hidden=\"true\">→</span>";
  renderSmartReview(result);
}

function saveSmartTask() {
  const task = {
    id: crypto.randomUUID(), title: $("#smartTitle").value.trim(), category: $("#smartCategory").value,
    date: $("#smartDate").value, time: $("#smartTime").value, reminder: $("#smartReminder").value,
    notes: $("#smartNotes").value.trim(), completed: false, createdAt: new Date().toISOString(), source: "smart-inbox"
  };
  const errors = Core.validateTask(task);
  if (errors.length) { showToast(errors[0]); return; }
  state.tasks.push(task);
  saveTasks(); render();
  elements.inboxText.value = "";
  elements.smartReview.innerHTML = `<div class="review-empty"><span class="scan-mark" aria-hidden="true">✓</span><strong>Task created</strong><p>Orbit saved the reviewed details. The original pasted text was discarded.</p></div>`;
  elements.smartReview.classList.remove("has-result");
  experience.analysisState = "complete";
  showToast("Smart Inbox task added");
  document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

function addTask() {
  const task = {
    id: crypto.randomUUID(), title: elements.title.value.trim(), category: elements.category.value,
    date: elements.date.value, time: elements.time.value, reminder: elements.reminder.value,
    notes: elements.notes.value.trim(), completed: false, createdAt: new Date().toISOString()
  };
  const errors = Core.validateTask(task);
  if (errors.length) { showToast(errors[0]); return; }
  state.tasks.push(task);
  saveTasks(); render(); elements.dialog.close(); elements.form.reset(); setDefaultDate();
  showToast("Task added to your orbit");
}

function setDefaultDate() {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  elements.date.value = toDateInput(tomorrow);
  elements.reminder.value = "1440";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function downloadCalendar(task) {
  const blob = new Blob([Core.buildIcs(task)], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "orbit-task"}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Calendar reminder downloaded");
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function exportBackup() {
  const payload = { product: "Orbit Abroad", version: 1, exportedAt: new Date().toISOString(), settings, tasks: state.tasks };
  downloadFile(`orbit-abroad-backup-${Core.dayKey(new Date())}.json`, JSON.stringify(payload, null, 2));
  showToast("Private backup downloaded");
}

async function importBackup(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.product !== "Orbit Abroad" || !Array.isArray(payload.tasks)) throw new Error("Not an Orbit Abroad backup.");
    if (payload.tasks.some((task) => Core.validateTask(task).length)) throw new Error("The backup contains invalid tasks.");
    state.tasks = payload.tasks;
    if (payload.settings && typeof payload.settings === "object") settings = { ...settings, ...payload.settings, onboarded: true };
    saveTasks(); saveSettings(); render();
    showToast(`${state.tasks.length} tasks restored`);
  } catch (error) {
    showToast(error.message || "Could not import that backup");
  } finally {
    event.target.value = "";
  }
}

function showWelcome() {
  $("#regionInput").value = settings.region;
  $("#dateOrderInput").value = settings.dateOrder;
  $("#redactionConsent").checked = false;
  $("#welcomeDialog").showModal();
}

function saveOnboarding() {
  settings = { region: $("#regionInput").value, dateOrder: $("#dateOrderInput").value, onboarded: true };
  saveSettings();
  showToast("Your private desk is ready");
}

function resetLocalData() {
  if (!window.confirm("Delete every Orbit Abroad task and setting from this browser? This cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  window.location.reload();
}

function openFeedbackIssue() {
  const rating = $("#feedbackRating").value;
  const feedback = $("#feedbackText").value.trim();
  const title = "[Beta feedback] Orbit Abroad experience";
  const body = `## Beta feedback\n\n**Usefulness:** ${rating}/5\n\n**What confused me or felt missing:**\n${feedback}\n\n---\nI confirm that this report contains no personal or sensitive information.`;
  const issueUrl = `https://github.com/gdifranco1/orbit-abroad/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.location.assign(issueUrl);
}

async function enableNotifications() {
  if (!("Notification" in window)) { showToast("Notifications are not supported here"); return; }
  const permission = await Notification.requestPermission();
  updateNotificationButton();
  showToast(permission === "granted" ? "Reminders are on while Orbit is open" : "Notification permission was not enabled");
  if (permission === "granted") checkReminders();
}

function updateNotificationButton() {
  if (!("Notification" in window)) { elements.notificationButton.hidden = true; return; }
  elements.notificationButton.textContent = Notification.permission === "granted" ? "Reminders enabled" : "Enable reminders";
}

function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  let changed = false;
  state.tasks.forEach((task) => {
    if (task.completed || task.reminder === "none") return;
    const reminderTime = Core.parseDeadline(task).getTime() - Number(task.reminder || 0) * 60000;
    const key = `${task.date}-${task.time}-${task.reminder}`;
    if (now.getTime() >= reminderTime && now.getTime() < Core.parseDeadline(task).getTime() + 3600000 && task.notifiedKey !== key) {
      new Notification(`Orbit reminder: ${task.title}`, { body: dueText(task, now).text, tag: task.id });
      task.notifiedKey = key; changed = true;
    }
  });
  if (changed) saveTasks();
}

$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
$("#openFormButton").addEventListener("click", () => { elements.dialog.showModal(); setTimeout(() => elements.title.focus(), 50); });
$("#closeFormButton").addEventListener("click", () => elements.dialog.close());
$("#cancelFormButton").addEventListener("click", () => elements.dialog.close());
elements.form.addEventListener("submit", (event) => { event.preventDefault(); addTask(); });
elements.search.addEventListener("input", () => { state.query = elements.search.value; render(); });
elements.categoryFilter.addEventListener("change", () => { state.category = elements.categoryFilter.value; render(); });
elements.tabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-view]"); if (!tab) return;
  state.view = tab.dataset.view;
  elements.tabs.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
  render();
});
elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]"); if (!button) return;
  const task = state.tasks.find((item) => item.id === button.dataset.id); if (!task) return;
  if (button.dataset.action === "toggle") { task.completed = !task.completed; saveTasks(); render(); showToast(task.completed ? "Nicely done" : "Task restored"); }
  if (button.dataset.action === "delete" && window.confirm(`Delete “${task.title}”?`)) { state.tasks = state.tasks.filter((item) => item.id !== task.id); saveTasks(); render(); showToast("Task deleted"); }
  if (button.dataset.action === "calendar") downloadCalendar(task);
});
elements.notificationButton.addEventListener("click", enableNotifications);
$("#analyzeButton").addEventListener("click", analyzeInbox);
$("#exampleButton").addEventListener("click", () => {
  elements.inboxText.value = EXAMPLES[$("#exampleSelect").value];
  analyzeInbox();
});
$("#briefInboxButton").addEventListener("click", () => {
  $("#smartInbox").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => elements.inboxText.focus(), 450);
});
$("#welcomeForm").addEventListener("submit", saveOnboarding);
$("#settingsButton").addEventListener("click", showWelcome);
$("#resetDataButton").addEventListener("click", resetLocalData);
$("#clearSamplesButton").addEventListener("click", () => {
  state.tasks = state.tasks.filter((task) => !task.sample);
  saveTasks();
  render();
  showToast("Sample tasks removed");
});
$("#feedbackButton").addEventListener("click", () => $("#feedbackDialog").showModal());
$("#closeFeedbackButton").addEventListener("click", () => $("#feedbackDialog").close());
$("#feedbackForm").addEventListener("submit", (event) => { event.preventDefault(); openFeedbackIssue(); });
$("#exportButton").addEventListener("click", exportBackup);
$("#importInput").addEventListener("change", importBackup);
$("#installButton").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("#installButton").hidden = true;
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  $("#installButton").hidden = false;
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

loadSettings(); loadTasks(); setDefaultDate(); updateNotificationButton(); render(); checkReminders();
if (!settings.onboarded) setTimeout(showWelcome, 250);
setInterval(checkReminders, 30000);
