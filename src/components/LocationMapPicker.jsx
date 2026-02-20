import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function clampLatitude(latitude) {
  if (!Number.isFinite(latitude)) return 0;
  return Math.min(90, Math.max(-90, latitude));
}

function normalizeLongitude(longitude) {
  if (!Number.isFinite(longitude)) return 0;
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

export function LocationMapPicker({ latitude, longitude, onSelect, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const safeLat = useMemo(() => clampLatitude(latitude), [latitude]);
  const safeLon = useMemo(() => normalizeLongitude(longitude), [longitude]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.circleMarker([safeLat, safeLon], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#e11d48",
      fillOpacity: 0.95,
    }).addTo(map);

    map.setView([safeLat, safeLon], Math.abs(safeLat) > 60 ? 3 : 4);
    map.on("click", (event) => {
      const nextLat = clampLatitude(event.latlng.lat);
      const nextLon = normalizeLongitude(event.latlng.lng);
      onSelectRef.current?.({ latitude: nextLat, longitude: nextLon });
    });

    mapRef.current = map;
    markerRef.current = marker;
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [safeLat, safeLon]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLatLng([safeLat, safeLon]);
    const currentCenter = map.getCenter();
    const distanceToNext = currentCenter.distanceTo([safeLat, safeLon]);
    if (distanceToNext > 500000) {
      map.panTo([safeLat, safeLon], { animate: true, duration: 0.35 });
    }
  }, [safeLat, safeLon]);

  return (
    <div
      ref={containerRef}
      className={`h-56 w-full overflow-hidden rounded-md border border-slate-200 ${className}`}
      aria-label="Interactive world map location picker"
    />
  );
}
