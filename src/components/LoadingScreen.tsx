import { LoaderBrand } from "./LoaderBrand";
import { ParticleNetwork } from "./ParticleNetwork";

export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-bg" aria-hidden />
      <ParticleNetwork variant="light" />
      <LoaderBrand label={label} />
    </div>
  );
}
