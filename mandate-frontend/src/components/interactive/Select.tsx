import { useState, useRef, useEffect, useCallback } from "react";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
}

export function Select({ options, value, onChange, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, handleClose]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "h-8 px-3 text-sm font-dashboard rounded inline-flex items-center justify-between gap-2",
          "bg-night-sky text-text-primary border border-border-default",
          "hover:bg-surface-hover transition-colors duration-150",
          "w-full",
        ].join(" ")}
      >
        <span className={selectedOption ? "text-text-primary" : "text-text-tertiary"}>
          {selectedOption?.label ?? "Select..."}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className={[
            "absolute z-50 mt-1 w-full",
            "bg-surface-2 border border-border-default rounded",
            "max-h-[240px] overflow-y-auto",
          ].join(" ")}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={[
                "w-full text-left px-3 py-1.5 text-sm font-dashboard",
                "hover:bg-surface-hover transition-colors duration-150",
                option.value === value ? "text-text-primary" : "text-text-secondary",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
