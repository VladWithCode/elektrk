import { cn } from "@/lib/utils";
import brandLogo from "@/assets/logo_elektrk.webp";
import Image from "next/image";

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
        className="h-full w-auto max-h-20"
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
