import type { ComponentProps } from "react";
import { cn } from "@/utils/tailwind";

function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("finlog-control appearance-none", className)} {...props} />;
}

export { Select };
