const LOGO_SRC = "/logo_talkeo.png";

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Talkeo"
      width={size}
      height={size}
      className={`logo-img${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}

export function LogoWordmark({ light }: { light?: boolean }) {
  return (
    <span className={`logo-wordmark${light ? " logo-light" : ""}`}>
      <Logo size={32} />
      <span className="logo-wordmark-text">Talkeo</span>
    </span>
  );
}
