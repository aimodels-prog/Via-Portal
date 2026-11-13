type InverseViaLogoProps = {
  className?: string;
};

export function InverseViaLogo({ className = "" }: InverseViaLogoProps) {
  return (
    <span
      className={`relative block aspect-[2048/766] ${className}`}
      role="img"
      aria-label="VIA International"
    >
      <img
        src="/via-logo.png"
        alt=""
        className="absolute inset-0 h-full w-full object-contain brightness-0 invert"
      />
      <img
        src="/via-logo.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: "ellipse(2.8% 7.5% at 59.9% 10.9%)" }}
      />
      <img
        src="/via-logo.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: "ellipse(2.8% 7.5% at 55.2% 26.3%)" }}
      />
    </span>
  );
}
