#!/usr/bin/env bash
# Dijalankan setiap kali container "backend" start (lihat ENTRYPOINT di
# Dockerfile). Tugasnya: pastikan .env, APP_KEY, dependency composer, dan
# skema database sudah siap -- sama seperti langkah manual yang biasanya
# dilakukan sekali waktu setup project (composer.json script "setup"), tapi
# otomatis tiap kali container dinyalakan supaya tidak perlu diingat-ingat.
set -e

cd /var/www/html

# .env dibuat dari .env.example kalau belum ada (misal clone baru / volume
# baru). Kalau sudah ada punya kamu sendiri, TIDAK ditimpa.
if [ ! -f .env ]; then
  echo "[entrypoint] .env belum ada, menyalin dari .env.example..."
  cp .env.example .env
fi

# PENTING: paksa nilai DB_* di FILE .env supaya SELALU sama dengan environment
# Docker Compose, bukan cuma mengandalkan environment variable proses (yang
# ternyata tidak selalu konsisten diteruskan ke proses child yang dibuat
# "php artisan serve" saat menangani request web -- migration & CLI lain
# lewat proses yang sama sudah benar pakai host "db", tapi request HTTP
# sempat kejadian tetap connect ke "localhost" dari .env lama. Menulis
# langsung ke file .env menghilangkan ambiguitas ini sama sekali, karena
# Dotenv selalu baca file ini dari disk apa pun konteksnya (CLI atau web).
set_env_value() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    echo "${key}=${value}" >> .env
  fi
}
echo "[entrypoint] Menyamakan DB_* di .env dengan environment Docker Compose..."
set_env_value "DB_CONNECTION" "${DB_CONNECTION:-pgsql}"
set_env_value "DB_HOST" "${DB_HOST:-host.docker.internal}"
set_env_value "DB_PORT" "${DB_PORT:-5432}"
set_env_value "DB_DATABASE" "${DB_DATABASE:-indomaret}"
set_env_value "DB_USERNAME" "${DB_USERNAME:-postgres}"
set_env_value "DB_PASSWORD" "${DB_PASSWORD:-postgres}"

# vendor/ bisa kosong kalau ini pertama kali folder di-bind-mount dari host
# yang belum pernah composer install (Dockerfile sudah composer install
# waktu build image, tapi bind mount volume di docker-compose menimpa isi
# /var/www/html dengan folder host -- makanya dicek ulang di sini).
if [ ! -f vendor/autoload.php ]; then
  echo "[entrypoint] vendor/ belum ada, menjalankan composer install..."
  composer install --no-interaction --prefer-dist
fi

# Tunggu Postgres benar-benar siap menerima koneksi (db di docker-compose
# punya healthcheck sendiri, ini jaga-jaga tambahan kalau entrypoint dipicu
# ulang manual / db sempat restart).
echo "[entrypoint] Menunggu database di ${DB_HOST:-host.docker.internal}:${DB_PORT:-5432}..."
until php -r "
    try {
        new PDO('pgsql:host=${DB_HOST:-host.docker.internal};port=${DB_PORT:-5432};dbname=${DB_DATABASE:-indomaret}', '${DB_USERNAME:-postgres}', '${DB_PASSWORD:-postgres}');
    } catch (Exception \$e) {
        exit(1);
    }
" 2>/dev/null; do
  sleep 1
done
echo "[entrypoint] Database siap."

# APP_KEY digenerate otomatis kalau masih kosong -- ditulis langsung ke
# .env di host (karena foldernya bind-mount), sama seperti
# "php artisan key:generate" manual.
if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
  echo "[entrypoint] APP_KEY kosong, generate baru..."
  php artisan key:generate --force
fi

php artisan config:clear >/dev/null

# Bisa dimatikan dengan set RUN_MIGRATIONS=false di environment kalau tidak
# mau migration otomatis jalan tiap restart (migration Laravel aman
# dijalankan berulang -- yang sudah pernah jalan otomatis dilewati).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Menjalankan migration..."
  php artisan migrate --force
fi

# Seed otomatis KALAU tabel users masih kosong -- ini menutupi kasus volume
# Postgres yang baru pertama kali dibuat (migration berhasil bikin skema,
# tapi tidak ada akun sama sekali, jadi login manapun ditolak walau
# email/password sudah benar). Dicek langsung ke DB (bukan pakai file
# penanda) supaya tetap benar walau cuma volume "db" yang di-reset lewat
# "docker compose down -v" sementara folder backend (isinya entrypoint ini)
# tidak ikut ke-reset. Bisa dimatikan dengan RUN_SEEDER=false di environment.
# PENTING: kalau proses CEK-nya sendiri gagal (bukan tabelnya beneran
# kosong -- misal koneksi sempat putus sesaat), FALLBACK-nya harus "jangan
# seed" (nilai selain "0", dipilih "unknown"), BUKAN "0". Kalau fallback-nya
# "0", satu kali gagal cek = auto-seed nimpa data asli dengan dataset kecil
# contoh -- ini pernah kejadian nyata ke user (lihat "Masalah nyata" di
# bagian Docker status doc).
if [ "${RUN_SEEDER:-true}" = "true" ]; then
  USER_COUNT=$(php -r "
      try {
          \$pdo = new PDO('pgsql:host=${DB_HOST:-host.docker.internal};port=${DB_PORT:-5432};dbname=${DB_DATABASE:-indomaret}', '${DB_USERNAME:-postgres}', '${DB_PASSWORD:-postgres}');
          echo \$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
      } catch (Exception \$e) {
          echo 'unknown';
      }
  " 2>/dev/null)
  if [ "$USER_COUNT" = "0" ]; then
    echo "[entrypoint] Tabel users masih kosong, menjalankan db:seed..."
    php artisan db:seed --force
  elif [ "$USER_COUNT" = "unknown" ]; then
    echo "[entrypoint] WARNING: gagal cek jumlah users (bukan berarti kosong) -- SKIP auto-seed demi keamanan data. Set RUN_SEEDER=false permanen kalau sudah ada data asli."
  fi
fi

echo "[entrypoint] Siap. Menjalankan: $*"
exec "$@"
