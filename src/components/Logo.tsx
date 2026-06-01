import { useId } from "react";

export function Logo({ size = 32 }: { size?: number }) {
  const gid = useId().replace(/:/g, "");

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden role="img">
      <title>Talkeo</title>
      <defs>
        <linearGradient id={`talkeo-g-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#talkeo-g-${gid})`} />
      <path
        fill="#fff"
        fillOpacity={0.98}
        d="M11 11.5h17.5a2.5 2.5 0 0 1 2.5 2.5v8.5a2.5 2.5 0 0 1-2.5 2.5H19.2L15 28.5v-3.5h-3.5a2.5 2.5 0 0 1-2.5-2.5V14a2.5 2.5 0 0 1 2.5-2.5z"
      />
      <rect x="15" y="16.5" width="2.5" height="7" rx="1.25" fill="#7c3aed" />
      <rect x="19.25" y="15" width="2.5" height="9" rx="1.25" fill="#6366f1" />
      <rect x="23.5" y="17" width="2.5" height="6" rx="1.25" fill="#06b6d4" />
    </svg>
  );
}

export function LogoWordmark({ light }: { light?: boolean }) {
  return (
    <span className={`logo-wordmark${light ? " logo-light" : ""}`}>
      <Logo size={28} />
      <span className="logo-wordmark-text">Talkeo</span>
    </span>
  );
}
