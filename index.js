import wasm from "url:./build/optimized.wasm";

const fs = require("fs");
const loader = require("@assemblyscript/loader");
const imports = {
  console: {
    consoleLog(strPtr) {
      console.log("[AS]", Instance.exports.__getString(strPtr));
      Instance.exports.__release(strPtr);
    },
    consoleLogOP(op, pc) {
      console.log("[AS]", "OP", op.toString(16), "PC", pc.toString(16));
    },
    updateRegisters_(pc, a, f, bc, de, hl, ix, iy, i, r, sp) {
      Instance.updateRegisters(pc, a, f, bc, de, hl, ix, iy, i, r, sp);
    },
  },
  displayer: {
    refreshScreenJS(ptr) {
      const data = Instance.exports.__getUint8ClampedArray(ptr);
      Instance.exports.__release(ptr);
      Instance.refreshScreen(data);
    },
    writeSoundRegisterJS: require("./SoundDriver"),
  },
};
let Instance = null;
module.exports = fetch(wasm)
  .then((res) => res.arrayBuffer())
  .then((buffer) => loader.instantiate(buffer, imports))
  .then((instance) => {
    Instance = instance;
    return Instance;
  });
