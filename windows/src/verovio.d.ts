declare module 'verovio/wasm-hum' {
  const create: () => Promise<unknown>;
  export default create;
}
declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): number;
    getPageCount(): number;
    renderToSVG(page: number): string;
    getMEI(): string;
    destroy(): void;
  }
}
