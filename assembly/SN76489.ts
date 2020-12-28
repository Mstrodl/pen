import * as displayer from "./displayer";

export class SN76489 {
  write(port: u8, value: u8) {
    displayer.writeSoundRegister(port, value);
  }
}
