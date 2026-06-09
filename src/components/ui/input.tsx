import type { ComponentProps } from "react";
import { cn } from "@/utils/tailwind";

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn("finlog-control placeholder:text-muted-foreground/80", className)}
      {...props}
    />
  );
}

export { Input };
