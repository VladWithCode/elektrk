import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  linkClassName?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: { icon: "h-4 w-4", text: "text-base" },
  md: { icon: "h-5 w-5", text: "text-lg" },
  lg: { icon: "h-6 w-6", text: "text-xl" },
};

export function BrandLogo({ className, linkClassName, size = "md" }: BrandLogoProps) {
  const { icon, text } = SIZE_CLASSES[size];
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-heading font-bold", text, linkClassName)}
    >
      <Zap className={cn(icon, "text-primary", className)} />
      <span className="text-foreground">
        Elektr<span className="text-primary">K</span>
      </span>
    </Link>
  );
}
