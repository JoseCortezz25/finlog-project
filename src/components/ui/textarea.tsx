import type { ComponentProps } from "react";
import { cn } from "@/utils/tailwind";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "finlog-control min-h-28 resize-y placeholder:text-muted-foreground/80",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
