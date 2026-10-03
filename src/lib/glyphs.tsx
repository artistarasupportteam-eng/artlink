type Props = { glyph: string; className?: string };

export function Glyph({ glyph, className = "size-4" }: Props) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (glyph) {
    case "note":
      return (
        <svg {...common}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M10 9l6 3-6 3V9z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "wave":
      return (
        <svg {...common}>
          <path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0" />
        </svg>
      );
    case "disc":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path d="M7 17h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7 17z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 3L6 13h5l-1 8 8-12h-5l0-6z" />
        </svg>
      );
    case "radio":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M7 7l10-4" />
          <circle cx="15" cy="13" r="2" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M12 3l2.2 5.2L20 9l-4 3.6L17.2 18 12 15.2 6.8 18 8 12.6 4 9l5.8-.8L12 3z" />
        </svg>
      );
    case "hex":
      return (
        <svg {...common}>
          <path d="M8 4h8l4 8-4 8H8L4 12l4-8z" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M3 9l9-5 9 5-9 11L3 9z" />
          <path d="M3 9h18" />
        </svg>
      );
    case "rings":
      return (
        <svg {...common}>
          <circle cx="9" cy="12" r="5" />
          <circle cx="15" cy="12" r="5" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-5 3 10 2-5h7" />
        </svg>
      );
    case "cassette":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <path d="M10 12h4" />
        </svg>
      );
    case "headphones":
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <rect x="3" y="13" width="4" height="7" rx="1" />
          <rect x="17" y="13" width="4" height="7" rx="1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

export function BrandMark({
  color,
  ink,
  glyph,
  name,
}: {
  color: string;
  ink: "light" | "dark";
  glyph: string;
  name: string;
}) {
  const letter = glyph === "mono";
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-md"
      style={{ backgroundColor: color, color: ink === "dark" ? "#1c1408" : "#fffaf3" }}
      aria-hidden
    >
      {letter ? (
        <span className="font-display text-sm font-semibold leading-none">
          {(name.trim().slice(0, 1) || "?").toUpperCase()}
        </span>
      ) : (
        <Glyph glyph={glyph} />
      )}
    </span>
  );
}
