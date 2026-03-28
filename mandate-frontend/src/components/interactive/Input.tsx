import { type InputHTMLAttributes } from "react";

type InputVariant = "form" | "terminal";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly variant?: InputVariant;
  readonly className?: string;
}

const variantStyles: Record<InputVariant, string> = {
  form: "font-dashboard",
  terminal: "font-terminal",
};

export function Input({
  value,
  onChange,
  variant = "form",
  className = "",
  ...rest
}: InputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "h-8 px-3 text-sm bg-night-sky text-text-primary border border-transparent rounded",
        "placeholder:text-text-tertiary",
        "focus:outline-none focus:ring-0 focus:border-border-focus",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
