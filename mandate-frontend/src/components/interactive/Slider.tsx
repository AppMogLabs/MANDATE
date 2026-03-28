interface SliderProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly label?: string;
  readonly className?: string;
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  className = "",
}: SliderProps) {
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary font-dashboard">{label}</span>
          <span className="text-sm text-text-primary font-dashboard">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-range w-full appearance-none h-1 rounded-full bg-surface-3 cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--color-compute) ${percentage}%, var(--color-surface-3) ${percentage}%)`,
        }}
      />
      <style>{`
        .slider-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 9999px;
          background: var(--color-moon-white);
          cursor: pointer;
        }
        .slider-range::-moz-range-thumb {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 9999px;
          background: var(--color-moon-white);
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
