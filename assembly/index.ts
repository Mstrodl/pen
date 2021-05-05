// The entry file of your WebAssembly module.
import * as console from "./console";
import { Z80 } from "./Z80";

export function createEmulator(bios: Uint8Array, cart: Uint8Array): Z80 {
  console.log("Cart: " + cart[0].toString());
  return new Z80(bios, cart);
}

export function step(emulator: Z80, many: boolean): u32 {
  if (many) {
    let collector = 0;
    for (let i = 0; i < 1024 * 4; ++i) {
      const amount = emulator.stepCpu();
      collector += amount;
    }
    return collector;
  } else {
    emulator.logging = true;
    const delay = emulator.stepCpu();
    emulator.logging = false;
    return delay;
  }
}

export function stepEmulatorVideo(emulator: Z80): Uint8ClampedArray {
  let times = 1;
  emulator.video.tick();
  // (not 235, because it gets +1'd at runtime)
  while (emulator.video.line != 234) {
    times++;
    emulator.video.tick();
  }
  return emulator.video.screen;
}

export function updateROM(emulator: Z80, rom: Uint8Array): void {
  emulator.memory.set(rom, 0x8000);
  emulator.memory.fill(0, rom.length + 0x8000);
}

export function reset(emulator: Z80): void {
  emulator.registers.PC = 0;
  emulator.registers.SP = 0;

  emulator.registers.IX = 0;
  emulator.registers.IY = 0;

  emulator.registers.I = 0;
  emulator.registers.R = 0;

  emulator.registers.A1 = 0;
  emulator.registers.F1 = 0;

  emulator.registers.B1 = 0;
  emulator.registers.C1 = 0;

  emulator.registers.D1 = 0;
  emulator.registers.E1 = 0;

  emulator.registers.H1 = 0;
  emulator.registers.L1 = 0;

  emulator.registers.A2 = 0;
  emulator.registers.F2 = 0;

  emulator.registers.B2 = 0;
  emulator.registers.C2 = 0;

  emulator.registers.D2 = 0;
  emulator.registers.E2 = 0;

  emulator.registers.H2 = 0;
  emulator.registers.L2 = 0;

  emulator.registers.registerSet = false;
  emulator.registers.mathSet = false;

  emulator.registers.instructionCount = 228;
  emulator.registers.instructionPeriod = 228;

  emulator.registers.NMI = false;
  emulator.registers.IFF1 = false;
  emulator.registers.IFF2 = false;
  emulator.registers.INT = false;

  emulator.registers.INTMODE = 0;

  emulator.registers.halted = false;

  emulator.registers.cycleOffset = 0;

  emulator.trapping = false;
  emulator.logging = false;
  emulator.memory.fill(0, 0x5fff, 0x6000);

  emulator.video.memory.fill(0);
  emulator.video.registers.fill(0);
  emulator.video.pendingAddress = 0;
  emulator.video.status = 0;
  emulator.video.status = 0;
  emulator.video.fifthSprite = 0;
  emulator.video.interrupt = false;
  emulator.video.latch = false;
  emulator.video.updateCount = 0;
  emulator.video.line = 0;
  emulator.video.screen.fill(0);
  for (let i = 3; i < emulator.video.screen.length; i += 4) {
    emulator.video.screen[i] = 0xff;
  }
}

export function pc(emulator: Z80): u16 {
  return emulator.registers.PC;
}

export function getMemory(emulator: Z80): Uint8Array {
  return emulator.memory;
}

export function getSprites(emulator: Z80): Uint8Array {
  return emulator.video.memory.slice(emulator.video.patternTable);
}

export function getPatternAt(emulator: Z80, x: u16, y: u16): u8 {
  return emulator.video.memory[
    emulator.video.nameTable + ((y & 0xf8) << 2) + x
  ];
}

export function controllerKeys(emulator: Z80, state: u16): void {
  emulator.joysticks.one = state;
  emulator.registers.INT = true;
}

export function debugLog(emulator: Z80): Array<i32> {
  return emulator.debuggingItems.values();
}

