export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0866FF" />
          <stop offset="100%" stopColor="#0052CC" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#lg)" />
      <path fill="#fff" d="M20 9l11 7v8l-11 7-11-7v-8l11-7z" opacity="0.95" />
    </svg>
  );
}

export function LogoWordmark({ light }: { light?: boolean }) {
  return (
    <span className={`logo-wordmark${light ? " logo-light" : ""}`}>
      <Logo size={28} />
      <span>SecureHub</span>
    </span>
  );
}
