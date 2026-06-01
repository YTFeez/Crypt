import { LoaderBrand } from "./LoaderBrand";
import { NodesBackground } from "./NodesBackground";

export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-bg" aria-hidden />
      <NodesBackground variant="light" />
      <LoaderBrand label={label} />
    </div>
  );
}
