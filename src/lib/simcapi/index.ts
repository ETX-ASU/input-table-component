import { CellCoordinates } from "../store.ts";
import { capi } from "./model.ts";
import "./simcapi.js";

const simcapi = window.simcapi;
if (!simcapi) throw new Error("Error loading simcapi");

// Create model
const simModel = new simcapi.CapiAdapter.CapiModel(capi.defaults);

// Expose model with options
for (const key in capi.exposeWith) {
  simcapi.CapiAdapter.expose(
    key,
    simModel,
    capi.exposeWith[key as keyof typeof capi.exposeWith],
  );
}

// Notify when ready
simcapi.Transporter.notifyOnReady();

const cellModelKey = ({ col, row }: CellCoordinates) =>
  `Cell.Column${col}.Row${row}`;

const dinamicallyAddToSimModel = (
  props: { name: string; defaultValue: string }[],
) => {
  props.forEach(({ name, defaultValue }) => {
    simModel.set(name, defaultValue);
    simcapi.CapiAdapter.expose(name, simModel);
  });
};

const dinamicallyRemoveFromSimModel = (props: { name: string }[]) => {
  props.forEach(({ name }) => {
    simcapi.CapiAdapter.unexpose(name);
  });
};

export {
  cellModelKey,
  dinamicallyAddToSimModel,
  dinamicallyRemoveFromSimModel,
  simModel,
};
