import { Logo } from "./Logo";

type Props = {
  label?: string;
  compact?: boolean;
};

/** Animation logo + anneaux (partagée écran plein et zones de contenu) */
export function LoaderBrand({ label, compact = false }: Props) {
  return (
    <div className={`loader-brand${compact ? " loader-brand--compact" : ""}`} role="status" aria-live="polite">
      <div className="loader-brand-visual" aria-hidden>
        <div className="loader-orbit loader-orbit--outer" />
        <div className="loader-orbit loader-orbit--inner" />
        <div className="loader-logo-wrap">
          <Logo size={compact ? 28 : 36} />
        </div>
      </div>
      {label ? <p className="loader-brand-label">{label}</p> : null}
      <div className="loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
