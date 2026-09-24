import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import KpiCard from "../components/ui/KpiCard";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Field, InputShell, inputClass } from "../components/ui/InputShell";
import { useAuth } from "../context/AuthContext";
import { listIndomaret, listKabupaten, createIndomaret } from "../api/resources";

export default function GeraiIndomaret() {
  const { isAdmin } = useAuth();
  const [gerai, setGerai] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return {
      kabupaten_id: "",
      kode_toko: "",
      nama: "",
      alamat: "",
      kecamatan: "",
      latitude: "",
      longitude: "",
      no_telp: "",
    };
  }

  function load() {
    setLoading(true);
    listIndomaret()
      .then(setGerai)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    if (isAdmin) listKabupaten().then(setKabupatenList);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!search) return gerai;
    const q = search.toLowerCase();
    return gerai.filter((g) => g.nama.toLowerCase().includes(q) || g.kode_toko.toLowerCase().includes(q));
  }, [gerai, search]);

  const kecamatanCount = new Set(gerai.map((g) => g.kecamatan).filter(Boolean)).size;
  const aktifCount = gerai.filter((g) => g.is_active).length;

  const perKecamatan = useMemo(() => {
    const map = new Map();
    gerai.forEach((g) => {
      const key = g.kecamatan || "Belum diketahui";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }, [gerai]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await createIndomaret({
        ...form,
        kabupaten_id: Number(form.kabupaten_id),
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
        title="Direktori & Manajemen Gerai Indomaret"
        description="Informasi operasional, lokasi, dan penanggung jawab tiap gerai."
        actions={
          isAdmin && (
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
        <KpiCard icon="storefront" accent="blue" label="Total Gerai Terdaftar" value={`${gerai.length} Gerai`} footerLeft={`${aktifCount} Aktif`} />
        <KpiCard icon="map" accent="red" label="Kecamatan Tercover" value={`${kecamatanCount} Kecamatan`} footerLeft="Sebaran wilayah" />
        <KpiCard
          icon="badge"
          accent="yellow"
          label="Rata-rata Karyawan/Gerai"
          value="Lihat Detail"
          footerLeft="Buka halaman detail gerai"
        />
        <KpiCard
          icon="apartment"
          accent="tricolor"
          label="Wilayah Terpadat"
          value={perKecamatan[0]?.nama || "-"}
          footerLeft={perKecamatan[0] ? `${perKecamatan[0].jumlah} Gerai Aktif` : ""}
        />
      </div>

      <SectionCard title="Sebaran Gerai per Kecamatan" description="Distribusi konsentrasi gerai">
        <div className="space-y-3">
          {perKecamatan.map((k, i) => (
            <div key={k.nama} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-idm-blue text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="w-32 shrink-0 font-bold text-[13px]">{k.nama}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-idm-blue rounded-full"
                  style={{ width: `${(k.jumlah / gerai.length) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-[12px] font-bold">{k.jumlah} Gerai</span>
            </div>
          ))}
          {perKecamatan.length === 0 && <p className="text-sm text-text-muted">Belum ada data.</p>}
        </div>
      </SectionCard>

      <SectionCard
        title="Daftar Master Gerai Indomaret"
        description="Data induk seluruh titik gerai"
        actions={
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode / nama gerai..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-idm-blue outline-none"
            />
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
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[13px] text-on-surface">{g.nama}</div>
                    <span className="text-[11px] text-idm-blue font-mono">{g.kode_toko}</span>
                    <div className="text-[11px] text-text-muted truncate max-w-xs">{g.alamat}</div>
                  </td>
                  <td className="py-3 px-3 text-[13px]">{g.kecamatan || "-"}</td>
                  <td className="py-3 px-3 text-[13px] font-mono">{g.no_telp || "-"}</td>
                  <td className="py-3 px-3">
                    <Badge variant={g.is_active ? "emerald" : "slate"}>{g.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      to={`/gerai/${g.id}`}
                      className="inline-flex items-center gap-1 text-idm-blue font-bold text-[12px] hover:underline"
                    >
                      Lihat Detail <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted text-sm">
                    Tidak ada gerai yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tambah Gerai Baru"
        description="Daftarkan titik Indomaret baru dalam kabupaten"
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-text-muted hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              form="form-gerai"
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-idm-blue hover:bg-idm-blue-dark text-white text-sm font-bold shadow-sm disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Gerai"}
            </button>
          </div>
        }
      >
        <form id="form-gerai" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Kabupaten" required>
              <InputShell icon="location_city">
                <select
                  required
                  className={inputClass}
                  value={form.kabupaten_id}
                  onChange={(e) => setForm((f) => ({ ...f, kabupaten_id: e.target.value }))}
                >
                  <option value="">Pilih kabupaten...</option>
                  {kabupatenList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </InputShell>
            </Field>
            <Field label="Kode Toko" required>
              <InputShell icon="qr_code">
                <input
                  required
                  className={inputClass}
                  placeholder="IDM-001"
                  value={form.kode_toko}
                  onChange={(e) => setForm((f) => ({ ...f, kode_toko: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>
          <Field label="Nama Gerai" required>
            <InputShell icon="storefront">
              <input
                required
                className={inputClass}
                placeholder="Indomaret Contoh"
                value={form.nama}
                onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              />
            </InputShell>
          </Field>
          <Field label="Alamat" required>
            <InputShell icon="home_pin">
              <input
                required
                className={inputClass}
                placeholder="Jl. Contoh No. 1"
                value={form.alamat}
                onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
              />
            </InputShell>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Field label="Kecamatan">
              <InputShell icon="map">
                <input
                  className={inputClass}
                  value={form.kecamatan}
                  onChange={(e) => setForm((f) => ({ ...f, kecamatan: e.target.value }))}
                />
              </InputShell>
            </Field>
            <Field label="Latitude" required>
              <InputShell icon="my_location">
                <input
                  required
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="-7.4478"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </InputShell>
            </Field>
            <Field label="Longitude" required>
              <InputShell icon="my_location">
                <input
                  required
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="112.7183"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </InputShell>
            </Field>
          </div>
          <Field label="No. Telepon">
            <InputShell icon="call">
              <input
                className={inputClass}
                value={form.no_telp}
                onChange={(e) => setForm((f) => ({ ...f, no_telp: e.target.value }))}
              />
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
