export declare function refreshScreenJS(arg0: Uint8ClampedArray): void;
export declare function writeSoundRegisterJS(port: u8, value: u8): void;

export function writeSoundRegister(port: u8, value: u8): void {
  writeSoundRegisterJS(port, value);
}
export function refreshScreen(arg0: Uint8ClampedArray): void {
  refreshScreenJS(arg0);
}
