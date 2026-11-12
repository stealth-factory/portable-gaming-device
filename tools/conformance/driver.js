// Plays a conformance script (tools/conformance/README.md) through native/shim/host.js. A plain script, so the
// Node runner (run.mjs) and the native one (native/core/tools/disk_run.cpp) run exactly the same driver; only the
// JavaScript engine and the way the command buffer leaves it differ. It defines one global, `PGDConformance`.
var PGDConformance = (function () {
  'use strict';
  var script = null, frame = 0, next = 0;
  return {
    /** { script: a parsed script with its defaults, palettes: { name: { pal, roles } } }. The header rides on `state`. */
    boot: function (config) {
      script = config.script;
      var palette = config.palettes[script.palette];
      if (!palette) throw new Error('Unknown palette: ' + script.palette);
      var init = PGDHost.boot({ grid: script.grid, palette: palette });
      var disk = PGDDisk.disk;
      init.state = { type: 'header', stream: 1, contract: disk.contract, disk: disk.id, version: disk.version,
        seed: script.seed, dt: 1 / 60, frames: script.frames, grid: script.grid, palette: script.palette, colours: palette.pal };
      return init;
    },
    /** The next frame; `state` carries its number, the input events applied and the state summary. */
    tick: function () {
      var events = [];
      while (next < script.events.length && script.events[next].frame === frame) events.push(script.events[next++]);
      var out = PGDHost.tick(events);
      out.state = { frame: frame++, input: events, state: out.state };
      return out;
    },
  };
})();
