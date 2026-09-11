(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SmartInbox = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MONTHS = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
    september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
    december: 11, dec: 11
  };

  const CATEGORY_WORDS = {
    bill: { bill: 5, invoice: 5, payment: 3, pay: 3, balance: 3, amount: 2, utility: 2, electricity: 2, rent: 2, premium: 2 },
    renewal: { renew: 5, renewal: 5, expires: 4, expiry: 4, expiration: 4, membership: 2, license: 2, licence: 2, passport: 2, subscription: 2 },
    appointment: { appointment: 6, confirmed: 2, doctor: 3, dentist: 3, clinic: 3, visit: 2, reservation: 2, meeting: 2, consultation: 3 },
    document: { document: 4, submit: 4, upload: 3, form: 3, paperwork: 4, certificate: 3, proof: 3, application: 2, signature: 2, sign: 2 }
  };

  function pad(number) { return String(number).padStart(2, "0"); }
  function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function validDate(year, month, day) {
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
  function inferredYear(month, day, reference) {
    let year = reference.getFullYear();
    const candidate = validDate(year, month, day);
    const yesterday = new Date(reference); yesterday.setDate(yesterday.getDate() - 1);
    if (candidate && candidate < yesterday) year += 1;
    return year;
  }

  function categoryFrom(text) {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];
    const scores = Object.fromEntries(Object.keys(CATEGORY_WORDS).map((category) => [category, 0]));
    words.forEach((word) => {
      Object.entries(CATEGORY_WORDS).forEach(([category, weights]) => { scores[category] += weights[word] || 0; });
    });
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return { category: ranked[0][1] ? ranked[0][0] : "document", score: ranked[0][1], margin: ranked[0][1] - ranked[1][1] };
  }

  function contextScore(text, index) {
    const context = text.slice(Math.max(0, index - 50), index).toLowerCase();
    let score = 0;
    if (/\b(due|deadline|pay by|submit by|renew by|before|no later than)\b/.test(context)) score += 8;
    if (/\b(on|for|expires?|expiration|appointment|scheduled)\b/.test(context)) score += 3;
    return score;
  }

  function dateCandidates(text, reference, dateOrder = "MDY") {
    const candidates = [];
    const add = (match, date, label) => {
      if (date) candidates.push({ date, raw: match[0], index: match.index, score: contextScore(text, match.index), label });
    };
    const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
    let match;
    while ((match = iso.exec(text))) add(match, validDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])), "date");

    const numeric = /\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2}|\d{2})\b/g;
    while ((match = numeric.exec(text))) {
      const first = Number(match[1]); const second = Number(match[2]);
      const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
      const dayFirst = dateOrder === "DMY" || first > 12;
      const month = dayFirst ? second - 1 : first - 1;
      const day = dayFirst ? first : second;
      add(match, validDate(year, month, day), "date");
    }

    const monthFirst = new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "gi");
    while ((match = monthFirst.exec(text))) {
      const month = MONTHS[match[1].toLowerCase()]; const day = Number(match[2]);
      add(match, validDate(match[3] ? Number(match[3]) : inferredYear(month, day, reference), month, day), "date");
    }

    const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join("|")})(?:,?\\s+(20\\d{2}))?\\b`, "gi");
    while ((match = dayFirst.exec(text))) {
      const month = MONTHS[match[2].toLowerCase()]; const day = Number(match[1]);
      add(match, validDate(match[3] ? Number(match[3]) : inferredYear(month, day, reference), month, day), "date");
    }

    const lower = text.toLowerCase();
    for (const [word, offset] of [["today", 0], ["tomorrow", 1]]) {
      const index = lower.indexOf(word);
      if (index >= 0) { const date = new Date(reference); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + offset); candidates.push({ date, raw: word, index, score: contextScore(text, index) + 2, label: "relative date" }); }
    }
    const relative = /\bin\s+(\d{1,3})\s+days?\b/i.exec(text);
    if (relative) { const date = new Date(reference); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + Number(relative[1])); candidates.push({ date, raw: relative[0], index: relative.index, score: contextScore(text, relative.index) + 2, label: "relative date" }); }
    return candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  }

  function extractTime(text) {
    const match = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i.exec(text) || /\b(?:at\s+)([01]?\d|2[0-3]):([0-5]\d)\b/i.exec(text);
    if (!match) return null;
    let hour = Number(match[1]); const minute = Number(match[2] || 0); const meridiem = (match[3] || "").toLowerCase();
    if (meridiem.startsWith("p") && hour < 12) hour += 12;
    if (meridiem.startsWith("a") && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return { value: `${pad(hour)}:${pad(minute)}`, raw: match[0].trim() };
  }

  function extractAmount(text) {
    const match = /(?:\b(?:USD|EUR|GBP)\s*|[$€£]\s*)\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/i.exec(text);
    return match ? match[0].trim() : "";
  }

  function extractReference(text) {
    const patterns = [
      /\baccount\s+(?:ending\s+(?:in\s+)?|number\s*(?:no\.?|#|:)?\s*|#\s*)?([A-Z0-9-]{4,})\b/i,
      /\b(?:invoice|confirmation|reference|ref|policy)\s*(?:number|no\.?|#|:)?\s*([A-Z0-9-]{4,})\b/i
    ];
    const genericWords = /^(?:account|ending|number|please|details)$/i;
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && !genericWords.test(match[1])) return match[1];
    }
    return "";
  }

  function extractTitle(text, category) {
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const subject = lines.find((line) => /^subject\s*:/i.test(line));
    if (subject) return subject.replace(/^subject\s*:\s*/i, "").slice(0, 80);
    let first = (lines[0] || "New life admin task").replace(/^(hello|hi|dear)\b[^,]*,?\s*/i, "");
    first = first.split(/\b(?:is due|due on|due by|for (?:january|february|march|april|may|june|july|august|september|october|november|december)|on \d|at \d)\b/i)[0];
    first = first.replace(/[.!,:;-]+$/, "").trim();
    if (first.length >= 5 && first.length <= 80) return first;
    return ({ bill: "Review and pay bill", renewal: "Complete renewal", appointment: "Upcoming appointment", document: "Submit required document" })[category];
  }

  function analyze(text, referenceDate = new Date(), options = {}) {
    const clean = String(text || "").replace(/\r/g, "").trim();
    if (!clean) return { error: "Paste a notice or message first." };
    const categoryResult = categoryFrom(clean);
    const dates = dateCandidates(clean, referenceDate, options.dateOrder || "MDY");
    const selectedDate = dates[0] || null;
    const time = extractTime(clean);
    const amount = extractAmount(clean);
    const reference = extractReference(clean);
    const category = categoryResult.category;
    const title = extractTitle(clean, category);
    const findings = [];
    findings.push({ type: "category", label: "Category", value: category });
    if (selectedDate) findings.push({ type: "date", label: "Deadline", value: selectedDate.raw });
    if (time) findings.push({ type: "time", label: "Time", value: time.raw });
    if (amount) findings.push({ type: "amount", label: "Amount", value: amount });
    if (reference) findings.push({ type: "reference", label: "Reference", value: reference });
    let confidence = 28;
    confidence += Math.min(22, categoryResult.score * 2 + categoryResult.margin);
    if (selectedDate) confidence += 30;
    if (time) confidence += 7;
    if (amount || reference) confidence += 8;
    confidence = Math.min(96, confidence);
    const detailParts = [];
    if (amount) detailParts.push(`Amount: ${amount}`);
    if (reference) detailParts.push(`Reference: ${reference}`);
    return {
      title, category, date: selectedDate ? dateKey(selectedDate.date) : "", time: time ? time.value : "",
      amount, reference, notes: detailParts.join(" · "), confidence, findings,
      needsDate: !selectedDate
    };
  }

  return { analyze, categoryFrom, dateCandidates, extractTime, extractAmount, extractReference, extractTitle, dateKey };
});
