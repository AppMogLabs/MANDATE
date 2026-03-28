import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive";
type ButtonSize = "sm" | "md";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
  readonly className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-surface-hover text-moon-white hover:bg-surface-3 border border-border-default",
  secondary:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent",
  destructive:
    "bg-status-critical/15 text-status-critical hover:bg-status-critical/25 border border-status-critical/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-xs",
  md: "h-8 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  disabled,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={[
        "font-dashboard rounded transition-colors duration-150 inline-flex items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        disabled ? "opacity-50 cursor-not-allowed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
