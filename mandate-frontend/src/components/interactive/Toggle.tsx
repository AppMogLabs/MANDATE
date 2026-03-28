interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: string;
  readonly className?: string;
}

export function Toggle({ checked, onChange, label, className = "" }: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-8 h-4 rounded-full transition-all duration-150",
          checked ? "bg-compute" : "bg-surface-3",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-moon-white transition-transform duration-150",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      {label && (
        <span className="text-sm text-text-secondary font-dashboard">{label}</span>
      )}
    </label>
  );
}
