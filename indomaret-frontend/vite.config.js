import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Folder ini di-bind-mount dari drive Windows ke container Linux
    // (lihat docker-compose.yml) -- event filesystem asli (inotify) yang
    // biasa dipakai Vite buat deteksi perubahan file SERING TIDAK NYAMPE
    // lewat jembatan Windows<->WSL2/Docker Desktop ini, jadi edit file di
    // editor kamu tidak ke-reload otomatis di browser. usePolling bikin
    // Vite cek perubahan file tiap 300ms (bukan nunggu event) -- lebih
    // berat dikit di CPU tapi hot-reload jadi selalu jalan. Kalau BUKAN
    // dijalankan lewat Docker (native "npm run dev" langsung di Windows),
    // ini tidak berpengaruh/tidak perlu, tapi aman dibiarkan aktif.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
