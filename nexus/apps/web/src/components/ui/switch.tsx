import * as React from "react";
import * as Primitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";
export const Switch = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root ref={ref} className={cn("a11y-switch", className)} {...props}>
    <Primitive.Thumb className="a11y-switch-thumb" />
  </Primitive.Root>
));
Switch.displayName = "Switch";
