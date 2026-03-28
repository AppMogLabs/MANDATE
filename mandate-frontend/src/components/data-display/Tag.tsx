interface TagProps {
  label: string;
  colour: string;
}

export function Tag({ label, colour }: TagProps) {
  return (
    <span
      className="font-terminal text-xs rounded px-1.5 py-0.5 inline-block"
      style={{
        color: colour,
        backgroundColor: `color-mix(in srgb, ${colour} 12%, transparent)`,
        borderRadius: "2px",
      }}
    >
      {label}
    </span>
  );
}

export type { TagProps };
