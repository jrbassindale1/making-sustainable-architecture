const MISSING_VALUES = new Set([9999, 99999, 999999, -9999]);
const EPW_HEADER_LINES = 8;
const HOURS_PER_YEAR = 8760;

/**
 * @typedef {Object} WeatherHour
 * @property {string} ts
 * @property {number} tDryC
 * @property {number} ghiWhm2
 * @property {number} dniWhm2
 * @property {number} dhiWhm2
 * @property {number=} windMS
 * @property {number=} totalSkyCover - Total sky cover in tenths (0-10)
 * @property {number=} opaqueSkyCover - Opaque sky cover in tenths (0-10)
 */

/**
 * @typedef {Object} WeatherDataset
 * @property {{name: string, lat: number, lon: number, elevationM: number, tzHours: number}} meta
 * @property {WeatherHour[]} hours
 */

function parseNumeric(value) {
  const parsed = Number.parseFloat((value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissing(value) {
  return value == null || MISSING_VALUES.has(value);
}

function sanitizeRadiation(value) {
  if (isMissing(value)) return 0;
  return Math.max(0, value);
}

function sanitizeWind(value) {
  if (isMissing(value)) return undefined;
  return Math.max(0, value);
}

function sanitizeSkyCover(value) {
  if (isMissing(value)) return undefined;
  // Sky cover is in tenths (0-10)
  return Math.max(0, Math.min(10, value));
}

function fillMissingTemperatures(values) {
  const out = [...values];
  const firstValid = out.findIndex((v) => Number.isFinite(v));

  if (firstValid === -1) {
    return out.map(() => 10);
  }

  for (let i = 0; i < firstValid; i++) {
    out[i] = out[firstValid];
  }

  let lastValid = firstValid;
  for (let i = firstValid + 1; i < out.length; i++) {
    if (!Number.isFinite(out[i])) continue;
    const gap = i - lastValid;
    if (gap > 1) {
      const start = out[lastValid];
      const end = out[i];
      for (let j = 1; j < gap; j++) {
        out[lastValid + j] = start + ((end - start) * j) / gap;
      }
    }
    lastValid = i;
  }

  for (let i = lastValid + 1; i < out.length; i++) {
    out[i] = out[lastValid];
  }

  return out;
}

/**
 * Parse EPW text into weather rows.
 * @param {string} epwText
 * @returns {WeatherDataset}
 */
export function parseEpwText(epwText) {
  const lines = epwText.replace(/\r/g, "").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length <= EPW_HEADER_LINES) {
    throw new Error("EPW parse failed: file has insufficient lines.");
  }

  const locationLine = (lines[0] ?? "").split(",");
  const city = (locationLine[1] ?? "Unknown").trim();
  const country = (locationLine[3] ?? "").trim();
  const source = (locationLine[4] ?? "EPW").trim();
  const lat = parseNumeric(locationLine[6]);
  const lon = parseNumeric(locationLine[7]);
  const tzHours = parseNumeric(locationLine[8]);
  const elevationM = parseNumeric(locationLine[9]);

  if (![lat, lon, tzHours, elevationM].every(Number.isFinite)) {
    throw new Error("EPW parse failed: LOCATION metadata is invalid.");
  }

  const rows = lines.slice(EPW_HEADER_LINES);
  const hours = [];
  const dryBulb = [];

  rows.forEach((row) => {
    const fields = row.split(",");
    if (fields.length < 22) return;

    const month = Number.parseInt(fields[1], 10);
    const day = Number.parseInt(fields[2], 10);
    const epwHour = Number.parseInt(fields[3], 10);
    const hour = ((epwHour % 24) + 24) % 24;

    if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(hour)) return;

    const tDryRaw = parseNumeric(fields[6]);
    const ghiRaw = parseNumeric(fields[13]);
    const dniRaw = parseNumeric(fields[14]);
    const dhiRaw = parseNumeric(fields[15]);
    const windRaw = parseNumeric(fields[21]);
    const totalSkyCoverRaw = parseNumeric(fields[22]); // Total sky cover (tenths)
    const opaqueSkyCoverRaw = parseNumeric(fields[23]); // Opaque sky cover (tenths)

    dryBulb.push(isMissing(tDryRaw) ? null : tDryRaw);

    hours.push({
      ts: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:00`,
      tDryC: 0,
      ghiWhm2: sanitizeRadiation(ghiRaw),
      dniWhm2: sanitizeRadiation(dniRaw),
      dhiWhm2: sanitizeRadiation(dhiRaw),
      windMS: sanitizeWind(windRaw),
      totalSkyCover: sanitizeSkyCover(totalSkyCoverRaw),
      opaqueSkyCover: sanitizeSkyCover(opaqueSkyCoverRaw),
    });
  });

  if (hours.length !== HOURS_PER_YEAR) {
    throw new Error(`EPW parse failed: expected ${HOURS_PER_YEAR} rows, got ${hours.length}.`);
  }

  const filledDryBulb = fillMissingTemperatures(dryBulb);
  filledDryBulb.forEach((value, idx) => {
    hours[idx].tDryC = value;
  });

  return {
    meta: {
      name: `${city} (${source})${country ? `, ${country}` : ""}`,
      lat,
      lon,
      elevationM,
      tzHours,
    },
    hours,
  };
}

const datasetPromiseCache = new Map();

/**
 * Load and parse an EPW file once, then reuse it.
 * @param {string} url
 * @returns {Promise<WeatherDataset>}
 */
export function loadEpwDataset(url) {
  if (datasetPromiseCache.has(url)) return datasetPromiseCache.get(url);

  const pending = fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch EPW (${res.status} ${res.statusText}).`);
      }
      return res.text();
    })
    .then(parseEpwText)
    .then((dataset) => {
      if (dataset.hours.length !== HOURS_PER_YEAR) {
        throw new Error(`EPW validation failed: expected ${HOURS_PER_YEAR} rows.`);
      }
      return dataset;
    });

  datasetPromiseCache.set(url, pending);
  return pending;
}
