import { FC, forwardRef } from "react";
import {
  ConfigInputCell,
  InputCellProps,
  PreviewInputCell,
} from "./cell-input";
import { ConfigLinkCell, LinkCellProps, PreviewLinkCell } from "./cell-link";
import {
  ConfigSelectCell,
  PreviewSelectCell,
  SelectCellProps,
} from "./cell-select";
import { AppModeSwitcher } from "./utils";

const LinkCell: FC<LinkCellProps> = (props) => {
  return (
    <AppModeSwitcher
      previewComponent={<PreviewLinkCell {...props} />}
      configComponent={<ConfigLinkCell {...props} />}
    />
  );
};

const InputCell = forwardRef<HTMLInputElement, InputCellProps>((props, ref) => {
  return (
    <AppModeSwitcher
      previewComponent={<PreviewInputCell {...props} ref={ref} />}
      configComponent={<ConfigInputCell {...props} ref={ref} />}
    />
  );
});

const SelectCell = forwardRef<HTMLInputElement, SelectCellProps>(
  (props, ref) => {
    return (
      <AppModeSwitcher
        previewComponent={<PreviewSelectCell {...props} ref={ref} />}
        configComponent={<ConfigSelectCell {...props} ref={ref} />}
      />
    );
  },
);

export { InputCell, LinkCell, SelectCell };
