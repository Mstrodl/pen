import { DisplayMode } from "./Display";
import { VideoProcessor, WIDTH } from "./VideoProcessor";
import * as console from "./console";

export class Graphics2 implements DisplayMode {
  video: VideoProcessor;
  colors: Uint32Array;

  constructor(video: VideoProcessor) {
    this.video = video;
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
  }

  setColor(x: i32, y: i32, colorId: u8): void {
    // if (i32(colorId) >= this.colors.length) {
    //   // throw new Error("Oh no! Trying to use color: " + colorId.toString());
    // }
    const color = i32(colorId) >= this.colors.length ? 0 : this.colors[colorId];
    const baseIndex = x * 4 + y * WIDTH * 4;
    this.video.screen[baseIndex] = color >> 16;
    this.video.screen[baseIndex + 1] = (color >> 8) & 0xff;
    this.video.screen[baseIndex + 2] = color & 0xff;
    this.video.screen[baseIndex + 3] = 255;
  }

  lineHandler(y: u8): void {
    const spriteLineIndex = i32(y & 7) + (i32(y & 0xc0) << 5);

    const patternTable = this.video.patternTable;
    const colorTable = this.video.colorTable;

    const nameStarts = this.video.nameTable + (i32(y & 0xf8) << 2);

    for (let x: u16 = 0; x < 32; ++x) {
      const I = i32(this.video.memory[nameStarts + x]) << 3;
      const color = this.video.memory[colorTable + I + spriteLineIndex];
      const fg: u8 = color >> 4;
      const bg: u8 = color & 0xf;

      const line = this.video.memory[patternTable + spriteLineIndex + I];

      // Each char is 8x8
      const screenX = i32(x) * 8;

      this.setColor(screenX + 0, y, line & 0x80 ? fg : bg);
      this.setColor(screenX + 1, y, line & 0x40 ? fg : bg);
      this.setColor(screenX + 2, y, line & 0x20 ? fg : bg);
      this.setColor(screenX + 3, y, line & 0x10 ? fg : bg);
      this.setColor(screenX + 4, y, line & 0x08 ? fg : bg);
      this.setColor(screenX + 5, y, line & 0x04 ? fg : bg);
      this.setColor(screenX + 6, y, line & 0x02 ? fg : bg);
      this.setColor(screenX + 7, y, line & 0x01 ? fg : bg);
    }
  }
}
