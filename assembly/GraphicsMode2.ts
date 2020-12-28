import { DisplayMode } from "./Display";
import { VideoProcessor } from "./VideoProcessor";
import * as console from "./console";

export class Graphics2 implements DisplayMode {
  video: VideoProcessor;
  colors: Uint32Array;

  constructor(video: VideoProcessor) {
    this.video = video;
    this.colors = new Uint32Array(32);

    let i = 0;
    this.colors[i++] = 0x000000;
    this.colors[i++] = 0x000000;
    this.colors[i++] = 0x24da24;
    this.colors[i++] = 0x6dff6d;
    this.colors[i++] = 0x2424ff;
    this.colors[i++] = 0x486dff;
    this.colors[i++] = 0xb62424;
    this.colors[i++] = 0x48daff;
    this.colors[i++] = 0xff2424;
    this.colors[i++] = 0xff6d6d;
    this.colors[i++] = 0xdada24;
    this.colors[i++] = 0xdada91;
    this.colors[i++] = 0x249124;
    this.colors[i++] = 0xda48b6;
    this.colors[i++] = 0xb6b6b6;
    this.colors[i++] = 0xffffff;
  }

  setColor(x: i32, y: i32, colorId: u8): void {
    // if (i32(colorId) >= this.colors.length) {
    //   // throw new Error("Oh no! Trying to use color: " + colorId.toString());
    // }
    const color = i32(colorId) >= this.colors.length ? 0 : this.colors[colorId];
    const baseIndex = x * 4 + y * 272 * 4;
    this.video.screen[baseIndex] = color >> 8;
    this.video.screen[baseIndex + 1] = (color >> 4) & 0xff;
    this.video.screen[baseIndex + 2] = color & 0xff;
    // this.video.screen[baseIndex + 3] = 255;
  }

  lineHandler(y: u8): void {
    const spriteLineIndex = u16(y & 7) + u16((y & 0x60) << 5);
    // console.log(
    //   "Sprite Line Index: " + y.toString() + " " + spriteLineIndex.toString()
    // );
    const patternTable = this.video.patternTable;
    const colorTable = this.video.colorTable;

    const nameStarts = this.video.nameTable + (u16(y & 0xf8) << 2);

    const CLTMask = 0xffffff;
    const PGTMask = 0xffffff;
    for (let x: u16 = 0; x < 32; ++x) {
      const I = this.video.memory[nameStarts] << 3;
      const color = this.video.memory[
        colorTable + ((I + spriteLineIndex) | 0) // & CLTMask
      ];
      const fg = this.video.memory[colorTable + (color >> 4)];
      const bg = this.video.memory[colorTable + (color & 0xf)];
      const line = this.video.memory[
        patternTable + ((spriteLineIndex + I) | 0) // & PGTMask)
      ];

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
    // console.importantLog(patterns);
  }
}
