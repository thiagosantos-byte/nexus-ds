import * as React from "react";
import * as Primitive from "@radix-ui/react-label";
export const Label = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>((props, ref) => <Primitive.Root ref={ref} {...props} />);
Label.displayName = "Label";
