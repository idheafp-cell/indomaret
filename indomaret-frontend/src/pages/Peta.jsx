import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import KpiCard from "../components/ui/KpiCard";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Pagination from "../components/ui/Pagination";
import usePaginatedRows from "../hooks/usePaginatedRows";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import { useAuth } from "../context/AuthContext";
import { getStoresMap, listStores, listRegencies, createStore } from "../api/resources";
import { formatRupiah } from "../lib/format";
import { storeDot, clusterIcon } from "../components/map/MapMarkerIcon";
import StorePopupCard from "../components/map/StorePopupCard";

const ZONE_COLORS = ["#005baa", "#d61c24", "#fdb813", "#334155", "#0ea5e9", "#7c3aed"];

// Stop warna choropleth buat batas kecamatan (tab "Wilayah Kecamatan"): hijau
// (pemasukan rendah) -> kuning -> merah (pemasukan TERTINGGI se-kota) --
// gaya "lampu lalu lintas" sesuai permintaan user (merah = paling tinggi).
const PEMASUKAN_COLOR_STOPS = [
  { stop: 0, rgb: [34, 197, 94] }, // hijau (emerald-500)
  { stop: 0.5, rgb: [253, 184, 19] }, // kuning Indomaret
  { stop: 1, rgb: [214, 28, 36] }, // merah Indomaret -- pemasukan tertinggi
];

function pemasukanColorScale(ratio) {
  const r = Math.max(0, Math.min(1, ratio || 0));
  for (let i = 0; i < PEMASUKAN_COLOR_STOPS.length - 1; i++) {
    const a = PEMASUKAN_COLOR_STOPS[i];
    const b = PEMASUKAN_COLOR_STOPS[i + 1];
    if (r >= a.stop && r <= b.stop) {
      const t = (r - a.stop) / (b.stop - a.stop || 1);
      const rgb = a.rgb.map((c, idx) => Math.round(c + (b.rgb[idx] - c) * t));
      return `rgb(${rgb.join(",")})`;
    }
  }
  const last = PEMASUKAN_COLOR_STOPS[PEMASUKAN_COLOR_STOPS.length - 1];
  return `rgb(${last.rgb.join(",")})`;
}

// String CSS gradient buat legenda -- diturunkan dari PEMASUKAN_COLOR_STOPS
// yang sama dipakai pemasukanColorScale(), supaya legendanya tidak pernah
// beda sendiri dari warna yang benar-benar dipakai di poligonnya.
const PEMASUKAN_GRADIENT_CSS = `linear-gradient(to right, ${PEMASUKAN_COLOR_STOPS.map((s) => `rgb(${s.rgb.join(",")})`).join(", ")})`;

const TABS = [
  { key: "semua", label: "Semua Gerai", icon: "location_on" },
  { key: "kecamatan", label: "Wilayah Kecamatan", icon: "workspaces" },
];

// Nama kecamatan di data gerai (input manual/hasil ekstrak alamat) kadang beda
// ejaan tipis dari nama resmi di data batas wilayah (mis. "Dukuhpakis" vs
// "Dukuh Pakis", "Gn. Anyar" vs "Gunung Anyar"). Normalisasi ini menyamakan
// keduanya sebelum dicocokkan: huruf kecil semua, singkatan "Gn." -> "Gunung",
// lalu buang semua spasi/tanda baca. Perbaikan permanen di databasenya sendiri
// ada di file fix_kecamatan_names.sql (dikirim terpisah), tapi normalisasi di
// sini tetap dipakai supaya peta tetap cocok walau SQL itu belum/tidak dijalankan.
function normalizeKecamatan(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\bgn\.?\b/g, "gunung")
    .replace(/[^a-z0-9]/g, "");
}

// react-leaflet render layer GeoJSON lewat Leaflet biasa (bukan lewat React),
// jadi popup-nya tidak bisa "dipasang" sebagai <Popup> JSX seperti Marker
// lain di file ini -- harus lewat layer.bindPopup(htmlString). Supaya isi
// popup-nya tetap konsisten (termasuk Sparkline SVG-nya), komponen
// ZonePopupContent di bawah tetap dipakai apa adanya, cuma di-render jadi
// string HTML lewat renderToStaticMarkup (bukan dipasang langsung di JSX).
function zonePopupHtml(zone, totalKota) {
  return renderToStaticMarkup(<ZonePopupContent zone={zone} totalKota={totalKota} />);
}

function emptyZonePopupHtml(namaResmi) {
  return renderToStaticMarkup(
    <div className="text-sm min-w-[190px]">
      <div className="font-bold text-[13px]">Kec. {namaResmi}</div>
      <div className="text-[11px] text-slate-500">Belum ada gerai tercatat di kecamatan ini</div>
    </div>
  );
}

