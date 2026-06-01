type ListProps = { rows?: number };

export function SkeletonList({ rows = 6 }: ListProps) {
  return (
    <div className="skeleton-list" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="skeleton skeleton-circle" />
          <div className="skeleton-col">
            <div className="skeleton skeleton-line" style={{ width: `${55 + (i % 3) * 12}%` }} />
            <div className="skeleton skeleton-line skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel() {
  return (
    <div className="skeleton-panel" aria-hidden>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-block skeleton-block--sm" />
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="skeleton-chat" aria-hidden>
      <div className="skeleton-bubble skeleton-bubble--them" />
      <div className="skeleton-bubble skeleton-bubble--me" />
      <div className="skeleton-bubble skeleton-bubble--them skeleton-bubble--short" />
      <div className="skeleton-bubble skeleton-bubble--me skeleton-bubble--short" />
    </div>
  );
}
