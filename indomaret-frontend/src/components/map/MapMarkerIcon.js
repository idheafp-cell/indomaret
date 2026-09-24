import L from "leaflet";

// Ikon marker kustom warna Indomaret (biru) tanpa bergantung pada asset
// default Leaflet (yang sering rusak ketika dibundel Vite).
export function coloredPin(color = "#005baa") {
  const svg = `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.3-6.7-15-15-15z" fill="${color}"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
}

export const idmBluePin = coloredPin("#005baa");
export const idmRedPin = coloredPin("#d61c24");
export const idmYellowPin = coloredPin("#fdb813");

// Ikon "dot" gerai -- dipakai SERAGAM di ketiga tab peta `/peta` (Semua
// Gerai, Wilayah Kecamatan, Heatmap Omset) supaya gaya markernya konsisten
// di seluruh peta, bukan campuran pin (`coloredPin`, dipakai lewat
// `<Marker>`) di 1 tab dan lingkaran polos (`<CircleMarker>`) di 2 tab
// lainnya seperti sebelumnya. Bentuknya lingkaran solid + cincin putih +
// halo tipis warna sendiri, senada dengan gaya badge cluster (`clusterIcon`
// di bawah) supaya "1 keluarga visual" dengan cluster-nya sendiri. Dipakai
// lewat `<Marker icon={storeDot(warna)}>`, BUKAN `coloredPin` (teardrop) --
// teardrop dipertahankan cuma buat `coloredPin` sendiri (dipakai di halaman
// detail gerai, bukan di `/peta`).
export function storeDot(color = "#005baa", size = 18) {
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};
        border:2.25px solid #ffffff;
        box-shadow:0 1px 3px rgba(15,23,42,0.45), 0 0 0 3px ${color}2e;
      "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
  });
}

// Ikon cluster kustom (dipakai lewat prop iconCreateFunction di
// MarkerClusterGroup) supaya warnanya konsisten dengan palet Indomaret,
// bukan hijau/kuning/oranye bawaan leaflet.markercluster.
//
// Sengaja dibuat 1 lingkaran solid + cincin halo lewat box-shadow (bukan 2
// <div> bersarang seperti versi awal) — versi bersarang keliatan seperti
// noda/blur yang menyatu dengan warna tile peta di belakangnya, apalagi
// kalau beberapa cluster berdekatan. Border putih + drop shadow tegas bikin
// badge-nya selalu kontras & jelas tepinya di atas peta warna apa pun.
export function clusterIcon(count) {
  const tier = count < 10 ? 0 : count < 25 ? 1 : count < 50 ? 2 : 3;
  const size = [34, 42, 50, 58][tier];
  const fontSize = [12, 13, 14, 15][tier];
  const label = count > 999 ? "999+" : String(count);
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:#005baa;color:#fff;font-weight:800;font-size:${fontSize}px;
        display:flex;align-items:center;justify-content:center;
        line-height:1;font-family:'Plus Jakarta Sans',system-ui,sans-serif;
        border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(15,23,42,0.35), 0 0 0 4px rgba(0,91,170,0.22);
      ">${label}</div>`,
    className: "",
    iconSize: [size, size],
  });
}
