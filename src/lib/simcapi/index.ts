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

export { simModel };
