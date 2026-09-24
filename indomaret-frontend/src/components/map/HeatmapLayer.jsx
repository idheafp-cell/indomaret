import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
// Plugin `leaflet.heat` BUKAN komponen React -- dia nempel langsung ke objek
// global `L` (referensi `L.Layer`/`L.Class` dkk di source-nya, bukan
// `require("leaflet")`). Ini aman dipakai lewat import ES module biasa
// (tanpa perlu `window.L = L` manual) karena package `leaflet` sendiri di
// baris terakhir source-nya SELALU melakukan `window.L = exports` begitu
// modulnya dievaluasi -- dan `import L from "leaflet"` di atas ini membuat
// modul itu (kalau belum) dievaluasi duluan sebelum `import "leaflet.heat"`
// di bawahnya, jadi `window.L` sudah pasti ada saat leaflet.heat nempelkan
// `L.heatLayer`.
import "leaflet.heat";

/**
 * Wrapper tipis untuk leaflet.heat -- react-leaflet tidak punya komponen heat
 * layer bawaan, jadi layer-nya dipasang imperatif ke instance peta Leaflet
 * lewat useMap() (pola yang sama dipakai plugin Leaflet non-React lainnya).
 *
 * `points`: array `[lat, lng, intensitas]`, intensitas 0..1 (relatif
 * terhadap gerai dengan omset tertinggi -- lihat pemakaiannya di Peta.jsx).
 */
export default function HeatmapLayer({ points, gradient, radius = 34, blur = 24, maxZoom = 16 }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return undefined;
    const layer = L.heatLayer(points, {
      radius,
      blur,
      maxZoom,
      minOpacity: 0.25,
      gradient,
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, gradient, radius, blur, maxZoom]);

  return null;
}
