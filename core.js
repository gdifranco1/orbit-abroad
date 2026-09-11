(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LifeAdminCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = ["bill", "renewal", "appointment", "document"];

  function parseDeadline(task) {
    const time = task.time || "23:59";
    return new Date(`${task.date}T${time}:00`);
  }

  function dayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function statusOf(task, now = new Date()) {
    if (task.completed) return "completed";
    const deadline = parseDeadline(task);
    if (dayKey(deadline) === dayKey(now)) return "today";
    if (deadline.getTime() < now.getTime()) return "overdue";
    return "upcoming";
  }

  function daysUntil(task, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = parseDeadline(task);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return Math.round((dueDay - today) / 86400000);
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return parseDeadline(a) - parseDeadline(b);
    });
  }

  function validateTask(task) {
    const errors = [];
    if (!task.title || !task.title.trim()) errors.push("Give the task a title.");
    if (!CATEGORIES.includes(task.category)) errors.push("Choose a valid category.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date || "") || Number.isNaN(parseDeadline(task).getTime())) errors.push("Choose a valid deadline.");
    return errors;
  }

  function filterTasks(tasks, options = {}, now = new Date()) {
    const view = options.view || "active";
    const category = options.category || "all";
    const query = (options.query || "").trim().toLowerCase();
    return sortTasks(tasks).filter((task) => {
      const status = statusOf(task, now);
      if (view === "active" && status === "completed") return false;
      if (view === "today" && !["today", "overdue"].includes(status)) return false;
      if (view === "upcoming" && status !== "upcoming") return false;
      if (view === "completed" && status !== "completed") return false;
      if (category !== "all" && task.category !== category) return false;
      if (query && !`${task.title} ${task.notes || ""}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function escapeIcs(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function icsDate(date) {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
  }

  function buildIcs(task, now = new Date()) {
    const start = parseDeadline(task);
    const end = new Date(start.getTime() + 30 * 60000);
    const reminder = task.reminder === "none" ? null : Math.max(0, Number(task.reminder || 0));
    const alarm = reminder === null ? "" : `\r\nBEGIN:VALARM\r\nTRIGGER:-PT${reminder}M\r\nACTION:DISPLAY\r\nDESCRIPTION:${escapeIcs(task.title)}\r\nEND:VALARM`;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orbit Life Admin//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${escapeIcs(task.id)}@orbit.local`, `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.notes || `${task.category} task from Orbit`)}`,
      `${alarm}\r\nEND:VEVENT`, "END:VCALENDAR"
    ].join("\r\n");
  }

  return { CATEGORIES, parseDeadline, dayKey, statusOf, daysUntil, sortTasks, validateTask, filterTasks, escapeIcs, buildIcs };
});