// Test rig stuff
export function getRegister(emulator: Z80, register: string): u16 {
  if (register == "a") {
    return emulator.registers.A;
  } else if (register == "f") {
    return emulator.registers.F;
  } else if (register == "b") {
    return emulator.registers.B;
  } else if (register == "c") {
    return emulator.registers.C;
  } else if (register == "d") {
    return emulator.registers.D;
  } else if (register == "e") {
    return emulator.registers.E;
  } else if (register == "h") {
    return emulator.registers.H;
  } else if (register == "l") {
    return emulator.registers.L;
  } else if (register == "ixh") {
    return (emulator.registers.IX >> 8) & 0xff;
  } else if (register == "ixl") {
    return emulator.registers.IX & 0xff;
  } else if (register == "iyh") {
    return (emulator.registers.IY >> 8) & 0xff;
  } else if (register == "iyl") {
    return emulator.registers.IY & 0xff;
  } else if (register == "i") {
    return emulator.registers.I;
  } else if (register == "r") {
    return emulator.registers.R;
  } else if (register == "af") {
    return emulator.registers.AF;
  } else if (register == "bc") {
    return emulator.registers.BC;
  } else if (register == "de") {
    return emulator.registers.DE;
  } else if (register == "hl") {
    return emulator.registers.HL;
  } else if (register == "afPrime") {
    emulator.registers.mathSet = !emulator.registers.mathSet;
    const value = emulator.registers.AF;
    emulator.registers.mathSet = !emulator.registers.mathSet;
    return value;
  } else if (register == "bcPrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    const value = emulator.registers.BC;
    emulator.registers.registerSet = !emulator.registers.registerSet;
    return value;
  } else if (register == "dePrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    const value = emulator.registers.DE;
    emulator.registers.registerSet = !emulator.registers.registerSet;
    return value;
  } else if (register == "hlPrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    const value = emulator.registers.HL;
    emulator.registers.registerSet = !emulator.registers.registerSet;
    return value;
  } else if (register == "ix") {
    return emulator.registers.IX;
  } else if (register == "iy") {
    return emulator.registers.IY;
  } else if (register == "sp") {
    return emulator.registers.SP;
  } else if (register == "pc") {
    return emulator.registers.PC;
  } else if (register == "memptr") {
    return 0;
  } else if (register == "iff1") {
    return emulator.registers.IFF1 ? 1 : 0;
  } else if (register == "iff2") {
    return emulator.registers.IFF2 ? 1 : 0;
  } else if (register == "im") {
    return emulator.registers.INTMODE;
  } else if (register == "halted") {
    return emulator.registers.halted ? 1 : 0;
  } else {
    throw new Error("Unknown register: " + register);
  }
}

export function readMemory(emulator: Z80, address: u16): u8 {
  return emulator.memory[address];
}

export function setRegister(emulator: Z80, register: string, value: u16): void {
  if (register == "a") {
    emulator.registers.A = u8(value);
  } else if (register == "f") {
    emulator.registers.F = u8(value);
  } else if (register == "b") {
    emulator.registers.B = u8(value);
  } else if (register == "c") {
    emulator.registers.C = u8(value);
  } else if (register == "d") {
    emulator.registers.D = u8(value);
  } else if (register == "e") {
    emulator.registers.E = u8(value);
  } else if (register == "h") {
    emulator.registers.H = u8(value);
  } else if (register == "l") {
    emulator.registers.L = u8(value);
  } else if (register == "ixh") {
    emulator.registers.IX = (emulator.registers.IX & 0xff) | (value << 8);
  } else if (register == "ixl") {
    emulator.registers.IX = (emulator.registers.IX & 0xff00) | value;
  } else if (register == "iyh") {
    emulator.registers.IY = (emulator.registers.IY & 0xff) | (value << 8);
  } else if (register == "iyl") {
    emulator.registers.IY = (emulator.registers.IY & 0xff00) | value;
  } else if (register == "i") {
    emulator.registers.I = u8(value);
  } else if (register == "r") {
    emulator.registers.R = u8(value);
  } else if (register == "af") {
    emulator.registers.AF = value;
  } else if (register == "bc") {
    emulator.registers.BC = value;
  } else if (register == "de") {
    emulator.registers.DE = value;
  } else if (register == "hl") {
    emulator.registers.HL = value;
  } else if (register == "afPrime") {
    emulator.registers.mathSet = !emulator.registers.mathSet;
    emulator.registers.AF = value;
    emulator.registers.mathSet = !emulator.registers.mathSet;
  } else if (register == "bcPrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    emulator.registers.BC = value;
    emulator.registers.registerSet = !emulator.registers.registerSet;
  } else if (register == "dePrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    emulator.registers.DE = value;
    emulator.registers.registerSet = !emulator.registers.registerSet;
  } else if (register == "hlPrime") {
    emulator.registers.registerSet = !emulator.registers.registerSet;
    emulator.registers.HL = value;
    emulator.registers.registerSet = !emulator.registers.registerSet;
  } else if (register == "ix") {
    emulator.registers.IX = value;
  } else if (register == "iy") {
    emulator.registers.IY = value;
  } else if (register == "sp") {
    emulator.registers.SP = value;
  } else if (register == "pc") {
    emulator.registers.PC = value;
  } else if (register == "iff1") {
    emulator.registers.IFF1 = value != 0;
  } else if (register == "iff2") {
    emulator.registers.IFF2 = value != 0;
  } else if (register == "im") {
    emulator.registers.INTMODE = u8(value);
  } else if (register == "halted") {
    emulator.registers.halted = value != 0;
  }
}

export function writeMemory(emulator: Z80, address: u16, value: u8): void {
  emulator.memory[address] = value;
}

export const UINT8ARRAY_ID = idof<Uint8Array>();
export const INT16ARRAY_ID = idof<Int16Array>();
export const UINT16ARRAY_ID = idof<Uint16Array>();
export const INT32ARRAY_ID = idof<Int32Array>();
export const UINT32ARRAY_ID = idof<Uint32Array>();
export const FLOAT32ARRAY_ID = idof<Float32Array>();
export const ARRAYI32_ID = idof<Array<i32>>();
export const STATICARRAYI32_ID = idof<StaticArray<i32>>();
export const STATICARRAYU32_ID = idof<StaticArray<u32>>();
export const STATICARRAYU8_ID = idof<StaticArray<u8>>();
export const STATICARRAYI16_ID = idof<StaticArray<i16>>();
export const STATICARRAYF32_ID = idof<StaticArray<f32>>();
