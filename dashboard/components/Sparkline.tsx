type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
};

export function Sparkline({ data, width = 80, height = 28 }: SparklineProps) {
  if (!data.length) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const last = data.length - 1;
  const up = data[last] >= data[0];
  const points = data
    .map((value, index) => {
      const x = last === 0 ? 0 : (index / last) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={up ? "#34d399" : "#fb7185"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
