/**
 * Grafik tren mini (sparkline) SVG ringan tanpa dependency chart library,
 * dipakai di popup peta (per titik & per kecamatan) untuk menunjukkan tren
 * harian pemasukan/pengeluaran secara representatif dibanding cuma angka.
 */
export default function Sparkline({ series, width = 220, height = 60, className = "" }) {
  // series: [{ label, color, points: number[] }]
  const allValues = series.flatMap((s) => s.points);
  const max = Math.max(1, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const count = series[0]?.points.length || 0;
  const stepX = count > 1 ? width / (count - 1) : width;

  function toPath(points) {
    return points
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
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
