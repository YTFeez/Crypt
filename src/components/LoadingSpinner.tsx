type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = { sm: 18, md: 28, lg: 40 };

export function LoadingSpinner({ size = "md", className = "" }: Props) {
  const px = sizes[size];
  return (
    <span
      className={`loading-spinner loading-spinner--${size} ${className}`.trim()}
      style={{ width: px, height: px }}
      role="status"
      aria-label="Chargement"
    />
  );
}
