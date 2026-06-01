import { LoaderBrand } from "./LoaderBrand";

type Props = {
  label?: string;
  /** Remplit la zone parent (ex. main-content) au lieu de toute la page */
  fill?: boolean;
};

export function PageLoader({ label = "Chargement…", fill = true }: Props) {
  return (
    <div className={`page-loader${fill ? " page-loader--fill" : ""}`}>
      <LoaderBrand label={label} compact />
    </div>
  );
}
