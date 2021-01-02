export declare function refreshScreenJS(): void;
export declare function writeSoundRegisterJS(port: u8, value: u8): void;
export declare function receiveScreen(screen: Uint8ClampedArray): void;

export function writeSoundRegister(port: u8, value: u8): void {
  writeSoundRegisterJS(port, value);
}
export function refreshScreen(): void {
  refreshScreenJS();
}
