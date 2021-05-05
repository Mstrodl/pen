const ColecoAsync = require("./index");
const SoundDriver = require("./SoundDriver");
const biosUrl = require("url:./roms/bios.col");
const romUrl = require("url:./roms/dk.col");

const biosPromise = fetch(biosUrl, {cache: "force-cache"}).then((res) =>
  res.arrayBuffer()
);
const romPromise = fetch(romUrl, {cache: "force-cache"}).then((res) =>
  res.arrayBuffer()
);
ColecoAsync.then((ColecoInstance) => {
  const Coleco = ColecoInstance.exports;
  Promise.all([
    biosPromise.then((bios) =>
      Coleco.__pin(
        Coleco.__newArray(Coleco.UINT8ARRAY_ID, new Uint8Array(bios))
      )
    ),
    romPromise.then((rom) =>
      Coleco.__pin(Coleco.__newArray(Coleco.UINT8ARRAY_ID, new Uint8Array(rom)))
    ),
  ]).then(([bios, cartridge]) => {
    console.log("Setup!");
    const ctx = document.getElementById("coleco").getContext("2d");
    ColecoInstance.refreshScreen = (videoData) => {
      const data = new ImageData(videoData, 256, 192);
      ctx.putImageData(data, 0, 0);
    };
    const regPC = document.getElementById("reg-pc");
    const regA = document.getElementById("reg-a");
    const regF = document.getElementById("reg-f");
    const regBC = document.getElementById("reg-bc");
    const regDE = document.getElementById("reg-de");
    const regHL = document.getElementById("reg-hl");
    const regIX = document.getElementById("reg-ix");
    const regIY = document.getElementById("reg-iy");
    const regI = document.getElementById("reg-i");
    const regR = document.getElementById("reg-r");
    const regSP = document.getElementById("reg-sp");

    const emulator = Coleco.createEmulator(bios, cartridge);
    Coleco.__unpin(bios);
    Coleco.__unpin(cartridge);
    const memoryPtr = Coleco.getMemory(emulator);
    ColecoInstance.updateRegisters = (
      pc,
      a,
      f,
      bc,
      de,
      hl,
      ix,
      iy,
      i,
      r,
      sp
    ) => {
      regPC.textContent = pc.toString(16).padStart(4, 0) + "h";
      regA.textContent = a.toString(16).padStart(2, 0) + "h";
      regF.textContent = `${f & (1 << 7) ? "S" : "."}${
        f & (1 << 6) ? "Z" : "."
      }${f & (1 << 4) ? "H" : "."}${f & (1 << 2) ? "P" : "."}${
        f & (1 << 1) ? "N" : "."
      }${f & 1 ? "C" : "."}`;
      // regF.textContent = f.toString(2).padStart(8, 0);
      regBC.textContent = bc.toString(16).padStart(4, 0) + "h";
      regDE.textContent = de.toString(16).padStart(4, 0) + "h";
      regHL.textContent = hl.toString(16).padStart(4, 0) + "h";
      regIX.textContent = ix.toString(16).padStart(4, 0) + "h";
      regIY.textContent = iy.toString(16).padStart(4, 0) + "h";
      regI.textContent = i.toString(16).padStart(2, 0) + "h";
      regR.textContent = r.toString(16).padStart(2, 0) + "h";
      regSP.textContent = sp.toString(16).padStart(4, 0) + "h";
    };

    const executing = document.getElementById("executing");
    executing.addEventListener("change", () =>
      SoundDriver.setMuted(!executing.checked)
    );

    function step(many) {
      if (executing.checked) {
        return Coleco.step(emulator, many);
      } else {
        return null;
      }
    }

    const speed = (1 / 3580000) * 1000;
    function stepMany(delay) {
      setTimeout(() => {
        const now = performance.now();
        const stepAmount = step(true);
        if (!stepAmount) {
          return;
        }
        const amount = stepAmount * speed;
        const delay = amount - (performance.now() - now);
        console.log("PC:", Coleco.pc(emulator).toString(16), delay);
        stepMany(delay);
      }, delay);
    }
    stepMany();

    tickOnce.addEventListener("click", () => {
      step(false);
    });
    tick.addEventListener("click", () => {
      stepMany();
    });

    let updateTimeout = null;
    function updateKeys() {
      let arrowKeys = 0;
      if (joyKeySet.has("ArrowLeft")) {
        arrowKeys |= 0x800;
      } else if (joyKeySet.has("ArrowRight")) {
        arrowKeys |= 0x200;
      }

      if (joyKeySet.has("ArrowUp")) {
        arrowKeys |= 0x100;
      } else if (joyKeySet.has("ArrowDown")) {
        arrowKeys |= 0x400;
      }

      console.log("Pushing keys!", state | arrowKeys, arrowKeys);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(
        () => Coleco.controllerKeys(emulator, state | arrowKeys),
        1000 / 120
      );
    }
    let state = 0;
    const keys = {
      Digit0: 0x5,
      Digit1: 0x2,
      Digit2: 0x8,
      Digit3: 0x3,
      Digit4: 0xd,
      Digit5: 0xc,
      Digit6: 0x1,
      Digit7: 0xa,
      Digit8: 0xe,
      Digit9: 0x4,
      Minus: 0x6,
      Equal: 0x9,
      // Left fire
      ControlLeft: 0x4000,
      // Right fire
      ControlRight: 0x0040,
    };
    const joyKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    const joyKeySet = new Set();
    window.addEventListener("keydown", (event) => {
      if (keys[event.code]) {
        if (!(state & keys[event.code])) {
          state |= keys[event.code];
          updateKeys();
        }
      } else if (joyKeys.includes(event.code)) {
        if (!joyKeySet.has(event.code)) {
          joyKeySet.add(event.code);
          updateKeys();
        }
      }
    });
    window.addEventListener("keyup", (event) => {
      if (keys[event.code]) {
        if (state & keys[event.code]) {
          state &= 0xffff - keys[event.code];
          updateKeys();
        }
      } else if (joyKeys.includes(event.code)) {
        if (joyKeySet.has(event.code)) {
          joyKeySet.delete(event.code);
          updateKeys();
        }
      }
    });

    const previewCtx = preview.getContext("2d");

    window.check = function () {
      const ids = new Set();
      for (let x = 0; x < 32; ++x) {
        for (let y = 0; y < 24; ++y) {
          const id = Coleco.getPatternAt(emulator, x, y);
          ids.add(id);
          console.log("ID", id, x, y);
        }
      }
      console.log("ID:", ids);

      const spriteTablePtr = Coleco.getSprites(emulator);
      const spriteTable = Coleco.__getUint8Array(spriteTablePtr);
      return spriteTable;
    };
    window.draw = function (x, y) {
      const id = Coleco.getPatternAt(emulator, x, y);
      drawPattern(id);
    };
    window.drawPattern = function (id) {
      console.log("Pattern is:", id);
      const spriteTablePtr = Coleco.getSprites(emulator);
      const spriteTable = Coleco.__getUint8Array(spriteTablePtr);

      const data = new Uint8ClampedArray(8 * 8 * 4);

      for (let y = 0; y < 8; ++y) {
        let line = spriteTable[(id << 3) | y];
        let x = 0;
        for (let x = 0; x < 8; ++x) {
          const isSet = (line >> x) & 1;
          const value = isSet ? 255 : 0;
          const base = x * 4 + y * 8 * 4;
          data[base] = value;
          data[base + 1] = value;
          data[base + 2] = value;
          data[base + 3] = 255;
        }
        console.log(line.toString(2).replace(/0/g, "."));
      }
      const imageData = new ImageData(data, 8, 8);
      previewCtx.putImageData(imageData, 0, 0, 0, 0, 64, 64);
    };

    window.checkValues = function () {
      return Coleco.__getArray(Coleco.debugLog(emulator));
    };
  });
});
