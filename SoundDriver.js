// 16x clock divider
const BASE_FREQUENCY = 3579545 / (16 * 2);

class ToneRegister {
  constructor(ctx, dest, id) {
    this.id = id;
    this.ctx = ctx;
    this.node = ctx.createOscillator();
    this.node.type = "square";
    this.node.start();

    this.gain = ctx.createGain();

    this.node.connect(this.gain);
    this.gain.connect(dest);

    this.setFrequency(0);
    this.volume = 0;
  }

  calculateFrequency() {}

  setFrequency(frequency) {
    // console.log("[SN7] Setting frequency:", frequency);
    this.frequency = frequency;
    // console.log(BASE_FREQUENCY / this.frequency, ctx.currentTime);
    this.node.frequency.setValueAtTime(
      this.frequency ? BASE_FREQUENCY / this.frequency : 0,
      this.ctx.currentTime
    );
    // document.getElementById(`sn7-${this.id}-f`).textContent = frequency;
  }

  setVolume(value) {
    this.volume = value;
    const volume = VOLUME_TABLE[value] / 32767;
    this.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    // console.log("[SN7] Set gain:", volume, value);
    // document.getElementById(`sn7-${this.id}-v`).textContent = value;
  }
}

const frequencies = [6991, 3496, 1748];
class NoiseRegister {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.periodic = this.ctx.createBufferSource();
    this.white = this.ctx.createBufferSource();
    const length = 2 * this.ctx.sampleRate;
    this.white.buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const output = this.white.buffer.getChannelData(0);
    for (let i = 0; i < length; ++i) {
      output[i] = Math.random() * 2 - 1;
    }
    this.white.loop = true;

    this.gain = this.ctx.createGain();
    this.gain.connect(dest);
  }
  setFrequency(frequency) {
    console.time("Set frequency!");
    this.frequency = frequency;
    if ((frequency & 0b11) == 0b11) {
      this.frequencyNumber = channels[2].node.frequency.value;
    } else {
      this.frequencyNumber = frequencies[frequency & 0b11];
    }
    if ((frequency & 0b100) == 0) {
      // "Periodic noise"
      try {
        this.gain.disconnect(this.white);
      } catch (err) {
        // console.warn(err);
      }
      this.periodic.connect(this.gain);
    } else {
      // White noise
      try {
        this.gain.disconnect(this.periodic);
      } catch (err) {
        // console.warn(err);
      }
      this.white.connect(this.gain);
      try {
        this.white.start(0);
      } catch (err) {
        // console.warn(err);
      }
    }
    console.timeEnd("Set frequency!");
  }
  setVolume(value) {
    this.volume = value;
    const volume = VOLUME_TABLE[value] / 32767;
    console.log("Setting noise register volume", volume, value);
    this.gain.gain.setValueAtTime(
      isNaN(volume) ? 0 : volume,
      this.ctx.currentTime
    );
  }
}

const VOLUME_TABLE = [
  32767,
  26028,
  20675,
  16422,
  13045,
  10362,
  8231,
  6568,
  5193,
  4125,
  3277,
  2603,
  2067,
  1642,
  1304,
  0,
];

const channels = [];
const ctx = new AudioContext();
const gainNode = ctx.createGain();
const DEFAULT_VOLUME = 0.1;
gainNode.gain.value = DEFAULT_VOLUME;
for (let i = 0; i < 3; ++i) {
  channels.push(new ToneRegister(ctx, gainNode, i));
}
channels.push(new NoiseRegister(ctx, gainNode));
let lastChannel = 0;
let lastVolume = false;
gainNode.connect(ctx.destination);

module.exports = function write(port, value) {
  setTimeout(() => {
    // console.log(
    //   "[SN7] Writing value: ",
    //   value.toString(2).padStart(8, "0"),
    //   value
    // );
    if (value & 128) {
      // Latch
      const channel = (value >> 5) & 0b11;
      lastVolume = !!(value & 0b10000);
      lastChannel = channel;
      const result = value & 0b1111;
      if (lastVolume) {
        // Volume = 4 bits anyways
        channels[channel].setVolume(result & 0xf);
      } else {
        // Tone = 10 bits
        channels[channel].setFrequency(
          (channels[channel].frequency & 0b1111110000) | result
        );
      }
    } else {
      // Low 6 bits of value
      const result = value & 0b111111;
      // Data
      if (lastVolume) {
        channels[lastChannel].setVolume(result & 0xf);
      } else {
        channels[lastChannel].setFrequency(
          // Shift int back 4, 4+6=10
          (channels[lastChannel].frequency & 0b1111) | (result << 4)
        );
      }
    }
  });
};

module.exports.resume = () => ctx.resume();
module.exports.setMuted = (muted) =>
  gainNode.gain.setValueAtTime(muted ? 0 : DEFAULT_VOLUME, ctx.currentTime);
