import { cn } from "@/lib/utils";
import Image from "next/image";
import brandLogo from "@/assets/logo_elektrk.webp";
import brandLogoLg from "@/assets/logo_light.webp";

interface BrandLogoProps {
  className?: string;
  variant?: "full" | "short" | "logo";
}

export function BrandLogo({ className, variant = "full" }: BrandLogoProps) {
  let brandName = null;

  if (variant === "full") {
    brandName = <BrandNameFull />;
  } else if (variant === "short") {
    brandName = <BrandNameShort />;
  }

  return (
    <div className={cn("h-full flex items-center gap-3 font-heading font-bold py-3", className)} >
      <Image
        className="h-full w-auto max-h-20 dark:hidden"
        width={435} height={720}
        src={brandLogoLg}
        alt="Logo de marca"
      />
      <Image
        className="hidden h-full w-auto max-h-20 dark:block"
        width={435} height={720}
        src={brandLogo}
        alt="Logo de marca"
      />
      {brandName}
    </div>
  );
}

function BrandNameShort() {
  return (
    <div className="">
      <p className="flex gap-2 text-2xl font-extrabold uppercase">
        <span>D.E.</span>
        <span>MTY</span>
      </p>
      <p className="text-[8px] uppercase">Distribuidor Electrico Monterrey</p>
    </div>
  );
}

function BrandNameFull() {
  return (
    <p className="flex flex-col text-2xl font-extrabold uppercase">
      <span>Distribuidor</span>
      <span>Electrico</span>
      <span>Monterrey</span>
    </p>
  );
}