function tanggalPendek(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

// Bar chart pemasukan vs pengeluaran per hari -- gaya sama persis dengan
// popup satu gerai (StorePopupCard), dipakai di popup kecamatan yang
// datanya 14 hari (dua kali lipat gerai). Label tanggal per-bar sengaja
// dihilangkan (kepadatan 14 bar berdampingan kalau dikasih teks jadi
// numpuk), diganti tooltip <title> per bar + badge rentang tanggal di judul.
function niceAxisStep(rawMax, divisions) {
  // Bikin batas atas & jarak antar-garis sumbu-y yang "bulat" (kayak
  // penggaris: 0, 5, 10, 15) -- bukan pecahan dari nilai maksimum data
  // aktual yang seringkali ganjil dan nggak enak dibaca.
  if (!isFinite(rawMax) || rawMax <= 0) return { step: 1, niceMax: divisions };
  const roughStep = rawMax / divisions;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / Math.pow(10, exponent);
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  const step = niceFraction * Math.pow(10, exponent);
  return { step, niceMax: step * divisions };
}

function ZoneTrenChart({ agg }) {
  const width = 300;
  const height = 172;
  const padX = 42; // ruang buat label angka sumbu-y di kiri, sekalian jadi
  // jarak aman tepi kiri/kanan biar titik hari pertama/terakhir nggak nempel
  // garis tepi SVG (separuh lingkarannya kepotong).
  const padTop = 14;
  const plotBottom = height - 26; // sisa di bawah ini buat garis sumbu-x + label tanggal
  const count = agg.length;
  const stepX = count > 1 ? (width - padX - 12) / (count - 1) : width - padX - 12;

  // Skala tiap garis dihitung SENDIRI-SENDIRI (pemasukan vs pengeluaran) --
  // pemasukan biasanya jauh lebih besar, kalau dipaksa 1 skala garis
  // pengeluaran bakal keliatan rata terus di bawah. Batas atasnya dibulatkan
  // lewat niceAxisStep supaya angka di sumbu-y jadi kelipatan rapi
  // (0, 5, 10, 15, ...), bukan pecahan ganjil dari nilai maksimum aktual.
  // min selalu dikunci ke 0, jadi plotBottom = 0 buat KEDUA garis.
  const DIVISIONS = 3;
  const rawMaxPemasukan = Math.max(1, ...agg.map((p) => p.pemasukan));
  const rawMaxPengeluaran = Math.max(1, ...agg.map((p) => p.pengeluaran));
  const { niceMax: maxPemasukan } = niceAxisStep(rawMaxPemasukan, DIVISIONS);
  const { niceMax: maxPengeluaran } = niceAxisStep(rawMaxPengeluaran, DIVISIONS);

  function seriesPoints(key, max) {
    return agg.map((p, i) => ({
      x: padX + i * stepX,
      y: plotBottom - (p[key] / max) * (plotBottom - padTop),
      v: p[key],
    }));
  }

  const seriesList = [
    { key: "pemasukan", color: "#145fa0", max: maxPemasukan },
    { key: "pengeluaran", color: "#bf3339", max: maxPengeluaran },
  ];

  // Label tanggal di sumbu-x: cuma sebagian (bukan ke-14 harinya) supaya
  // nggak numpuk -- hari pertama, ~tiap 1/3 jalan, dan hari terakhir.
  const tickIdx = count > 1
    ? Array.from(new Set([0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1]))
    : [0];

  // Sumbu-y kiri digambar rapi kayak penggaris: garis vertikal + tanda
  // strip pendek (tick) di tiap level, jaraknya sama rata (0, 1/3, 2/3, 1
  // dari niceMax) supaya angkanya jadi rentang bulat, misal 0/5/10/15.
  const yTicks = Array.from({ length: DIVISIONS + 1 }, (_, i) => i / DIVISIONS);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Tren pemasukan vs pengeluaran 14 hari">
      {yTicks.map((t) => {
        const y = plotBottom - t * (plotBottom - padTop);
        return (
          <g key={`grid-${t}`}>
            <line x1={padX} x2={width - 8} y1={y} y2={y} stroke="#eef2f6" strokeWidth="1" strokeDasharray="2 3" />
            <line x1={padX - 4} x2={padX} y1={y} y2={y} stroke="#94a3b8" strokeWidth="1" />
          </g>
        );
      })}

      {/* Angka sumbu-y: level "0" cukup 1 angka netral (dipakai bareng,
          karena kedua garis sama-sama mulai dari 0). Level di atasnya
          dikasih 2 angka (biru & merah) dengan jarak baris yang lega. */}
      <text x={padX - 8} y={plotBottom + 2.5} fontSize="7.5" fontWeight="700" fill="#94a3b8" textAnchor="end">
        0
      </text>
      {yTicks.filter((t) => t > 0).map((t) => {
        const y = plotBottom - t * (plotBottom - padTop);
        return (
          <g key={`label-${t}`}>
            <text x={padX - 8} y={y - 3} fontSize="7.5" fontWeight="700" fill="#145fa0" textAnchor="end">
              {formatRupiah(t * maxPemasukan, { compact: true })}
            </text>
            <text x={padX - 8} y={y + 9} fontSize="7.5" fontWeight="700" fill="#bf3339" textAnchor="end">
              {formatRupiah(t * maxPengeluaran, { compact: true })}
            </text>
          </g>
        );
      })}

      {/* Bingkai sumbu: garis kiri (sumbu-y) & garis bawah (sumbu-x). */}
      <line x1={padX} x2={padX} y1={padTop} y2={plotBottom} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={padX} x2={width - 8} y1={plotBottom} y2={plotBottom} stroke="#cbd5e1" strokeWidth="1" />

      {/* Label tanggal di sumbu-x */}
      {tickIdx.map((i) => (
        <text key={i} x={padX + i * stepX} y={plotBottom + 13} fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          {tanggalPendek(agg[i].tanggal)}
        </text>
      ))}

      {seriesList.map(({ key, color, max }) => {
        const points = seriesPoints(key, max);
        const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        return (
          <g key={key}>
            <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1.75" fill={color}>
                <title>{`${tanggalPendek(agg[i].tanggal)} — ${formatRupiah(p.v, { compact: true })}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
function ZonePopupContent({ zone, totalKota }) {
  const days = zone.list[0]?.daily_trend?.length || 0;
  const agg = Array.from({ length: days }, (_, i) => ({
    tanggal: zone.list[0]?.daily_trend?.[i]?.date,
    pemasukan: zone.list.reduce((s, g) => s + (g.daily_trend?.[i]?.income || 0), 0),
    pengeluaran: zone.list.reduce((s, g) => s + (g.daily_trend?.[i]?.expense || 0), 0),
  }));
  const kontribusi = totalKota ? (zone.totalPemasukan / totalKota) * 100 : 0;
  const topGerai = [...zone.list]
    .sort((a, b) => (b.total_income_this_month || 0) - (a.total_income_this_month || 0))
    .slice(0, 3);

  return (
    <div className="text-sm w-[340px]">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: zone.color }} />
        <span className="font-extrabold text-[13.5px] text-slate-900 flex-1 truncate">Kec. {zone.nama}</span>
        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold whitespace-nowrap">
          {zone.list.length} Gerai
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 leading-tight">Pemasukan</div>
          <div className="font-extrabold text-[13.5px] leading-tight mt-0.5 text-emerald-700">
            {formatRupiah(zone.totalPemasukan, { compact: true })}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/70 px-2.5 py-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 leading-tight">Pengeluaran</div>
          <div className="font-extrabold text-[13.5px] leading-tight mt-0.5 text-idm-red">
            {formatRupiah(zone.totalPengeluaran || 0, { compact: true })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 px-0.5">
        <span className="text-[10px] text-slate-500 font-semibold">Kontribusi pemasukan kota</span>
        <span className="text-[10px] font-bold text-idm-blue">{kontribusi.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, kontribusi)}%`, backgroundColor: zone.color }}
        />
      </div>

      {topGerai.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200">
          <div className="text-[10px] text-slate-500 font-semibold mb-1.5">Gerai omset tertinggi</div>
          <div className="flex flex-col gap-1">
            {topGerai.map((g, i) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <span
                  className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                    i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 truncate flex-1">{g.name}</span>
                <span className="text-[10px] font-bold text-idm-blue whitespace-nowrap">
                  {formatRupiah(g.total_income_this_month || 0, { compact: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {agg.length > 1 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-[10px] text-slate-500 font-semibold">Tren gabungan 14 hari terakhir</div>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold whitespace-nowrap">
              {tanggalPendek(agg[0].tanggal)} – {tanggalPendek(agg[agg.length - 1].tanggal)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-slate-500 font-semibold mb-1.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-idm-blue" /> Pemasukan
              <span className="text-idm-blue font-extrabold">
                {formatRupiah(agg.reduce((s, p) => s + p.pemasukan, 0), { compact: true })}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-idm-red" /> Pengeluaran
              <span className="text-idm-red font-extrabold">
                {formatRupiah(agg.reduce((s, p) => s + p.pengeluaran, 0), { compact: true })}
              </span>
            </span>
          </div>
          <ZoneTrenChart agg={agg} />
        </div>
      )}
    </div>
  );
}

export default function Peta() {
  const { user, isManager } = useAuth();
  const [tab, setTab] = useState("semua");
  const [gerai, setGerai] = useState([]);
  const [masterList, setMasterList] = useState([]);
  const [regencyList, setRegencyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kecamatanFilter, setKecamatanFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [kecamatanBoundaries, setKecamatanBoundaries] = useState(null);

  // Kontrol tampilan peta (panel melayang di pojok peta): filter kecamatan
  // mana yang ditampilkan & toggle tampil/sembunyikan marker gerai. State
  // ini KHUSUS buat peta -- terpisah dari pencarian/filter kecamatan tabel
  // master di bawah peta (search, kecamatanFilter) yang sudah ada duluan.
  const [showGeraiMarkers, setShowGeraiMarkers] = useState(true);
  const [excludedKecamatan, setExcludedKecamatan] = useState(() => new Set());
  const [mapControlOpen, setMapControlOpen] = useState(false);
  // Ref instance peta Leaflet (buat zoom/pan terprogram dari luar, misal
  // klik baris tabel di bawah) & ref elemen pembungkus peta (buat
  // scroll-ke-peta kalau tabelnya lagi di luar layar). Lihat handleLocateOnMap.
  const mapRef = useRef(null);
  const mapSectionRef = useRef(null);

  function emptyForm() {
    return { regency_id: "", store_code: "", name: "", address: "", district: "", latitude: "", longitude: "", phone: "" };
  }

  function load() {
    setLoading(true);
    Promise.all([getStoresMap(), listStores()])
      .then(([peta, master]) => {
        setGerai(peta);
        setMasterList(master);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    if (isManager) listRegencies().then(setRegencyList);
  }, [isManager]);

  // Batas wilayah 31 kecamatan Surabaya (GeoJSON hasil ekstrak shapefile BPS,
  // disederhanakan supaya ringan) -- file statis di public/, bukan di-bundle
  // biar tidak membengkakkan ukuran JS. Cuma manager yang punya tab
  // "kecamatan", tapi fetch-nya tetap jalan dari awal (bukan nunggu tab
  // dibuka) supaya pas tabnya dibuka datanya sudah siap.
  useEffect(() => {
    if (!isManager) return;
    fetch("/data/surabaya_kecamatan.geojson")
      .then((res) => res.json())
      .then(setKecamatanBoundaries)
      .catch(() => setKecamatanBoundaries(null));
  }, [isManager]);

  // Tab wilayah berbasis angka omset, jadi hanya berguna (dan hanya boleh)
  // untuk manager. Supervisor cukup tab "Semua Gerai".
  const visibleTabs = useMemo(() => (isManager ? TABS : TABS.filter((t) => t.key === "semua")), [isManager]);
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "semua";

  // Pencarian & filter kecamatan sekarang milik TABEL master di bawah peta,
  // bukan peta itu sendiri — peta selalu menampilkan seluruh gerai.
  const kecamatanOptions = useMemo(
    () => Array.from(new Set(masterList.map((g) => g.district).filter(Boolean))).sort(),
    [masterList]
  );

  const filteredMaster = useMemo(() => {
    return masterList.filter((g) => {
      if (kecamatanFilter && g.district !== kecamatanFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.store_code.toLowerCase().includes(q) ||
        (g.address || "").toLowerCase().includes(q)
      );
    });
  }, [masterList, search, kecamatanFilter]);

  const halamanGerai = usePaginatedRows(filteredMaster, 10);

  // Supervisor: peta langsung fokus & zoom ke gerai miliknya sendiri saat
  // halaman dibuka (bukan titik tengah rata-rata semua gerai seperti
  // manager), supaya gerainya langsung kelihatan menonjol tanpa perlu
  // cari manual di antara gerai lain.
  const ownStore = useMemo(() => {
    if (isManager || !user?.store_id) return null;
    return gerai.find((g) => g.id === user.store_id) || null;
  }, [gerai, isManager, user]);

  const center = useMemo(() => {
    if (ownStore) return [ownStore.latitude, ownStore.longitude];
    if (gerai.length === 0) return [-7.2575, 112.7521];
    const lat = gerai.reduce((s, g) => s + g.latitude, 0) / gerai.length;
    const lng = gerai.reduce((s, g) => s + g.longitude, 0) / gerai.length;
    return [lat, lng];
  }, [gerai, ownStore]);

  const initialZoom = ownStore ? 16 : 12;

  const kecamatanGroups = useMemo(() => {
    const map = new Map();
    gerai.forEach((g) => {
      const key = g.district || "Belum diketahui";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    });
    return Array.from(map.entries())
      .map(([nama, list], idx) => {
        const lat = list.reduce((s, g) => s + g.latitude, 0) / list.length;
        const lng = list.reduce((s, g) => s + g.longitude, 0) / list.length;
        const totalPemasukan = list.reduce((s, g) => s + (g.total_income_this_month || 0), 0);
        const totalPengeluaran = list.reduce((s, g) => s + (g.total_expense_this_month || 0), 0);
        return { nama, list, lat, lng, totalPemasukan, totalPengeluaran, color: ZONE_COLORS[idx % ZONE_COLORS.length] };
      })
      .sort((a, b) => b.list.length - a.list.length);
  }, [gerai]);

  // Daftar nama kecamatan buat checklist panel kontrol peta, diurutkan A-Z
  // (beda dari kecamatanGroups yang diurutkan dari jumlah gerai terbanyak).
  const mapKecamatanList = useMemo(
    () => kecamatanGroups.map((z) => z.nama).sort((a, b) => a.localeCompare(b, "id")),
    [kecamatanGroups]
  );

  function toggleKecamatanVisibility(nama) {
    setExcludedKecamatan((prev) => {
      const next = new Set(prev);
      if (next.has(nama)) next.delete(nama);
      else next.add(nama);
      return next;
    });
  }

  // Gerai & kecamatan yang BENERAN ditampilkan di peta setelah difilter
  // panel kontrol -- dipakai buat marker/boundary peta, TIDAK memengaruhi
  // tabel master/daftar kecamatan di bawah peta yang punya filter sendiri.
  const visibleGerai = useMemo(
    () => gerai.filter((g) => !excludedKecamatan.has(g.district || "Belum diketahui")),
    [gerai, excludedKecamatan]
  );
  const visibleKecamatanGroups = useMemo(
    () => kecamatanGroups.filter((z) => !excludedKecamatan.has(z.nama)),
    [kecamatanGroups, excludedKecamatan]
  );

  // Skala tertinggi buat warna dot toko per-GERAI (bukan per-kecamatan) di
  // tab "Wilayah Kecamatan" -- lihat pemakaiannya di bawah.
  const maxStoreOmset = Math.max(1, ...gerai.map((g) => g.total_income_this_month || 0));

  // Kecamatan dengan total pemasukan tertinggi -- ditampilkan di legenda
  // tab "Wilayah Kecamatan".
  const topKecamatanOmset = useMemo(
    () => kecamatanGroups.reduce((top, z) => (!top || z.totalPemasukan > top.totalPemasukan ? z : top), null),
    [kecamatanGroups]
  );
  const maxKecamatanOmset = Math.max(1, topKecamatanOmset?.totalPemasukan || 0);

  const halamanKecamatan = usePaginatedRows(kecamatanGroups, 10);

  // Lookup nama kecamatan (dari GeoJSON batas wilayah) -> zone gerai, pakai
  // nama yang sudah dinormalisasi supaya "Dukuhpakis" (data gerai) ketemu
  // dengan "Dukuh Pakis" (nama resmi di GeoJSON), dst.
  const zoneByNormalizedName = useMemo(() => {
    const map = new Map();
    kecamatanGroups.forEach((zone) => map.set(normalizeKecamatan(zone.nama), zone));
    return map;
  }, [kecamatanGroups]);

  function kecamatanBoundaryStyle(feature) {
    const zone = zoneByNormalizedName.get(normalizeKecamatan(feature.properties.kecamatan));
    if (zone) {
      // Warna batas & isi poligon sekarang choropleth -- mengikuti besar
      // kecilnya total pemasukan kecamatan itu RELATIF terhadap kecamatan
      // dengan pemasukan tertinggi se-kota (maxKecamatanOmset), bukan warna
      // acak per-kecamatan seperti sebelumnya (ZONE_COLORS bergiliran).
      // Opacity isi juga ikut naik seiring ratio-nya supaya kecamatan
      // dengan pemasukan tertinggi kelihatan paling "solid" di peta.
      const ratio = zone.totalPemasukan / maxKecamatanOmset;
      const fill = pemasukanColorScale(ratio);
      return { color: fill, weight: 2, fillColor: fill, fillOpacity: 0.18 + ratio * 0.42 };
    }
    // Kecamatan resmi yang belum ada gerainya di data kita (mis. Benowo,
    // Pakal) -- tetap digambar batasnya, tapi warna netral putus-putus
    // supaya kelihatan beda dari yang sudah ada datanya.
    return { color: "#94a3b8", weight: 1.5, dashArray: "4 4", fillColor: "#94a3b8", fillOpacity: 0.05 };
  }

  function onEachKecamatanFeature(feature, layer) {
    const namaResmi = feature.properties.kecamatan;
    const zone = zoneByNormalizedName.get(normalizeKecamatan(namaResmi));
    // totalPemasukanBulanIni dipakai buat baris "Kontribusi pemasukan kota" di
    // popup -- didefinisikan di bawah fungsi ini tapi aman dibaca di sini
    // karena isi fungsi baru benar-benar jalan nanti (saat GeoJSON dirender),
    // bukan saat fungsi ini dideklarasikan.
    layer.bindPopup(
      zone ? zonePopupHtml(zone, totalPemasukanBulanIni) : emptyZonePopupHtml(namaResmi),
      zone ? { maxWidth: 360, minWidth: 340 } : undefined
    );
  }

  // Untuk supervisor, gerai lain dikirim tanpa angka (null) — jadi total di
  // bawah ini otomatis hanya menjumlahkan gerai yang boleh dia lihat.
  const totalPemasukanBulanIni = gerai.reduce((s, g) => s + (g.total_income_this_month || 0), 0);

  const kecamatanCount = kecamatanOptions.length;
  const aktifCount = masterList.filter((g) => g.is_active).length;
  const perKecamatanRank = useMemo(() => {
    const map = new Map();
    gerai.forEach((g) => {
      const key = g.district || "Belum diketahui";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }, [gerai]);

  // Dipanggil saat baris gerai di tabel "Daftar Master Gerai Indomaret" (di
  // bawah peta) diklik -- scroll dulu ke peta (soalnya tabelnya jauh di
  // bawah, sering di luar layar), baru zoom/pan ke lokasi gerai itu. Delay
  // kecil sebelum flyTo supaya animasi scroll-nya selesai duluan; kalau
  // dibarengin, flyTo-nya keliatan patah-patah karena browser masih sibuk
  // scroll ke posisi peta.
  function handleLocateOnMap(g) {
    if (g.latitude == null || g.longitude == null) return;
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      mapRef.current?.flyTo([g.latitude, g.longitude], 17, { duration: 1.2 });
    }, 260);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await createStore({
        ...form,
        regency_id: Number(form.regency_id),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      setModalOpen(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setFormError(msg || "Gagal menyimpan data gerai.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Peta & Daftar Gerai Indomaret"
        description="Sebaran lokasi gerai di peta, dengan direktori operasional lengkap beserta pencarian & filter kecamatan di tabel bawah."
        actions={
          isManager && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-idm-blue hover:bg-idm-blue-dark text-white px-4 py-2 rounded-xl font-bold text-body-sm shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Tambah Gerai Baru
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon="storefront" accent="blue" label="Total Gerai Terdaftar" value={`${masterList.length} Gerai`} footerLeft={`${aktifCount} Aktif`} />
        <KpiCard icon="map" accent="red" label="Kecamatan Tercover" value={`${kecamatanCount} Kecamatan`} footerLeft="Sebaran wilayah" />
        <KpiCard
          icon="payments"
          accent="yellow"
          label={isManager ? "Pemasukan Bulan Ini" : "Pemasukan Gerai Anda"}
          value={formatRupiah(totalPemasukanBulanIni, { compact: true })}
          footerLeft={isManager ? "Seluruh gerai" : "Bulan berjalan"}
        />
        <KpiCard
          icon="apartment"
          accent="tricolor"
          label="Wilayah Terpadat"
          value={perKecamatanRank[0]?.nama || "-"}
          footerLeft={perKecamatanRank[0] ? `${perKecamatanRank[0].jumlah} Gerai Aktif` : ""}
        />
      </div>

      <SectionCard bodyClassName="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-2 text-sm font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                  activeTab === t.key ? "bg-idm-blue text-white shadow-sm" : "text-text-muted hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-idm-blue" /> Total Gerai Ditampilkan (
            {showGeraiMarkers ? visibleGerai.length : 0})
          </div>
        </div>

        <div ref={mapSectionRef} className="w-full h-[520px] rounded-xl overflow-hidden border border-border-subtle relative">
          {!loading && (
            <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setMapControlOpen((o) => !o)}
                className="w-10 h-10 rounded-xl bg-white shadow-md border border-border-subtle flex items-center justify-center text-idm-blue hover:bg-slate-50 transition-colors"
                title="Filter tampilan peta"
              >
                <span className="material-symbols-outlined text-[20px]">{mapControlOpen ? "close" : "tune"}</span>
              </button>

              {mapControlOpen && (
                <div className="w-64 max-h-[420px] overflow-y-auto rounded-xl bg-white shadow-lg border border-border-subtle p-3.5 flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Kontrol Peta
                  </span>

                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[13px] font-semibold text-on-surface">Tampilkan gerai Indomaret</span>
                    <input
                      type="checkbox"
                      checked={showGeraiMarkers}
                      onChange={(e) => setShowGeraiMarkers(e.target.checked)}
                      className="w-4 h-4 accent-idm-blue"
                    />
                  </label>

                  <div className="border-t border-border-subtle pt-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                        Kecamatan
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setExcludedKecamatan(new Set())}
                          className="text-idm-blue hover:underline"
                        >
                          Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcludedKecamatan(new Set(mapKecamatanList))}
                          className="text-text-muted hover:underline"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {mapKecamatanList.map((nama) => (
                        <label key={nama} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={!excludedKecamatan.has(nama)}
                            onChange={() => toggleKecamatanVisibility(nama)}
                            className="w-3.5 h-3.5 accent-idm-blue shrink-0"
                          />
                          <span className="text-[12.5px] text-on-surface-variant truncate">{nama}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-text-muted text-sm">
              Memuat peta...
            </div>
          ) : (
            <MapContainer ref={mapRef} center={center} zoom={initialZoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Clustering cuma untuk tab "Semua Gerai" -- ini yang paling
                  sering numpuk kalau banyak gerai berdekatan/zoom kecil.
                  Tab kecamatan tidak di-cluster (posisinya memang
                  representatif per wilayah), tapi ikon toko individunya
                  (storeDot) SAMA persis di kedua tab supaya gaya markernya
                  konsisten di seluruh peta ini. */}
              {activeTab === "semua" && showGeraiMarkers && (
                <MarkerClusterGroup
                  chunkedLoading
                  maxClusterRadius={60}
                  spiderfyOnMaxZoom
                  // Matikan polygon biru transparan yang muncul saat hover
                  // di atas cluster (bawaan leaflet.markercluster) -- kalau
                  // beberapa cluster berdekatan, polygon-polygon itu saling
                  // tumpang tindih dan bikin peta keliatan berantakan.
                  showCoverageOnHover={false}
                  spiderLegPolylineOptions={{ color: "#005baa", weight: 1.5, opacity: 0.6 }}
                  iconCreateFunction={(cluster) => clusterIcon(cluster.getChildCount())}
                >
                  {visibleGerai.map((g) => (
                    <Marker key={g.id} position={[g.latitude, g.longitude]} icon={storeDot("#005baa")}>
                      <Popup maxWidth={444} minWidth={404}>
                        <StorePopupCard gerai={g} />
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              )}

              {activeTab === "kecamatan" && (
                <>
                  {/* Batas kecamatan asli (bukan lagi lingkaran perkiraan) --
                      key diikat ke jumlah gerai & filter kecamatan aktif
                      supaya layer di-mount ulang kalau datanya/filter-nya
                      berubah (style/popup/filter GeoJSON di react-leaflet
                      "dibekukan" saat layer pertama dibuat, tidak auto-
                      update). Kecamatan yang di-nonaktifkan dari panel
                      kontrol peta disaring lewat prop filter, jadi batasnya
                      ikut hilang sama seperti marker gerainya. */}
                  {kecamatanBoundaries && (
                    <GeoJSON
                      key={`kec-boundaries-${gerai.length}-${excludedKecamatan.size}-${Array.from(excludedKecamatan).sort().join("|")}`}
                      data={kecamatanBoundaries}
                      style={kecamatanBoundaryStyle}
                      onEachFeature={onEachKecamatanFeature}
                      filter={(feature) => {
                        const zone = zoneByNormalizedName.get(normalizeKecamatan(feature.properties.kecamatan));
                        return !zone || !excludedKecamatan.has(zone.nama);
                      }}
                    />
                  )}
                  {/* Warna dot toko di sini gradasi mengikuti omset GERAI itu
                      sendiri (hijau = rendah, merah = tertinggi, sama skala
                      warna dengan batas kecamatan di atas) -- BUKAN warna
                      identitas kecamatan (zone.color) lagi. Ikut toggle
                      "tampilkan gerai" & filter kecamatan dari panel kontrol
                      peta (visibleKecamatanGroups). */}
                  {showGeraiMarkers &&
                    visibleKecamatanGroups.map((zone) =>
                      zone.list.map((g) => {
                        const color = pemasukanColorScale((g.total_income_this_month || 0) / maxStoreOmset);
                        return (
                          <Marker key={g.id} position={[g.latitude, g.longitude]} icon={storeDot(color)}>
                            <Popup maxWidth={444} minWidth={404}>
                              <StorePopupCard gerai={g} />
                            </Popup>
                          </Marker>
                        );
                      })
                    )}
                </>
              )}

            </MapContainer>
          )}
        </div>

        {activeTab === "kecamatan" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold text-text-muted">Pemasukan rendah</span>
              <span className="h-2.5 w-32 rounded-full shadow-inner" style={{ background: PEMASUKAN_GRADIENT_CSS }} />
              <span className="text-[11px] font-semibold text-text-muted">Pemasukan tertinggi</span>
              <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full border border-dashed border-slate-400" /> Belum ada gerai
              </span>
            </div>
            <span className="text-[11px] text-text-muted">
              Warna batas wilayah ikut total pemasukan kecamatan, warna titik toko ikut omset gerainya
              masing-masing. Kecamatan tertinggi bulan ini:{" "}
              <strong className="text-on-surface">{topKecamatanOmset?.nama || "-"}</strong> (
              {formatRupiah(maxKecamatanOmset, { compact: true })})
            </span>
          </div>
        )}

      </SectionCard>

      {isManager && activeTab === "kecamatan" && (
        <SectionCard title="Daftar Kecamatan" description="Agregasi gerai & pemasukan bulan berjalan per kecamatan">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                  <th className="py-2.5 px-3">Kecamatan</th>
                  <th className="py-2.5 px-3">Total Gerai</th>
                  <th className="py-2.5 px-3 text-right">Pemasukan Bln Ini</th>
                  <th className="py-2.5 px-3 text-right">Kontribusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-body-sm">
                {halamanKecamatan.pageRows.map((zone) => (
                  <tr key={zone.nama} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-[13px] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
                      {zone.nama}
                    </td>
                    <td className="py-3 px-3 text-[13px]">{zone.list.length} Gerai</td>
                    <td className="py-3 px-3 text-right font-bold text-idm-blue text-[13px]">
                      {formatRupiah(zone.totalPemasukan, { compact: true })}
                    </td>
                    <td className="py-3 px-3 text-right text-[13px]">
                      {totalPemasukanBulanIni ? ((zone.totalPemasukan / totalPemasukanBulanIni) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={halamanKecamatan.page}
            lastPage={halamanKecamatan.lastPage}
            from={halamanKecamatan.from}
            to={halamanKecamatan.to}
            total={halamanKecamatan.total}
            onChange={halamanKecamatan.setPage}
            label="kecamatan"
          />
        </SectionCard>
      )}

      {/* Pencarian & filter kecamatan dipindah ke sini (dulu di kartu daftar
          gerai yang ada di atas peta, kartu itu sudah dihapus). */}
      <SectionCard
        title="Daftar Master Gerai Indomaret"
        description={
          (search || kecamatanFilter
            ? `Menampilkan ${filteredMaster.length} dari ${masterList.length} gerai`
            : "Data induk seluruh titik gerai untuk keperluan operasional") + " — klik baris untuk lihat lokasinya di peta"
        }
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode / nama / alamat..."
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-idm-blue outline-none w-full sm:w-60"
              />
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
                filter_list
              </span>
              <select
                value={kecamatanFilter}
                onChange={(e) => setKecamatanFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-idm-blue outline-none w-full sm:w-52 appearance-none"
              >
                <option value="">Semua Kecamatan</option>
                {kecamatanOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                <th className="py-2.5 px-3">Kode & Nama</th>
                <th className="py-2.5 px-3">Kecamatan</th>
                <th className="py-2.5 px-3">Telepon</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-body-sm">
              {halamanGerai.pageRows.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => handleLocateOnMap(g)}
                  title="Klik untuk lihat lokasinya di peta"
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 font-bold text-[13px] text-on-surface">
                      <span className="material-symbols-outlined text-[14px] text-idm-blue">location_on</span>
                      {g.name}
                    </div>
                    <span className="text-[11px] text-idm-blue font-mono">{g.store_code}</span>
                    <div className="text-[11px] text-text-muted truncate max-w-xs">{g.address}</div>
                  </td>
                  <td className="py-3 px-3 text-[13px]">{g.district || "-"}</td>
                  <td className="py-3 px-3 text-[13px] font-mono">{g.phone || "-"}</td>
                  <td className="py-3 px-3">
                    <Badge variant={g.is_active ? "emerald" : "slate"}>{g.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {/* Supervisor hanya boleh membuka detail gerainya sendiri
                        (backend juga menolak lewat show()). stopPropagation
                        di sini supaya klik link ini tidak IKUT memicu
                        handleLocateOnMap di <tr> (mubazir, wong halamannya
                        langsung pindah ke /gerai/:id). */}
                    {g.can_view_detail === false ? (
                      <span className="text-[12px] text-text-muted">—</span>
                    ) : (
                      <Link
                        to={`/gerai/${g.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-idm-blue font-bold text-[12px] hover:underline"
                      >
                        Lihat Detail <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredMaster.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted text-sm">
                    {masterList.length === 0
                      ? "Belum ada gerai yang terdaftar."
                      : "Tidak ada gerai yang cocok dengan pencarian."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={halamanGerai.page}
          lastPage={halamanGerai.lastPage}
          from={halamanGerai.from}
          to={halamanGerai.to}
          total={halamanGerai.total}
          onChange={halamanGerai.setPage}
          label="gerai"
        />
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Gerai Baru"
        description="Daftarkan titik Indomaret baru dalam kabupaten"
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100">
              Batal
            </button>
            <button form="form-gerai" type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60">
              {saving ? "Menyimpan..." : "Simpan Gerai"}
            </button>
          </div>
        }
      >
        <form id="form-gerai" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Kabupaten" required>
              <InputShell icon="location_city">
                <select required className={inputClass} value={form.regency_id} onChange={(e) => setForm((f) => ({ ...f, regency_id: e.target.value }))}>
                  <option value="">Pilih kabupaten...</option>
                  {regencyList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </InputShell>
            </Field>
            <Field label="Kode Toko" required>
              <InputShell icon="qr_code">
                <input required className={inputClass} placeholder="IDM-001" value={form.store_code} onChange={(e) => setForm((f) => ({ ...f, store_code: e.target.value }))} />
              </InputShell>
            </Field>
          </div>
          <Field label="Nama Gerai" required>
            <InputShell icon="storefront">
              <input required className={inputClass} placeholder="Indomaret Contoh" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </InputShell>
          </Field>
          <Field label="Alamat" required>
            <InputShell icon="home_pin">
              <input required className={inputClass} placeholder="Jl. Contoh No. 1" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </InputShell>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Kecamatan">
              <InputShell icon="map">
                <input className={inputClass} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </InputShell>
            </Field>
            <Field label="Latitude" required>
              <InputShell icon="my_location">
                <input required type="number" step="any" className={inputClass} placeholder="-7.4478" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} />
              </InputShell>
            </Field>
            <Field label="Longitude" required>
              <InputShell icon="my_location">
                <input required type="number" step="any" className={inputClass} placeholder="112.7183" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} />
              </InputShell>
            </Field>
          </div>
          <Field label="No. Telepon">
            <InputShell icon="call">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </InputShell>
          </Field>
          {formError && (
            <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {formError}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
