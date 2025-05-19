import { FC, PropsWithChildren } from "react";

export const Tooltip: FC<PropsWithChildren<{ text: string }>> = ({
  children,
  text,
}) => {
  return (
    <div data-tooltip-id="app-tooltip" data-tooltip-content={text}>
      {children}
    </div>
  );
};
