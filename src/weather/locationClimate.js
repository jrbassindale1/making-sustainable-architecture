const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_TIMEZONE_HOURS = -12;
const MAX_TIMEZONE_HOURS = 14;

function clamp(value, min, max) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safe));
}

const deg2rad = (deg) => (deg * Math.PI) / 180;

export function clampLatitude(latitude) {
  return clamp(latitude, MIN_LATITUDE, MAX_LATITUDE);
}

export function normalizeLongitude(longitude) {
  if (!Number.isFinite(longitude)) return 0;
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

export function clampTimezoneHours(timezoneHours) {
  return clamp(Math.round(timezoneHours), MIN_TIMEZONE_HOURS, MAX_TIMEZONE_HOURS);
}

export function estimateTimezoneFromLongitude(longitude) {
  return clampTimezoneHours(normalizeLongitude(longitude) / 15);
}

export function inferClimatologyFromLocation(location = {}) {
  const latitude = clampLatitude(location.latitude ?? 0);
  const longitude = normalizeLongitude(location.longitude ?? 0);
  const elevationM = Math.max(0, Number.isFinite(location.elevationM) ? location.elevationM : 0);
  const timezoneHours = Number.isFinite(location.tzHours)
    ? clampTimezoneHours(location.tzHours)
    : estimateTimezoneFromLongitude(longitude);

  const absLat = Math.abs(latitude);
  const latNormalized = absLat / 90;
  // Adds modest variation by longitude so places on the same latitude are not identical.
  const continentality = Math.abs(Math.sin(deg2rad(longitude * 1.2 + latitude * 0.35)));
  const maritime = 1 - continentality;

  // Keep tropical/subtropical highland climates from being unrealistically cold.
  const annualMeanSeaLevel = 27 - absLat * 0.08 - absLat * absLat * 0.0042;
  const elevationLapseRate = 0.0018 + latNormalized * 0.0044;
  const elevationCooling = elevationM * elevationLapseRate;
  const annualMean = annualMeanSeaLevel - elevationCooling;

  const seasonalRange = clamp(2 + absLat * (0.1 + continentality * 0.08), 2, 22);
  const diurnalRange = clamp(
    4.5 + absLat * 0.03 + continentality * 2 + (elevationM / 1000) * 0.8,
    3,
    16,
  );
  const summer = annualMean + seasonalRange / 2;
  const winter = annualMean - seasonalRange / 2;

  const meanWindMS = clamp(1.2 + absLat * 0.025 + maritime * 1.4 + continentality * 0.4, 0.8, 10);
  const cloudCoverTenths = clamp(2.8 + maritime * 3.4 + absLat * 0.03, 1, 9.5);
  const humidityPct = clamp(40 + maritime * 35 + cloudCoverTenths * 2, 20, 97);

  return {
    latitude,
    longitude,
    tzHours: timezoneHours,
    elevationM,
    temps: {
      summer: Number(summer.toFixed(2)),
      winter: Number(winter.toFixed(2)),
    },
    diurnalRange: Number(diurnalRange.toFixed(2)),
    meanWindMS: Number(meanWindMS.toFixed(2)),
    cloudCoverTenths: Number(cloudCoverTenths.toFixed(1)),
    humidityPct: Number(humidityPct.toFixed(1)),
  };
}

export function buildManualProfileFromLocation(location = {}, manual = {}) {
  const base = inferClimatologyFromLocation(location);
  const summer = Number.isFinite(manual.summerTempC) ? manual.summerTempC : base.temps.summer;
  const winter = Number.isFinite(manual.winterTempC) ? manual.winterTempC : base.temps.winter;
  return {
    ...base,
    temps: {
      summer: Math.max(summer, winter + 0.5),
      winter: Math.min(winter, summer - 0.5),
    },
    diurnalRange: clamp(manual.diurnalRangeC, 2, 20),
    meanWindMS: clamp(manual.meanWindMS, 0.1, 15),
    cloudCoverTenths: clamp(manual.cloudCoverTenths, 0, 10),
    humidityPct: clamp(manual.humidityPct, 0, 100),
  };
}

export const DEFAULT_MANUAL_WEATHER = {
  summerTempC: 26,
  winterTempC: 5,
  diurnalRangeC: 8,
  meanWindMS: 2.2,
  cloudCoverTenths: 4,
  humidityPct: 60,
};
