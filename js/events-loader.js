(function () {
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDvIkBPFbdeW1juLvhHdX6B29DP2pj0pYyzYsT5DzmYre6Rkl--JwPEtHbmBscoqNBvNWkpiU1oY7T/pub?output=csv";

  const listEl = document.getElementById("events-list");
  const pastListEl = document.getElementById("past-events-list");
  if (!listEl && !pastListEl) return;

  if (!SHEET_CSV_URL || SHEET_CSV_URL.indexOf("PASTE_") === 0) {
    if (listEl) listEl.innerHTML = '<p class="events-status">Event list not connected yet.</p>';
    if (pastListEl) pastListEl.innerHTML = '<p class="events-status">Event list not connected yet.</p>';
    return;
  }

  const MONTHS = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
    september: 8, sept: 8, sep: 8, october: 9, oct: 9,
    november: 10, nov: 10, december: 11, dec: 11
  };

  // Parses dates like "September 20 2026" or "September 20, 2026" (comma optional).
  // Returns a Date at local midnight, or null if it can't be parsed.
  function parseEventDate(str) {
    if (!str) return null;
    const match = str.trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
    if (!match) return null;
    const monthKey = match[1].toLowerCase();
    if (!(monthKey in MONTHS)) return null;
    const month = MONTHS[monthKey];
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }

  function toDirectImageUrl(url) {
    if (!url) return url;
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    return url;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') { field += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { field += char; }
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { row.push(field); field = ""; }
        else if (char === '\n' || char === '\r') {
          if (field !== "" || row.length) { row.push(field); rows.push(row); }
          row = []; field = "";
          if (char === '\r' && next === '\n') i++;
        } else { field += char; }
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function renderCards(events) {
    return events.map((e) => {
      const dateTime = [e.date, e.time].filter(Boolean).join(" • ");
      const photoBlock = e.photo
        ? `<div class="event-card-photo"><img src="${toDirectImageUrl(e.photo)}" alt="${escapeHtml(e.name)}"></div>`
        : "";
      return `
        <div class="event-card">
          ${photoBlock}
          <div class="event-card-body">
            ${dateTime ? `<div class="event-date">${escapeHtml(dateTime)}</div>` : ""}
            <h3>${escapeHtml(e.name)}</h3>
            ${e.desc ? `<p>${escapeHtml(e.desc)}</p>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  fetch(SHEET_CSV_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
      return res.text();
    })
    .then((csvText) => {
      const rows = parseCsv(csvText);
      if (!rows.length) {
        if (listEl) listEl.innerHTML = '<p class="events-status">No upcoming events posted yet — check back soon!</p>';
        if (pastListEl) pastListEl.innerHTML = '<p class="events-status">No past events highlighted yet.</p>';
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf("event name");
      const dateIdx = header.indexOf("date");
      const timeIdx = header.indexOf("time");
      const descIdx = header.indexOf("description");
      const photoIdx = header.indexOf("photo link");

      if (nameIdx === -1) {
        const msg = '<p class="events-status">Event sheet needs an "Event Name" column.</p>';
        if (listEl) listEl.innerHTML = msg;
        if (pastListEl) pastListEl.innerHTML = msg;
        return;
      }

      const events = rows.slice(1)
        .map((r) => {
          const dateStr = dateIdx > -1 ? (r[dateIdx] || "").trim() : "";
          return {
            name: (r[nameIdx] || "").trim(),
            date: dateStr,
            parsedDate: parseEventDate(dateStr),
            time: timeIdx > -1 ? (r[timeIdx] || "").trim() : "",
            desc: descIdx > -1 ? (r[descIdx] || "").trim() : "",
            photo: photoIdx > -1 ? (r[photoIdx] || "").trim() : "",
          };
        })
        .filter((e) => e.name);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Events with an unreadable date default to "upcoming" so they don't silently vanish.
      const upcoming = events
        .filter((e) => !e.parsedDate || e.parsedDate >= today)
        .sort((a, b) => {
          if (!a.parsedDate) return 1;
          if (!b.parsedDate) return -1;
          return a.parsedDate - b.parsedDate;
        });

      const pastAll = events
        .filter((e) => e.parsedDate && e.parsedDate < today)
        .sort((a, b) => b.parsedDate - a.parsedDate);

      const past = pastAll.slice(0, 3);
      const galleryEvents = pastAll.slice(3, 12);

      if (listEl) {
        listEl.innerHTML = upcoming.length
          ? renderCards(upcoming)
          : '<p class="events-status">No upcoming events posted yet — check back soon!</p>';
      }

      if (pastListEl) {
        pastListEl.innerHTML = past.length
          ? renderCards(past)
          : '<p class="events-status">No past events highlighted yet.</p>';
      }

      const galleryImgs = document.querySelectorAll(".gallery-grid .gallery-photo img");
      galleryImgs.forEach((img, i) => {
        const ev = galleryEvents[i];
        if (ev && ev.photo) {
          img.src = toDirectImageUrl(ev.photo);
          img.alt = ev.name || "";
          img.style.display = "";
        } else {
          img.removeAttribute("src");
          img.style.display = "none";
        }
      });
    })
    .catch((err) => {
      const msg = '<p class="events-status">Couldn\'t load events right now — check back soon!</p>';
      if (listEl) listEl.innerHTML = msg;
      if (pastListEl) pastListEl.innerHTML = msg;
      console.warn("events-loader:", err.message);
    });
})();
