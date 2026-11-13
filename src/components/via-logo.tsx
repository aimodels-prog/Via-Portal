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
        style={{ clipPath: "polygon(53.5% 2%, 60.8% 2%, 60.8% 20%, 53.5% 20%)" }}
      />
      <img
        src="/via-logo.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: "polygon(48.5% 17%, 56.5% 17%, 56.5% 36%, 48.5% 36%)" }}
      />
    </span>
  );
}
