"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Inbox = require("./smart-inbox.js");
const reference = new Date("2026-09-11T12:00:00");

test("extracts a bill with amount, deadline, and account reference", () => {
  const result = Inbox.analyze("Subject: Electricity bill reminder\nYour bill of $128.44 is due on September 28, 2026. Account ending 4821.", reference);
  assert.equal(result.title, "Electricity bill reminder");
  assert.equal(result.category, "bill");
  assert.equal(result.date, "2026-09-28");
  assert.equal(result.amount, "$128.44");
  assert.equal(result.reference, "4821");
  assert.ok(result.confidence >= 80);
});

test("extracts an appointment date and twelve-hour time", () => {
  const result = Inbox.analyze("Appointment confirmed with Dr. Chen for October 3, 2026 at 10:30 AM. Confirmation ABC123.", reference);
  assert.equal(result.category, "appointment");
  assert.equal(result.date, "2026-10-03");
  assert.equal(result.time, "10:30");
  assert.equal(result.reference, "ABC123");
});

test("prioritizes a renewal deadline over an expiry date", () => {
  const result = Inbox.analyze("Your passport expires 11/20/2026. Please renew before November 1, 2026.", reference);
  assert.equal(result.category, "renewal");
  assert.equal(result.date, "2026-11-01");
});

test("understands a relative document deadline", () => {
  const result = Inbox.analyze("Please submit the signed consent form in 5 days. Reference FORM-8821.", reference);
  assert.equal(result.category, "document");
  assert.equal(result.date, "2026-09-16");
  assert.equal(result.reference, "FORM-8821");
});

test("returns a review warning when no date is found", () => {
  const result = Inbox.analyze("Your annual membership renewal is ready.", reference);
  assert.equal(result.category, "renewal");
  assert.equal(result.needsDate, true);
  assert.equal(result.date, "");
});

test("respects the selected numeric date order", () => {
  const us = Inbox.analyze("Payment is due by 10/11/2026.", reference, { dateOrder: "MDY" });
  const international = Inbox.analyze("Payment is due by 10/11/2026.", reference, { dateOrder: "DMY" });
  assert.equal(us.date, "2026-10-11");
  assert.equal(international.date, "2026-11-10");
});

test("rejects an empty inbox", () => {
  assert.equal(Inbox.analyze("  ", reference).error, "Paste a notice or message first.");
});
