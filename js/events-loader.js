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
 
  function toDirectImageUrl(url) {
    if (!url) return url;
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
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
      const featuredIdx = header.indexOf("featured");
 
      if (nameIdx === -1) {
        const msg = '<p class="events-status">Event sheet needs an "Event Name" column.</p>';
        if (listEl) listEl.innerHTML = msg;
        if (pastListEl) pastListEl.innerHTML = msg;
        return;
      }
 
      const events = rows.slice(1)
        .map((r) => ({
          name: (r[nameIdx] || "").trim(),
          date: dateIdx > -1 ? (r[dateIdx] || "").trim() : "",
          time: timeIdx > -1 ? (r[timeIdx] || "").trim() : "",
          desc: descIdx > -1 ? (r[descIdx] || "").trim() : "",
          photo: photoIdx > -1 ? (r[photoIdx] || "").trim() : "",
          featured: featuredIdx > -1 ? (r[featuredIdx] || "").trim().toLowerCase() === "yes" : false,
        }))
        .filter((e) => e.name);
 
      if (listEl) {
        listEl.innerHTML = events.length
          ? renderCards(events)
          : '<p class="events-status">No upcoming events posted yet — check back soon!</p>';
      }
 
      if (pastListEl) {
        const featured = events.filter((e) => e.featured).slice(0, 3);
        pastListEl.innerHTML = featured.length
          ? renderCards(featured)
          : '<p class="events-status">No past events highlighted yet.</p>';
      }
    })
    .catch((err) => {
      const msg = '<p class="events-status">Couldn\'t load events right now — check back soon!</p>';
      if (listEl) listEl.innerHTML = msg;
      if (pastListEl) pastListEl.innerHTML = msg;
      console.warn("events-loader:", err.message);
    });
})();
