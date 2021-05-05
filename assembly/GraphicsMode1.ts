import { DisplayMode } from "./Display";
import { VideoProcessor, WIDTH } from "./VideoProcessor";
import * as console from "./console";

export class Graphics1 implements DisplayMode {
  video: VideoProcessor;
  colors: Uint32Array;

  constructor(video: VideoProcessor) {
    this.video = video;
    this.colors = new Uint32Array(16);

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
    const color = this.colors[colorId & 0xf];
    const baseIndex = x * 4 + y * WIDTH * 4;
    if (baseIndex + 3 >= this.video.screen.length) {
      console.log(
        "Putting: " +
        colorId.toString() +
        " to: " +
        x.toString() +
        ", " +
        y.toString()
      );
    }
    this.video.screen[baseIndex] = color >> 16;
    this.video.screen[baseIndex + 1] = (color >> 8) & 0xff;
    this.video.screen[baseIndex + 2] = color & 0xff;
    // this.video.screen[baseIndex + 3] = colorId == 0 ? 255 : 0;
  }

  lineHandler(y: u8): void {
    const patternY = u16(y & 7);
    const patternStarts = this.video.patternTable;
    const colorTable = this.video.colorTable;

    const nameStarts = this.video.nameTable + (u16(y & 0xf8) << 2);

    for (let x: u16 = 0; x < 32; ++x) {
      const patternIndex = this.video.memory[nameStarts + x];
      let line = this.video.memory[
        patternStarts + ((u16(patternIndex) << 3) | patternY)
      ];
      // Each char is 8x8
      const screenX = i32(x) * 8;

      const color = this.video.memory[colorTable + (patternIndex >> 3)];
      const fg = color >> 4;
      const bg = color & 0xf;

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
