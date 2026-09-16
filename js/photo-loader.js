(function () {
  // TODO: paste your published Google Sheet CSV URL here
  const SHEET_CSV_URL = "PASTE_PUBLISHED_SHEET_CSV_URL_HERE";

  if (!SHEET_CSV_URL || SHEET_CSV_URL.indexOf("PASTE_") === 0) {
    console.warn("photo-loader: SHEET_CSV_URL not set yet — using default photos.");
    return;
  }

  // Converts a normal Google Drive share link into a direct-image URL.
  function toDirectImageUrl(url) {
    if (!url) return url;
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }
    return url; // already a direct link (e.g. Imgur, Dropbox raw, etc.)
  }

  // Minimal CSV parser — handles quoted fields with embedded commas.
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

  fetch(SHEET_CSV_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
      return res.text();
    })
    .then((csvText) => {
      const rows = parseCsv(csvText);
      if (!rows.length) return;

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const spotIdx = header.indexOf("spot");
      const linkIdx = header.indexOf("photo link");

      if (spotIdx === -1 || linkIdx === -1) {
        console.warn('photo-loader: sheet needs "Spot" and "Photo Link" columns.');
        return;
      }

      const photoMap = {};
      for (let i = 1; i < rows.length; i++) {
        const spot = (rows[i][spotIdx] || "").trim();
        const link = (rows[i][linkIdx] || "").trim();
        if (spot && link) photoMap[spot] = toDirectImageUrl(link);
      }

      document.querySelectorAll("[data-photo-spot]").forEach((el) => {
        const spotName = el.getAttribute("data-photo-spot");
        const url = photoMap[spotName];
        if (!url) return; // no entry yet — leave the default photo in place

        if (el.tagName === "IMG") {
          el.src = url;
        } else {
          el.style.backgroundImage = `url("${url}")`;
        }
      });
    })
    .catch((err) => {
      console.warn("photo-loader: falling back to default photos —", err.message);
    });
})();
