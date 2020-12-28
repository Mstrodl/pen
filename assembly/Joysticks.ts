export class Joysticks {
  mode: boolean;
  one: u16;
  two: u16;
  constructor() {
    this.mode = false;

    this.one = 0;
    this.two = 0;
  }
}
