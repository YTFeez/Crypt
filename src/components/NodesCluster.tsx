/** Motif « réseau » du logo Talkeo — 5 nœuds reliés */
export function NodesCluster({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`nodes-cluster${className ? ` ${className}` : ""}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g className="nodes-cluster-lines" stroke="var(--nodes-line)" strokeWidth="5.5" strokeLinecap="round">
        <line x1="48" y1="48" x2="74" y2="20" />
        <line x1="48" y1="48" x2="20" y2="40" />
        <line x1="48" y1="48" x2="36" y2="80" />
        <line x1="48" y1="48" x2="84" y2="56" />
        <line x1="74" y1="20" x2="84" y2="56" />
        <line x1="20" y1="40" x2="36" y2="80" />
        <line x1="74" y1="20" x2="20" y2="40" />
      </g>
      <g className="nodes-cluster-dots" fill="var(--nodes-fill)">
        <circle cx="74" cy="20" r="12" />
        <circle cx="48" cy="48" r="10" />
        <circle cx="20" cy="40" r="10" />
        <circle cx="36" cy="80" r="8" />
        <circle cx="84" cy="56" r="8" />
      </g>
    </svg>
  );
}
