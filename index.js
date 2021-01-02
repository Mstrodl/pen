const wasm = require("url:./build/optimized.wasm");
const fs = require("fs");
const loader = require("@assemblyscript/loader");
let screenPtr;
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
    receiveScreen(ptr) {
      screenPtr = ptr;
    },
    refreshScreenJS() {
      const data = Instance.exports.__getUint8ClampedArray(screenPtr);
      Instance.refreshScreen(data);
    },
    writeSoundRegisterJS: require("./SoundDriver"),
  },
};
let Instance = null;
module.exports = loader.instantiate(fetch(wasm), imports).then((instance) => {
  Instance = instance;
  return Instance;
});
