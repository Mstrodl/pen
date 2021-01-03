import * as console from "./console";
import * as displayer from "./displayer";
import { u16HexImportant as $, u8HexImportant as _ } from "./console";
import { Z80 } from "./Z80";

import { DisplayMode } from "./Display";
import { Graphics1 } from "./GraphicsMode1";
import { Graphics2 } from "./GraphicsMode2";

export const VDP_START_LINE = 3 + 13 + 27;
export const VDP_END_LINE = VDP_START_LINE + 192;

export const WIDTH = 256;
export const HEIGHT = 192;

export class VideoProcessor {
  memory: Uint8Array;
  registers: Uint8Array;
  readAhead: u8;
  pendingAddress: u16;
  // status register
  status: u8;
  fifthSprite: u8;
  interrupt: boolean;
  latch: boolean;
  REGISTER_MASKS: Uint8Array;

  updateCount: u8;
  // Position of scanline
  line: u16;

  cpu: Z80;

  screen: Uint8ClampedArray;

  modes: StaticArray<DisplayMode | null>;

  constructor(cpu: Z80) {
    this.cpu = cpu;

    // VRAM
    this.memory = new Uint8Array(0x4000);
    this.registers = new Uint8Array(8).fill(0);

    this.pendingAddress = 0;
    this.readAhead = 0;
    this.latch = false;
    this.fifthSprite = 31;
    this.interrupt = false;

    this.REGISTER_MASKS = new Uint8Array(8);
    this.REGISTER_MASKS[0] = 0x03;
    this.REGISTER_MASKS[1] = 0xfb;
    this.REGISTER_MASKS[2] = 0x0f;
    this.REGISTER_MASKS[3] = 0xff;
    this.REGISTER_MASKS[4] = 0x07;
    this.REGISTER_MASKS[5] = 0x7f;
    this.REGISTER_MASKS[6] = 0x07;
    this.REGISTER_MASKS[7] = 0xff;

    this.screen = new Uint8ClampedArray(WIDTH * HEIGHT * 4);

    this.modes = new StaticArray<DisplayMode | null>(4);
    this.modes[1] = new Graphics1(this);
    // this.modes[2] = new Graphics2(this);
    // this.modes[1] = new Graphics2(this);
    // this.modes[2] = new Multicolor(this);
    // this.modes[4] = new Text(this);

    for (let i = 3; i < this.screen.length; i += 4) {
      this.screen[i] = 0xff;
    }

    displayer.receiveScreen(this.screen);
  }

  // https://github.com/mamedev/mame/blob/f81fbdb8d4356b7a526a902726463e2f1af00615/src/devices/video/tms9928a.cpp#L147
  write(port: u8, value: u8): void {
    if (!(port & 0x1)) {
      // "Control"/VRAM direct
      this.writeMemory(value);
    } else {
      // Registers / Address setup
      this.writeRegister(value);
    }
  }

  readRegister(): u8 {
    const data = this.status;
    // Wipe out all data except 5th sprite
    // We're resetting status here, basically
    this.status &= 0x40 | 0x1f;
    return data;
  }

  doInterrupt(): void {
    throw new Error("What the heck is an interrupt!");
  }

  get mode(): u8 {
    const mode =
      (((this.registers[0] & 2) >> 1) & 1) | ((this.registers[1] & 0x18) >> 2);
    switch (mode) {
      case 0:
        return 1;
      case 1:
        return 2;
      case 2:
        return 3;
      case 4:
        return 0;
      default:
        return mode;
    }
  }
  get externalVideo(): boolean {
    return (this.registers[0] & 1) == 1;
  }
  get blank(): boolean {
    return (this.registers[1] & 2) == 0;
  }
  get interruptEnable(): boolean {
    return (this.registers[1] & 0x20) == 0x20;
  }
  get spriteSize(): boolean {
    return (this.registers[1] & 64) == 64;
  }
  get spriteMagnify(): boolean {
    return (this.registers[1] & 128) == 128;
  }
  get nameTable(): u16 {
    return u16(this.registers[2] & 0x7f) << 10;
  }
  get colorTable(): u16 {
    if (this.registers[0] & 2) {
      if (this.registers[3] == 0x7f) return 0x0000;
      if (this.registers[3] == 0xff) return 0x2000;
    }
    return u16(this.registers[3]) << 6;
  }
  get patternTable(): u16 {
    if (this.registers[0] & 2) {
      if (this.registers[4] == 0x7f) return 0x0000;
      if (this.registers[4] == 0xff) return 0x2000;
    }
    return u16(this.registers[4] & 7) * 0x800;
  }

  get spriteAttributeTable(): u16 {
    return (this.registers[5] & 127) << 7;
  }
  get spritePatternTable(): u16 {
    return (this.registers[6] & 7) << 11;
  }
  get textColor(): u8 {
    return this.registers[7] >> 4;
  }
  get backdropColor(): u8 {
    return this.registers[7] & 0xf;
  }

  setRegister(register: u8, value: u8): void {
    value &= this.REGISTER_MASKS[register];
    this.registers[register] = value;
  }

  writeRegister(value: u8): void {
    if (this.latch) {
      this.pendingAddress =
        ((u16(value) << 8) | (this.pendingAddress & 0xff)) &
        (u16(this.memory.length) - 1);

      // Register
      if (value & 0x80) {
        this.setRegister(value & 7, u8(this.pendingAddress));
      } else if (!(value & 0x40)) {
        this.readMemory();
      }
      this.latch = false;
    } else {
      this.pendingAddress =
        ((this.pendingAddress & 0xff00) | value) &
        (u16(this.memory.length) - 1);
      this.latch = true;
    }
  }

  writeMemory(value: u8): void {
    // Write value to pending address
    this.memory[this.pendingAddress] = value;

    // Increment address
    this.pendingAddress =
      (this.pendingAddress + 1) & (u16(this.memory.length) - 1);
    this.readAhead = value;

    this.latch = false;
  }

  readMemory(): u8 {
    const data = this.readAhead;
    // Read next part of memory
    this.readAhead = this.memory[this.pendingAddress];
    this.pendingAddress =
      (this.pendingAddress + 1) & (u16(this.memory.length) - 1);
    this.latch = false;
    return data;
  }

  tick(): void {
    // Increment scanline, 252 lines
    if (++this.line >= 262) this.line = 0;

    if (this.line >= u16(VDP_START_LINE) && this.line < u16(VDP_END_LINE)) {
      if (this.updateCount >= 100) {
        const handler = this.modes[this.mode];
        if (handler != null) {
          handler.lineHandler(u8(this.line - VDP_START_LINE));
        } else {
          throw new Error("(Missing handler for " + this.mode.toString() + ")");
        }
      }
    }
    if (this.line == u16(VDP_END_LINE)) {
      if (this.updateCount >= 100) {
        displayer.refreshScreen();
        this.updateCount -= 100;
      }
      this.updateCount += 75;
      const irq = this.interruptEnable && (this.status & 0x80) == 0;

      // Set vblank
      this.status |= 0x80;

      // Collision flag
      if ((this.status & 32) == 0) {
        this.checkCollisions();
      }

      if (irq) {
        this.cpu.doNMI();
      }
    }
  }

  checkCollisions(): void {
    // Check all sprites, if collision:
    this.status |= 32;
  }
}
