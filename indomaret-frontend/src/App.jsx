import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Peta from "./pages/Peta";
import BarangKeluar from "./pages/BarangKeluar";
import Pemasukan from "./pages/Pemasukan";
import GeraiDetail from "./pages/GeraiDetail";
import ManajemenAkun from "./pages/ManajemenAkun";
import Persetujuan from "./pages/Persetujuan";
import InputBarangKeluar from "./pages/kasir/InputBarangKeluar";
import InputPemasukan from "./pages/kasir/InputPemasukan";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/*
            Semua role memakai shell yang sama (sidebar + header). Daftar menu
            di sidebar dan hak akses per halaman dibedakan di Sidebar.jsx dan
            AppLayout.jsx: kasir hanya boleh membuka halaman di bawah /kasir,
            role lain justru tidak bisa membukanya.
          */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/peta" element={<Peta />} />
            <Route path="/gerai" element={<Navigate to="/peta" replace />} />
            <Route path="/gerai/:id" element={<GeraiDetail />} />
            <Route path="/barang-keluar" element={<BarangKeluar />} />
            <Route path="/pemasukan" element={<Pemasukan />} />
            <Route path="/persetujuan" element={<Persetujuan />} />
            {/* /pegawai lama digabung jadi tab "Pegawai" di /akun -- redirect
                supaya bookmark/link lama tidak 404. */}
            <Route path="/pegawai" element={<Navigate to="/akun" replace />} />
            <Route path="/akun" element={<ManajemenAkun />} />

            <Route path="/kasir" element={<Navigate to="/kasir/barang-keluar" replace />} />
            <Route path="/kasir/barang-keluar" element={<InputBarangKeluar />} />
            <Route path="/kasir/pemasukan" element={<InputPemasukan />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
