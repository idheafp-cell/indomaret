import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import Pagination from "../components/ui/Pagination";
import usePaginatedRows from "../hooks/usePaginatedRows";
import KpiCard from "../components/ui/KpiCard";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import ProgressBar from "../components/ui/ProgressBar";
import DualBarChart from "../components/charts/DualBarChart";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import EmployeeInputToggle from "../components/ui/EmployeeInputToggle";
import { coloredPin } from "../components/map/MapMarkerIcon";
import { useAuth } from "../context/AuthContext";
import {
  getStore,
  updateStore,
  getDashboard,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listExpenses,
  createExpense,
  listIncomes,
  createIncome,
  listItemCategories,
} from "../api/resources";
import { formatRupiah, formatNumber, formatDate, todayISO } from "../lib/format";

const CATEGORY_COLORS = ["#005baa", "#d61c24", "#fdb813", "#475569", "#0ea5e9", "#be123c", "#ca8a04"];

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function GeraiDetail() {
  const { id } = useParams();

  useEffect(() => setPhotoError(false), [id]);
  const navigate = useNavigate();
  const { user, isManager, isSupervisor } = useAuth();

  const [store, setStore] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [dash, setDash] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [recentIn, setRecentIn] = useState([]);
  const [recentOut, setRecentOut] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [inModalOpen, setInModalOpen] = useState(false);
  const [outModalOpen, setOutModalOpen] = useState(false);

  const canManageStore = isManager;
  const isOwnStore = isSupervisor && Number(user?.store_id) === Number(id);
  const canRecordTransaction = isManager || isOwnStore;
  // Manager (akun pusat) boleh kelola karyawan di gerai mana pun; supervisor
  // hanya di gerainya sendiri.
  const canManageEmployees = isManager || isOwnStore;

  function loadAll() {
    setLoading(true);
    setError("");
    const params = { store_id: id, start_date: firstDayOfMonth(), end_date: todayISO() };
    Promise.all([
      getStore(id),
      getDashboard(params),
      listEmployees({ store_id: id }),
      listIncomes({ store_id: id, per_page: 5 }),
      listExpenses({ store_id: id, per_page: 5 }),
    ])
      .then(([s, d, emp, inc, out]) => {
        setStore(s);
        setDash(d);
        setEmployees(emp);
        setRecentIn(inc.data || []);
        setRecentOut(out.data || []);
      })
      .catch(() => setError("Gagal memuat detail gerai. Periksa koneksi backend atau hak akses Anda."))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [id]);
  useEffect(() => {
    listItemCategories({ active_only: true }).then(setCategoryList).catch(() => {});
  }, []);

  async function handleToggleEmployeeActive(emp) {
    try {
      await updateEmployee(emp.id, { is_active: !emp.is_active });
      loadAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal mengubah status pegawai.");
    }
  }

  async function handleDeleteEmployee(emp) {
    const ok = window.confirm(
      `Hapus pegawai "${emp.name}"? Riwayat transaksi yang pernah dicatat pegawai ini akan tetap tersimpan tapi kehilangan keterangan nama pegawainya. Kalau pegawai ini hanya berhenti sementara, lebih baik nonaktifkan saja. Tindakan hapus tidak bisa dibatalkan.`
    );
    if (!ok) return;
    try {
      await deleteEmployee(emp.id);
      loadAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Gagal menghapus pegawai.");
    }
  }

  const chartData = useMemo(() => {
    if (!dash) return [];
    const map = new Map();
    dash.daily_income_trend?.forEach((d) => map.set(d.date, { label: d.date, a: d.total, b: 0 }));
    dash.daily_expense_trend?.forEach((d) => {
      const existing = map.get(d.date) || { label: d.date, a: 0, b: 0 };
      existing.b = d.total;
      map.set(d.date, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [dash]);

  const ringkasan = dash?.summary || { total_income: 0, total_expense: 0, estimated_profit: 0 };
  const marginPct = ringkasan.total_income ? (ringkasan.estimated_profit / ringkasan.total_income) * 100 : 0;
  const rasioBeban = ringkasan.total_income ? (ringkasan.total_expense / ringkasan.total_income) * 100 : 0;
  const pegawaiAktif = employees.filter((e) => e.is_active).length;
  const halamanPegawai = usePaginatedRows(employees, 8);

  if (loading && !store) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-3xl mr-2">progress_activity</span>
        Memuat detail gerai...
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center">
        <span className="material-symbols-outlined text-idm-red text-4xl mb-2">error</span>
        <p className="text-idm-red font-semibold">{error || "Gerai tidak ditemukan."}</p>
        <Link to="/peta" className="inline-block mt-4 text-idm-blue font-bold hover:underline">
          &larr; Kembali ke Peta & Daftar Gerai
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={["Peta & Daftar Gerai", store.name]}
        title={store.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold bg-slate-100 text-idm-blue border border-idm-blue/20">
              {store.store_code}
            </span>
            {store.district && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-text-muted">
                Kec. {store.district}
              </span>
            )}
            <Badge variant={store.is_active ? "emerald" : "slate"}>{store.is_active ? "Aktif" : "Nonaktif"}</Badge>
          </span>
        }
        actions={
          <>
            <button
              onClick={() => navigate("/peta")}
              className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-text-muted hover:text-on-surface hover:bg-slate-50 transition-colors font-bold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span> Kembali
            </button>
            {canManageStore && (
              <button
                onClick={() => setEditOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-idm-blue text-white hover:bg-idm-blue-dark transition-colors font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">edit</span> Edit Gerai
              </button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          icon="payments"
          accent="blue"
          label="Total Pemasukan (bulan ini)"
          value={formatRupiah(ringkasan.total_income, { compact: true })}
          footerLeft={formatRupiah(ringkasan.total_income)}
        />
        <KpiCard
          icon="outbox"
          accent="red"
          label="Beban Barang Keluar"
          value={formatRupiah(ringkasan.total_expense, { compact: true })}
          valueClassName="text-idm-red"
          footerLeft={`Rasio beban: ${rasioBeban.toFixed(1)}%`}
        />
        <KpiCard
          icon="account_balance_wallet"
          accent="yellow"
          label="Margin Operasional"
          value={formatRupiah(ringkasan.estimated_profit, { compact: true })}
          footerLeft={`Net margin: ${marginPct.toFixed(1)}%`}
        />
        <KpiCard
          icon="badge"
          accent="blue"
          label="Total Pegawai Aktif"
          value={`${pegawaiAktif} Orang`}
          footerLeft={`${employees.length} total terdaftar`}
        />
      </div>

      {/* Trend chart */}
      <SectionCard
        title="Tren Harian: Pemasukan vs Beban Barang Keluar"
        description={
          <>
            Statistik bulan berjalan untuk <span className="font-mono font-semibold text-idm-blue">{store.store_code}</span> —
            data diambil langsung dari transaksi tercatat (bukan simulasi).
          </>
        }
      >
        {chartData.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">Belum ada transaksi pada periode ini.</p>
        ) : (
          <>
            <DualBarChart data={chartData} />
            <div className="flex items-center gap-4 pt-3 text-xs font-semibold text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-idm-blue" /> Pemasukan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-idm-red" /> Barang Keluar
              </span>
            </div>
          </>
        )}

        {dash?.expense_by_category?.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-5 mt-2 border-t border-border-subtle">
            {dash.expense_by_category.slice(0, 6).map((k, i) => {
              const pct = ringkasan.total_expense ? (k.total_value / ringkasan.total_expense) * 100 : 0;
              return (
                <div key={k.category} className="p-3 rounded-xl bg-slate-50/70 border border-border-subtle">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-on-surface truncate">{k.category}</span>
                    <span className="text-[11px] font-mono text-text-muted">{pct.toFixed(0)}%</span>
                  </div>
                  <ProgressBar percent={pct} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Profile + Employees */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 flex flex-col gap-5">
          <SectionCard className="!p-0 overflow-hidden">
            <div className="h-1.5 w-full flex shrink-0">
              <div className="h-full w-1/3 bg-idm-blue" />
              <div className="h-full w-1/3 bg-idm-red" />
              <div className="h-full w-1/3 bg-idm-yellow" />
            </div>
            {store.photo_url && !photoError && (
              <img
                src={store.photo_url}
                alt={`Foto ${store.name}`}
                className="w-full h-40 object-cover bg-slate-100"
                loading="lazy"
                onError={() => setPhotoError(true)}
              />
            )}
            <div className="p-5 flex items-center gap-3 bg-slate-50/70 border-b border-border-subtle">
              <div className="w-11 h-11 rounded-xl bg-white shadow-xs flex items-center justify-center text-idm-blue">
                <span className="material-symbols-outlined text-2xl">storefront</span>
              </div>
              <div>
                <p className="font-extrabold text-on-surface leading-tight">Profil Gerai</p>
                <p className="text-[11px] text-text-muted font-mono">ID: {store.id}</p>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2.5">
              <MetaRow label="Kode Gerai" value={<span className="font-mono font-bold text-idm-blue">{store.store_code}</span>} />
              <MetaRow label="Nama Gerai" value={<span className="font-bold text-right">{store.name}</span>} />
              <MetaRow label="Kabupaten" value={store.regency?.name || "-"} />
              <MetaRow label="Kecamatan" value={store.district || "-"} />
              <MetaRow label="Alamat Lengkap" value={<span className="text-right text-[13px]">{store.address}</span>} align="start" />
              <MetaRow label="No. Telepon" value={store.phone || "-"} />
              <MetaRow
                label="Koordinat"
                value={
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-idm-blue">{Number(store.latitude).toFixed(6)}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-idm-blue">{Number(store.longitude).toFixed(6)}</span>
                  </span>
                }
              />
            </div>

            <div className="px-5 pb-5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-text-muted font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-idm-red">pin_drop</span> Lokasi Peta
                </span>
                <a
                  href={`https://maps.google.com/?q=${store.latitude},${store.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-idm-blue hover:underline flex items-center gap-0.5"
                >
                  Buka di Google Maps <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
              <div className="w-full h-44 rounded-xl overflow-hidden border border-border-subtle">
                <MapContainer
                  center={[Number(store.latitude), Number(store.longitude)]}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[Number(store.latitude), Number(store.longitude)]} icon={coloredPin("#005baa")}>
                    <Popup>{store.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>

            {store.supervisors?.length > 0 && (
              <div className="mx-5 mb-5 p-3.5 rounded-xl bg-slate-50/70 border border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-idm-blue text-white font-bold flex items-center justify-center text-xs">
                    {store.supervisors[0].name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted">PIC / Supervisor</p>
                    <p className="text-[13px] font-bold text-on-surface leading-tight">{store.supervisors[0].name}</p>
                    <p className="text-[11px] text-text-muted font-mono">{store.supervisors[0].email}</p>
                  </div>
                </div>
                <Badge variant="blue">Verifikator</Badge>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-5">
          <SectionCard
            className="!p-0 overflow-hidden flex-1"
            title={
              <span className="flex items-center gap-2 px-5 pt-5">
                <span className="material-symbols-outlined text-idm-blue text-xl">badge</span>
                Daftar Pegawai Gerai
                <Badge variant="blue">{employees.length} Staff</Badge>
              </span>
            }
            actions={
              canManageEmployees && (
                <button
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmpModalOpen(true);
                  }}
                  className="mr-5 mt-5 h-9 px-3.5 rounded-lg bg-idm-blue text-white hover:bg-idm-blue-dark transition-colors font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">person_add</span> Tambah Pegawai
                </button>
              )
            }
          >
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                    <th className="py-2.5 px-3">Nama Pegawai</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Terdaftar</th>
                    {canManageEmployees && <th className="py-2.5 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-body-sm">
                  {halamanPegawai.pageRows.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-idm-blue font-bold flex items-center justify-center text-[11px]">
                            {e.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-[13px] text-on-surface">{e.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={e.is_active ? "emerald" : "slate"}>{e.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="py-3 px-3 text-[12px] text-text-muted font-mono">{formatDate(e.created_at)}</td>
                      {canManageEmployees && (
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingEmployee(e);
                                setEmpModalOpen(true);
                              }}
                              type="button"
                              title="Edit pegawai"
                              aria-label={`Edit ${e.name}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200 text-text-muted hover:text-idm-blue hover:bg-blue-50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleEmployeeActive(e)}
                              type="button"
                              title={e.is_active ? "Nonaktifkan pegawai" : "Aktifkan pegawai"}
                              aria-label={e.is_active ? `Nonaktifkan ${e.name}` : `Aktifkan ${e.name}`}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                                e.is_active
                                  ? "bg-slate-50 border-slate-200 text-text-muted hover:text-amber-600 hover:bg-amber-50"
                                  : "bg-slate-50 border-slate-200 text-text-muted hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {e.is_active ? "person_off" : "person_check"}
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(e)}
                              type="button"
                              title="Hapus pegawai"
                              aria-label={`Hapus ${e.name}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200 text-text-muted hover:text-idm-red hover:bg-red-50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={canManageEmployees ? 4 : 3} className="py-8 text-center text-text-muted text-sm">
                        Belum ada karyawan/kasir terdaftar di gerai ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={halamanPegawai.page}
              lastPage={halamanPegawai.lastPage}
              from={halamanPegawai.from}
              to={halamanPegawai.to}
              total={halamanPegawai.total}
              onChange={halamanPegawai.setPage}
              label="pegawai"
            />
          </SectionCard>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard
          className="!p-0 overflow-hidden border-t-2 !border-t-idm-blue"
          title={
            <span className="flex items-center gap-2 px-5 pt-5">
              <span className="material-symbols-outlined text-idm-blue text-xl">account_balance</span>
              Pemasukan Terkini
            </span>
          }
          actions={
            canRecordTransaction && (
              <button
                onClick={() => setInModalOpen(true)}
                className="mr-5 mt-5 h-8 px-3 rounded-lg bg-idm-blue text-white hover:bg-idm-blue-dark transition-colors font-bold text-[11px] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span> Catat Pemasukan
              </button>
            )
          }
        >
          <div className="overflow-x-auto px-5 pb-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Pegawai</th>
                  <th className="py-2 px-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-body-sm">
                {recentIn.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-[12px] text-text-muted font-mono whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-2.5 px-3 text-[12px]">{r.employee?.name || r.user?.name}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-idm-blue text-[13px]">{formatRupiah(r.amount)}</td>
                  </tr>
                ))}
                {recentIn.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-text-muted text-sm">
                      Belum ada pemasukan tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          className="!p-0 overflow-hidden border-t-2 !border-t-idm-red"
          title={
            <span className="flex items-center gap-2 px-5 pt-5">
              <span className="material-symbols-outlined text-idm-red text-xl">inventory_2</span>
              Barang Keluar Terkini
            </span>
          }
          actions={
            canRecordTransaction && (
              <button
                onClick={() => setOutModalOpen(true)}
                className="mr-5 mt-5 h-8 px-3 rounded-lg bg-idm-red text-white hover:bg-idm-red-dark transition-colors font-bold text-[11px] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span> Catat Barang Keluar
              </button>
            )
          }
        >
          <div className="overflow-x-auto px-5 pb-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-text-muted text-[11px] font-bold uppercase tracking-wider border-b border-border-subtle bg-slate-50/70">
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Kategori</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-body-sm">
                {recentOut.map((r) => (
                  <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-[12px] text-text-muted font-mono whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-2.5 px-3 text-[12px] font-medium">{r.item_category?.name}</td>
                    <td className="py-2.5 px-3 text-center text-[12px]">
                      {formatNumber(r.quantity)} {r.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-idm-red text-[13px]">{formatRupiah(r.value)}</td>
                  </tr>
                ))}
                {recentOut.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-text-muted text-sm">
                      Belum ada barang keluar tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {canManageStore && (
        <EditStoreModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          store={store}
          onSaved={(updated) => {
            setStore(updated);
            setEditOpen(false);
          }}
        />
      )}

      {canManageEmployees && (
        <EmployeeFormModal
          open={empModalOpen}
          onClose={() => setEmpModalOpen(false)}
          storeId={id}
          employee={editingEmployee}
          onSaved={() => {
            setEmpModalOpen(false);
            setEditingEmployee(null);
            loadAll();
          }}
        />
      )}

      {canRecordTransaction && (
        <QuickPemasukanModal
          open={inModalOpen}
          onClose={() => setInModalOpen(false)}
          storeId={id}
          isManager={isManager}
          employeeOptions={employees}
          onSaved={() => {
            setInModalOpen(false);
            loadAll();
          }}
        />
      )}

      {canRecordTransaction && (
        <QuickPengeluaranModal
          open={outModalOpen}
          onClose={() => setOutModalOpen(false)}
          storeId={id}
          isManager={isManager}
          categoryList={categoryList}
          employeeOptions={employees}
          onSaved={() => {
            setOutModalOpen(false);
            loadAll();
          }}
        />
      )}
    </>
  );
}

function MetaRow({ label, value, align = "center" }) {
  return (
    <div className={`flex ${align === "start" ? "items-start" : "items-center"} justify-between py-1 gap-3`}>
      <span className="text-[12px] font-semibold text-text-muted shrink-0">{label}</span>
      <span className="text-[13px] font-bold text-on-surface">{value}</span>
    </div>
  );
}

function EditStoreModal({ open, onClose, store, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && store) {
      setForm({
        name: store.name,
        address: store.address,
        district: store.district || "",
        latitude: store.latitude,
        longitude: store.longitude,
        phone: store.phone || "",
        is_active: !!store.is_active,
      });
      setError("");
    }
  }, [open, store]);

  if (!form) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateStore(store.id, {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      onSaved(updated);
    } catch (err) {
      setError(err?.response?.data?.message || "Gagal menyimpan perubahan gerai.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Gerai Indomaret"
      description={store.store_code}
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100">
            Batal
          </button>
          <button form="form-edit-store" type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      }
    >
      <form id="form-edit-store" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama Gerai" required>
          <InputShell icon="storefront">
            <input required className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </InputShell>
        </Field>
        <Field label="Alamat" required>
          <InputShell icon="map">
            <input required className={inputClass} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </InputShell>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Kecamatan">
            <InputShell icon="location_city">
              <input className={inputClass} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
            </InputShell>
          </Field>
          <Field label="No. Telepon">
            <InputShell icon="call">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </InputShell>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Latitude" required>
            <InputShell icon="my_location">
              <input required type="number" step="any" className={inputClass} value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} />
            </InputShell>
          </Field>
          <Field label="Longitude" required>
            <InputShell icon="my_location">
              <input required type="number" step="any" className={inputClass} value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} />
            </InputShell>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Gerai berstatus aktif
        </label>
        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function EmployeeFormModal({ open, onClose, storeId, employee, onSaved }) {
  const isEdit = !!employee;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(employee?.name || "");
      setPassword("");
      setIsActive(employee ? !!employee.is_active : true);
      setError("");
    }
  }, [open, employee]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        // Password dikosongkan berarti tidak diganti; nama & status aktif
        // selalu dikirim ulang.
        const payload = { name, is_active: isActive };
        if (password) payload.password = password;
        await updateEmployee(employee.id, payload);
      } else {
        // Supervisor otomatis terkunci ke gerainya sendiri di backend; manager
        // (akun pusat) wajib menyebutkan gerai tujuannya.
        await createEmployee({ name, password, store_id: Number(storeId) });
      }
      onSaved();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setError(msg || `Gagal ${isEdit ? "menyimpan perubahan" : "menambahkan"} pegawai.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Pegawai / Kasir" : "Tambah Pegawai / Kasir"}
      description="Karyawan tidak memiliki akun login penuh — nama & password ini hanya dipakai untuk verifikasi saat input transaksi."
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100">
            Batal
          </button>
          <button form="form-add-employee" type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60">
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Pegawai"}
          </button>
        </div>
      }
    >
      <form id="form-add-employee" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama Pegawai" code="name" required>
          <InputShell icon="badge">
            <input required className={inputClass} placeholder="cth. Kasir Dua" value={name} onChange={(e) => setName(e.target.value)} />
          </InputShell>
        </Field>
        <Field label="Password" code="password" required={!isEdit}>
          <InputShell icon="lock">
            <input
              required={!isEdit}
              type="password"
              minLength={4}
              className={inputClass}
              placeholder={isEdit ? "Kosongkan jika tidak diganti" : "Minimal 4 karakter"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </InputShell>
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Pegawai berstatus aktif
          </label>
        )}
        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function QuickPemasukanModal({ open, onClose, storeId, isManager, employeeOptions, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function emptyForm() {
    return { date: todayISO(), amount: "", notes: "", mode: "self", employee_name: "", employee_password: "" };
  }

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { date: form.date, amount: Number(form.amount), notes: form.notes || undefined };
      if (isManager) payload.store_id = Number(storeId);
      if (form.mode === "employee") {
        payload.employee_name = form.employee_name;
        payload.employee_password = form.employee_password;
      }
      await createIncome(payload);
      onSaved();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setError(msg || "Gagal menyimpan pemasukan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat Pemasukan"
      description="Pencatatan pemasukan untuk gerai ini"
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100">
            Batal
          </button>
          <button form="form-quick-in" type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan Pemasukan"}
          </button>
        </div>
      }
    >
      <form id="form-quick-in" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tanggal" required>
          <InputShell icon="calendar_today">
            <input type="date" required className={inputClass} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </InputShell>
        </Field>
        <Field label="Jumlah" required>
          <InputShell icon="payments">
            <span className="text-[11px] text-text-muted">Rp</span>
            <input type="number" min="0" required className={inputClass} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </InputShell>
        </Field>
        <Field label="Keterangan (opsional)">
          <InputShell icon="notes">
            <input className={inputClass} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </InputShell>
        </Field>
        <EmployeeInputToggle
          mode={form.mode}
          onModeChange={(mode) => setForm((f) => ({ ...f, mode }))}
          name={form.employee_name}
          onNameChange={(v) => setForm((f) => ({ ...f, employee_name: v }))}
          password={form.employee_password}
          onPasswordChange={(v) => setForm((f) => ({ ...f, employee_password: v }))}
          employeeOptions={employeeOptions}
        />
        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function QuickPengeluaranModal({ open, onClose, storeId, isManager, categoryList, employeeOptions, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function emptyForm() {
    return {
      item_category_id: "",
      date: todayISO(),
      quantity: "",
      unit: "pcs",
      value: "",
      notes: "",
      mode: "self",
      employee_name: "",
      employee_password: "",
    };
  }

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        item_category_id: Number(form.item_category_id),
        date: form.date,
        quantity: Number(form.quantity),
        unit: form.unit || "pcs",
        value: Number(form.value),
        notes: form.notes || undefined,
      };
      if (isManager) payload.store_id = Number(storeId);
      if (form.mode === "employee") {
        payload.employee_name = form.employee_name;
        payload.employee_password = form.employee_password;
      }
      await createExpense(payload);
      onSaved();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const msg = errs ? Object.values(errs)[0]?.[0] : err?.response?.data?.message;
      setError(msg || "Gagal menyimpan barang keluar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat Barang Keluar"
      description="Pencatatan mutasi barang keluar untuk gerai ini"
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100">
            Batal
          </button>
          <button form="form-quick-out" type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-idm-red hover:bg-idm-red-dark text-white text-sm font-bold shadow-sm disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan Barang Keluar"}
          </button>
        </div>
      }
    >
      <form id="form-quick-out" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Kategori Barang" required>
          <InputShell icon="category">
            <select required className={inputClass} value={form.item_category_id} onChange={(e) => setForm((f) => ({ ...f, item_category_id: e.target.value }))}>
              <option value="">Pilih kategori...</option>
              {categoryList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </InputShell>
        </Field>
        <Field label="Tanggal" required>
          <InputShell icon="calendar_today">
            <input type="date" required className={inputClass} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </InputShell>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Jumlah Barang" required>
            <InputShell icon="scale">
              <input type="number" min="1" required className={inputClass} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              <span className="text-[11px] text-text-muted shrink-0">{form.unit}</span>
            </InputShell>
          </Field>
          <Field label="Total Biaya" required>
            <InputShell icon="payments">
              <span className="text-[11px] text-text-muted">Rp</span>
              <input type="number" min="0" required className={inputClass} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            </InputShell>
          </Field>
        </div>
        <Field label="Keterangan (opsional)">
          <InputShell icon="notes">
            <input className={inputClass} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </InputShell>
        </Field>
        <EmployeeInputToggle
          mode={form.mode}
          onModeChange={(mode) => setForm((f) => ({ ...f, mode }))}
          name={form.employee_name}
          onNameChange={(v) => setForm((f) => ({ ...f, employee_name: v }))}
          password={form.employee_password}
          onPasswordChange={(v) => setForm((f) => ({ ...f, employee_password: v }))}
          employeeOptions={employeeOptions}
        />
        {error && (
          <div className="flex items-center gap-2 text-idm-red bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
