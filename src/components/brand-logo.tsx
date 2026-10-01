// Logo institucional da Biodinamica.
// O arquivo em /public/logo-biodinamica.png e monocromatico (branco + alpha),
// entao usamos CSS mask: a FORMA vem do alpha e a COR vem de `currentColor`.
// Assim a logo assume a cor do texto do elemento (ex.: text-[#283139],
// text-sidebar-foreground) e se adapta a light/dark sem gerar outra arte.
export function BrandLogo({
  className,
  title = "Biodinâmica",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{
        display: "inline-block",
        aspectRatio: "874 / 118",
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/logo-biodinamica.png)",
        maskImage: "url(/logo-biodinamica.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
