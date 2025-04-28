/* eslint-disable @typescript-eslint/no-explicit-any */

interface Simcapi {
  // TODO type this
  Transporter: any;
  BackboneAdapter: any;
  CapiAdapter: any;
  noConflict: () => Simcapi;
}

declare global {
  interface Window {
    simcapi: Simcapi;
  }
}

export {};
