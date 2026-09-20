(function () {
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsDDzFHzX4p8Ott8WVOr3GzQa-ELjkc84yPMjnEsqKYBH7MR0oeHHtDtkpYXhNxg7mTwxy_V5KU-4N/pub?gid=0&single=true&output=csv";

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
      if (spotIdx === -1 || linkIdx === -1) return;

      const photoMap = {};
      for (let i = 1; i < rows.length; i++) {
        const spot = (rows[i][spotIdx] || "").trim();
        const link = (rows[i][linkIdx] || "").trim();
        if (spot && link) photoMap[spot] = toDirectImageUrl(link);
      }

      document.querySelectorAll("[data-photo-spot]").forEach((el) => {
        const url = photoMap[el.getAttribute("data-photo-spot")];
        if (!url) return;
        if (el.tagName === "IMG") {
          el.src = url;
        } else {
          el.style.backgroundImage = `url("${url}")`;
        }
      });
    })
    .catch(() => {});
})();
