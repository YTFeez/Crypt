import { NodesCluster } from "./NodesCluster";

type Variant = "light" | "dark";

export function NodesBackground({ variant = "light" }: { variant?: Variant }) {
  return (
    <div className={`nodes-bg nodes-bg--${variant}`} aria-hidden>
      <NodesCluster className="nodes-bg__cluster nodes-bg__cluster--a" />
      <NodesCluster className="nodes-bg__cluster nodes-bg__cluster--b" />
      <NodesCluster className="nodes-bg__cluster nodes-bg__cluster--c" />
    </div>
  );
}
