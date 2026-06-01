import { LogoWordmark } from "./Logo";

export function LoadingScreen({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <LogoWordmark />
      <div className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}
