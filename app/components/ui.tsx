import { ButtonHTMLAttributes, ReactNode } from "react";

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm shadow-teal-900/10 disabled:bg-teal-300",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50",
  outline:
    "bg-transparent text-teal-700 border border-teal-200 hover:bg-teal-50 disabled:opacity-50",
  ghost:
    "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-50",
  danger:
    "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-base px-6 py-3.5 rounded-2xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Cards ---------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm shadow-slate-900/5 ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Badges ---------- */

type BadgeTone = "teal" | "amber" | "rose" | "slate" | "blue";

const badgeTones: Record<BadgeTone, string> = {
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- Avatar (initials) ---------- */

const avatarPalette = [
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const palette = avatarPalette[hashString(name) % avatarPalette.length];
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-xl",
  }[size];

  return (
    <div
      className={`${sizeClasses} ${palette} rounded-full flex items-center justify-center font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}

/* ---------- Icons (inline SVG, no external dependency) ---------- */

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PillIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M10.5 20.5 3.5 13.5a5 5 0 1 1 7-7l7 7a5 5 0 1 1-7 7Z" />
    <path d="M8.5 8.5l7 7" />
  </svg>
);

export const CalendarIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

export const AlertIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ArrowLeftIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const UserIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export const SparkleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
  </svg>
);

export const PencilIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
  </svg>
);

export const UploadIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </svg>
);

export const FileTextIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M9 13h6M9 17h6" />
  </svg>
);

export const PhoneIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);

export const HeartIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);

export const criticalityTone: Record<string, BadgeTone> = {
  low: "slate",
  medium: "amber",
  high: "rose",
};

export const EmptyStateIllustration = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24 mx-auto text-slate-300" fill="none">
    <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
    <path
      d="M40 70c0-12 9-20 20-20s20 8 20 20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="60" cy="42" r="10" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/* ---------- Marketing illustrations (original, geometric, brand-colored) ---------- */

export const CoordinationIllustration = ({
  className = "w-full max-w-sm mx-auto",
}: {
  className?: string;
}) => (
  <svg viewBox="0 0 400 400" className={className} fill="none">
    {/* Orbit rings */}
    <circle cx="200" cy="200" r="150" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 6" />
    <circle cx="200" cy="200" r="100" stroke="#e2e8f0" strokeWidth="1.5" />

    {/* Connecting lines from center to each caregiver node */}
    <line x1="200" y1="200" x2="200" y2="80" stroke="#5eead4" strokeWidth="2" strokeDasharray="3 5" />
    <line x1="200" y1="200" x2="313" y2="265" stroke="#93c5fd" strokeWidth="2" strokeDasharray="3 5" />
    <line x1="200" y1="200" x2="87" y2="265" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3 5" />

    {/* Center: the patient, a heart in a solid teal circle */}
    <circle cx="200" cy="200" r="48" fill="#0d9488" />
    <path
      d="M200 218c-1-1-22-13-22-27a13 13 0 0 1 22-9 13 13 0 0 1 22 9c0 14-21 26-22 27Z"
      fill="white"
    />

    {/* Caregiver node 1 (top) */}
    <circle cx="200" cy="80" r="30" fill="#f0fdfa" stroke="#0d9488" strokeWidth="2" />
    <circle cx="200" cy="72" r="9" fill="#0d9488" />
    <path d="M182 96c0-10 8-16 18-16s18 6 18 16" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Caregiver node 2 (bottom right) */}
    <circle cx="313" cy="265" r="30" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
    <circle cx="313" cy="257" r="9" fill="#3b82f6" />
    <path d="M295 281c0-10 8-16 18-16s18 6 18 16" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Caregiver node 3 (bottom left) */}
    <circle cx="87" cy="265" r="30" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
    <circle cx="87" cy="257" r="9" fill="#d97706" />
    <path d="M69 281c0-10 8-16 18-16s18 6 18 16" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Small floating checkmark badges, signaling tasks completed */}
    <circle cx="150" cy="130" r="12" fill="white" stroke="#0d9488" strokeWidth="2" />
    <path d="M145 130l3.5 3.5L156 126" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

    <circle cx="270" cy="220" r="12" fill="white" stroke="#3b82f6" strokeWidth="2" />
    <path d="M265 220l3.5 3.5L276 216" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ChecklistIllustration = ({
  className = "w-full max-w-xs mx-auto",
}: {
  className?: string;
}) => (
  <svg viewBox="0 0 300 300" className={className} fill="none">
    {/* A tilted paper/document behind the checklist card */}
    <rect x="60" y="50" width="160" height="200" rx="12" fill="#f1f5f9" transform="rotate(-6 140 150)" />
    {/* The confirmed checklist card, on top, upright */}
    <rect x="80" y="60" width="160" height="200" rx="14" fill="white" stroke="#e2e8f0" strokeWidth="2" />
    <rect x="104" y="90" width="80" height="8" rx="4" fill="#0d9488" />
    <rect x="104" y="106" width="112" height="6" rx="3" fill="#e2e8f0" />

    {/* Three checklist rows, alternating done/pending */}
    <circle cx="112" cy="150" r="9" fill="#0d9488" />
    <path d="M108 150l2.5 2.5L117 146" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="130" y="145" width="70" height="10" rx="5" fill="#cbd5e1" />

    <circle cx="112" cy="180" r="9" fill="#0d9488" />
    <path d="M108 180l2.5 2.5L117 176" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="130" y="175" width="86" height="10" rx="5" fill="#cbd5e1" />

    <circle cx="112" cy="210" r="9" fill="none" stroke="#cbd5e1" strokeWidth="2" />
    <rect x="130" y="205" width="60" height="10" rx="5" fill="#e2e8f0" />

    {/* A small teal sparkle, signaling the AI step that produced this */}
    <path
      d="M232 76l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"
      fill="#5eead4"
    />
  </svg>
);

/* ---------- Success overlay (brief celebratory confirmation) ---------- */

export function SuccessOverlay({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-3xl px-10 py-8 shadow-xl flex flex-col items-center gap-3 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-teal-500 text-white flex items-center justify-center animate-check-pop">
          <CheckIcon className="w-8 h-8" />
        </div>
        <p className="text-slate-700 font-medium text-center">{message}</p>
      </div>
    </div>
  );
}
