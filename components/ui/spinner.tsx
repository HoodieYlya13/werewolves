import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** A turning circle where an icon or a result is on its way; the button or region around it says what for. */
export function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return <LoaderCircle aria-hidden data-slot="spinner" className={cn("size-4 animate-spin", className)} {...props} />;
}
