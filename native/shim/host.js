// The game session a script host runs (GAM-36): loads the disk that `disk.js` and `game.js` defined (the globals
// PGDDisk and PGDGame) through the contract shim, then plays it one frame per call. A plain script, run after
// shim.js and the disk's two scripts, in the same fresh context. It defines one global, `PGDHost`.
// The native host supplies `__pgdMeasure(text, size)`, the width from the shared Silkscreen advances.
var PGDHost = (function () {
  'use strict';
  var session = null;

  /** measurePixelText over the host's measure: the same font check and whitespace rule as src/kit/platform/font.ts. */
  function measurer(measure) {
    return function (text, font) {
      var match = /^(8|16)px Silkscreen(?:,|$)/.exec(font);
      if (!match) throw new Error('Screen2D.font must be 8 or 16 px Silkscreen');
      // Canvas normalises ASCII whitespace to a space before measuring text.
      return { width: measure(text.replace(/[\t\n\f\r]/g, ' '), Number(match[1])) };
    };
  }

  function frame(shim) {
    var out = shim.take();
    out.state = shim.state();
    return out;
  }

  return {
    /** Start the disk: { grid: { w, h }, palette: { pal, roles } }. Returns the commands `create` and `start` issued. */
    boot: function (config) {
      var disk = PGDDisk.disk;
      var shim = PGDShim.createShim({ disk: disk, grid: config.grid, palette: config.palette, measurePixelText: measurer(globalThis.__pgdMeasure) });
      var runtime = PGDGame.create(shim.api);
      runtime.start();
      // The web console's ready countdown.
      shim.api.S.mode = 'ready';
      shim.api.S.modeT = disk.id === 'tunnel' ? 1.4 : 1.2;
      session = { shim: shim, runtime: runtime };
      return frame(shim);
    },
    /** One 1/60 s frame: apply the input events (the shim's input fields), update, draw. Returns the frame's commands. */
    tick: function (events) {
      if (!session) throw new Error('PGDHost.tick before PGDHost.boot');
      (events || []).forEach(function (event) { session.shim.input(event); });
      session.shim.step(session.runtime);
      return frame(session.shim);
    },
  };
})();
