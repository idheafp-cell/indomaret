/**
 * Grafik tren mini (sparkline) SVG ringan tanpa dependency chart library,
 * dipakai di popup peta (per titik & per kecamatan) untuk menunjukkan tren
 * harian pemasukan/pengeluaran secara representatif dibanding cuma angka.
 */
export default function Sparkline({ series, width = 220, height = 60, className = "" }) {
  // series: [{ label, color, points: number[] }]
  // Skala TIAP series dihitung SENDIRI-SENDIRI (bukan 1 skala global
  // gabungan seperti sebelumnya) -- soalnya nilai pemasukan biasanya jauh
  // lebih besar dari pengeluaran, kalau dipaksa 1 skala yang nilainya jauh
  // lebih kecil bakal keliatan rata/datar terus di bawah (seolah nggak ada
  // pergerakan/informasi sama sekali, padahal datanya sebenarnya bergerak).
  const count = series[0]?.points.length || 0;
  const stepX = count > 1 ? width / (count - 1) : width;
  const padY = height * 0.08; // jarak tipis biar puncak/lembah garis nggak nempel tepi atas/bawah

  function toPath(points) {
    const max = Math.max(1, ...points);
    const min = Math.min(0, ...points);
    const range = max - min || 1;
    return points
      .map((v, i) => {
        const x = i * stepX;
        const y = height - padY - ((v - min) / range) * (height - padY * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className}>
      {series.map((s) => (
        <path
          key={s.label}
          d={toPath(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
