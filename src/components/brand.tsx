import logo from "@/assets/alaska-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function AlaskaMark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Alaska AI logo"
      className={cn("h-8 w-8 rounded-xl object-contain", className)}
    />
  );
}

export function AlaskaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <AlaskaMark />
      <span className="font-display text-lg font-semibold tracking-tight">Alaska AI</span>
    </span>
  );
}
