"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Core = require("./core.js");

const now = new Date("2026-09-11T12:00:00");
const task = (overrides = {}) => ({ id: "task-1", title: "Pay rent", category: "bill", date: "2026-09-12", time: "09:00", reminder: "60", notes: "Apartment", completed: false, ...overrides });

test("classifies overdue, today, upcoming, and completed tasks", () => {
  assert.equal(Core.statusOf(task({ date: "2026-09-10" }), now), "overdue");
  assert.equal(Core.statusOf(task({ date: "2026-09-11" }), now), "today");
  assert.equal(Core.statusOf(task(), now), "upcoming");
  assert.equal(Core.statusOf(task({ completed: true }), now), "completed");
});

test("filters by view, category, and search", () => {
  const tasks = [task(), task({ id: "2", title: "Dentist", category: "appointment", date: "2026-09-11" }), task({ id: "3", completed: true })];
  assert.deepEqual(Core.filterTasks(tasks, { view: "today", category: "all", query: "" }, now).map((item) => item.id), ["2"]);
  assert.deepEqual(Core.filterTasks(tasks, { view: "active", category: "bill", query: "rent" }, now).map((item) => item.id), ["task-1"]);
  assert.deepEqual(Core.filterTasks(tasks, { view: "completed" }, now).map((item) => item.id), ["3"]);
});

test("sorts active deadlines before completed tasks", () => {
  const tasks = [task({ id: "late", completed: true }), task({ id: "second", date: "2026-09-13" }), task({ id: "first", date: "2026-09-12" })];
  assert.deepEqual(Core.sortTasks(tasks).map((item) => item.id), ["first", "second", "late"]);
});

test("validates required task data", () => {
  assert.equal(Core.validateTask(task()).length, 0);
  assert.equal(Core.validateTask(task({ title: "", category: "other", date: "bad" })).length, 3);
});

test("creates a calendar event with escaped content and alarm", () => {
  const calendar = Core.buildIcs(task({ title: "Rent, utilities", notes: "Pay; then file" }), now);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /SUMMARY:Rent\\, utilities/);
  assert.match(calendar, /DESCRIPTION:Pay\\; then file/);
  assert.match(calendar, /TRIGGER:-PT60M/);
});
