import { useEffect, useRef, useState } from "react";

/**
 * Bar chart ganda (biru vs merah) bergaya SVG custom, meniru gaya
 * "Komparasi Bulanan" pada desain Stitch — tapi datanya real, diambil dari
 * tren harian yang dikembalikan endpoint /api/dashboard.
 *
 * Ukurannya mengikuti kotak induknya: lebar DAN tinggi diukur lewat
 * ResizeObserver, lalu dipakai apa adanya sebagai viewBox. Dengan begitu
 * grafik ikut memanjang sampai dasar kartu (tidak menyisakan ruang kosong
 * saat kartu di sebelahnya lebih tinggi) tanpa membuat angka pada sumbu
 * ikut gepeng — yang akan terjadi kalau SVG-nya diregangkan paksa.
 *
 * data: [{ label, a, b }]  a = pemasukan (biru), b = pengeluaran (merah)
 */
export default function DualBarChart({ data, aLabel = "Pemasukan", bLabel = "Pengeluaran", minHeight = 240 }) {
  const wadahRef = useRef(null);
  const [ukuran, setUkuran] = useState({ width: 700, height: minHeight });

  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;

    function ukur() {
      const { width, height } = el.getBoundingClientRect();
      setUkuran({
        width: Math.max(320, Math.round(width)),
        height: Math.max(minHeight, Math.round(height)),
      });
    }

    ukur();
    const observer = new ResizeObserver(ukur);
    observer.observe(el);
    return () => observer.disconnect();
  }, [minHeight]);

  const { width, height } = ukuran;
  const paddingLeft = 44;
  const paddingRight = 16;
  const top = 16;
  const bottom = 18;                 // ruang untuk garis dasar
  const baseline = height - bottom;

  const values = data.flatMap((d) => [d.a, d.b]);
  const max = Math.max(1, ...values);
  const niceMax = niceCeil(max);
  const steps = 4;

  const plotWidth = width - paddingLeft - paddingRight;
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(4, Math.min(16, groupWidth * 0.28));

  function scaleY(v) {
    const ratio = v / niceMax;
    return baseline - ratio * (baseline - top);
  }

  return (
    <div
      ref={wadahRef}
      className="w-full flex-1 relative"
      style={{ minHeight: `${minHeight}px` }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        fill="none"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {Array.from({ length: steps + 1 }).map((_, i) => {
          const y = top + ((baseline - top) / steps) * i;
          const val = Math.round((niceMax * (steps - i)) / steps);
          return (
            <g key={i}>
              <line
                stroke={i === steps ? "#CBD5E1" : "#E2E8F0"}
                strokeDasharray={i === steps ? undefined : "4 4"}
                strokeWidth="1"
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
              />
              <text
                fill="#64748b"
                fontFamily="Plus Jakarta Sans"
                fontSize="11"
                fontWeight="600"
                x={paddingLeft - 34}
                y={y + 4}
              >
                {compactNumber(val)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const groupX = paddingLeft + groupWidth * i;
          const xa = groupX + groupWidth / 2 - barWidth - 2;
          const xb = groupX + groupWidth / 2 + 2;
          const ya = scaleY(d.a);
          const yb = scaleY(d.b);
          return (
            <g key={d.label}>
              <title>{`${d.label} — ${aLabel}: ${compactNumber(d.a)}, ${bLabel}: ${compactNumber(d.b)}`}</title>
              <rect fill="#005baa" height={Math.max(0, baseline - ya)} rx="3" width={barWidth} x={xa} y={ya} />
              <rect fill="#d61c24" height={Math.max(0, baseline - yb)} rx="3" width={barWidth} x={xb} y={yb} />
            </g>
          );
        })}
      </svg>

      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
          Belum ada data pada periode ini.
        </div>
      )}

      <div className="sr-only">
        {aLabel} vs {bLabel}
      </div>
    </div>
  );
}

function niceCeil(value) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const fraction = value / base;
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * base;
}

function compactNumber(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`.replace(".0M", "M");
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}Jt`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}Rb`;
  return `${v}`;
}
