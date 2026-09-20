(function () {
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsDDzFHzX4p8Ott8WVOr3GzQa-ELjkc84yPMjnEsqKYBH7MR0oeHHtDtkpYXhNxg7mTwxy_V5KU-4N/pub?gid=0&single=true&output=csv";

  // -----------------------------
  // Normalize text for matching
  // -----------------------------
  function normalize(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  // -----------------------------
  // Convert Google Drive links
  // -----------------------------
  function toDirectImageUrl(url) {
    if (!url) return "";

    url = url.trim();

    // Handles:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID

    const driveMatch =
      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];

      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    return url;
  }

  // -----------------------------
  // CSV parser
  // -----------------------------
  function parseCsv(text) {
    const rows = [];

    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          row.push(field);
          field = "";
        } else if (char === "\n" || char === "\r") {
          if (field !== "" || row.length) {
            row.push(field);
            rows.push(row);
          }

          row = [];
          field = "";

          // Handle Windows-style line endings
          if (char === "\r" && next === "\n") {
            i++;
          }
        } else {
          field += char;
        }
      }
    }

    // Add final row
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  // -----------------------------
  // Load the Google Sheet
  // -----------------------------
  fetch(SHEET_CSV_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Google Sheet request failed: ${response.status}`
        );
      }

      return response.text();
    })

    .then((csvText) => {
      console.log("PHOTO LOADER: Google Sheet loaded.");

      const rows = parseCsv(csvText);

      if (!rows.length) {
        throw new Error("Google Sheet returned no rows.");
      }

      // -----------------------------
      // Read headers
      // -----------------------------
      const header = rows[0].map((value) =>
        normalize(value)
      );

      console.log("PHOTO LOADER: Sheet headers:", header);

      const spotIdx = header.indexOf("spot");
      const linkIdx = header.indexOf("photo link");

      if (spotIdx === -1) {
        throw new Error(
          'Could not find a "Spot" column in the Google Sheet.'
        );
      }

      if (linkIdx === -1) {
        throw new Error(
          'Could not find a "Photo Link" column in the Google Sheet.'
        );
      }

      // -----------------------------
      // Build photo map
      // -----------------------------
      const photoMap = {};

      for (let i = 1; i < rows.length; i++) {
        const spot = normalize(rows[i][spotIdx]);
        const link = String(rows[i][linkIdx] || "").trim();

        if (!spot || !link) {
          continue;
        }

        const imageUrl = toDirectImageUrl(link);

        photoMap[spot] = imageUrl;
      }

      console.log(
        `PHOTO LOADER: Loaded ${Object.keys(photoMap).length} photo links.`
      );

      // -----------------------------
      // Find all photo elements
      // -----------------------------
      const photoElements =
        document.querySelectorAll("[data-photo-spot]");

      console.log(
        `PHOTO LOADER: Found ${photoElements.length} photo elements on the page.`
      );

      // -----------------------------
      // Apply photos
      // -----------------------------
      photoElements.forEach((element) => {
        const spotAttribute =
          element.getAttribute("data-photo-spot");

        const spotName = normalize(spotAttribute);

        const imageUrl = photoMap[spotName];

        // No matching spot
        if (!imageUrl) {
          console.warn(
            `PHOTO LOADER: No photo found for "${spotAttribute}"`
          );

          return;
        }

        console.log(
          `PHOTO LOADER: Loading "${spotAttribute}"`,
          imageUrl
        );

        // -----------------------------
        // IMG element
        // -----------------------------
        if (element.tagName === "IMG") {
          element.src = imageUrl;

          element.addEventListener("load", function () {
            console.log(
              `PHOTO LOADER: Successfully loaded "${spotAttribute}"`
            );
          });

          element.addEventListener("error", function () {
            console.error(
              `PHOTO LOADER: FAILED to load "${spotAttribute}"`,
              imageUrl
            );
          });

          return;
        }

        // -----------------------------
        // Background image
        // -----------------------------
        element.style.backgroundImage =
          `url("${imageUrl}")`;

        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";

        console.log(
          `PHOTO LOADER: Background image assigned to "${spotAttribute}"`
        );
      });
    })

    .catch((error) => {
      console.error(
        "PHOTO LOADER ERROR:",
        error
      );
    });
})();
