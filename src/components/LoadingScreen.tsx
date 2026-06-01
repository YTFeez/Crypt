import { LoaderBrand } from "./LoaderBrand";

export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-bg" aria-hidden />
      <LoaderBrand label={label} />
    </div>
  );
}
