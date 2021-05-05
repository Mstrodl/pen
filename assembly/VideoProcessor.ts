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
  colors: Uint32Array;

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

    this.colors = new Uint32Array(32);

    this.colors[0] = 0x000000;
    this.colors[1] = 0x000000;
    this.colors[2] = 0x24da24;
    this.colors[3] = 0x6dff6d;
    this.colors[4] = 0x2424ff;
    this.colors[5] = 0x486dff;
    this.colors[6] = 0xb62424;
    this.colors[7] = 0x48daff;
    this.colors[8] = 0xff2424;
    this.colors[9] = 0xff6d6d;
    this.colors[0xa] = 0xdada24;
    this.colors[0xb] = 0xdada91;
    this.colors[0xc] = 0x249124;
    this.colors[0xd] = 0xda48b6;
    this.colors[0xe] = 0xb6b6b6;
    this.colors[0xf] = 0xffffff;

    this.modes = new StaticArray<DisplayMode | null>(4);
    this.modes[1] = new Graphics1(this);
    this.modes[2] = new Graphics2(this);
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
    // Might be wrong...
    return (this.registers[1] & 128) != 128;
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
      return 0x2000;
    }
    return u16(this.registers[4] & 7) * 0x800;
    // return this.registers[4] << 11;
  }

  get spriteAttributeTable(): u16 {
    return u16(this.registers[5] & 127) << 7;
  }
  get spritePatternTable(): u16 {
    return u16(this.registers[6] & 7) << 11;
  }
  get textColor(): u8 {
    return this.registers[7] >> 4;
  }
  get backdropColor(): u8 {
    return this.registers[7] & 0xf;
  }

  setRegister(register: u8, value: u8): void {
    value &= this.REGISTER_MASKS[register];
    if (
      register == 1 &&
      // 0x20 = IRQ enable
      ((this.registers[register] ^ value) & value & 0x20) == 0x20 &&
      // 0x80 = vblank
      this.status & 0x80
    ) {
      this.cpu.doNMI();
    }
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

  refreshSprites(line: u8): void {
    // Caculate sprite height
    const nominalHeight = this.spriteSize ? 16 : 8;
    const height = nominalHeight * (this.spriteMagnify ? 2 : 1);
    const spriteTable = this.spriteAttributeTable;

    const spritePatternTable = this.spritePatternTable;
    let sprites = 0;
    let spriteCount = 0;
    let x2: i32;

    if (i32(spriteTable) + 4 * 32 >= this.memory.length) {
      console.log(
        "Danger! Pattern table might go out of bounds! Table is " +
        spriteTable.toString()
      );
      return;
    }

    for (x2 = 0; x2 < 32; ++x2) {
      let spriteY = i32(this.memory[spriteTable + x2 * 4]);

      if (spriteY == 208) {
        break;
      }
      // Negative Y
      if (spriteY > i32(256) - i32(nominalHeight)) {
        spriteY -= 256;
      }

      // We're drawing this sprite on this line!
      if (i32(line) > spriteY && i32(line) < spriteY + height) {
        ++spriteCount;
        if (spriteCount > 4) {
          // 5th sprite
          this.status |= 0x40;
          break;
        }
        sprites |= 1 << x2;
      }
    }

    // Last checked x coordinate
    this.status |= u8(x2 < 32 ? x2 : 31);

    for (let x: u8 = 32; x > 0; --x) {
      if (sprites & (1 << x)) {
        const attributeStart = spriteTable + x * 4;
        const attributes = this.memory[attributeStart + 3];

        const deltaX =
          attributes & 0x80
            ? i32(this.memory[attributeStart + 1]) - 32
            : i32(this.memory[attributeStart + 1]);
        const colorId = attributes & 0xf;

        if (deltaX < 256 && deltaX > -nominalHeight && colorId != 0) {
          let spriteY = i32(this.memory[attributeStart]);
          if (spriteY > 256 - nominalHeight) {
            spriteY -= 256;
          }

          spriteY = line - spriteY - 1;
          const dataPointer =
            this.spritePatternTable +
            (i32(
              nominalHeight > 8
                ? this.memory[attributeStart + 2] & 0xfc
                : this.memory[attributeStart + 2]
            ) <<
              3) +
            (height > nominalHeight ? spriteY >> 1 : spriteY);

          let mask = u16(
            deltaX >= 0
              ? 0xffff
              : (0x10000 >> (nominalHeight > height ? -deltaX >> 1 : -deltaX)) -
              1
          );

          mask &=
            (u16(this.memory[dataPointer]) << 8) |
            u16(nominalHeight > 8 ? this.memory[dataPointer + 16] : 0);

          const baseIndex = deltaX * 4 + line * WIDTH * 4;

          if (height > nominalHeight) {
            if (mask & 0x8000) {
              this.setColor(baseIndex + 4 * 1, colorId);
              this.setColor(baseIndex, colorId);
            }
            if (mask & 0x4000 && deltaX + 2 < WIDTH) {
              this.setColor(baseIndex + 4 * 2, colorId);
              this.setColor(baseIndex + 4 * 3, colorId);
            }
            if (mask & 0x2000 && deltaX + 4 < WIDTH) {
              this.setColor(baseIndex + 4 * 4, colorId);
              this.setColor(baseIndex + 4 * 5, colorId);
            }
            if (mask & 0x1000 && deltaX + 6 < WIDTH) {
              this.setColor(baseIndex + 4 * 6, colorId);
              this.setColor(baseIndex + 4 * 7, colorId);
            }
            if (mask & 0x800 && deltaX + 8 < WIDTH) {
              this.setColor(baseIndex + 4 * 8, colorId);
              this.setColor(baseIndex + 4 * 9, colorId);
            }
            if (mask & 0x400 && deltaX + 10 < WIDTH) {
              this.setColor(baseIndex + 4 * 10, colorId);
              this.setColor(baseIndex + 4 * 11, colorId);
            }
            if (mask & 0x200 && deltaX + 12 < WIDTH) {
              this.setColor(baseIndex + 4 * 12, colorId);
              this.setColor(baseIndex + 4 * 13, colorId);
            }
            if (mask & 0x100 && deltaX + 14 < WIDTH) {
              this.setColor(baseIndex + 4 * 14, colorId);
              this.setColor(baseIndex + 4 * 15, colorId);
            }

            // Right 16
            if (mask & 0x80 && deltaX + 16 < WIDTH) {
              this.setColor(baseIndex + 4 * 16, colorId);
              this.setColor(baseIndex + 4 * 17, colorId);
            }
            if (mask & 0x40 && deltaX + 18 < WIDTH) {
              this.setColor(baseIndex + 4 * 18, colorId);
              this.setColor(baseIndex + 4 * 19, colorId);
            }
            if (mask & 0x20 && deltaX + 20 < WIDTH) {
              this.setColor(baseIndex + 4 * 20, colorId);
              this.setColor(baseIndex + 4 * 21, colorId);
            }
            if (mask & 0x10 && deltaX + 22 < WIDTH) {
              this.setColor(baseIndex + 4 * 22, colorId);
              this.setColor(baseIndex + 4 * 23, colorId);
            }
            if (mask & 0x8 && deltaX + 24 < WIDTH) {
              this.setColor(baseIndex + 4 * 24, colorId);
              this.setColor(baseIndex + 4 * 25, colorId);
            }
            if (mask & 0x4 && deltaX + 26 < WIDTH) {
              this.setColor(baseIndex + 4 * 26, colorId);
              this.setColor(baseIndex + 4 * 27, colorId);
            }
            if (mask & 0x2 && deltaX + 28 < WIDTH) {
              this.setColor(baseIndex + 4 * 28, colorId);
              this.setColor(baseIndex + 4 * 29, colorId);
            }
            if (mask & 0x1 && deltaX + 30 < WIDTH) {
              this.setColor(baseIndex + 4 * 30, colorId);
              this.setColor(baseIndex + 4 * 31, colorId);
            }
          } else {
            if (mask & 0x8000) {
              this.setColor(baseIndex, colorId);
            }
            if (mask & 0x4000 && deltaX + 1 < WIDTH) {
              this.setColor(baseIndex + 4 * 1, colorId);
            }
            if (mask & 0x2000 && deltaX + 2 < WIDTH) {
              this.setColor(baseIndex + 4 * 2, colorId);
            }
            if (mask & 0x1000 && deltaX + 3 < WIDTH) {
              this.setColor(baseIndex + 4 * 3, colorId);
            }
            if (mask & 0x800 && deltaX + 4 < WIDTH) {
              this.setColor(baseIndex + 4 * 4, colorId);
            }
            if (mask & 0x400 && deltaX + 5 < WIDTH) {
              this.setColor(baseIndex + 4 * 5, colorId);
            }
            if (mask & 0x200 && deltaX + 6 < WIDTH) {
              this.setColor(baseIndex + 4 * 6, colorId);
            }
            if (mask & 0x100 && deltaX + 7 < WIDTH) {
              this.setColor(baseIndex + 4 * 7, colorId);
            }

            // Right 16
            if (mask & 0x80 && deltaX + 8 < WIDTH) {
              this.setColor(baseIndex + 4 * 8, colorId);
            }
            if (mask & 0x40 && deltaX + 9 < WIDTH) {
              this.setColor(baseIndex + 4 * 9, colorId);
            }
            if (mask & 0x20 && deltaX + 10 < WIDTH) {
              this.setColor(baseIndex + 4 * 10, colorId);
            }
            if (mask & 0x10 && deltaX + 11 < WIDTH) {
              this.setColor(baseIndex + 4 * 11, colorId);
            }
            if (mask & 0x8 && deltaX + 12 < WIDTH) {
              this.setColor(baseIndex + 4 * 12, colorId);
            }
            if (mask & 0x4 && deltaX + 13 < WIDTH) {
              this.setColor(baseIndex + 4 * 13, colorId);
            }
            if (mask & 0x2 && deltaX + 14 < WIDTH) {
              this.setColor(baseIndex + 4 * 14, colorId);
            }
            if (mask & 0x1 && deltaX + 15 < WIDTH) {
              this.setColor(baseIndex + 4 * 15, colorId);
            }
          }
        }
      }
    }
  }

  @inline
  setColor(baseIndex: i32, colorId: u8): void {
    const color = this.colors[colorId];
    this.screen[baseIndex] = color >> 16;
    this.screen[baseIndex + 1] = (color >> 8) & 0xff;
    this.screen[baseIndex + 2] = color & 0xff;
  }

  tick(): void {
    // Increment scanline, 252 lines
    if (++this.line >= 262) this.line = 0;

    if (this.line >= u16(VDP_START_LINE) && this.line < u16(VDP_END_LINE)) {
      if (this.updateCount >= 100) {
        const line = u8(this.line - VDP_START_LINE);
        const handler = this.modes[this.mode];
        if (handler != null) {
          handler.lineHandler(line);
        } else {
          throw new Error("(Missing handler for " + this.mode.toString() + ")");
        }

        this.refreshSprites(line);
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
