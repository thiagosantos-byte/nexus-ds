import * as Primitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
export function Tooltip({
  children,
  text,
}: {
  children: ReactNode;
  text: string;
}) {
  return (
    <Primitive.Provider delayDuration={300}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content className="ui-tooltip" sideOffset={8}>
            {text}
            <Primitive.Arrow />
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
