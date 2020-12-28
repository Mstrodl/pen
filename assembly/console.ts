export declare function consoleLog(arg0: string): void;
export declare function consoleLogOP(op: u8, pc: u16): void;
export declare function updateRegisters_(
  pc: u16,
  a: u8,
  f: u8,
  bc: u16,
  de: u16,
  hl: u16,
  ix: u16,
  iy: u16,
  i: u8,
  r: u8,
  sp: u16
): void;

export function log(arg0: string): void {
  consoleLog(arg0);
}
export function logOP(op: u8, pc: u16): void {
  consoleLogOP(op, pc);
}
export function importantLog(arg0: string): void { }

export function u8Hex(arg0: u8): string {
  return "";
}
export function u16Hex(arg0: u16): string {
  return "";
}

export function u8HexImportant(arg0: u8): string {
  return "";
}
export function u16HexImportant(arg0: u16): string {
  return "";
}

export function logMemory(arr: Uint8Array): void { }

export function updateRegisters(
  pc: u16,
  a: u8,
  f: u8,
  bc: u16,
  de: u16,
  hl: u16,
  ix: u16,
  iy: u16,
  i: u8,
  r: u8,
  sp: u16
): void {
  updateRegisters_(pc, a, f, bc, de, hl, ix, iy, i, r, sp);
}
