(() => {
  // node_modules/fancy-canvas/size.mjs
  function size(_a) {
    var width = _a.width, height = _a.height;
    if (width < 0) {
      throw new Error("Negative width is not allowed for Size");
    }
    if (height < 0) {
      throw new Error("Negative height is not allowed for Size");
    }
    return {
      width,
      height
    };
  }
  function equalSizes(first, second) {
    return first.width === second.width && first.height === second.height;
  }

  // node_modules/fancy-canvas/device-pixel-ratio.mjs
  var Observable = (
    /** @class */
    function() {
      function Observable2(win) {
        var _this = this;
        this._resolutionListener = function() {
          return _this._onResolutionChanged();
        };
        this._resolutionMediaQueryList = null;
        this._observers = [];
        this._window = win;
        this._installResolutionListener();
      }
      Observable2.prototype.dispose = function() {
        this._uninstallResolutionListener();
        this._window = null;
      };
      Object.defineProperty(Observable2.prototype, "value", {
        get: function() {
          return this._window.devicePixelRatio;
        },
        enumerable: false,
        configurable: true
      });
      Observable2.prototype.subscribe = function(next) {
        var _this = this;
        var observer = { next };
        this._observers.push(observer);
        return {
          unsubscribe: function() {
            _this._observers = _this._observers.filter(function(o2) {
              return o2 !== observer;
            });
          }
        };
      };
      Observable2.prototype._installResolutionListener = function() {
        if (this._resolutionMediaQueryList !== null) {
          throw new Error("Resolution listener is already installed");
        }
        var dppx = this._window.devicePixelRatio;
        this._resolutionMediaQueryList = this._window.matchMedia("all and (resolution: ".concat(dppx, "dppx)"));
        this._resolutionMediaQueryList.addListener(this._resolutionListener);
      };
      Observable2.prototype._uninstallResolutionListener = function() {
        if (this._resolutionMediaQueryList !== null) {
          this._resolutionMediaQueryList.removeListener(this._resolutionListener);
          this._resolutionMediaQueryList = null;
        }
      };
      Observable2.prototype._reinstallResolutionListener = function() {
        this._uninstallResolutionListener();
        this._installResolutionListener();
      };
      Observable2.prototype._onResolutionChanged = function() {
        var _this = this;
        this._observers.forEach(function(observer) {
          return observer.next(_this._window.devicePixelRatio);
        });
        this._reinstallResolutionListener();
      };
      return Observable2;
    }()
  );
  function createObservable(win) {
    return new Observable(win);
  }

  // node_modules/fancy-canvas/canvas-element-bitmap-size.mjs
  var DevicePixelContentBoxBinding = (
    /** @class */
    function() {
      function DevicePixelContentBoxBinding2(canvasElement, transformBitmapSize, options) {
        var _a;
        this._canvasElement = null;
        this._bitmapSizeChangedListeners = [];
        this._suggestedBitmapSize = null;
        this._suggestedBitmapSizeChangedListeners = [];
        this._devicePixelRatioObservable = null;
        this._canvasElementResizeObserver = null;
        this._canvasElement = canvasElement;
        this._canvasElementClientSize = size({
          width: this._canvasElement.clientWidth,
          height: this._canvasElement.clientHeight
        });
        this._transformBitmapSize = transformBitmapSize !== null && transformBitmapSize !== void 0 ? transformBitmapSize : function(size2) {
          return size2;
        };
        this._allowResizeObserver = (_a = options === null || options === void 0 ? void 0 : options.allowResizeObserver) !== null && _a !== void 0 ? _a : true;
        this._chooseAndInitObserver();
      }
      DevicePixelContentBoxBinding2.prototype.dispose = function() {
        var _a, _b;
        if (this._canvasElement === null) {
          throw new Error("Object is disposed");
        }
        (_a = this._canvasElementResizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        this._canvasElementResizeObserver = null;
        (_b = this._devicePixelRatioObservable) === null || _b === void 0 ? void 0 : _b.dispose();
        this._devicePixelRatioObservable = null;
        this._suggestedBitmapSizeChangedListeners.length = 0;
        this._bitmapSizeChangedListeners.length = 0;
        this._canvasElement = null;
      };
      Object.defineProperty(DevicePixelContentBoxBinding2.prototype, "canvasElement", {
        get: function() {
          if (this._canvasElement === null) {
            throw new Error("Object is disposed");
          }
          return this._canvasElement;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DevicePixelContentBoxBinding2.prototype, "canvasElementClientSize", {
        get: function() {
          return this._canvasElementClientSize;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DevicePixelContentBoxBinding2.prototype, "bitmapSize", {
        get: function() {
          return size({
            width: this.canvasElement.width,
            height: this.canvasElement.height
          });
        },
        enumerable: false,
        configurable: true
      });
      DevicePixelContentBoxBinding2.prototype.resizeCanvasElement = function(clientSize) {
        this._canvasElementClientSize = size(clientSize);
        this.canvasElement.style.width = "".concat(this._canvasElementClientSize.width, "px");
        this.canvasElement.style.height = "".concat(this._canvasElementClientSize.height, "px");
        this._invalidateBitmapSize();
      };
      DevicePixelContentBoxBinding2.prototype.subscribeBitmapSizeChanged = function(listener) {
        this._bitmapSizeChangedListeners.push(listener);
      };
      DevicePixelContentBoxBinding2.prototype.unsubscribeBitmapSizeChanged = function(listener) {
        this._bitmapSizeChangedListeners = this._bitmapSizeChangedListeners.filter(function(l2) {
          return l2 !== listener;
        });
      };
      Object.defineProperty(DevicePixelContentBoxBinding2.prototype, "suggestedBitmapSize", {
        get: function() {
          return this._suggestedBitmapSize;
        },
        enumerable: false,
        configurable: true
      });
      DevicePixelContentBoxBinding2.prototype.subscribeSuggestedBitmapSizeChanged = function(listener) {
        this._suggestedBitmapSizeChangedListeners.push(listener);
      };
      DevicePixelContentBoxBinding2.prototype.unsubscribeSuggestedBitmapSizeChanged = function(listener) {
        this._suggestedBitmapSizeChangedListeners = this._suggestedBitmapSizeChangedListeners.filter(function(l2) {
          return l2 !== listener;
        });
      };
      DevicePixelContentBoxBinding2.prototype.applySuggestedBitmapSize = function() {
        if (this._suggestedBitmapSize === null) {
          return;
        }
        var oldSuggestedSize = this._suggestedBitmapSize;
        this._suggestedBitmapSize = null;
        this._resizeBitmap(oldSuggestedSize);
        this._emitSuggestedBitmapSizeChanged(oldSuggestedSize, this._suggestedBitmapSize);
      };
      DevicePixelContentBoxBinding2.prototype._resizeBitmap = function(newSize) {
        var oldSize = this.bitmapSize;
        if (equalSizes(oldSize, newSize)) {
          return;
        }
        this.canvasElement.width = newSize.width;
        this.canvasElement.height = newSize.height;
        this._emitBitmapSizeChanged(oldSize, newSize);
      };
      DevicePixelContentBoxBinding2.prototype._emitBitmapSizeChanged = function(oldSize, newSize) {
        var _this = this;
        this._bitmapSizeChangedListeners.forEach(function(listener) {
          return listener.call(_this, oldSize, newSize);
        });
      };
      DevicePixelContentBoxBinding2.prototype._suggestNewBitmapSize = function(newSize) {
        var oldSuggestedSize = this._suggestedBitmapSize;
        var finalNewSize = size(this._transformBitmapSize(newSize, this._canvasElementClientSize));
        var newSuggestedSize = equalSizes(this.bitmapSize, finalNewSize) ? null : finalNewSize;
        if (oldSuggestedSize === null && newSuggestedSize === null) {
          return;
        }
        if (oldSuggestedSize !== null && newSuggestedSize !== null && equalSizes(oldSuggestedSize, newSuggestedSize)) {
          return;
        }
        this._suggestedBitmapSize = newSuggestedSize;
        this._emitSuggestedBitmapSizeChanged(oldSuggestedSize, newSuggestedSize);
      };
      DevicePixelContentBoxBinding2.prototype._emitSuggestedBitmapSizeChanged = function(oldSize, newSize) {
        var _this = this;
        this._suggestedBitmapSizeChangedListeners.forEach(function(listener) {
          return listener.call(_this, oldSize, newSize);
        });
      };
      DevicePixelContentBoxBinding2.prototype._chooseAndInitObserver = function() {
        var _this = this;
        if (!this._allowResizeObserver) {
          this._initDevicePixelRatioObservable();
          return;
        }
        isDevicePixelContentBoxSupported().then(function(isSupported) {
          return isSupported ? _this._initResizeObserver() : _this._initDevicePixelRatioObservable();
        });
      };
      DevicePixelContentBoxBinding2.prototype._initDevicePixelRatioObservable = function() {
        var _this = this;
        if (this._canvasElement === null) {
          return;
        }
        var win = canvasElementWindow(this._canvasElement);
        if (win === null) {
          throw new Error("No window is associated with the canvas");
        }
        this._devicePixelRatioObservable = createObservable(win);
        this._devicePixelRatioObservable.subscribe(function() {
          return _this._invalidateBitmapSize();
        });
        this._invalidateBitmapSize();
      };
      DevicePixelContentBoxBinding2.prototype._invalidateBitmapSize = function() {
        var _a, _b;
        if (this._canvasElement === null) {
          return;
        }
        var win = canvasElementWindow(this._canvasElement);
        if (win === null) {
          return;
        }
        var ratio = (_b = (_a = this._devicePixelRatioObservable) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : win.devicePixelRatio;
        var canvasRects = this._canvasElement.getClientRects();
        var newSize = (
          // eslint-disable-next-line no-negated-condition
          canvasRects[0] !== void 0 ? predictedBitmapSize(canvasRects[0], ratio) : size({
            width: this._canvasElementClientSize.width * ratio,
            height: this._canvasElementClientSize.height * ratio
          })
        );
        this._suggestNewBitmapSize(newSize);
      };
      DevicePixelContentBoxBinding2.prototype._initResizeObserver = function() {
        var _this = this;
        if (this._canvasElement === null) {
          return;
        }
        this._canvasElementResizeObserver = new ResizeObserver(function(entries) {
          var entry = entries.find(function(entry2) {
            return entry2.target === _this._canvasElement;
          });
          if (!entry || !entry.devicePixelContentBoxSize || !entry.devicePixelContentBoxSize[0]) {
            return;
          }
          var entrySize = entry.devicePixelContentBoxSize[0];
          var newSize = size({
            width: entrySize.inlineSize,
            height: entrySize.blockSize
          });
          _this._suggestNewBitmapSize(newSize);
        });
        this._canvasElementResizeObserver.observe(this._canvasElement, { box: "device-pixel-content-box" });
      };
      return DevicePixelContentBoxBinding2;
    }()
  );
  function bindTo(canvasElement, target) {
    if (target.type === "device-pixel-content-box") {
      return new DevicePixelContentBoxBinding(canvasElement, target.transform, target.options);
    }
    throw new Error("Unsupported binding target");
  }
  function canvasElementWindow(canvasElement) {
    return canvasElement.ownerDocument.defaultView;
  }
  function isDevicePixelContentBoxSupported() {
    return new Promise(function(resolve) {
      var ro = new ResizeObserver(function(entries) {
        resolve(entries.every(function(entry) {
          return "devicePixelContentBoxSize" in entry;
        }));
        ro.disconnect();
      });
      ro.observe(document.body, { box: "device-pixel-content-box" });
    }).catch(function() {
      return false;
    });
  }
  function predictedBitmapSize(canvasRect, ratio) {
    return size({
      width: Math.round(canvasRect.left * ratio + canvasRect.width * ratio) - Math.round(canvasRect.left * ratio),
      height: Math.round(canvasRect.top * ratio + canvasRect.height * ratio) - Math.round(canvasRect.top * ratio)
    });
  }

  // node_modules/fancy-canvas/canvas-rendering-target.mjs
  var CanvasRenderingTarget2D = (
    /** @class */
    function() {
      function CanvasRenderingTarget2D2(context, mediaSize, bitmapSize) {
        if (mediaSize.width === 0 || mediaSize.height === 0) {
          throw new TypeError("Rendering target could only be created on a media with positive width and height");
        }
        this._mediaSize = mediaSize;
        if (bitmapSize.width === 0 || bitmapSize.height === 0) {
          throw new TypeError("Rendering target could only be created using a bitmap with positive integer width and height");
        }
        this._bitmapSize = bitmapSize;
        this._context = context;
      }
      CanvasRenderingTarget2D2.prototype.useMediaCoordinateSpace = function(f2) {
        try {
          this._context.save();
          this._context.setTransform(1, 0, 0, 1, 0, 0);
          this._context.scale(this._horizontalPixelRatio, this._verticalPixelRatio);
          return f2({
            context: this._context,
            mediaSize: this._mediaSize
          });
        } finally {
          this._context.restore();
        }
      };
      CanvasRenderingTarget2D2.prototype.useBitmapCoordinateSpace = function(f2) {
        try {
          this._context.save();
          this._context.setTransform(1, 0, 0, 1, 0, 0);
          return f2({
            context: this._context,
            mediaSize: this._mediaSize,
            bitmapSize: this._bitmapSize,
            horizontalPixelRatio: this._horizontalPixelRatio,
            verticalPixelRatio: this._verticalPixelRatio
          });
        } finally {
          this._context.restore();
        }
      };
      Object.defineProperty(CanvasRenderingTarget2D2.prototype, "_horizontalPixelRatio", {
        get: function() {
          return this._bitmapSize.width / this._mediaSize.width;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(CanvasRenderingTarget2D2.prototype, "_verticalPixelRatio", {
        get: function() {
          return this._bitmapSize.height / this._mediaSize.height;
        },
        enumerable: false,
        configurable: true
      });
      return CanvasRenderingTarget2D2;
    }()
  );
  function tryCreateCanvasRenderingTarget2D(binding, contextOptions) {
    var mediaSize = binding.canvasElementClientSize;
    if (mediaSize.width === 0 || mediaSize.height === 0) {
      return null;
    }
    var bitmapSize = binding.bitmapSize;
    if (bitmapSize.width === 0 || bitmapSize.height === 0) {
      return null;
    }
    var context = binding.canvasElement.getContext("2d", contextOptions);
    if (context === null) {
      return null;
    }
    return new CanvasRenderingTarget2D(context, mediaSize, bitmapSize);
  }

  // node_modules/lightweight-charts/dist/lightweight-charts.production.mjs
  var e = { upColor: "#26a69a", downColor: "#ef5350", wickVisible: true, borderVisible: true, borderColor: "#378658", borderUpColor: "#26a69a", borderDownColor: "#ef5350", wickColor: "#737375", wickUpColor: "#26a69a", wickDownColor: "#ef5350" };
  var r = { upColor: "#26a69a", downColor: "#ef5350", openVisible: true, thinBars: true };
  var h = { color: "#2196f3", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false };
  var l = { topColor: "rgba( 46, 220, 135, 0.4)", bottomColor: "rgba( 40, 221, 100, 0)", invertFilledArea: false, lineColor: "#33D778", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false };
  var a = { baseValue: { type: "price", price: 0 }, topFillColor1: "rgba(38, 166, 154, 0.28)", topFillColor2: "rgba(38, 166, 154, 0.05)", topLineColor: "rgba(38, 166, 154, 1)", bottomFillColor1: "rgba(239, 83, 80, 0.05)", bottomFillColor2: "rgba(239, 83, 80, 0.28)", bottomLineColor: "rgba(239, 83, 80, 1)", lineWidth: 3, lineStyle: 0, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false };
  var o = { color: "#26a69a", base: 0 };
  var _ = { color: "#2196f3" };
  var u = { title: "", visible: true, lastValueVisible: true, priceLineVisible: true, priceLineSource: 0, priceLineWidth: 1, priceLineColor: "", priceLineStyle: 2, baseLineVisible: true, baseLineWidth: 1, baseLineColor: "#B2B5BE", baseLineStyle: 0, priceFormat: { type: "price", precision: 2, minMove: 0.01 } };
  var c;
  var d;
  function f(t, i) {
    const n = { 0: [], 1: [t.lineWidth, t.lineWidth], 2: [2 * t.lineWidth, 2 * t.lineWidth], 3: [6 * t.lineWidth, 6 * t.lineWidth], 4: [t.lineWidth, 4 * t.lineWidth] }[i];
    t.setLineDash(n);
  }
  function v(t, i, n, s) {
    t.beginPath();
    const e2 = t.lineWidth % 2 ? 0.5 : 0;
    t.moveTo(n, i + e2), t.lineTo(s, i + e2), t.stroke();
  }
  function p(t, i) {
    if (!t)
      throw new Error("Assertion failed" + (i ? ": " + i : ""));
  }
  function m(t) {
    if (void 0 === t)
      throw new Error("Value is undefined");
    return t;
  }
  function b(t) {
    if (null === t)
      throw new Error("Value is null");
    return t;
  }
  function w(t) {
    return b(m(t));
  }
  !function(t) {
    t[t.Simple = 0] = "Simple", t[t.WithSteps = 1] = "WithSteps", t[t.Curved = 2] = "Curved";
  }(c || (c = {})), function(t) {
    t[t.Solid = 0] = "Solid", t[t.Dotted = 1] = "Dotted", t[t.Dashed = 2] = "Dashed", t[t.LargeDashed = 3] = "LargeDashed", t[t.SparseDotted = 4] = "SparseDotted";
  }(d || (d = {}));
  var g = { khaki: "#f0e68c", azure: "#f0ffff", aliceblue: "#f0f8ff", ghostwhite: "#f8f8ff", gold: "#ffd700", goldenrod: "#daa520", gainsboro: "#dcdcdc", gray: "#808080", green: "#008000", honeydew: "#f0fff0", floralwhite: "#fffaf0", lightblue: "#add8e6", lightcoral: "#f08080", lemonchiffon: "#fffacd", hotpink: "#ff69b4", lightyellow: "#ffffe0", greenyellow: "#adff2f", lightgoldenrodyellow: "#fafad2", limegreen: "#32cd32", linen: "#faf0e6", lightcyan: "#e0ffff", magenta: "#f0f", maroon: "#800000", olive: "#808000", orange: "#ffa500", oldlace: "#fdf5e6", mediumblue: "#0000cd", transparent: "#0000", lime: "#0f0", lightpink: "#ffb6c1", mistyrose: "#ffe4e1", moccasin: "#ffe4b5", midnightblue: "#191970", orchid: "#da70d6", mediumorchid: "#ba55d3", mediumturquoise: "#48d1cc", orangered: "#ff4500", royalblue: "#4169e1", powderblue: "#b0e0e6", red: "#f00", coral: "#ff7f50", turquoise: "#40e0d0", white: "#fff", whitesmoke: "#f5f5f5", wheat: "#f5deb3", teal: "#008080", steelblue: "#4682b4", bisque: "#ffe4c4", aquamarine: "#7fffd4", aqua: "#0ff", sienna: "#a0522d", silver: "#c0c0c0", springgreen: "#00ff7f", antiquewhite: "#faebd7", burlywood: "#deb887", brown: "#a52a2a", beige: "#f5f5dc", chocolate: "#d2691e", chartreuse: "#7fff00", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c", cadetblue: "#5f9ea0", tomato: "#ff6347", fuchsia: "#f0f", blue: "#00f", salmon: "#fa8072", blanchedalmond: "#ffebcd", slateblue: "#6a5acd", slategray: "#708090", thistle: "#d8bfd8", tan: "#d2b48c", cyan: "#0ff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b", darkgray: "#a9a9a9", blueviolet: "#8a2be2", black: "#000", darkmagenta: "#8b008b", darkslateblue: "#483d8b", darkkhaki: "#bdb76b", darkorchid: "#9932cc", darkorange: "#ff8c00", darkgreen: "#006400", darkred: "#8b0000", dodgerblue: "#1e90ff", darkslategray: "#2f4f4f", dimgray: "#696969", deepskyblue: "#00bfff", firebrick: "#b22222", forestgreen: "#228b22", indigo: "#4b0082", ivory: "#fffff0", lavenderblush: "#fff0f5", feldspar: "#d19275", indianred: "#cd5c5c", lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightskyblue: "#87cefa", lightslategray: "#789", lightslateblue: "#8470ff", snow: "#fffafa", lightseagreen: "#20b2aa", lightsalmon: "#ffa07a", darksalmon: "#e9967a", darkviolet: "#9400d3", mediumpurple: "#9370d8", mediumaquamarine: "#66cdaa", skyblue: "#87ceeb", lavender: "#e6e6fa", lightsteelblue: "#b0c4de", mediumvioletred: "#c71585", mintcream: "#f5fffa", navajowhite: "#ffdead", navy: "#000080", olivedrab: "#6b8e23", palevioletred: "#d87093", violetred: "#d02090", yellow: "#ff0", yellowgreen: "#9acd32", lawngreen: "#7cfc00", pink: "#ffc0cb", paleturquoise: "#afeeee", palegoldenrod: "#eee8aa", darkolivegreen: "#556b2f", darkseagreen: "#8fbc8f", darkturquoise: "#00ced1", peachpuff: "#ffdab9", deeppink: "#ff1493", violet: "#ee82ee", palegreen: "#98fb98", mediumseagreen: "#3cb371", peru: "#cd853f", saddlebrown: "#8b4513", sandybrown: "#f4a460", rosybrown: "#bc8f8f", purple: "#800080", seagreen: "#2e8b57", seashell: "#fff5ee", papayawhip: "#ffefd5", mediumslateblue: "#7b68ee", plum: "#dda0dd", mediumspringgreen: "#00fa9a" };
  function M(t) {
    return t < 0 ? 0 : t > 255 ? 255 : Math.round(t) || 0;
  }
  function x(t) {
    return t <= 0 || t > 1 ? Math.min(Math.max(t, 0), 1) : Math.round(1e4 * t) / 1e4;
  }
  var S = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
  var k = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
  var y = /^rgb\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*\)$/;
  var C = /^rgba\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d*\.?\d+)\s*\)$/;
  function T(t) {
    (t = t.toLowerCase()) in g && (t = g[t]);
    {
      const i = C.exec(t) || y.exec(t);
      if (i)
        return [M(parseInt(i[1], 10)), M(parseInt(i[2], 10)), M(parseInt(i[3], 10)), x(i.length < 5 ? 1 : parseFloat(i[4]))];
    }
    {
      const i = k.exec(t);
      if (i)
        return [M(parseInt(i[1], 16)), M(parseInt(i[2], 16)), M(parseInt(i[3], 16)), 1];
    }
    {
      const i = S.exec(t);
      if (i)
        return [M(17 * parseInt(i[1], 16)), M(17 * parseInt(i[2], 16)), M(17 * parseInt(i[3], 16)), 1];
    }
    throw new Error(`Cannot parse color: ${t}`);
  }
  function P(t) {
    return 0.199 * t[0] + 0.687 * t[1] + 0.114 * t[2];
  }
  function R(t) {
    const i = T(t);
    return { t: `rgb(${i[0]}, ${i[1]}, ${i[2]})`, i: P(i) > 160 ? "black" : "white" };
  }
  var D = class {
    constructor() {
      this.h = [];
    }
    l(t, i, n) {
      const s = { o: t, _: i, u: true === n };
      this.h.push(s);
    }
    v(t) {
      const i = this.h.findIndex((i2) => t === i2.o);
      i > -1 && this.h.splice(i, 1);
    }
    p(t) {
      this.h = this.h.filter((i) => i._ !== t);
    }
    m(t, i, n) {
      const s = [...this.h];
      this.h = this.h.filter((t2) => !t2.u), s.forEach((s2) => s2.o(t, i, n));
    }
    M() {
      return this.h.length > 0;
    }
    S() {
      this.h = [];
    }
  };
  function V(t, ...i) {
    for (const n of i)
      for (const i2 in n)
        void 0 !== n[i2] && Object.prototype.hasOwnProperty.call(n, i2) && !["__proto__", "constructor", "prototype"].includes(i2) && ("object" != typeof n[i2] || void 0 === t[i2] || Array.isArray(n[i2]) ? t[i2] = n[i2] : V(t[i2], n[i2]));
    return t;
  }
  function O(t) {
    return "number" == typeof t && isFinite(t);
  }
  function B(t) {
    return "number" == typeof t && t % 1 == 0;
  }
  function A(t) {
    return "string" == typeof t;
  }
  function I(t) {
    return "boolean" == typeof t;
  }
  function z(t) {
    const i = t;
    if (!i || "object" != typeof i)
      return i;
    let n, s, e2;
    for (s in n = Array.isArray(i) ? [] : {}, i)
      i.hasOwnProperty(s) && (e2 = i[s], n[s] = e2 && "object" == typeof e2 ? z(e2) : e2);
    return n;
  }
  function L(t) {
    return null !== t;
  }
  function E(t) {
    return null === t ? void 0 : t;
  }
  var N = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
  function F(t, i, n) {
    return void 0 === i && (i = N), `${n = void 0 !== n ? `${n} ` : ""}${t}px ${i}`;
  }
  var W = class {
    constructor(t) {
      this.k = { C: 1, T: 5, P: NaN, R: "", D: "", V: "", O: "", B: 0, A: 0, I: 0, L: 0, N: 0 }, this.F = t;
    }
    W() {
      const t = this.k, i = this.j(), n = this.H();
      return t.P === i && t.D === n || (t.P = i, t.D = n, t.R = F(i, n), t.L = 2.5 / 12 * i, t.B = t.L, t.A = i / 12 * t.T, t.I = i / 12 * t.T, t.N = 0), t.V = this.$(), t.O = this.U(), this.k;
    }
    $() {
      return this.F.W().layout.textColor;
    }
    U() {
      return this.F.q();
    }
    j() {
      return this.F.W().layout.fontSize;
    }
    H() {
      return this.F.W().layout.fontFamily;
    }
  };
  var j = class {
    constructor() {
      this.Y = [];
    }
    Z(t) {
      this.Y = t;
    }
    X(t, i, n) {
      this.Y.forEach((s) => {
        s.X(t, i, n);
      });
    }
  };
  var H = class {
    X(t, i, n) {
      t.useBitmapCoordinateSpace((t2) => this.K(t2, i, n));
    }
  };
  var $ = class extends H {
    constructor() {
      super(...arguments), this.G = null;
    }
    J(t) {
      this.G = t;
    }
    K({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
      if (null === this.G || null === this.G.tt)
        return;
      const s = this.G.tt, e2 = this.G, r2 = Math.max(1, Math.floor(i)) % 2 / 2, h2 = (h3) => {
        t.beginPath();
        for (let l2 = s.to - 1; l2 >= s.from; --l2) {
          const s2 = e2.it[l2], a2 = Math.round(s2.nt * i) + r2, o2 = s2.st * n, _2 = h3 * n + r2;
          t.moveTo(a2, o2), t.arc(a2, o2, _2, 0, 2 * Math.PI);
        }
        t.fill();
      };
      e2.et > 0 && (t.fillStyle = e2.rt, h2(e2.ht + e2.et)), t.fillStyle = e2.lt, h2(e2.ht);
    }
  };
  function U() {
    return { it: [{ nt: 0, st: 0, ot: 0, _t: 0 }], lt: "", rt: "", ht: 0, et: 0, tt: null };
  }
  var q = { from: 0, to: 1 };
  var Y = class {
    constructor(t, i) {
      this.ut = new j(), this.ct = [], this.dt = [], this.ft = true, this.F = t, this.vt = i, this.ut.Z(this.ct);
    }
    bt(t) {
      const i = this.F.wt();
      i.length !== this.ct.length && (this.dt = i.map(U), this.ct = this.dt.map((t2) => {
        const i2 = new $();
        return i2.J(t2), i2;
      }), this.ut.Z(this.ct)), this.ft = true;
    }
    gt() {
      return this.ft && (this.Mt(), this.ft = false), this.ut;
    }
    Mt() {
      const t = 2 === this.vt.W().mode, i = this.F.wt(), n = this.vt.xt(), s = this.F.St();
      i.forEach((i2, e2) => {
        var r2;
        const h2 = this.dt[e2], l2 = i2.kt(n);
        if (t || null === l2 || !i2.yt())
          return void (h2.tt = null);
        const a2 = b(i2.Ct());
        h2.lt = l2.Tt, h2.ht = l2.ht, h2.et = l2.Pt, h2.it[0]._t = l2._t, h2.it[0].st = i2.Dt().Rt(l2._t, a2.Vt), h2.rt = null !== (r2 = l2.Ot) && void 0 !== r2 ? r2 : this.F.Bt(h2.it[0].st / i2.Dt().At()), h2.it[0].ot = n, h2.it[0].nt = s.It(n), h2.tt = q;
      });
    }
  };
  var Z = class extends H {
    constructor(t) {
      super(), this.zt = t;
    }
    K({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
      if (null === this.zt)
        return;
      const e2 = this.zt.Lt.yt, r2 = this.zt.Et.yt;
      if (!e2 && !r2)
        return;
      const h2 = Math.round(this.zt.nt * n), l2 = Math.round(this.zt.st * s);
      t.lineCap = "butt", e2 && h2 >= 0 && (t.lineWidth = Math.floor(this.zt.Lt.et * n), t.strokeStyle = this.zt.Lt.V, t.fillStyle = this.zt.Lt.V, f(t, this.zt.Lt.Nt), function(t2, i2, n2, s2) {
        t2.beginPath();
        const e3 = t2.lineWidth % 2 ? 0.5 : 0;
        t2.moveTo(i2 + e3, n2), t2.lineTo(i2 + e3, s2), t2.stroke();
      }(t, h2, 0, i.height)), r2 && l2 >= 0 && (t.lineWidth = Math.floor(this.zt.Et.et * s), t.strokeStyle = this.zt.Et.V, t.fillStyle = this.zt.Et.V, f(t, this.zt.Et.Nt), v(t, l2, 0, i.width));
    }
  };
  var X = class {
    constructor(t) {
      this.ft = true, this.Ft = { Lt: { et: 1, Nt: 0, V: "", yt: false }, Et: { et: 1, Nt: 0, V: "", yt: false }, nt: 0, st: 0 }, this.Wt = new Z(this.Ft), this.jt = t;
    }
    bt() {
      this.ft = true;
    }
    gt() {
      return this.ft && (this.Mt(), this.ft = false), this.Wt;
    }
    Mt() {
      const t = this.jt.yt(), i = b(this.jt.Ht()), n = i.$t().W().crosshair, s = this.Ft;
      if (2 === n.mode)
        return s.Et.yt = false, void (s.Lt.yt = false);
      s.Et.yt = t && this.jt.Ut(i), s.Lt.yt = t && this.jt.qt(), s.Et.et = n.horzLine.width, s.Et.Nt = n.horzLine.style, s.Et.V = n.horzLine.color, s.Lt.et = n.vertLine.width, s.Lt.Nt = n.vertLine.style, s.Lt.V = n.vertLine.color, s.nt = this.jt.Yt(), s.st = this.jt.Zt();
    }
  };
  function K(t, i, n, s, e2, r2) {
    t.fillRect(i + r2, n, s - 2 * r2, r2), t.fillRect(i + r2, n + e2 - r2, s - 2 * r2, r2), t.fillRect(i, n, r2, e2), t.fillRect(i + s - r2, n, r2, e2);
  }
  function G(t, i, n, s, e2, r2) {
    t.save(), t.globalCompositeOperation = "copy", t.fillStyle = r2, t.fillRect(i, n, s, e2), t.restore();
  }
  function J(t, i, n, s, e2, r2) {
    t.beginPath(), t.roundRect ? t.roundRect(i, n, s, e2, r2) : (t.lineTo(i + s - r2[1], n), 0 !== r2[1] && t.arcTo(i + s, n, i + s, n + r2[1], r2[1]), t.lineTo(i + s, n + e2 - r2[2]), 0 !== r2[2] && t.arcTo(i + s, n + e2, i + s - r2[2], n + e2, r2[2]), t.lineTo(i + r2[3], n + e2), 0 !== r2[3] && t.arcTo(i, n + e2, i, n + e2 - r2[3], r2[3]), t.lineTo(i, n + r2[0]), 0 !== r2[0] && t.arcTo(i, n, i + r2[0], n, r2[0]));
  }
  function Q(t, i, n, s, e2, r2, h2 = 0, l2 = [0, 0, 0, 0], a2 = "") {
    if (t.save(), !h2 || !a2 || a2 === r2)
      return J(t, i, n, s, e2, l2), t.fillStyle = r2, t.fill(), void t.restore();
    const o2 = h2 / 2;
    var _2;
    J(t, i + o2, n + o2, s - h2, e2 - h2, (_2 = -o2, l2.map((t2) => 0 === t2 ? t2 : t2 + _2))), "transparent" !== r2 && (t.fillStyle = r2, t.fill()), "transparent" !== a2 && (t.lineWidth = h2, t.strokeStyle = a2, t.closePath(), t.stroke()), t.restore();
  }
  function tt(t, i, n, s, e2, r2, h2) {
    t.save(), t.globalCompositeOperation = "copy";
    const l2 = t.createLinearGradient(0, 0, 0, e2);
    l2.addColorStop(0, r2), l2.addColorStop(1, h2), t.fillStyle = l2, t.fillRect(i, n, s, e2), t.restore();
  }
  var it = class {
    constructor(t, i) {
      this.J(t, i);
    }
    J(t, i) {
      this.zt = t, this.Xt = i;
    }
    At(t, i) {
      return this.zt.yt ? t.P + t.L + t.B : 0;
    }
    X(t, i, n, s) {
      if (!this.zt.yt || 0 === this.zt.Kt.length)
        return;
      const e2 = this.zt.V, r2 = this.Xt.t, h2 = t.useBitmapCoordinateSpace((t2) => {
        const h3 = t2.context;
        h3.font = i.R;
        const l2 = this.Gt(t2, i, n, s), a2 = l2.Jt;
        return l2.Qt ? Q(h3, a2.ti, a2.ii, a2.ni, a2.si, r2, a2.ei, [a2.ht, 0, 0, a2.ht], r2) : Q(h3, a2.ri, a2.ii, a2.ni, a2.si, r2, a2.ei, [0, a2.ht, a2.ht, 0], r2), this.zt.hi && (h3.fillStyle = e2, h3.fillRect(a2.ri, a2.li, a2.ai - a2.ri, a2.oi)), this.zt._i && (h3.fillStyle = i.O, h3.fillRect(l2.Qt ? a2.ui - a2.ei : 0, a2.ii, a2.ei, a2.ci - a2.ii)), l2;
      });
      t.useMediaCoordinateSpace(({ context: t2 }) => {
        const n2 = h2.di;
        t2.font = i.R, t2.textAlign = h2.Qt ? "right" : "left", t2.textBaseline = "middle", t2.fillStyle = e2, t2.fillText(this.zt.Kt, n2.fi, (n2.ii + n2.ci) / 2 + n2.pi);
      });
    }
    Gt(t, i, n, s) {
      var e2;
      const { context: r2, bitmapSize: h2, mediaSize: l2, horizontalPixelRatio: a2, verticalPixelRatio: o2 } = t, _2 = this.zt.hi || !this.zt.mi ? i.T : 0, u2 = this.zt.bi ? i.C : 0, c2 = i.L + this.Xt.wi, d2 = i.B + this.Xt.gi, f2 = i.A, v2 = i.I, p2 = this.zt.Kt, m2 = i.P, b2 = n.Mi(r2, p2), w2 = Math.ceil(n.xi(r2, p2)), g2 = m2 + c2 + d2, M2 = i.C + f2 + v2 + w2 + _2, x2 = Math.max(1, Math.floor(o2));
      let S2 = Math.round(g2 * o2);
      S2 % 2 != x2 % 2 && (S2 += 1);
      const k2 = u2 > 0 ? Math.max(1, Math.floor(u2 * a2)) : 0, y2 = Math.round(M2 * a2), C2 = Math.round(_2 * a2), T2 = null !== (e2 = this.Xt.Si) && void 0 !== e2 ? e2 : this.Xt.ki, P2 = Math.round(T2 * o2) - Math.floor(0.5 * o2), R2 = Math.floor(P2 + x2 / 2 - S2 / 2), D2 = R2 + S2, V2 = "right" === s, O2 = V2 ? l2.width - u2 : u2, B2 = V2 ? h2.width - k2 : k2;
      let A2, I2, z2;
      return V2 ? (A2 = B2 - y2, I2 = B2 - C2, z2 = O2 - _2 - f2 - u2) : (A2 = B2 + y2, I2 = B2 + C2, z2 = O2 + _2 + f2), { Qt: V2, Jt: { ii: R2, li: P2, ci: D2, ni: y2, si: S2, ht: 2 * a2, ei: k2, ti: A2, ri: B2, ai: I2, oi: x2, ui: h2.width }, di: { ii: R2 / o2, ci: D2 / o2, fi: z2, pi: b2 } };
    }
  };
  var nt = class {
    constructor(t) {
      this.yi = { ki: 0, t: "#000", gi: 0, wi: 0 }, this.Ci = { Kt: "", yt: false, hi: true, mi: false, Ot: "", V: "#FFF", _i: false, bi: false }, this.Ti = { Kt: "", yt: false, hi: false, mi: true, Ot: "", V: "#FFF", _i: true, bi: true }, this.ft = true, this.Pi = new (t || it)(this.Ci, this.yi), this.Ri = new (t || it)(this.Ti, this.yi);
    }
    Kt() {
      return this.Di(), this.Ci.Kt;
    }
    ki() {
      return this.Di(), this.yi.ki;
    }
    bt() {
      this.ft = true;
    }
    At(t, i = false) {
      return Math.max(this.Pi.At(t, i), this.Ri.At(t, i));
    }
    Vi() {
      return this.yi.Si || 0;
    }
    Oi(t) {
      this.yi.Si = t;
    }
    Bi() {
      return this.Di(), this.Ci.yt || this.Ti.yt;
    }
    Ai() {
      return this.Di(), this.Ci.yt;
    }
    gt(t) {
      return this.Di(), this.Ci.hi = this.Ci.hi && t.W().ticksVisible, this.Ti.hi = this.Ti.hi && t.W().ticksVisible, this.Pi.J(this.Ci, this.yi), this.Ri.J(this.Ti, this.yi), this.Pi;
    }
    Ii() {
      return this.Di(), this.Pi.J(this.Ci, this.yi), this.Ri.J(this.Ti, this.yi), this.Ri;
    }
    Di() {
      this.ft && (this.Ci.hi = true, this.Ti.hi = false, this.zi(this.Ci, this.Ti, this.yi));
    }
  };
  var st = class extends nt {
    constructor(t, i, n) {
      super(), this.jt = t, this.Li = i, this.Ei = n;
    }
    zi(t, i, n) {
      if (t.yt = false, 2 === this.jt.W().mode)
        return;
      const s = this.jt.W().horzLine;
      if (!s.labelVisible)
        return;
      const e2 = this.Li.Ct();
      if (!this.jt.yt() || this.Li.Ni() || null === e2)
        return;
      const r2 = R(s.labelBackgroundColor);
      n.t = r2.t, t.V = r2.i;
      const h2 = 2 / 12 * this.Li.P();
      n.wi = h2, n.gi = h2;
      const l2 = this.Ei(this.Li);
      n.ki = l2.ki, t.Kt = this.Li.Fi(l2._t, e2), t.yt = true;
    }
  };
  var et = /[1-9]/g;
  var rt = class {
    constructor() {
      this.zt = null;
    }
    J(t) {
      this.zt = t;
    }
    X(t, i) {
      if (null === this.zt || false === this.zt.yt || 0 === this.zt.Kt.length)
        return;
      const n = t.useMediaCoordinateSpace(({ context: t2 }) => (t2.font = i.R, Math.round(i.Wi.xi(t2, b(this.zt).Kt, et))));
      if (n <= 0)
        return;
      const s = i.ji, e2 = n + 2 * s, r2 = e2 / 2, h2 = this.zt.Hi;
      let l2 = this.zt.ki, a2 = Math.floor(l2 - r2) + 0.5;
      a2 < 0 ? (l2 += Math.abs(0 - a2), a2 = Math.floor(l2 - r2) + 0.5) : a2 + e2 > h2 && (l2 -= Math.abs(h2 - (a2 + e2)), a2 = Math.floor(l2 - r2) + 0.5);
      const o2 = a2 + e2, _2 = Math.ceil(0 + i.C + i.T + i.L + i.P + i.B);
      t.useBitmapCoordinateSpace(({ context: t2, horizontalPixelRatio: n2, verticalPixelRatio: s2 }) => {
        const e3 = b(this.zt);
        t2.fillStyle = e3.t;
        const r3 = Math.round(a2 * n2), h3 = Math.round(0 * s2), l3 = Math.round(o2 * n2), u2 = Math.round(_2 * s2), c2 = Math.round(2 * n2);
        if (t2.beginPath(), t2.moveTo(r3, h3), t2.lineTo(r3, u2 - c2), t2.arcTo(r3, u2, r3 + c2, u2, c2), t2.lineTo(l3 - c2, u2), t2.arcTo(l3, u2, l3, u2 - c2, c2), t2.lineTo(l3, h3), t2.fill(), e3.hi) {
          const r4 = Math.round(e3.ki * n2), l4 = h3, a3 = Math.round((l4 + i.T) * s2);
          t2.fillStyle = e3.V;
          const o3 = Math.max(1, Math.floor(n2)), _3 = Math.floor(0.5 * n2);
          t2.fillRect(r4 - _3, l4, o3, a3 - l4);
        }
      }), t.useMediaCoordinateSpace(({ context: t2 }) => {
        const n2 = b(this.zt), e3 = 0 + i.C + i.T + i.L + i.P / 2;
        t2.font = i.R, t2.textAlign = "left", t2.textBaseline = "middle", t2.fillStyle = n2.V;
        const r3 = i.Wi.Mi(t2, "Apr0");
        t2.translate(a2 + s, e3 + r3), t2.fillText(n2.Kt, 0, 0);
      });
    }
  };
  var ht = class {
    constructor(t, i, n) {
      this.ft = true, this.Wt = new rt(), this.Ft = { yt: false, t: "#4c525e", V: "white", Kt: "", Hi: 0, ki: NaN, hi: true }, this.vt = t, this.$i = i, this.Ei = n;
    }
    bt() {
      this.ft = true;
    }
    gt() {
      return this.ft && (this.Mt(), this.ft = false), this.Wt.J(this.Ft), this.Wt;
    }
    Mt() {
      const t = this.Ft;
      if (t.yt = false, 2 === this.vt.W().mode)
        return;
      const i = this.vt.W().vertLine;
      if (!i.labelVisible)
        return;
      const n = this.$i.St();
      if (n.Ni())
        return;
      t.Hi = n.Hi();
      const s = this.Ei();
      if (null === s)
        return;
      t.ki = s.ki;
      const e2 = n.Ui(this.vt.xt());
      t.Kt = n.qi(b(e2)), t.yt = true;
      const r2 = R(i.labelBackgroundColor);
      t.t = r2.t, t.V = r2.i, t.hi = n.W().ticksVisible;
    }
  };
  var lt = class {
    constructor() {
      this.Yi = null, this.Zi = 0;
    }
    Xi() {
      return this.Zi;
    }
    Ki(t) {
      this.Zi = t;
    }
    Dt() {
      return this.Yi;
    }
    Gi(t) {
      this.Yi = t;
    }
    Ji(t) {
      return [];
    }
    Qi() {
      return [];
    }
    yt() {
      return true;
    }
  };
  var at;
  !function(t) {
    t[t.Normal = 0] = "Normal", t[t.Magnet = 1] = "Magnet", t[t.Hidden = 2] = "Hidden";
  }(at || (at = {}));
  var ot = class extends lt {
    constructor(t, i) {
      super(), this.tn = null, this.nn = NaN, this.sn = 0, this.en = true, this.rn = /* @__PURE__ */ new Map(), this.hn = false, this.ln = NaN, this.an = NaN, this._n = NaN, this.un = NaN, this.$i = t, this.cn = i, this.dn = new Y(t, this);
      this.fn = /* @__PURE__ */ ((t2, i2) => (n2) => {
        const s = i2(), e2 = t2();
        if (n2 === b(this.tn).vn())
          return { _t: e2, ki: s };
        {
          const t3 = b(n2.Ct());
          return { _t: n2.pn(s, t3), ki: s };
        }
      })(() => this.nn, () => this.an);
      const n = /* @__PURE__ */ ((t2, i2) => () => {
        const n2 = this.$i.St().mn(t2()), s = i2();
        return n2 && Number.isFinite(s) ? { ot: n2, ki: s } : null;
      })(() => this.sn, () => this.Yt());
      this.bn = new ht(this, t, n), this.wn = new X(this);
    }
    W() {
      return this.cn;
    }
    gn(t, i) {
      this._n = t, this.un = i;
    }
    Mn() {
      this._n = NaN, this.un = NaN;
    }
    xn() {
      return this._n;
    }
    Sn() {
      return this.un;
    }
    kn(t, i, n) {
      this.hn || (this.hn = true), this.en = true, this.yn(t, i, n);
    }
    xt() {
      return this.sn;
    }
    Yt() {
      return this.ln;
    }
    Zt() {
      return this.an;
    }
    yt() {
      return this.en;
    }
    Cn() {
      this.en = false, this.Tn(), this.nn = NaN, this.ln = NaN, this.an = NaN, this.tn = null, this.Mn();
    }
    Pn(t) {
      return null !== this.tn ? [this.wn, this.dn] : [];
    }
    Ut(t) {
      return t === this.tn && this.cn.horzLine.visible;
    }
    qt() {
      return this.cn.vertLine.visible;
    }
    Rn(t, i) {
      this.en && this.tn === t || this.rn.clear();
      const n = [];
      return this.tn === t && n.push(this.Dn(this.rn, i, this.fn)), n;
    }
    Qi() {
      return this.en ? [this.bn] : [];
    }
    Ht() {
      return this.tn;
    }
    Vn() {
      this.wn.bt(), this.rn.forEach((t) => t.bt()), this.bn.bt(), this.dn.bt();
    }
    On(t) {
      return t && !t.vn().Ni() ? t.vn() : null;
    }
    yn(t, i, n) {
      this.Bn(t, i, n) && this.Vn();
    }
    Bn(t, i, n) {
      const s = this.ln, e2 = this.an, r2 = this.nn, h2 = this.sn, l2 = this.tn, a2 = this.On(n);
      this.sn = t, this.ln = isNaN(t) ? NaN : this.$i.St().It(t), this.tn = n;
      const o2 = null !== a2 ? a2.Ct() : null;
      return null !== a2 && null !== o2 ? (this.nn = i, this.an = a2.Rt(i, o2)) : (this.nn = NaN, this.an = NaN), s !== this.ln || e2 !== this.an || h2 !== this.sn || r2 !== this.nn || l2 !== this.tn;
    }
    Tn() {
      const t = this.$i.wt().map((t2) => t2.In().An()).filter(L), i = 0 === t.length ? null : Math.max(...t);
      this.sn = null !== i ? i : NaN;
    }
    Dn(t, i, n) {
      let s = t.get(i);
      return void 0 === s && (s = new st(this, i, n), t.set(i, s)), s;
    }
  };
  function _t(t) {
    return "left" === t || "right" === t;
  }
  var ut = class _ut {
    constructor(t) {
      this.zn = /* @__PURE__ */ new Map(), this.Ln = [], this.En = t;
    }
    Nn(t, i) {
      const n = function(t2, i2) {
        return void 0 === t2 ? i2 : { Fn: Math.max(t2.Fn, i2.Fn), Wn: t2.Wn || i2.Wn };
      }(this.zn.get(t), i);
      this.zn.set(t, n);
    }
    jn() {
      return this.En;
    }
    Hn(t) {
      const i = this.zn.get(t);
      return void 0 === i ? { Fn: this.En } : { Fn: Math.max(this.En, i.Fn), Wn: i.Wn };
    }
    $n() {
      this.Un(), this.Ln = [{ qn: 0 }];
    }
    Yn(t) {
      this.Un(), this.Ln = [{ qn: 1, Vt: t }];
    }
    Zn(t) {
      this.Xn(), this.Ln.push({ qn: 5, Vt: t });
    }
    Un() {
      this.Xn(), this.Ln.push({ qn: 6 });
    }
    Kn() {
      this.Un(), this.Ln = [{ qn: 4 }];
    }
    Gn(t) {
      this.Un(), this.Ln.push({ qn: 2, Vt: t });
    }
    Jn(t) {
      this.Un(), this.Ln.push({ qn: 3, Vt: t });
    }
    Qn() {
      return this.Ln;
    }
    ts(t) {
      for (const i of t.Ln)
        this.ns(i);
      this.En = Math.max(this.En, t.En), t.zn.forEach((t2, i) => {
        this.Nn(i, t2);
      });
    }
    static ss() {
      return new _ut(2);
    }
    static es() {
      return new _ut(3);
    }
    ns(t) {
      switch (t.qn) {
        case 0:
          this.$n();
          break;
        case 1:
          this.Yn(t.Vt);
          break;
        case 2:
          this.Gn(t.Vt);
          break;
        case 3:
          this.Jn(t.Vt);
          break;
        case 4:
          this.Kn();
          break;
        case 5:
          this.Zn(t.Vt);
          break;
        case 6:
          this.Xn();
      }
    }
    Xn() {
      const t = this.Ln.findIndex((t2) => 5 === t2.qn);
      -1 !== t && this.Ln.splice(t, 1);
    }
  };
  var ct = ".";
  function dt(t, i) {
    if (!O(t))
      return "n/a";
    if (!B(i))
      throw new TypeError("invalid length");
    if (i < 0 || i > 16)
      throw new TypeError("invalid length");
    if (0 === i)
      return t.toString();
    return ("0000000000000000" + t.toString()).slice(-i);
  }
  var ft = class {
    constructor(t, i) {
      if (i || (i = 1), O(t) && B(t) || (t = 100), t < 0)
        throw new TypeError("invalid base");
      this.Li = t, this.rs = i, this.hs();
    }
    format(t) {
      const i = t < 0 ? "\u2212" : "";
      return t = Math.abs(t), i + this.ls(t);
    }
    hs() {
      if (this._s = 0, this.Li > 0 && this.rs > 0) {
        let t = this.Li;
        for (; t > 1; )
          t /= 10, this._s++;
      }
    }
    ls(t) {
      const i = this.Li / this.rs;
      let n = Math.floor(t), s = "";
      const e2 = void 0 !== this._s ? this._s : NaN;
      if (i > 1) {
        let r2 = +(Math.round(t * i) - n * i).toFixed(this._s);
        r2 >= i && (r2 -= i, n += 1), s = ct + dt(+r2.toFixed(this._s) * this.rs, e2);
      } else
        n = Math.round(n * i) / i, e2 > 0 && (s = ct + dt(0, e2));
      return n.toFixed(0) + s;
    }
  };
  var vt = class extends ft {
    constructor(t = 100) {
      super(t);
    }
    format(t) {
      return `${super.format(t)}%`;
    }
  };
  var pt = class {
    constructor(t) {
      this.us = t;
    }
    format(t) {
      let i = "";
      return t < 0 && (i = "-", t = -t), t < 995 ? i + this.cs(t) : t < 999995 ? i + this.cs(t / 1e3) + "K" : t < 999999995 ? (t = 1e3 * Math.round(t / 1e3), i + this.cs(t / 1e6) + "M") : (t = 1e6 * Math.round(t / 1e6), i + this.cs(t / 1e9) + "B");
    }
    cs(t) {
      let i;
      const n = Math.pow(10, this.us);
      return i = (t = Math.round(t * n) / n) >= 1e-15 && t < 1 ? t.toFixed(this.us).replace(/\.?0+$/, "") : String(t), i.replace(/(\.[1-9]*)0+$/, (t2, i2) => i2);
    }
  };
  function mt(t, i, n, s, e2, r2, h2) {
    if (0 === i.length || s.from >= i.length || s.to <= 0)
      return;
    const { context: l2, horizontalPixelRatio: a2, verticalPixelRatio: o2 } = t, _2 = i[s.from];
    let u2 = r2(t, _2), c2 = _2;
    if (s.to - s.from < 2) {
      const i2 = e2 / 2;
      l2.beginPath();
      const n2 = { nt: _2.nt - i2, st: _2.st }, s2 = { nt: _2.nt + i2, st: _2.st };
      l2.moveTo(n2.nt * a2, n2.st * o2), l2.lineTo(s2.nt * a2, s2.st * o2), h2(t, u2, n2, s2);
    } else {
      const e3 = (i2, n2) => {
        h2(t, u2, c2, n2), l2.beginPath(), u2 = i2, c2 = n2;
      };
      let d2 = c2;
      l2.beginPath(), l2.moveTo(_2.nt * a2, _2.st * o2);
      for (let h3 = s.from + 1; h3 < s.to; ++h3) {
        d2 = i[h3];
        const s2 = r2(t, d2);
        switch (n) {
          case 0:
            l2.lineTo(d2.nt * a2, d2.st * o2);
            break;
          case 1:
            l2.lineTo(d2.nt * a2, i[h3 - 1].st * o2), s2 !== u2 && (e3(s2, d2), l2.lineTo(d2.nt * a2, i[h3 - 1].st * o2)), l2.lineTo(d2.nt * a2, d2.st * o2);
            break;
          case 2: {
            const [t2, n2] = Mt(i, h3 - 1, h3);
            l2.bezierCurveTo(t2.nt * a2, t2.st * o2, n2.nt * a2, n2.st * o2, d2.nt * a2, d2.st * o2);
            break;
          }
        }
        1 !== n && s2 !== u2 && (e3(s2, d2), l2.moveTo(d2.nt * a2, d2.st * o2));
      }
      (c2 !== d2 || c2 === d2 && 1 === n) && h2(t, u2, c2, d2);
    }
  }
  var bt = 6;
  function wt(t, i) {
    return { nt: t.nt - i.nt, st: t.st - i.st };
  }
  function gt(t, i) {
    return { nt: t.nt / i, st: t.st / i };
  }
  function Mt(t, i, n) {
    const s = Math.max(0, i - 1), e2 = Math.min(t.length - 1, n + 1);
    var r2, h2;
    return [(r2 = t[i], h2 = gt(wt(t[n], t[s]), bt), { nt: r2.nt + h2.nt, st: r2.st + h2.st }), wt(t[n], gt(wt(t[e2], t[i]), bt))];
  }
  function xt(t, i, n, s, e2) {
    const { context: r2, horizontalPixelRatio: h2, verticalPixelRatio: l2 } = i;
    r2.lineTo(e2.nt * h2, t * l2), r2.lineTo(s.nt * h2, t * l2), r2.closePath(), r2.fillStyle = n, r2.fill();
  }
  var St = class extends H {
    constructor() {
      super(...arguments), this.G = null;
    }
    J(t) {
      this.G = t;
    }
    K(t) {
      var i;
      if (null === this.G)
        return;
      const { it: n, tt: s, ds: e2, et: r2, Nt: h2, fs: l2 } = this.G, a2 = null !== (i = this.G.vs) && void 0 !== i ? i : this.G.ps ? 0 : t.mediaSize.height;
      if (null === s)
        return;
      const o2 = t.context;
      o2.lineCap = "butt", o2.lineJoin = "round", o2.lineWidth = r2, f(o2, h2), o2.lineWidth = 1, mt(t, n, l2, s, e2, this.bs.bind(this), xt.bind(null, a2));
    }
  };
  function kt(t, i, n) {
    return Math.min(Math.max(t, i), n);
  }
  function yt(t, i, n) {
    return i - t <= n;
  }
  function Ct(t) {
    const i = Math.ceil(t);
    return i % 2 == 0 ? i - 1 : i;
  }
  var Tt = class {
    ws(t, i) {
      const n = this.gs, { Ms: s, xs: e2, Ss: r2, ks: h2, ys: l2, vs: a2 } = i;
      if (void 0 === this.Cs || void 0 === n || n.Ms !== s || n.xs !== e2 || n.Ss !== r2 || n.ks !== h2 || n.vs !== a2 || n.ys !== l2) {
        const n2 = t.context.createLinearGradient(0, 0, 0, l2);
        if (n2.addColorStop(0, s), null != a2) {
          const i2 = kt(a2 * t.verticalPixelRatio / l2, 0, 1);
          n2.addColorStop(i2, e2), n2.addColorStop(i2, r2);
        }
        n2.addColorStop(1, h2), this.Cs = n2, this.gs = i;
      }
      return this.Cs;
    }
  };
  var Pt = class extends St {
    constructor() {
      super(...arguments), this.Ts = new Tt();
    }
    bs(t, i) {
      return this.Ts.ws(t, { Ms: i.Ps, xs: "", Ss: "", ks: i.Rs, ys: t.bitmapSize.height });
    }
  };
  function Rt(t, i) {
    const n = t.context;
    n.strokeStyle = i, n.stroke();
  }
  var Dt = class extends H {
    constructor() {
      super(...arguments), this.G = null;
    }
    J(t) {
      this.G = t;
    }
    K(t) {
      if (null === this.G)
        return;
      const { it: i, tt: n, ds: s, fs: e2, et: r2, Nt: h2, Ds: l2 } = this.G;
      if (null === n)
        return;
      const a2 = t.context;
      a2.lineCap = "butt", a2.lineWidth = r2 * t.verticalPixelRatio, f(a2, h2), a2.lineJoin = "round";
      const o2 = this.Vs.bind(this);
      void 0 !== e2 && mt(t, i, e2, n, s, o2, Rt), l2 && function(t2, i2, n2, s2, e3) {
        const { horizontalPixelRatio: r3, verticalPixelRatio: h3, context: l3 } = t2;
        let a3 = null;
        const o3 = Math.max(1, Math.floor(r3)) % 2 / 2, _2 = n2 * h3 + o3;
        for (let n3 = s2.to - 1; n3 >= s2.from; --n3) {
          const s3 = i2[n3];
          if (s3) {
            const i3 = e3(t2, s3);
            i3 !== a3 && (l3.beginPath(), null !== a3 && l3.fill(), l3.fillStyle = i3, a3 = i3);
            const n4 = Math.round(s3.nt * r3) + o3, u2 = s3.st * h3;
            l3.moveTo(n4, u2), l3.arc(n4, u2, _2, 0, 2 * Math.PI);
          }
        }
        l3.fill();
      }(t, i, l2, n, o2);
    }
  };
  var Vt = class extends Dt {
    Vs(t, i) {
      return i.lt;
    }
  };
  function Ot(t, i, n, s, e2 = 0, r2 = i.length) {
    let h2 = r2 - e2;
    for (; 0 < h2; ) {
      const r3 = h2 >> 1, l2 = e2 + r3;
      s(i[l2], n) === t ? (e2 = l2 + 1, h2 -= r3 + 1) : h2 = r3;
    }
    return e2;
  }
  var Bt = Ot.bind(null, true);
  var At = Ot.bind(null, false);
  function It(t, i) {
    return t.ot < i;
  }
  function zt(t, i) {
    return i < t.ot;
  }
  function Lt(t, i, n) {
    const s = i.Os(), e2 = i.ui(), r2 = Bt(t, s, It), h2 = At(t, e2, zt);
    if (!n)
      return { from: r2, to: h2 };
    let l2 = r2, a2 = h2;
    return r2 > 0 && r2 < t.length && t[r2].ot >= s && (l2 = r2 - 1), h2 > 0 && h2 < t.length && t[h2 - 1].ot <= e2 && (a2 = h2 + 1), { from: l2, to: a2 };
  }
  var Et = class {
    constructor(t, i, n) {
      this.Bs = true, this.As = true, this.Is = true, this.zs = [], this.Ls = null, this.Es = t, this.Ns = i, this.Fs = n;
    }
    bt(t) {
      this.Bs = true, "data" === t && (this.As = true), "options" === t && (this.Is = true);
    }
    gt() {
      return this.Es.yt() ? (this.Ws(), null === this.Ls ? null : this.js) : null;
    }
    Hs() {
      this.zs = this.zs.map((t) => Object.assign(Object.assign({}, t), this.Es.Us().$s(t.ot)));
    }
    qs() {
      this.Ls = null;
    }
    Ws() {
      this.As && (this.Ys(), this.As = false), this.Is && (this.Hs(), this.Is = false), this.Bs && (this.Zs(), this.Bs = false);
    }
    Zs() {
      const t = this.Es.Dt(), i = this.Ns.St();
      if (this.qs(), i.Ni() || t.Ni())
        return;
      const n = i.Xs();
      if (null === n)
        return;
      if (0 === this.Es.In().Ks())
        return;
      const s = this.Es.Ct();
      null !== s && (this.Ls = Lt(this.zs, n, this.Fs), this.Gs(t, i, s.Vt), this.Js());
    }
  };
  var Nt = class extends Et {
    constructor(t, i) {
      super(t, i, true);
    }
    Gs(t, i, n) {
      i.Qs(this.zs, E(this.Ls)), t.te(this.zs, n, E(this.Ls));
    }
    ie(t, i) {
      return { ot: t, _t: i, nt: NaN, st: NaN };
    }
    Ys() {
      const t = this.Es.Us();
      this.zs = this.Es.In().ne().map((i) => {
        const n = i.Vt[3];
        return this.se(i.ee, n, t);
      });
    }
  };
  var Ft = class extends Nt {
    constructor(t, i) {
      super(t, i), this.js = new j(), this.re = new Pt(), this.he = new Vt(), this.js.Z([this.re, this.he]);
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.ie(t, i)), n.$s(t));
    }
    Js() {
      const t = this.Es.W();
      this.re.J({ fs: t.lineType, it: this.zs, Nt: t.lineStyle, et: t.lineWidth, vs: null, ps: t.invertFilledArea, tt: this.Ls, ds: this.Ns.St().le() }), this.he.J({ fs: t.lineVisible ? t.lineType : void 0, it: this.zs, Nt: t.lineStyle, et: t.lineWidth, tt: this.Ls, ds: this.Ns.St().le(), Ds: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0 });
    }
  };
  var Wt = class extends H {
    constructor() {
      super(...arguments), this.zt = null, this.ae = 0, this.oe = 0;
    }
    J(t) {
      this.zt = t;
    }
    K({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
      if (null === this.zt || 0 === this.zt.In.length || null === this.zt.tt)
        return;
      if (this.ae = this._e(i), this.ae >= 2) {
        Math.max(1, Math.floor(i)) % 2 != this.ae % 2 && this.ae--;
      }
      this.oe = this.zt.ue ? Math.min(this.ae, Math.floor(i)) : this.ae;
      let s = null;
      const e2 = this.oe <= this.ae && this.zt.le >= Math.floor(1.5 * i);
      for (let r2 = this.zt.tt.from; r2 < this.zt.tt.to; ++r2) {
        const h2 = this.zt.In[r2];
        s !== h2.ce && (t.fillStyle = h2.ce, s = h2.ce);
        const l2 = Math.floor(0.5 * this.oe), a2 = Math.round(h2.nt * i), o2 = a2 - l2, _2 = this.oe, u2 = o2 + _2 - 1, c2 = Math.min(h2.de, h2.fe), d2 = Math.max(h2.de, h2.fe), f2 = Math.round(c2 * n) - l2, v2 = Math.round(d2 * n) + l2, p2 = Math.max(v2 - f2, this.oe);
        t.fillRect(o2, f2, _2, p2);
        const m2 = Math.ceil(1.5 * this.ae);
        if (e2) {
          if (this.zt.ve) {
            const i3 = a2 - m2;
            let s3 = Math.max(f2, Math.round(h2.pe * n) - l2), e4 = s3 + _2 - 1;
            e4 > f2 + p2 - 1 && (e4 = f2 + p2 - 1, s3 = e4 - _2 + 1), t.fillRect(i3, s3, o2 - i3, e4 - s3 + 1);
          }
          const i2 = a2 + m2;
          let s2 = Math.max(f2, Math.round(h2.me * n) - l2), e3 = s2 + _2 - 1;
          e3 > f2 + p2 - 1 && (e3 = f2 + p2 - 1, s2 = e3 - _2 + 1), t.fillRect(u2 + 1, s2, i2 - u2, e3 - s2 + 1);
        }
      }
    }
    _e(t) {
      const i = Math.floor(t);
      return Math.max(i, Math.floor(function(t2, i2) {
        return Math.floor(0.3 * t2 * i2);
      }(b(this.zt).le, t)));
    }
  };
  var jt = class extends Et {
    constructor(t, i) {
      super(t, i, false);
    }
    Gs(t, i, n) {
      i.Qs(this.zs, E(this.Ls)), t.be(this.zs, n, E(this.Ls));
    }
    we(t, i, n) {
      return { ot: t, ge: i.Vt[0], Me: i.Vt[1], xe: i.Vt[2], Se: i.Vt[3], nt: NaN, pe: NaN, de: NaN, fe: NaN, me: NaN };
    }
    Ys() {
      const t = this.Es.Us();
      this.zs = this.Es.In().ne().map((i) => this.se(i.ee, i, t));
    }
  };
  var Ht = class extends jt {
    constructor() {
      super(...arguments), this.js = new Wt();
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.we(t, i, n)), n.$s(t));
    }
    Js() {
      const t = this.Es.W();
      this.js.J({ In: this.zs, le: this.Ns.St().le(), ve: t.openVisible, ue: t.thinBars, tt: this.Ls });
    }
  };
  var $t = class extends St {
    constructor() {
      super(...arguments), this.Ts = new Tt();
    }
    bs(t, i) {
      const n = this.G;
      return this.Ts.ws(t, { Ms: i.ke, xs: i.ye, Ss: i.Ce, ks: i.Te, ys: t.bitmapSize.height, vs: n.vs });
    }
  };
  var Ut = class extends Dt {
    constructor() {
      super(...arguments), this.Pe = new Tt();
    }
    Vs(t, i) {
      const n = this.G;
      return this.Pe.ws(t, { Ms: i.Re, xs: i.Re, Ss: i.De, ks: i.De, ys: t.bitmapSize.height, vs: n.vs });
    }
  };
  var qt = class extends Nt {
    constructor(t, i) {
      super(t, i), this.js = new j(), this.Ve = new $t(), this.Oe = new Ut(), this.js.Z([this.Ve, this.Oe]);
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.ie(t, i)), n.$s(t));
    }
    Js() {
      const t = this.Es.Ct();
      if (null === t)
        return;
      const i = this.Es.W(), n = this.Es.Dt().Rt(i.baseValue.price, t.Vt), s = this.Ns.St().le();
      this.Ve.J({ it: this.zs, et: i.lineWidth, Nt: i.lineStyle, fs: i.lineType, vs: n, ps: false, tt: this.Ls, ds: s }), this.Oe.J({ it: this.zs, et: i.lineWidth, Nt: i.lineStyle, fs: i.lineVisible ? i.lineType : void 0, Ds: i.pointMarkersVisible ? i.pointMarkersRadius || i.lineWidth / 2 + 2 : void 0, vs: n, tt: this.Ls, ds: s });
    }
  };
  var Yt = class extends H {
    constructor() {
      super(...arguments), this.zt = null, this.ae = 0;
    }
    J(t) {
      this.zt = t;
    }
    K(t) {
      if (null === this.zt || 0 === this.zt.In.length || null === this.zt.tt)
        return;
      const { horizontalPixelRatio: i } = t;
      if (this.ae = function(t2, i2) {
        if (t2 >= 2.5 && t2 <= 4)
          return Math.floor(3 * i2);
        const n2 = 1 - 0.2 * Math.atan(Math.max(4, t2) - 4) / (0.5 * Math.PI), s2 = Math.floor(t2 * n2 * i2), e2 = Math.floor(t2 * i2), r2 = Math.min(s2, e2);
        return Math.max(Math.floor(i2), r2);
      }(this.zt.le, i), this.ae >= 2) {
        Math.floor(i) % 2 != this.ae % 2 && this.ae--;
      }
      const n = this.zt.In;
      this.zt.Be && this.Ae(t, n, this.zt.tt), this.zt._i && this.Ie(t, n, this.zt.tt);
      const s = this.ze(i);
      (!this.zt._i || this.ae > 2 * s) && this.Le(t, n, this.zt.tt);
    }
    Ae(t, i, n) {
      if (null === this.zt)
        return;
      const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
      let h2 = "", l2 = Math.min(Math.floor(e2), Math.floor(this.zt.le * e2));
      l2 = Math.max(Math.floor(e2), Math.min(l2, this.ae));
      const a2 = Math.floor(0.5 * l2);
      let o2 = null;
      for (let t2 = n.from; t2 < n.to; t2++) {
        const n2 = i[t2];
        n2.Ee !== h2 && (s.fillStyle = n2.Ee, h2 = n2.Ee);
        const _2 = Math.round(Math.min(n2.pe, n2.me) * r2), u2 = Math.round(Math.max(n2.pe, n2.me) * r2), c2 = Math.round(n2.de * r2), d2 = Math.round(n2.fe * r2);
        let f2 = Math.round(e2 * n2.nt) - a2;
        const v2 = f2 + l2 - 1;
        null !== o2 && (f2 = Math.max(o2 + 1, f2), f2 = Math.min(f2, v2));
        const p2 = v2 - f2 + 1;
        s.fillRect(f2, c2, p2, _2 - c2), s.fillRect(f2, u2 + 1, p2, d2 - u2), o2 = v2;
      }
    }
    ze(t) {
      let i = Math.floor(1 * t);
      this.ae <= 2 * i && (i = Math.floor(0.5 * (this.ae - 1)));
      const n = Math.max(Math.floor(t), i);
      return this.ae <= 2 * n ? Math.max(Math.floor(t), Math.floor(1 * t)) : n;
    }
    Ie(t, i, n) {
      if (null === this.zt)
        return;
      const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
      let h2 = "";
      const l2 = this.ze(e2);
      let a2 = null;
      for (let t2 = n.from; t2 < n.to; t2++) {
        const n2 = i[t2];
        n2.Ne !== h2 && (s.fillStyle = n2.Ne, h2 = n2.Ne);
        let o2 = Math.round(n2.nt * e2) - Math.floor(0.5 * this.ae);
        const _2 = o2 + this.ae - 1, u2 = Math.round(Math.min(n2.pe, n2.me) * r2), c2 = Math.round(Math.max(n2.pe, n2.me) * r2);
        if (null !== a2 && (o2 = Math.max(a2 + 1, o2), o2 = Math.min(o2, _2)), this.zt.le * e2 > 2 * l2)
          K(s, o2, u2, _2 - o2 + 1, c2 - u2 + 1, l2);
        else {
          const t3 = _2 - o2 + 1;
          s.fillRect(o2, u2, t3, c2 - u2 + 1);
        }
        a2 = _2;
      }
    }
    Le(t, i, n) {
      if (null === this.zt)
        return;
      const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
      let h2 = "";
      const l2 = this.ze(e2);
      for (let t2 = n.from; t2 < n.to; t2++) {
        const n2 = i[t2];
        let a2 = Math.round(Math.min(n2.pe, n2.me) * r2), o2 = Math.round(Math.max(n2.pe, n2.me) * r2), _2 = Math.round(n2.nt * e2) - Math.floor(0.5 * this.ae), u2 = _2 + this.ae - 1;
        if (n2.ce !== h2) {
          const t3 = n2.ce;
          s.fillStyle = t3, h2 = t3;
        }
        this.zt._i && (_2 += l2, a2 += l2, u2 -= l2, o2 -= l2), a2 > o2 || s.fillRect(_2, a2, u2 - _2 + 1, o2 - a2 + 1);
      }
    }
  };
  var Zt = class extends jt {
    constructor() {
      super(...arguments), this.js = new Yt();
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.we(t, i, n)), n.$s(t));
    }
    Js() {
      const t = this.Es.W();
      this.js.J({ In: this.zs, le: this.Ns.St().le(), Be: t.wickVisible, _i: t.borderVisible, tt: this.Ls });
    }
  };
  var Xt = class {
    constructor(t, i) {
      this.Fe = t, this.Li = i;
    }
    X(t, i, n) {
      this.Fe.draw(t, this.Li, i, n);
    }
  };
  var Kt = class extends Et {
    constructor(t, i, n) {
      super(t, i, false), this.wn = n, this.js = new Xt(this.wn.renderer(), (i2) => {
        const n2 = t.Ct();
        return null === n2 ? null : t.Dt().Rt(i2, n2.Vt);
      });
    }
    We(t) {
      return this.wn.priceValueBuilder(t);
    }
    je(t) {
      return this.wn.isWhitespace(t);
    }
    Ys() {
      const t = this.Es.Us();
      this.zs = this.Es.In().ne().map((i) => Object.assign(Object.assign({ ot: i.ee, nt: NaN }, t.$s(i.ee)), { He: i.$e }));
    }
    Gs(t, i) {
      i.Qs(this.zs, E(this.Ls));
    }
    Js() {
      this.wn.update({ bars: this.zs.map(Gt), barSpacing: this.Ns.St().le(), visibleRange: this.Ls }, this.Es.W());
    }
  };
  function Gt(t) {
    return { x: t.nt, time: t.ot, originalData: t.He, barColor: t.ce };
  }
  var Jt = class extends H {
    constructor() {
      super(...arguments), this.zt = null, this.Ue = [];
    }
    J(t) {
      this.zt = t, this.Ue = [];
    }
    K({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
      if (null === this.zt || 0 === this.zt.it.length || null === this.zt.tt)
        return;
      this.Ue.length || this.qe(i);
      const s = Math.max(1, Math.floor(n)), e2 = Math.round(this.zt.Ye * n) - Math.floor(s / 2), r2 = e2 + s;
      for (let i2 = this.zt.tt.from; i2 < this.zt.tt.to; i2++) {
        const h2 = this.zt.it[i2], l2 = this.Ue[i2 - this.zt.tt.from], a2 = Math.round(h2.st * n);
        let o2, _2;
        t.fillStyle = h2.ce, a2 <= e2 ? (o2 = a2, _2 = r2) : (o2 = e2, _2 = a2 - Math.floor(s / 2) + s), t.fillRect(l2.Os, o2, l2.ui - l2.Os + 1, _2 - o2);
      }
    }
    qe(t) {
      if (null === this.zt || 0 === this.zt.it.length || null === this.zt.tt)
        return void (this.Ue = []);
      const i = Math.ceil(this.zt.le * t) <= 1 ? 0 : Math.max(1, Math.floor(t)), n = Math.round(this.zt.le * t) - i;
      this.Ue = new Array(this.zt.tt.to - this.zt.tt.from);
      for (let i2 = this.zt.tt.from; i2 < this.zt.tt.to; i2++) {
        const s2 = this.zt.it[i2], e2 = Math.round(s2.nt * t);
        let r2, h2;
        if (n % 2) {
          const t2 = (n - 1) / 2;
          r2 = e2 - t2, h2 = e2 + t2;
        } else {
          const t2 = n / 2;
          r2 = e2 - t2, h2 = e2 + t2 - 1;
        }
        this.Ue[i2 - this.zt.tt.from] = { Os: r2, ui: h2, Ze: e2, Xe: s2.nt * t, ot: s2.ot };
      }
      for (let t2 = this.zt.tt.from + 1; t2 < this.zt.tt.to; t2++) {
        const n2 = this.Ue[t2 - this.zt.tt.from], s2 = this.Ue[t2 - this.zt.tt.from - 1];
        n2.ot === s2.ot + 1 && (n2.Os - s2.ui !== i + 1 && (s2.Ze > s2.Xe ? s2.ui = n2.Os - i - 1 : n2.Os = s2.ui + i + 1));
      }
      let s = Math.ceil(this.zt.le * t);
      for (let t2 = this.zt.tt.from; t2 < this.zt.tt.to; t2++) {
        const i2 = this.Ue[t2 - this.zt.tt.from];
        i2.ui < i2.Os && (i2.ui = i2.Os);
        const n2 = i2.ui - i2.Os + 1;
        s = Math.min(n2, s);
      }
      if (i > 0 && s < 4)
        for (let t2 = this.zt.tt.from; t2 < this.zt.tt.to; t2++) {
          const i2 = this.Ue[t2 - this.zt.tt.from];
          i2.ui - i2.Os + 1 > s && (i2.Ze > i2.Xe ? i2.ui -= 1 : i2.Os += 1);
        }
    }
  };
  var Qt = class extends Nt {
    constructor() {
      super(...arguments), this.js = new Jt();
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.ie(t, i)), n.$s(t));
    }
    Js() {
      const t = { it: this.zs, le: this.Ns.St().le(), tt: this.Ls, Ye: this.Es.Dt().Rt(this.Es.W().base, b(this.Es.Ct()).Vt) };
      this.js.J(t);
    }
  };
  var ti = class extends Nt {
    constructor() {
      super(...arguments), this.js = new Vt();
    }
    se(t, i, n) {
      return Object.assign(Object.assign({}, this.ie(t, i)), n.$s(t));
    }
    Js() {
      const t = this.Es.W(), i = { it: this.zs, Nt: t.lineStyle, fs: t.lineVisible ? t.lineType : void 0, et: t.lineWidth, Ds: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0, tt: this.Ls, ds: this.Ns.St().le() };
      this.js.J(i);
    }
  };
  var ii = /[2-9]/g;
  var ni = class {
    constructor(t = 50) {
      this.Ke = 0, this.Ge = 1, this.Je = 1, this.Qe = {}, this.tr = /* @__PURE__ */ new Map(), this.ir = t;
    }
    nr() {
      this.Ke = 0, this.tr.clear(), this.Ge = 1, this.Je = 1, this.Qe = {};
    }
    xi(t, i, n) {
      return this.sr(t, i, n).width;
    }
    Mi(t, i, n) {
      const s = this.sr(t, i, n);
      return ((s.actualBoundingBoxAscent || 0) - (s.actualBoundingBoxDescent || 0)) / 2;
    }
    sr(t, i, n) {
      const s = n || ii, e2 = String(i).replace(s, "0");
      if (this.tr.has(e2))
        return m(this.tr.get(e2)).er;
      if (this.Ke === this.ir) {
        const t2 = this.Qe[this.Je];
        delete this.Qe[this.Je], this.tr.delete(t2), this.Je++, this.Ke--;
      }
      t.save(), t.textBaseline = "middle";
      const r2 = t.measureText(e2);
      return t.restore(), 0 === r2.width && i.length || (this.tr.set(e2, { er: r2, rr: this.Ge }), this.Qe[this.Ge] = e2, this.Ke++, this.Ge++), r2;
    }
  };
  var si = class {
    constructor(t) {
      this.hr = null, this.k = null, this.lr = "right", this.ar = t;
    }
    _r(t, i, n) {
      this.hr = t, this.k = i, this.lr = n;
    }
    X(t) {
      null !== this.k && null !== this.hr && this.hr.X(t, this.k, this.ar, this.lr);
    }
  };
  var ei = class {
    constructor(t, i, n) {
      this.ur = t, this.ar = new ni(50), this.cr = i, this.F = n, this.j = -1, this.Wt = new si(this.ar);
    }
    gt() {
      const t = this.F.dr(this.cr);
      if (null === t)
        return null;
      const i = t.vr(this.cr) ? t.pr() : this.cr.Dt();
      if (null === i)
        return null;
      const n = t.mr(i);
      if ("overlay" === n)
        return null;
      const s = this.F.br();
      return s.P !== this.j && (this.j = s.P, this.ar.nr()), this.Wt._r(this.ur.Ii(), s, n), this.Wt;
    }
  };
  var ri = class extends H {
    constructor() {
      super(...arguments), this.zt = null;
    }
    J(t) {
      this.zt = t;
    }
    wr(t, i) {
      var n;
      if (!(null === (n = this.zt) || void 0 === n ? void 0 : n.yt))
        return null;
      const { st: s, et: e2, gr: r2 } = this.zt;
      return i >= s - e2 - 7 && i <= s + e2 + 7 ? { Mr: this.zt, gr: r2 } : null;
    }
    K({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
      if (null === this.zt)
        return;
      if (false === this.zt.yt)
        return;
      const e2 = Math.round(this.zt.st * s);
      e2 < 0 || e2 > i.height || (t.lineCap = "butt", t.strokeStyle = this.zt.V, t.lineWidth = Math.floor(this.zt.et * n), f(t, this.zt.Nt), v(t, e2, 0, i.width));
    }
  };
  var hi = class {
    constructor(t) {
      this.Sr = { st: 0, V: "rgba(0, 0, 0, 0)", et: 1, Nt: 0, yt: false }, this.kr = new ri(), this.ft = true, this.Es = t, this.Ns = t.$t(), this.kr.J(this.Sr);
    }
    bt() {
      this.ft = true;
    }
    gt() {
      return this.Es.yt() ? (this.ft && (this.yr(), this.ft = false), this.kr) : null;
    }
  };
  var li = class extends hi {
    constructor(t) {
      super(t);
    }
    yr() {
      this.Sr.yt = false;
      const t = this.Es.Dt(), i = t.Cr().Cr;
      if (2 !== i && 3 !== i)
        return;
      const n = this.Es.W();
      if (!n.baseLineVisible || !this.Es.yt())
        return;
      const s = this.Es.Ct();
      null !== s && (this.Sr.yt = true, this.Sr.st = t.Rt(s.Vt, s.Vt), this.Sr.V = n.baseLineColor, this.Sr.et = n.baseLineWidth, this.Sr.Nt = n.baseLineStyle);
    }
  };
  var ai = class extends H {
    constructor() {
      super(...arguments), this.zt = null;
    }
    J(t) {
      this.zt = t;
    }
    $e() {
      return this.zt;
    }
    K({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
      const s = this.zt;
      if (null === s)
        return;
      const e2 = Math.max(1, Math.floor(i)), r2 = e2 % 2 / 2, h2 = Math.round(s.Xe.x * i) + r2, l2 = s.Xe.y * n;
      t.fillStyle = s.Tr, t.beginPath();
      const a2 = Math.max(2, 1.5 * s.Pr) * i;
      t.arc(h2, l2, a2, 0, 2 * Math.PI, false), t.fill(), t.fillStyle = s.Rr, t.beginPath(), t.arc(h2, l2, s.ht * i, 0, 2 * Math.PI, false), t.fill(), t.lineWidth = e2, t.strokeStyle = s.Dr, t.beginPath(), t.arc(h2, l2, s.ht * i + e2 / 2, 0, 2 * Math.PI, false), t.stroke();
    }
  };
  var oi = [{ Vr: 0, Or: 0.25, Br: 4, Ar: 10, Ir: 0.25, zr: 0, Lr: 0.4, Er: 0.8 }, { Vr: 0.25, Or: 0.525, Br: 10, Ar: 14, Ir: 0, zr: 0, Lr: 0.8, Er: 0 }, { Vr: 0.525, Or: 1, Br: 14, Ar: 14, Ir: 0, zr: 0, Lr: 0, Er: 0 }];
  function _i(t, i, n, s) {
    return function(t2, i2) {
      if ("transparent" === t2)
        return t2;
      const n2 = T(t2), s2 = n2[3];
      return `rgba(${n2[0]}, ${n2[1]}, ${n2[2]}, ${i2 * s2})`;
    }(t, n + (s - n) * i);
  }
  function ui(t, i) {
    const n = t % 2600 / 2600;
    let s;
    for (const t2 of oi)
      if (n >= t2.Vr && n <= t2.Or) {
        s = t2;
        break;
      }
    p(void 0 !== s, "Last price animation internal logic error");
    const e2 = (n - s.Vr) / (s.Or - s.Vr);
    return { Rr: _i(i, e2, s.Ir, s.zr), Dr: _i(i, e2, s.Lr, s.Er), ht: (r2 = e2, h2 = s.Br, l2 = s.Ar, h2 + (l2 - h2) * r2) };
    var r2, h2, l2;
  }
  var ci = class {
    constructor(t) {
      this.Wt = new ai(), this.ft = true, this.Nr = true, this.Fr = performance.now(), this.Wr = this.Fr - 1, this.jr = t;
    }
    Hr() {
      this.Wr = this.Fr - 1, this.bt();
    }
    $r() {
      if (this.bt(), 2 === this.jr.W().lastPriceAnimation) {
        const t = performance.now(), i = this.Wr - t;
        if (i > 0)
          return void (i < 650 && (this.Wr += 2600));
        this.Fr = t, this.Wr = t + 2600;
      }
    }
    bt() {
      this.ft = true;
    }
    Ur() {
      this.Nr = true;
    }
    yt() {
      return 0 !== this.jr.W().lastPriceAnimation;
    }
    qr() {
      switch (this.jr.W().lastPriceAnimation) {
        case 0:
          return false;
        case 1:
          return true;
        case 2:
          return performance.now() <= this.Wr;
      }
    }
    gt() {
      return this.ft ? (this.Mt(), this.ft = false, this.Nr = false) : this.Nr && (this.Yr(), this.Nr = false), this.Wt;
    }
    Mt() {
      this.Wt.J(null);
      const t = this.jr.$t().St(), i = t.Xs(), n = this.jr.Ct();
      if (null === i || null === n)
        return;
      const s = this.jr.Zr(true);
      if (s.Xr || !i.Kr(s.ee))
        return;
      const e2 = { x: t.It(s.ee), y: this.jr.Dt().Rt(s._t, n.Vt) }, r2 = s.V, h2 = this.jr.W().lineWidth, l2 = ui(this.Gr(), r2);
      this.Wt.J({ Tr: r2, Pr: h2, Rr: l2.Rr, Dr: l2.Dr, ht: l2.ht, Xe: e2 });
    }
    Yr() {
      const t = this.Wt.$e();
      if (null !== t) {
        const i = ui(this.Gr(), t.Tr);
        t.Rr = i.Rr, t.Dr = i.Dr, t.ht = i.ht;
      }
    }
    Gr() {
      return this.qr() ? performance.now() - this.Fr : 2599;
    }
  };
  function di(t, i) {
    return Ct(Math.min(Math.max(t, 12), 30) * i);
  }
  function fi(t, i) {
    switch (t) {
      case "arrowDown":
      case "arrowUp":
        return di(i, 1);
      case "circle":
        return di(i, 0.8);
      case "square":
        return di(i, 0.7);
    }
  }
  function vi(t) {
    return function(t2) {
      const i = Math.ceil(t2);
      return i % 2 != 0 ? i - 1 : i;
    }(di(t, 1));
  }
  function pi(t) {
    return Math.max(di(t, 0.1), 3);
  }
  function mi(t, i, n) {
    return i ? t : n ? Math.ceil(t / 2) : 0;
  }
  function bi(t, i, n, s, e2) {
    const r2 = fi("square", n), h2 = (r2 - 1) / 2, l2 = t - h2, a2 = i - h2;
    return s >= l2 && s <= l2 + r2 && e2 >= a2 && e2 <= a2 + r2;
  }
  function wi(t, i, n, s) {
    const e2 = (fi("arrowUp", s) - 1) / 2 * n.Jr, r2 = (Ct(s / 2) - 1) / 2 * n.Jr;
    i.beginPath(), t ? (i.moveTo(n.nt - e2, n.st), i.lineTo(n.nt, n.st - e2), i.lineTo(n.nt + e2, n.st), i.lineTo(n.nt + r2, n.st), i.lineTo(n.nt + r2, n.st + e2), i.lineTo(n.nt - r2, n.st + e2), i.lineTo(n.nt - r2, n.st)) : (i.moveTo(n.nt - e2, n.st), i.lineTo(n.nt, n.st + e2), i.lineTo(n.nt + e2, n.st), i.lineTo(n.nt + r2, n.st), i.lineTo(n.nt + r2, n.st - e2), i.lineTo(n.nt - r2, n.st - e2), i.lineTo(n.nt - r2, n.st)), i.fill();
  }
  function gi(t, i, n, s, e2, r2) {
    return bi(i, n, s, e2, r2);
  }
  var Mi = class extends H {
    constructor() {
      super(...arguments), this.zt = null, this.ar = new ni(), this.j = -1, this.H = "", this.Qr = "";
    }
    J(t) {
      this.zt = t;
    }
    _r(t, i) {
      this.j === t && this.H === i || (this.j = t, this.H = i, this.Qr = F(t, i), this.ar.nr());
    }
    wr(t, i) {
      if (null === this.zt || null === this.zt.tt)
        return null;
      for (let n = this.zt.tt.from; n < this.zt.tt.to; n++) {
        const s = this.zt.it[n];
        if (Si(s, t, i))
          return { Mr: s.th, gr: s.gr };
      }
      return null;
    }
    K({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }, s, e2) {
      if (null !== this.zt && null !== this.zt.tt) {
        t.textBaseline = "middle", t.font = this.Qr;
        for (let s2 = this.zt.tt.from; s2 < this.zt.tt.to; s2++) {
          const e3 = this.zt.it[s2];
          void 0 !== e3.Kt && (e3.Kt.Hi = this.ar.xi(t, e3.Kt.ih), e3.Kt.At = this.j, e3.Kt.nt = e3.nt - e3.Kt.Hi / 2), xi(e3, t, i, n);
        }
      }
    }
  };
  function xi(t, i, n, s) {
    i.fillStyle = t.V, void 0 !== t.Kt && function(t2, i2, n2, s2, e2, r2) {
      t2.save(), t2.scale(e2, r2), t2.fillText(i2, n2, s2), t2.restore();
    }(i, t.Kt.ih, t.Kt.nt, t.Kt.st, n, s), function(t2, i2, n2) {
      if (0 === t2.Ks)
        return;
      switch (t2.nh) {
        case "arrowDown":
          return void wi(false, i2, n2, t2.Ks);
        case "arrowUp":
          return void wi(true, i2, n2, t2.Ks);
        case "circle":
          return void function(t3, i3, n3) {
            const s2 = (fi("circle", n3) - 1) / 2;
            t3.beginPath(), t3.arc(i3.nt, i3.st, s2 * i3.Jr, 0, 2 * Math.PI, false), t3.fill();
          }(i2, n2, t2.Ks);
        case "square":
          return void function(t3, i3, n3) {
            const s2 = fi("square", n3), e2 = (s2 - 1) * i3.Jr / 2, r2 = i3.nt - e2, h2 = i3.st - e2;
            t3.fillRect(r2, h2, s2 * i3.Jr, s2 * i3.Jr);
          }(i2, n2, t2.Ks);
      }
      t2.nh;
    }(t, i, function(t2, i2, n2) {
      const s2 = Math.max(1, Math.floor(i2)) % 2 / 2;
      return { nt: Math.round(t2.nt * i2) + s2, st: t2.st * n2, Jr: i2 };
    }(t, n, s));
  }
  function Si(t, i, n) {
    return !(void 0 === t.Kt || !function(t2, i2, n2, s, e2, r2) {
      const h2 = s / 2;
      return e2 >= t2 && e2 <= t2 + n2 && r2 >= i2 - h2 && r2 <= i2 + h2;
    }(t.Kt.nt, t.Kt.st, t.Kt.Hi, t.Kt.At, i, n)) || function(t2, i2, n2) {
      if (0 === t2.Ks)
        return false;
      switch (t2.nh) {
        case "arrowDown":
        case "arrowUp":
          return gi(0, t2.nt, t2.st, t2.Ks, i2, n2);
        case "circle":
          return function(t3, i3, n3, s, e2) {
            const r2 = 2 + fi("circle", n3) / 2, h2 = t3 - s, l2 = i3 - e2;
            return Math.sqrt(h2 * h2 + l2 * l2) <= r2;
          }(t2.nt, t2.st, t2.Ks, i2, n2);
        case "square":
          return bi(t2.nt, t2.st, t2.Ks, i2, n2);
      }
    }(t, i, n);
  }
  function ki(t, i, n, s, e2, r2, h2, l2, a2) {
    const o2 = O(n) ? n : n.Se, _2 = O(n) ? n : n.Me, u2 = O(n) ? n : n.xe, c2 = O(i.size) ? Math.max(i.size, 0) : 1, d2 = vi(l2.le()) * c2, f2 = d2 / 2;
    switch (t.Ks = d2, i.position) {
      case "inBar":
        return t.st = h2.Rt(o2, a2), void (void 0 !== t.Kt && (t.Kt.st = t.st + f2 + r2 + 0.6 * e2));
      case "aboveBar":
        return t.st = h2.Rt(_2, a2) - f2 - s.sh, void 0 !== t.Kt && (t.Kt.st = t.st - f2 - 0.6 * e2, s.sh += 1.2 * e2), void (s.sh += d2 + r2);
      case "belowBar":
        return t.st = h2.Rt(u2, a2) + f2 + s.eh, void 0 !== t.Kt && (t.Kt.st = t.st + f2 + r2 + 0.6 * e2, s.eh += 1.2 * e2), void (s.eh += d2 + r2);
    }
    i.position;
  }
  var yi = class {
    constructor(t, i) {
      this.ft = true, this.rh = true, this.hh = true, this.ah = null, this.oh = null, this.Wt = new Mi(), this.jr = t, this.$i = i, this.zt = { it: [], tt: null };
    }
    bt(t) {
      this.ft = true, this.hh = true, "data" === t && (this.rh = true, this.oh = null);
    }
    gt(t) {
      if (!this.jr.yt())
        return null;
      this.ft && this._h();
      const i = this.$i.W().layout;
      return this.Wt._r(i.fontSize, i.fontFamily), this.Wt.J(this.zt), this.Wt;
    }
    uh() {
      if (this.hh) {
        if (this.jr.dh().length > 0) {
          const t = this.$i.St().le(), i = pi(t), n = 1.5 * vi(t) + 2 * i, s = this.fh();
          this.ah = { above: mi(n, s.aboveBar, s.inBar), below: mi(n, s.belowBar, s.inBar) };
        } else
          this.ah = null;
        this.hh = false;
      }
      return this.ah;
    }
    fh() {
      return null === this.oh && (this.oh = this.jr.dh().reduce((t, i) => (t[i.position] || (t[i.position] = true), t), { inBar: false, aboveBar: false, belowBar: false })), this.oh;
    }
    _h() {
      const t = this.jr.Dt(), i = this.$i.St(), n = this.jr.dh();
      this.rh && (this.zt.it = n.map((t2) => ({ ot: t2.time, nt: 0, st: 0, Ks: 0, nh: t2.shape, V: t2.color, th: t2.th, gr: t2.id, Kt: void 0 })), this.rh = false);
      const s = this.$i.W().layout;
      this.zt.tt = null;
      const e2 = i.Xs();
      if (null === e2)
        return;
      const r2 = this.jr.Ct();
      if (null === r2)
        return;
      if (0 === this.zt.it.length)
        return;
      let h2 = NaN;
      const l2 = pi(i.le()), a2 = { sh: l2, eh: l2 };
      this.zt.tt = Lt(this.zt.it, e2, true);
      for (let e3 = this.zt.tt.from; e3 < this.zt.tt.to; e3++) {
        const o2 = n[e3];
        o2.time !== h2 && (a2.sh = l2, a2.eh = l2, h2 = o2.time);
        const _2 = this.zt.it[e3];
        _2.nt = i.It(o2.time), void 0 !== o2.text && o2.text.length > 0 && (_2.Kt = { ih: o2.text, nt: 0, st: 0, Hi: 0, At: 0 });
        const u2 = this.jr.ph(o2.time);
        null !== u2 && ki(_2, o2, u2, a2, s.fontSize, l2, t, i, r2.Vt);
      }
      this.ft = false;
    }
  };
  var Ci = class extends hi {
    constructor(t) {
      super(t);
    }
    yr() {
      const t = this.Sr;
      t.yt = false;
      const i = this.Es.W();
      if (!i.priceLineVisible || !this.Es.yt())
        return;
      const n = this.Es.Zr(0 === i.priceLineSource);
      n.Xr || (t.yt = true, t.st = n.ki, t.V = this.Es.mh(n.V), t.et = i.priceLineWidth, t.Nt = i.priceLineStyle);
    }
  };
  var Ti = class extends nt {
    constructor(t) {
      super(), this.jt = t;
    }
    zi(t, i, n) {
      t.yt = false, i.yt = false;
      const s = this.jt;
      if (!s.yt())
        return;
      const e2 = s.W(), r2 = e2.lastValueVisible, h2 = "" !== s.bh(), l2 = 0 === e2.seriesLastValueMode, a2 = s.Zr(false);
      if (a2.Xr)
        return;
      r2 && (t.Kt = this.wh(a2, r2, l2), t.yt = 0 !== t.Kt.length), (h2 || l2) && (i.Kt = this.gh(a2, r2, h2, l2), i.yt = i.Kt.length > 0);
      const o2 = s.mh(a2.V), _2 = R(o2);
      n.t = _2.t, n.ki = a2.ki, i.Ot = s.$t().Bt(a2.ki / s.Dt().At()), t.Ot = o2, t.V = _2.i, i.V = _2.i;
    }
    gh(t, i, n, s) {
      let e2 = "";
      const r2 = this.jt.bh();
      return n && 0 !== r2.length && (e2 += `${r2} `), i && s && (e2 += this.jt.Dt().Mh() ? t.xh : t.Sh), e2.trim();
    }
    wh(t, i, n) {
      return i ? n ? this.jt.Dt().Mh() ? t.Sh : t.xh : t.Kt : "";
    }
  };
  function Pi(t, i, n, s) {
    const e2 = Number.isFinite(i), r2 = Number.isFinite(n);
    return e2 && r2 ? t(i, n) : e2 || r2 ? e2 ? i : n : s;
  }
  var Ri = class _Ri {
    constructor(t, i) {
      this.kh = t, this.yh = i;
    }
    Ch(t) {
      return null !== t && (this.kh === t.kh && this.yh === t.yh);
    }
    Th() {
      return new _Ri(this.kh, this.yh);
    }
    Ph() {
      return this.kh;
    }
    Rh() {
      return this.yh;
    }
    Dh() {
      return this.yh - this.kh;
    }
    Ni() {
      return this.yh === this.kh || Number.isNaN(this.yh) || Number.isNaN(this.kh);
    }
    ts(t) {
      return null === t ? this : new _Ri(Pi(Math.min, this.Ph(), t.Ph(), -1 / 0), Pi(Math.max, this.Rh(), t.Rh(), 1 / 0));
    }
    Vh(t) {
      if (!O(t))
        return;
      if (0 === this.yh - this.kh)
        return;
      const i = 0.5 * (this.yh + this.kh);
      let n = this.yh - i, s = this.kh - i;
      n *= t, s *= t, this.yh = i + n, this.kh = i + s;
    }
    Oh(t) {
      O(t) && (this.yh += t, this.kh += t);
    }
    Bh() {
      return { minValue: this.kh, maxValue: this.yh };
    }
    static Ah(t) {
      return null === t ? null : new _Ri(t.minValue, t.maxValue);
    }
  };
  var Di = class _Di {
    constructor(t, i) {
      this.Ih = t, this.zh = i || null;
    }
    Lh() {
      return this.Ih;
    }
    Eh() {
      return this.zh;
    }
    Bh() {
      return null === this.Ih ? null : { priceRange: this.Ih.Bh(), margins: this.zh || void 0 };
    }
    static Ah(t) {
      return null === t ? null : new _Di(Ri.Ah(t.priceRange), t.margins);
    }
  };
  var Vi = class extends hi {
    constructor(t, i) {
      super(t), this.Nh = i;
    }
    yr() {
      const t = this.Sr;
      t.yt = false;
      const i = this.Nh.W();
      if (!this.Es.yt() || !i.lineVisible)
        return;
      const n = this.Nh.Fh();
      null !== n && (t.yt = true, t.st = n, t.V = i.color, t.et = i.lineWidth, t.Nt = i.lineStyle, t.gr = this.Nh.W().id);
    }
  };
  var Oi = class extends nt {
    constructor(t, i) {
      super(), this.jr = t, this.Nh = i;
    }
    zi(t, i, n) {
      t.yt = false, i.yt = false;
      const s = this.Nh.W(), e2 = s.axisLabelVisible, r2 = "" !== s.title, h2 = this.jr;
      if (!e2 || !h2.yt())
        return;
      const l2 = this.Nh.Fh();
      if (null === l2)
        return;
      r2 && (i.Kt = s.title, i.yt = true), i.Ot = h2.$t().Bt(l2 / h2.Dt().At()), t.Kt = this.Wh(s.price), t.yt = true;
      const a2 = R(s.axisLabelColor || s.color);
      n.t = a2.t;
      const o2 = s.axisLabelTextColor || a2.i;
      t.V = o2, i.V = o2, n.ki = l2;
    }
    Wh(t) {
      const i = this.jr.Ct();
      return null === i ? "" : this.jr.Dt().Fi(t, i.Vt);
    }
  };
  var Bi = class {
    constructor(t, i) {
      this.jr = t, this.cn = i, this.jh = new Vi(t, this), this.ur = new Oi(t, this), this.Hh = new ei(this.ur, t, t.$t());
    }
    $h(t) {
      V(this.cn, t), this.bt(), this.jr.$t().Uh();
    }
    W() {
      return this.cn;
    }
    qh() {
      return this.jh;
    }
    Yh() {
      return this.Hh;
    }
    Zh() {
      return this.ur;
    }
    bt() {
      this.jh.bt(), this.ur.bt();
    }
    Fh() {
      const t = this.jr, i = t.Dt();
      if (t.$t().St().Ni() || i.Ni())
        return null;
      const n = t.Ct();
      return null === n ? null : i.Rt(this.cn.price, n.Vt);
    }
  };
  var Ai = class extends lt {
    constructor(t) {
      super(), this.$i = t;
    }
    $t() {
      return this.$i;
    }
  };
  var Ii = { Bar: (t, i, n, s) => {
    var e2;
    const r2 = i.upColor, h2 = i.downColor, l2 = b(t(n, s)), a2 = w(l2.Vt[0]) <= w(l2.Vt[3]);
    return { ce: null !== (e2 = l2.V) && void 0 !== e2 ? e2 : a2 ? r2 : h2 };
  }, Candlestick: (t, i, n, s) => {
    var e2, r2, h2;
    const l2 = i.upColor, a2 = i.downColor, o2 = i.borderUpColor, _2 = i.borderDownColor, u2 = i.wickUpColor, c2 = i.wickDownColor, d2 = b(t(n, s)), f2 = w(d2.Vt[0]) <= w(d2.Vt[3]);
    return { ce: null !== (e2 = d2.V) && void 0 !== e2 ? e2 : f2 ? l2 : a2, Ne: null !== (r2 = d2.Ot) && void 0 !== r2 ? r2 : f2 ? o2 : _2, Ee: null !== (h2 = d2.Xh) && void 0 !== h2 ? h2 : f2 ? u2 : c2 };
  }, Custom: (t, i, n, s) => {
    var e2;
    return { ce: null !== (e2 = b(t(n, s)).V) && void 0 !== e2 ? e2 : i.color };
  }, Area: (t, i, n, s) => {
    var e2, r2, h2, l2;
    const a2 = b(t(n, s));
    return { ce: null !== (e2 = a2.lt) && void 0 !== e2 ? e2 : i.lineColor, lt: null !== (r2 = a2.lt) && void 0 !== r2 ? r2 : i.lineColor, Ps: null !== (h2 = a2.Ps) && void 0 !== h2 ? h2 : i.topColor, Rs: null !== (l2 = a2.Rs) && void 0 !== l2 ? l2 : i.bottomColor };
  }, Baseline: (t, i, n, s) => {
    var e2, r2, h2, l2, a2, o2;
    const _2 = b(t(n, s));
    return { ce: _2.Vt[3] >= i.baseValue.price ? i.topLineColor : i.bottomLineColor, Re: null !== (e2 = _2.Re) && void 0 !== e2 ? e2 : i.topLineColor, De: null !== (r2 = _2.De) && void 0 !== r2 ? r2 : i.bottomLineColor, ke: null !== (h2 = _2.ke) && void 0 !== h2 ? h2 : i.topFillColor1, ye: null !== (l2 = _2.ye) && void 0 !== l2 ? l2 : i.topFillColor2, Ce: null !== (a2 = _2.Ce) && void 0 !== a2 ? a2 : i.bottomFillColor1, Te: null !== (o2 = _2.Te) && void 0 !== o2 ? o2 : i.bottomFillColor2 };
  }, Line: (t, i, n, s) => {
    var e2, r2;
    const h2 = b(t(n, s));
    return { ce: null !== (e2 = h2.V) && void 0 !== e2 ? e2 : i.color, lt: null !== (r2 = h2.V) && void 0 !== r2 ? r2 : i.color };
  }, Histogram: (t, i, n, s) => {
    var e2;
    return { ce: null !== (e2 = b(t(n, s)).V) && void 0 !== e2 ? e2 : i.color };
  } };
  var zi = class {
    constructor(t) {
      this.Kh = (t2, i) => void 0 !== i ? i.Vt : this.jr.In().Gh(t2), this.jr = t, this.Jh = Ii[t.Qh()];
    }
    $s(t, i) {
      return this.Jh(this.Kh, this.jr.W(), t, i);
    }
  };
  var Li;
  !function(t) {
    t[t.NearestLeft = -1] = "NearestLeft", t[t.None = 0] = "None", t[t.NearestRight = 1] = "NearestRight";
  }(Li || (Li = {}));
  var Ei = 30;
  var Ni = class {
    constructor() {
      this.tl = [], this.il = /* @__PURE__ */ new Map(), this.nl = /* @__PURE__ */ new Map();
    }
    sl() {
      return this.Ks() > 0 ? this.tl[this.tl.length - 1] : null;
    }
    el() {
      return this.Ks() > 0 ? this.rl(0) : null;
    }
    An() {
      return this.Ks() > 0 ? this.rl(this.tl.length - 1) : null;
    }
    Ks() {
      return this.tl.length;
    }
    Ni() {
      return 0 === this.Ks();
    }
    Kr(t) {
      return null !== this.hl(t, 0);
    }
    Gh(t) {
      return this.ll(t);
    }
    ll(t, i = 0) {
      const n = this.hl(t, i);
      return null === n ? null : Object.assign(Object.assign({}, this.al(n)), { ee: this.rl(n) });
    }
    ne() {
      return this.tl;
    }
    ol(t, i, n) {
      if (this.Ni())
        return null;
      let s = null;
      for (const e2 of n) {
        s = Fi(s, this._l(t, i, e2));
      }
      return s;
    }
    J(t) {
      this.nl.clear(), this.il.clear(), this.tl = t;
    }
    rl(t) {
      return this.tl[t].ee;
    }
    al(t) {
      return this.tl[t];
    }
    hl(t, i) {
      const n = this.ul(t);
      if (null === n && 0 !== i)
        switch (i) {
          case -1:
            return this.cl(t);
          case 1:
            return this.dl(t);
          default:
            throw new TypeError("Unknown search mode");
        }
      return n;
    }
    cl(t) {
      let i = this.fl(t);
      return i > 0 && (i -= 1), i !== this.tl.length && this.rl(i) < t ? i : null;
    }
    dl(t) {
      const i = this.vl(t);
      return i !== this.tl.length && t < this.rl(i) ? i : null;
    }
    ul(t) {
      const i = this.fl(t);
      return i === this.tl.length || t < this.tl[i].ee ? null : i;
    }
    fl(t) {
      return Bt(this.tl, t, (t2, i) => t2.ee < i);
    }
    vl(t) {
      return At(this.tl, t, (t2, i) => t2.ee > i);
    }
    pl(t, i, n) {
      let s = null;
      for (let e2 = t; e2 < i; e2++) {
        const t2 = this.tl[e2].Vt[n];
        Number.isNaN(t2) || (null === s ? s = { ml: t2, bl: t2 } : (t2 < s.ml && (s.ml = t2), t2 > s.bl && (s.bl = t2)));
      }
      return s;
    }
    _l(t, i, n) {
      if (this.Ni())
        return null;
      let s = null;
      const e2 = b(this.el()), r2 = b(this.An()), h2 = Math.max(t, e2), l2 = Math.min(i, r2), a2 = Math.ceil(h2 / Ei) * Ei, o2 = Math.max(a2, Math.floor(l2 / Ei) * Ei);
      {
        const t2 = this.fl(h2), e3 = this.vl(Math.min(l2, a2, i));
        s = Fi(s, this.pl(t2, e3, n));
      }
      let _2 = this.il.get(n);
      void 0 === _2 && (_2 = /* @__PURE__ */ new Map(), this.il.set(n, _2));
      for (let t2 = Math.max(a2 + 1, h2); t2 < o2; t2 += Ei) {
        const i2 = Math.floor(t2 / Ei);
        let e3 = _2.get(i2);
        if (void 0 === e3) {
          const t3 = this.fl(i2 * Ei), s2 = this.vl((i2 + 1) * Ei - 1);
          e3 = this.pl(t3, s2, n), _2.set(i2, e3);
        }
        s = Fi(s, e3);
      }
      {
        const t2 = this.fl(o2), i2 = this.vl(l2);
        s = Fi(s, this.pl(t2, i2, n));
      }
      return s;
    }
  };
  function Fi(t, i) {
    if (null === t)
      return i;
    if (null === i)
      return t;
    return { ml: Math.min(t.ml, i.ml), bl: Math.max(t.bl, i.bl) };
  }
  var Wi = class {
    constructor(t) {
      this.wl = t;
    }
    X(t, i, n) {
      this.wl.draw(t);
    }
    gl(t, i, n) {
      var s, e2;
      null === (e2 = (s = this.wl).drawBackground) || void 0 === e2 || e2.call(s, t);
    }
  };
  var ji = class {
    constructor(t) {
      this.tr = null, this.wn = t;
    }
    gt() {
      var t;
      const i = this.wn.renderer();
      if (null === i)
        return null;
      if ((null === (t = this.tr) || void 0 === t ? void 0 : t.Ml) === i)
        return this.tr.xl;
      const n = new Wi(i);
      return this.tr = { Ml: i, xl: n }, n;
    }
    Sl() {
      var t, i, n;
      return null !== (n = null === (i = (t = this.wn).zOrder) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : "normal";
    }
  };
  function Hi(t) {
    var i, n, s, e2, r2;
    return { Kt: t.text(), ki: t.coordinate(), Si: null === (i = t.fixedCoordinate) || void 0 === i ? void 0 : i.call(t), V: t.textColor(), t: t.backColor(), yt: null === (s = null === (n = t.visible) || void 0 === n ? void 0 : n.call(t)) || void 0 === s || s, hi: null === (r2 = null === (e2 = t.tickVisible) || void 0 === e2 ? void 0 : e2.call(t)) || void 0 === r2 || r2 };
  }
  var $i = class {
    constructor(t, i) {
      this.Wt = new rt(), this.kl = t, this.yl = i;
    }
    gt() {
      return this.Wt.J(Object.assign({ Hi: this.yl.Hi() }, Hi(this.kl))), this.Wt;
    }
  };
  var Ui = class extends nt {
    constructor(t, i) {
      super(), this.kl = t, this.Li = i;
    }
    zi(t, i, n) {
      const s = Hi(this.kl);
      n.t = s.t, t.V = s.V;
      const e2 = 2 / 12 * this.Li.P();
      n.wi = e2, n.gi = e2, n.ki = s.ki, n.Si = s.Si, t.Kt = s.Kt, t.yt = s.yt, t.hi = s.hi;
    }
  };
  var qi = class {
    constructor(t, i) {
      this.Cl = null, this.Tl = null, this.Pl = null, this.Rl = null, this.Dl = null, this.Vl = t, this.jr = i;
    }
    Ol() {
      return this.Vl;
    }
    Vn() {
      var t, i;
      null === (i = (t = this.Vl).updateAllViews) || void 0 === i || i.call(t);
    }
    Pn() {
      var t, i, n, s;
      const e2 = null !== (n = null === (i = (t = this.Vl).paneViews) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : [];
      if ((null === (s = this.Cl) || void 0 === s ? void 0 : s.Ml) === e2)
        return this.Cl.xl;
      const r2 = e2.map((t2) => new ji(t2));
      return this.Cl = { Ml: e2, xl: r2 }, r2;
    }
    Qi() {
      var t, i, n, s;
      const e2 = null !== (n = null === (i = (t = this.Vl).timeAxisViews) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : [];
      if ((null === (s = this.Tl) || void 0 === s ? void 0 : s.Ml) === e2)
        return this.Tl.xl;
      const r2 = this.jr.$t().St(), h2 = e2.map((t2) => new $i(t2, r2));
      return this.Tl = { Ml: e2, xl: h2 }, h2;
    }
    Rn() {
      var t, i, n, s;
      const e2 = null !== (n = null === (i = (t = this.Vl).priceAxisViews) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : [];
      if ((null === (s = this.Pl) || void 0 === s ? void 0 : s.Ml) === e2)
        return this.Pl.xl;
      const r2 = this.jr.Dt(), h2 = e2.map((t2) => new Ui(t2, r2));
      return this.Pl = { Ml: e2, xl: h2 }, h2;
    }
    Bl() {
      var t, i, n, s;
      const e2 = null !== (n = null === (i = (t = this.Vl).priceAxisPaneViews) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : [];
      if ((null === (s = this.Rl) || void 0 === s ? void 0 : s.Ml) === e2)
        return this.Rl.xl;
      const r2 = e2.map((t2) => new ji(t2));
      return this.Rl = { Ml: e2, xl: r2 }, r2;
    }
    Al() {
      var t, i, n, s;
      const e2 = null !== (n = null === (i = (t = this.Vl).timeAxisPaneViews) || void 0 === i ? void 0 : i.call(t)) && void 0 !== n ? n : [];
      if ((null === (s = this.Dl) || void 0 === s ? void 0 : s.Ml) === e2)
        return this.Dl.xl;
      const r2 = e2.map((t2) => new ji(t2));
      return this.Dl = { Ml: e2, xl: r2 }, r2;
    }
    Il(t, i) {
      var n, s, e2;
      return null !== (e2 = null === (s = (n = this.Vl).autoscaleInfo) || void 0 === s ? void 0 : s.call(n, t, i)) && void 0 !== e2 ? e2 : null;
    }
    wr(t, i) {
      var n, s, e2;
      return null !== (e2 = null === (s = (n = this.Vl).hitTest) || void 0 === s ? void 0 : s.call(n, t, i)) && void 0 !== e2 ? e2 : null;
    }
  };
  function Yi(t, i, n, s) {
    t.forEach((t2) => {
      i(t2).forEach((t3) => {
        t3.Sl() === n && s.push(t3);
      });
    });
  }
  function Zi(t) {
    return t.Pn();
  }
  function Xi(t) {
    return t.Bl();
  }
  function Ki(t) {
    return t.Al();
  }
  var Gi = class extends Ai {
    constructor(t, i, n, s, e2) {
      super(t), this.zt = new Ni(), this.jh = new Ci(this), this.zl = [], this.Ll = new li(this), this.El = null, this.Nl = null, this.Fl = [], this.Wl = [], this.jl = null, this.Hl = [], this.cn = i, this.$l = n;
      const r2 = new Ti(this);
      this.rn = [r2], this.Hh = new ei(r2, this, t), "Area" !== n && "Line" !== n && "Baseline" !== n || (this.El = new ci(this)), this.Ul(), this.ql(e2);
    }
    S() {
      null !== this.jl && clearTimeout(this.jl);
    }
    mh(t) {
      return this.cn.priceLineColor || t;
    }
    Zr(t) {
      const i = { Xr: true }, n = this.Dt();
      if (this.$t().St().Ni() || n.Ni() || this.zt.Ni())
        return i;
      const s = this.$t().St().Xs(), e2 = this.Ct();
      if (null === s || null === e2)
        return i;
      let r2, h2;
      if (t) {
        const t2 = this.zt.sl();
        if (null === t2)
          return i;
        r2 = t2, h2 = t2.ee;
      } else {
        const t2 = this.zt.ll(s.ui(), -1);
        if (null === t2)
          return i;
        if (r2 = this.zt.Gh(t2.ee), null === r2)
          return i;
        h2 = t2.ee;
      }
      const l2 = r2.Vt[3], a2 = this.Us().$s(h2, { Vt: r2 }), o2 = n.Rt(l2, e2.Vt);
      return { Xr: false, _t: l2, Kt: n.Fi(l2, e2.Vt), xh: n.Yl(l2), Sh: n.Zl(l2, e2.Vt), V: a2.ce, ki: o2, ee: h2 };
    }
    Us() {
      return null !== this.Nl || (this.Nl = new zi(this)), this.Nl;
    }
    W() {
      return this.cn;
    }
    $h(t) {
      const i = t.priceScaleId;
      void 0 !== i && i !== this.cn.priceScaleId && this.$t().Xl(this, i), V(this.cn, t), void 0 !== t.priceFormat && (this.Ul(), this.$t().Kl()), this.$t().Gl(this), this.$t().Jl(), this.wn.bt("options");
    }
    J(t, i) {
      this.zt.J(t), this.Ql(), this.wn.bt("data"), this.dn.bt("data"), null !== this.El && (i && i.ta ? this.El.$r() : 0 === t.length && this.El.Hr());
      const n = this.$t().dr(this);
      this.$t().ia(n), this.$t().Gl(this), this.$t().Jl(), this.$t().Uh();
    }
    na(t) {
      this.Fl = t, this.Ql();
      const i = this.$t().dr(this);
      this.dn.bt("data"), this.$t().ia(i), this.$t().Gl(this), this.$t().Jl(), this.$t().Uh();
    }
    sa() {
      return this.Fl;
    }
    dh() {
      return this.Wl;
    }
    ea(t) {
      const i = new Bi(this, t);
      return this.zl.push(i), this.$t().Gl(this), i;
    }
    ra(t) {
      const i = this.zl.indexOf(t);
      -1 !== i && this.zl.splice(i, 1), this.$t().Gl(this);
    }
    Qh() {
      return this.$l;
    }
    Ct() {
      const t = this.ha();
      return null === t ? null : { Vt: t.Vt[3], la: t.ot };
    }
    ha() {
      const t = this.$t().St().Xs();
      if (null === t)
        return null;
      const i = t.Os();
      return this.zt.ll(i, 1);
    }
    In() {
      return this.zt;
    }
    ph(t) {
      const i = this.zt.Gh(t);
      return null === i ? null : "Bar" === this.$l || "Candlestick" === this.$l || "Custom" === this.$l ? { ge: i.Vt[0], Me: i.Vt[1], xe: i.Vt[2], Se: i.Vt[3] } : i.Vt[3];
    }
    aa(t) {
      const i = [];
      Yi(this.Hl, Zi, "top", i);
      const n = this.El;
      return null !== n && n.yt() ? (null === this.jl && n.qr() && (this.jl = setTimeout(() => {
        this.jl = null, this.$t().oa();
      }, 0)), n.Ur(), i.unshift(n), i) : i;
    }
    Pn() {
      const t = [];
      this._a() || t.push(this.Ll), t.push(this.wn, this.jh, this.dn);
      const i = this.zl.map((t2) => t2.qh());
      return t.push(...i), Yi(this.Hl, Zi, "normal", t), t;
    }
    ua() {
      return this.ca(Zi, "bottom");
    }
    da(t) {
      return this.ca(Xi, t);
    }
    fa(t) {
      return this.ca(Ki, t);
    }
    va(t, i) {
      return this.Hl.map((n) => n.wr(t, i)).filter((t2) => null !== t2);
    }
    Ji(t) {
      return [this.Hh, ...this.zl.map((t2) => t2.Yh())];
    }
    Rn(t, i) {
      if (i !== this.Yi && !this._a())
        return [];
      const n = [...this.rn];
      for (const t2 of this.zl)
        n.push(t2.Zh());
      return this.Hl.forEach((t2) => {
        n.push(...t2.Rn());
      }), n;
    }
    Qi() {
      const t = [];
      return this.Hl.forEach((i) => {
        t.push(...i.Qi());
      }), t;
    }
    Il(t, i) {
      if (void 0 !== this.cn.autoscaleInfoProvider) {
        const n = this.cn.autoscaleInfoProvider(() => {
          const n2 = this.pa(t, i);
          return null === n2 ? null : n2.Bh();
        });
        return Di.Ah(n);
      }
      return this.pa(t, i);
    }
    ma() {
      return this.cn.priceFormat.minMove;
    }
    ba() {
      return this.wa;
    }
    Vn() {
      var t;
      this.wn.bt(), this.dn.bt();
      for (const t2 of this.rn)
        t2.bt();
      for (const t2 of this.zl)
        t2.bt();
      this.jh.bt(), this.Ll.bt(), null === (t = this.El) || void 0 === t || t.bt(), this.Hl.forEach((t2) => t2.Vn());
    }
    Dt() {
      return b(super.Dt());
    }
    kt(t) {
      if (!(("Line" === this.$l || "Area" === this.$l || "Baseline" === this.$l) && this.cn.crosshairMarkerVisible))
        return null;
      const i = this.zt.Gh(t);
      if (null === i)
        return null;
      return { _t: i.Vt[3], ht: this.ga(), Ot: this.Ma(), Pt: this.xa(), Tt: this.Sa(t) };
    }
    bh() {
      return this.cn.title;
    }
    yt() {
      return this.cn.visible;
    }
    ka(t) {
      this.Hl.push(new qi(t, this));
    }
    ya(t) {
      this.Hl = this.Hl.filter((i) => i.Ol() !== t);
    }
    Ca() {
      if (this.wn instanceof Kt != false)
        return (t) => this.wn.We(t);
    }
    Ta() {
      if (this.wn instanceof Kt != false)
        return (t) => this.wn.je(t);
    }
    _a() {
      return !_t(this.Dt().Pa());
    }
    pa(t, i) {
      if (!B(t) || !B(i) || this.zt.Ni())
        return null;
      const n = "Line" === this.$l || "Area" === this.$l || "Baseline" === this.$l || "Histogram" === this.$l ? [3] : [2, 1], s = this.zt.ol(t, i, n);
      let e2 = null !== s ? new Ri(s.ml, s.bl) : null;
      if ("Histogram" === this.Qh()) {
        const t2 = this.cn.base, i2 = new Ri(t2, t2);
        e2 = null !== e2 ? e2.ts(i2) : i2;
      }
      let r2 = this.dn.uh();
      return this.Hl.forEach((n2) => {
        const s2 = n2.Il(t, i);
        if (null == s2 ? void 0 : s2.priceRange) {
          const t2 = new Ri(s2.priceRange.minValue, s2.priceRange.maxValue);
          e2 = null !== e2 ? e2.ts(t2) : t2;
        }
        var h2, l2, a2, o2;
        (null == s2 ? void 0 : s2.margins) && (h2 = r2, l2 = s2.margins, r2 = { above: Math.max(null !== (a2 = null == h2 ? void 0 : h2.above) && void 0 !== a2 ? a2 : 0, l2.above), below: Math.max(null !== (o2 = null == h2 ? void 0 : h2.below) && void 0 !== o2 ? o2 : 0, l2.below) });
      }), new Di(e2, r2);
    }
    ga() {
      switch (this.$l) {
        case "Line":
        case "Area":
        case "Baseline":
          return this.cn.crosshairMarkerRadius;
      }
      return 0;
    }
    Ma() {
      switch (this.$l) {
        case "Line":
        case "Area":
        case "Baseline": {
          const t = this.cn.crosshairMarkerBorderColor;
          if (0 !== t.length)
            return t;
        }
      }
      return null;
    }
    xa() {
      switch (this.$l) {
        case "Line":
        case "Area":
        case "Baseline":
          return this.cn.crosshairMarkerBorderWidth;
      }
      return 0;
    }
    Sa(t) {
      switch (this.$l) {
        case "Line":
        case "Area":
        case "Baseline": {
          const t2 = this.cn.crosshairMarkerBackgroundColor;
          if (0 !== t2.length)
            return t2;
        }
      }
      return this.Us().$s(t).ce;
    }
    Ul() {
      switch (this.cn.priceFormat.type) {
        case "custom":
          this.wa = { format: this.cn.priceFormat.formatter };
          break;
        case "volume":
          this.wa = new pt(this.cn.priceFormat.precision);
          break;
        case "percent":
          this.wa = new vt(this.cn.priceFormat.precision);
          break;
        default: {
          const t = Math.pow(10, this.cn.priceFormat.precision);
          this.wa = new ft(t, this.cn.priceFormat.minMove * t);
        }
      }
      null !== this.Yi && this.Yi.Ra();
    }
    Ql() {
      const t = this.$t().St();
      if (!t.Da() || this.zt.Ni())
        return void (this.Wl = []);
      const i = b(this.zt.el());
      this.Wl = this.Fl.map((n, s) => {
        const e2 = b(t.Va(n.time, true)), r2 = e2 < i ? 1 : -1;
        return { time: b(this.zt.ll(e2, r2)).ee, position: n.position, shape: n.shape, color: n.color, id: n.id, th: s, text: n.text, size: n.size, originalTime: n.originalTime };
      });
    }
    ql(t) {
      switch (this.dn = new yi(this, this.$t()), this.$l) {
        case "Bar":
          this.wn = new Ht(this, this.$t());
          break;
        case "Candlestick":
          this.wn = new Zt(this, this.$t());
          break;
        case "Line":
          this.wn = new ti(this, this.$t());
          break;
        case "Custom":
          this.wn = new Kt(this, this.$t(), m(t));
          break;
        case "Area":
          this.wn = new Ft(this, this.$t());
          break;
        case "Baseline":
          this.wn = new qt(this, this.$t());
          break;
        case "Histogram":
          this.wn = new Qt(this, this.$t());
          break;
        default:
          throw Error("Unknown chart style assigned: " + this.$l);
      }
    }
    ca(t, i) {
      const n = [];
      return Yi(this.Hl, t, i, n), n;
    }
  };
  var Ji = class {
    constructor(t) {
      this.cn = t;
    }
    Oa(t, i, n) {
      let s = t;
      if (0 === this.cn.mode)
        return s;
      const e2 = n.vn(), r2 = e2.Ct();
      if (null === r2)
        return s;
      const h2 = e2.Rt(t, r2), l2 = n.Ba().filter((t2) => t2 instanceof Gi).reduce((t2, s2) => {
        if (n.vr(s2) || !s2.yt())
          return t2;
        const e3 = s2.Dt(), r3 = s2.In();
        if (e3.Ni() || !r3.Kr(i))
          return t2;
        const h3 = r3.Gh(i);
        if (null === h3)
          return t2;
        const l3 = w(s2.Ct());
        return t2.concat([e3.Rt(h3.Vt[3], l3.Vt)]);
      }, []);
      if (0 === l2.length)
        return s;
      l2.sort((t2, i2) => Math.abs(t2 - h2) - Math.abs(i2 - h2));
      const a2 = l2[0];
      return s = e2.pn(a2, r2), s;
    }
  };
  var Qi = class extends H {
    constructor() {
      super(...arguments), this.zt = null;
    }
    J(t) {
      this.zt = t;
    }
    K({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
      if (null === this.zt)
        return;
      const e2 = Math.max(1, Math.floor(n));
      t.lineWidth = e2, function(t2, i2) {
        t2.save(), t2.lineWidth % 2 && t2.translate(0.5, 0.5), i2(), t2.restore();
      }(t, () => {
        const r2 = b(this.zt);
        if (r2.Aa) {
          t.strokeStyle = r2.Ia, f(t, r2.za), t.beginPath();
          for (const s2 of r2.La) {
            const r3 = Math.round(s2.Ea * n);
            t.moveTo(r3, -e2), t.lineTo(r3, i.height + e2);
          }
          t.stroke();
        }
        if (r2.Na) {
          t.strokeStyle = r2.Fa, f(t, r2.Wa), t.beginPath();
          for (const n2 of r2.ja) {
            const r3 = Math.round(n2.Ea * s);
            t.moveTo(-e2, r3), t.lineTo(i.width + e2, r3);
          }
          t.stroke();
        }
      });
    }
  };
  var tn = class {
    constructor(t) {
      this.Wt = new Qi(), this.ft = true, this.tn = t;
    }
    bt() {
      this.ft = true;
    }
    gt() {
      if (this.ft) {
        const t = this.tn.$t().W().grid, i = { Na: t.horzLines.visible, Aa: t.vertLines.visible, Fa: t.horzLines.color, Ia: t.vertLines.color, Wa: t.horzLines.style, za: t.vertLines.style, ja: this.tn.vn().Ha(), La: (this.tn.$t().St().Ha() || []).map((t2) => ({ Ea: t2.coord })) };
        this.Wt.J(i), this.ft = false;
      }
      return this.Wt;
    }
  };
  var nn = class {
    constructor(t) {
      this.wn = new tn(t);
    }
    qh() {
      return this.wn;
    }
  };
  var sn = { $a: 4, Ua: 1e-4 };
  function en(t, i) {
    const n = 100 * (t - i) / i;
    return i < 0 ? -n : n;
  }
  function rn(t, i) {
    const n = en(t.Ph(), i), s = en(t.Rh(), i);
    return new Ri(n, s);
  }
  function hn(t, i) {
    const n = 100 * (t - i) / i + 100;
    return i < 0 ? -n : n;
  }
  function ln(t, i) {
    const n = hn(t.Ph(), i), s = hn(t.Rh(), i);
    return new Ri(n, s);
  }
  function an(t, i) {
    const n = Math.abs(t);
    if (n < 1e-15)
      return 0;
    const s = Math.log10(n + i.Ua) + i.$a;
    return t < 0 ? -s : s;
  }
  function on(t, i) {
    const n = Math.abs(t);
    if (n < 1e-15)
      return 0;
    const s = Math.pow(10, n - i.$a) - i.Ua;
    return t < 0 ? -s : s;
  }
  function _n(t, i) {
    if (null === t)
      return null;
    const n = an(t.Ph(), i), s = an(t.Rh(), i);
    return new Ri(n, s);
  }
  function un(t, i) {
    if (null === t)
      return null;
    const n = on(t.Ph(), i), s = on(t.Rh(), i);
    return new Ri(n, s);
  }
  function cn(t) {
    if (null === t)
      return sn;
    const i = Math.abs(t.Rh() - t.Ph());
    if (i >= 1 || i < 1e-15)
      return sn;
    const n = Math.ceil(Math.abs(Math.log10(i))), s = sn.$a + n;
    return { $a: s, Ua: 1 / Math.pow(10, s) };
  }
  var dn = class {
    constructor(t, i) {
      if (this.qa = t, this.Ya = i, function(t2) {
        if (t2 < 0)
          return false;
        for (let i2 = t2; i2 > 1; i2 /= 10)
          if (i2 % 10 != 0)
            return false;
        return true;
      }(this.qa))
        this.Za = [2, 2.5, 2];
      else {
        this.Za = [];
        for (let t2 = this.qa; 1 !== t2; ) {
          if (t2 % 2 == 0)
            this.Za.push(2), t2 /= 2;
          else {
            if (t2 % 5 != 0)
              throw new Error("unexpected base");
            this.Za.push(2, 2.5), t2 /= 5;
          }
          if (this.Za.length > 100)
            throw new Error("something wrong with base");
        }
      }
    }
    Xa(t, i, n) {
      const s = 0 === this.qa ? 0 : 1 / this.qa;
      let e2 = Math.pow(10, Math.max(0, Math.ceil(Math.log10(t - i)))), r2 = 0, h2 = this.Ya[0];
      for (; ; ) {
        const t2 = yt(e2, s, 1e-14) && e2 > s + 1e-14, i2 = yt(e2, n * h2, 1e-14), l3 = yt(e2, 1, 1e-14);
        if (!(t2 && i2 && l3))
          break;
        e2 /= h2, h2 = this.Ya[++r2 % this.Ya.length];
      }
      if (e2 <= s + 1e-14 && (e2 = s), e2 = Math.max(1, e2), this.Za.length > 0 && (l2 = e2, a2 = 1, o2 = 1e-14, Math.abs(l2 - a2) < o2))
        for (r2 = 0, h2 = this.Za[0]; yt(e2, n * h2, 1e-14) && e2 > s + 1e-14; )
          e2 /= h2, h2 = this.Za[++r2 % this.Za.length];
      var l2, a2, o2;
      return e2;
    }
  };
  var fn = class {
    constructor(t, i, n, s) {
      this.Ka = [], this.Li = t, this.qa = i, this.Ga = n, this.Ja = s;
    }
    Xa(t, i) {
      if (t < i)
        throw new Error("high < low");
      const n = this.Li.At(), s = (t - i) * this.Qa() / n, e2 = new dn(this.qa, [2, 2.5, 2]), r2 = new dn(this.qa, [2, 2, 2.5]), h2 = new dn(this.qa, [2.5, 2, 2]), l2 = [];
      return l2.push(e2.Xa(t, i, s), r2.Xa(t, i, s), h2.Xa(t, i, s)), function(t2) {
        if (t2.length < 1)
          throw Error("array is empty");
        let i2 = t2[0];
        for (let n2 = 1; n2 < t2.length; ++n2)
          t2[n2] < i2 && (i2 = t2[n2]);
        return i2;
      }(l2);
    }
    io() {
      const t = this.Li, i = t.Ct();
      if (null === i)
        return void (this.Ka = []);
      const n = t.At(), s = this.Ga(n - 1, i), e2 = this.Ga(0, i), r2 = this.Li.W().entireTextOnly ? this.no() / 2 : 0, h2 = r2, l2 = n - 1 - r2, a2 = Math.max(s, e2), o2 = Math.min(s, e2);
      if (a2 === o2)
        return void (this.Ka = []);
      let _2 = this.Xa(a2, o2), u2 = a2 % _2;
      u2 += u2 < 0 ? _2 : 0;
      const c2 = a2 >= o2 ? 1 : -1;
      let d2 = null, f2 = 0;
      for (let n2 = a2 - u2; n2 > o2; n2 -= _2) {
        const s2 = this.Ja(n2, i, true);
        null !== d2 && Math.abs(s2 - d2) < this.Qa() || (s2 < h2 || s2 > l2 || (f2 < this.Ka.length ? (this.Ka[f2].Ea = s2, this.Ka[f2].so = t.eo(n2)) : this.Ka.push({ Ea: s2, so: t.eo(n2) }), f2++, d2 = s2, t.ro() && (_2 = this.Xa(n2 * c2, o2))));
      }
      this.Ka.length = f2;
    }
    Ha() {
      return this.Ka;
    }
    no() {
      return this.Li.P();
    }
    Qa() {
      return Math.ceil(2.5 * this.no());
    }
  };
  function vn(t) {
    return t.slice().sort((t2, i) => b(t2.Xi()) - b(i.Xi()));
  }
  var pn;
  !function(t) {
    t[t.Normal = 0] = "Normal", t[t.Logarithmic = 1] = "Logarithmic", t[t.Percentage = 2] = "Percentage", t[t.IndexedTo100 = 3] = "IndexedTo100";
  }(pn || (pn = {}));
  var mn = new vt();
  var bn = new ft(100, 1);
  var wn = class {
    constructor(t, i, n, s) {
      this.ho = 0, this.lo = null, this.Ih = null, this.ao = null, this.oo = { _o: false, uo: null }, this.co = 0, this.do = 0, this.fo = new D(), this.vo = new D(), this.po = [], this.mo = null, this.bo = null, this.wo = null, this.Mo = null, this.wa = bn, this.xo = cn(null), this.So = t, this.cn = i, this.ko = n, this.yo = s, this.Co = new fn(this, 100, this.To.bind(this), this.Po.bind(this));
    }
    Pa() {
      return this.So;
    }
    W() {
      return this.cn;
    }
    $h(t) {
      if (V(this.cn, t), this.Ra(), void 0 !== t.mode && this.Ro({ Cr: t.mode }), void 0 !== t.scaleMargins) {
        const i = m(t.scaleMargins.top), n = m(t.scaleMargins.bottom);
        if (i < 0 || i > 1)
          throw new Error(`Invalid top margin - expect value between 0 and 1, given=${i}`);
        if (n < 0 || n > 1)
          throw new Error(`Invalid bottom margin - expect value between 0 and 1, given=${n}`);
        if (i + n > 1)
          throw new Error(`Invalid margins - sum of margins must be less than 1, given=${i + n}`);
        this.Do(), this.bo = null;
      }
    }
    Vo() {
      return this.cn.autoScale;
    }
    ro() {
      return 1 === this.cn.mode;
    }
    Mh() {
      return 2 === this.cn.mode;
    }
    Oo() {
      return 3 === this.cn.mode;
    }
    Cr() {
      return { Wn: this.cn.autoScale, Bo: this.cn.invertScale, Cr: this.cn.mode };
    }
    Ro(t) {
      const i = this.Cr();
      let n = null;
      void 0 !== t.Wn && (this.cn.autoScale = t.Wn), void 0 !== t.Cr && (this.cn.mode = t.Cr, 2 !== t.Cr && 3 !== t.Cr || (this.cn.autoScale = true), this.oo._o = false), 1 === i.Cr && t.Cr !== i.Cr && (!function(t2, i2) {
        if (null === t2)
          return false;
        const n2 = on(t2.Ph(), i2), s2 = on(t2.Rh(), i2);
        return isFinite(n2) && isFinite(s2);
      }(this.Ih, this.xo) ? this.cn.autoScale = true : (n = un(this.Ih, this.xo), null !== n && this.Ao(n))), 1 === t.Cr && t.Cr !== i.Cr && (n = _n(this.Ih, this.xo), null !== n && this.Ao(n));
      const s = i.Cr !== this.cn.mode;
      s && (2 === i.Cr || this.Mh()) && this.Ra(), s && (3 === i.Cr || this.Oo()) && this.Ra(), void 0 !== t.Bo && i.Bo !== t.Bo && (this.cn.invertScale = t.Bo, this.Io()), this.vo.m(i, this.Cr());
    }
    zo() {
      return this.vo;
    }
    P() {
      return this.ko.fontSize;
    }
    At() {
      return this.ho;
    }
    Lo(t) {
      this.ho !== t && (this.ho = t, this.Do(), this.bo = null);
    }
    Eo() {
      if (this.lo)
        return this.lo;
      const t = this.At() - this.No() - this.Fo();
      return this.lo = t, t;
    }
    Lh() {
      return this.Wo(), this.Ih;
    }
    Ao(t, i) {
      const n = this.Ih;
      (i || null === n && null !== t || null !== n && !n.Ch(t)) && (this.bo = null, this.Ih = t);
    }
    Ni() {
      return this.Wo(), 0 === this.ho || !this.Ih || this.Ih.Ni();
    }
    jo(t) {
      return this.Bo() ? t : this.At() - 1 - t;
    }
    Rt(t, i) {
      return this.Mh() ? t = en(t, i) : this.Oo() && (t = hn(t, i)), this.Po(t, i);
    }
    te(t, i, n) {
      this.Wo();
      const s = this.Fo(), e2 = b(this.Lh()), r2 = e2.Ph(), h2 = e2.Rh(), l2 = this.Eo() - 1, a2 = this.Bo(), o2 = l2 / (h2 - r2), _2 = void 0 === n ? 0 : n.from, u2 = void 0 === n ? t.length : n.to, c2 = this.Ho();
      for (let n2 = _2; n2 < u2; n2++) {
        const e3 = t[n2], h3 = e3._t;
        if (isNaN(h3))
          continue;
        let l3 = h3;
        null !== c2 && (l3 = c2(e3._t, i));
        const _3 = s + o2 * (l3 - r2), u3 = a2 ? _3 : this.ho - 1 - _3;
        e3.st = u3;
      }
    }
    be(t, i, n) {
      this.Wo();
      const s = this.Fo(), e2 = b(this.Lh()), r2 = e2.Ph(), h2 = e2.Rh(), l2 = this.Eo() - 1, a2 = this.Bo(), o2 = l2 / (h2 - r2), _2 = void 0 === n ? 0 : n.from, u2 = void 0 === n ? t.length : n.to, c2 = this.Ho();
      for (let n2 = _2; n2 < u2; n2++) {
        const e3 = t[n2];
        let h3 = e3.ge, l3 = e3.Me, _3 = e3.xe, u3 = e3.Se;
        null !== c2 && (h3 = c2(e3.ge, i), l3 = c2(e3.Me, i), _3 = c2(e3.xe, i), u3 = c2(e3.Se, i));
        let d2 = s + o2 * (h3 - r2), f2 = a2 ? d2 : this.ho - 1 - d2;
        e3.pe = f2, d2 = s + o2 * (l3 - r2), f2 = a2 ? d2 : this.ho - 1 - d2, e3.de = f2, d2 = s + o2 * (_3 - r2), f2 = a2 ? d2 : this.ho - 1 - d2, e3.fe = f2, d2 = s + o2 * (u3 - r2), f2 = a2 ? d2 : this.ho - 1 - d2, e3.me = f2;
      }
    }
    pn(t, i) {
      const n = this.To(t, i);
      return this.$o(n, i);
    }
    $o(t, i) {
      let n = t;
      return this.Mh() ? n = function(t2, i2) {
        return i2 < 0 && (t2 = -t2), t2 / 100 * i2 + i2;
      }(n, i) : this.Oo() && (n = function(t2, i2) {
        return t2 -= 100, i2 < 0 && (t2 = -t2), t2 / 100 * i2 + i2;
      }(n, i)), n;
    }
    Ba() {
      return this.po;
    }
    Uo() {
      if (this.mo)
        return this.mo;
      let t = [];
      for (let i = 0; i < this.po.length; i++) {
        const n = this.po[i];
        null === n.Xi() && n.Ki(i + 1), t.push(n);
      }
      return t = vn(t), this.mo = t, this.mo;
    }
    qo(t) {
      -1 === this.po.indexOf(t) && (this.po.push(t), this.Ra(), this.Yo());
    }
    Zo(t) {
      const i = this.po.indexOf(t);
      if (-1 === i)
        throw new Error("source is not attached to scale");
      this.po.splice(i, 1), 0 === this.po.length && (this.Ro({ Wn: true }), this.Ao(null)), this.Ra(), this.Yo();
    }
    Ct() {
      let t = null;
      for (const i of this.po) {
        const n = i.Ct();
        null !== n && ((null === t || n.la < t.la) && (t = n));
      }
      return null === t ? null : t.Vt;
    }
    Bo() {
      return this.cn.invertScale;
    }
    Ha() {
      const t = null === this.Ct();
      if (null !== this.bo && (t || this.bo.Xo === t))
        return this.bo.Ha;
      this.Co.io();
      const i = this.Co.Ha();
      return this.bo = { Ha: i, Xo: t }, this.fo.m(), i;
    }
    Ko() {
      return this.fo;
    }
    Go(t) {
      this.Mh() || this.Oo() || null === this.wo && null === this.ao && (this.Ni() || (this.wo = this.ho - t, this.ao = b(this.Lh()).Th()));
    }
    Jo(t) {
      if (this.Mh() || this.Oo())
        return;
      if (null === this.wo)
        return;
      this.Ro({ Wn: false }), (t = this.ho - t) < 0 && (t = 0);
      let i = (this.wo + 0.2 * (this.ho - 1)) / (t + 0.2 * (this.ho - 1));
      const n = b(this.ao).Th();
      i = Math.max(i, 0.1), n.Vh(i), this.Ao(n);
    }
    Qo() {
      this.Mh() || this.Oo() || (this.wo = null, this.ao = null);
    }
    t_(t) {
      this.Vo() || null === this.Mo && null === this.ao && (this.Ni() || (this.Mo = t, this.ao = b(this.Lh()).Th()));
    }
    i_(t) {
      if (this.Vo())
        return;
      if (null === this.Mo)
        return;
      const i = b(this.Lh()).Dh() / (this.Eo() - 1);
      let n = t - this.Mo;
      this.Bo() && (n *= -1);
      const s = n * i, e2 = b(this.ao).Th();
      e2.Oh(s), this.Ao(e2, true), this.bo = null;
    }
    n_() {
      this.Vo() || null !== this.Mo && (this.Mo = null, this.ao = null);
    }
    ba() {
      return this.wa || this.Ra(), this.wa;
    }
    Fi(t, i) {
      switch (this.cn.mode) {
        case 2:
          return this.s_(en(t, i));
        case 3:
          return this.ba().format(hn(t, i));
        default:
          return this.Wh(t);
      }
    }
    eo(t) {
      switch (this.cn.mode) {
        case 2:
          return this.s_(t);
        case 3:
          return this.ba().format(t);
        default:
          return this.Wh(t);
      }
    }
    Yl(t) {
      return this.Wh(t, b(this.e_()).ba());
    }
    Zl(t, i) {
      return t = en(t, i), this.s_(t, mn);
    }
    r_() {
      return this.po;
    }
    h_(t) {
      this.oo = { uo: t, _o: false };
    }
    Vn() {
      this.po.forEach((t) => t.Vn());
    }
    Ra() {
      this.bo = null;
      const t = this.e_();
      let i = 100;
      null !== t && (i = Math.round(1 / t.ma())), this.wa = bn, this.Mh() ? (this.wa = mn, i = 100) : this.Oo() ? (this.wa = new ft(100, 1), i = 100) : null !== t && (this.wa = t.ba()), this.Co = new fn(this, i, this.To.bind(this), this.Po.bind(this)), this.Co.io();
    }
    Yo() {
      this.mo = null;
    }
    e_() {
      return this.po[0] || null;
    }
    No() {
      return this.Bo() ? this.cn.scaleMargins.bottom * this.At() + this.do : this.cn.scaleMargins.top * this.At() + this.co;
    }
    Fo() {
      return this.Bo() ? this.cn.scaleMargins.top * this.At() + this.co : this.cn.scaleMargins.bottom * this.At() + this.do;
    }
    Wo() {
      this.oo._o || (this.oo._o = true, this.l_());
    }
    Do() {
      this.lo = null;
    }
    Po(t, i) {
      if (this.Wo(), this.Ni())
        return 0;
      t = this.ro() && t ? an(t, this.xo) : t;
      const n = b(this.Lh()), s = this.Fo() + (this.Eo() - 1) * (t - n.Ph()) / n.Dh();
      return this.jo(s);
    }
    To(t, i) {
      if (this.Wo(), this.Ni())
        return 0;
      const n = this.jo(t), s = b(this.Lh()), e2 = s.Ph() + s.Dh() * ((n - this.Fo()) / (this.Eo() - 1));
      return this.ro() ? on(e2, this.xo) : e2;
    }
    Io() {
      this.bo = null, this.Co.io();
    }
    l_() {
      const t = this.oo.uo;
      if (null === t)
        return;
      let i = null;
      const n = this.r_();
      let s = 0, e2 = 0;
      for (const r3 of n) {
        if (!r3.yt())
          continue;
        const n2 = r3.Ct();
        if (null === n2)
          continue;
        const h3 = r3.Il(t.Os(), t.ui());
        let l2 = h3 && h3.Lh();
        if (null !== l2) {
          switch (this.cn.mode) {
            case 1:
              l2 = _n(l2, this.xo);
              break;
            case 2:
              l2 = rn(l2, n2.Vt);
              break;
            case 3:
              l2 = ln(l2, n2.Vt);
          }
          if (i = null === i ? l2 : i.ts(b(l2)), null !== h3) {
            const t2 = h3.Eh();
            null !== t2 && (s = Math.max(s, t2.above), e2 = Math.max(e2, t2.below));
          }
        }
      }
      if (s === this.co && e2 === this.do || (this.co = s, this.do = e2, this.bo = null, this.Do()), null !== i) {
        if (i.Ph() === i.Rh()) {
          const t2 = this.e_(), n2 = 5 * (null === t2 || this.Mh() || this.Oo() ? 1 : t2.ma());
          this.ro() && (i = un(i, this.xo)), i = new Ri(i.Ph() - n2, i.Rh() + n2), this.ro() && (i = _n(i, this.xo));
        }
        if (this.ro()) {
          const t2 = un(i, this.xo), n2 = cn(t2);
          if (r2 = n2, h2 = this.xo, r2.$a !== h2.$a || r2.Ua !== h2.Ua) {
            const s2 = null !== this.ao ? un(this.ao, this.xo) : null;
            this.xo = n2, i = _n(t2, n2), null !== s2 && (this.ao = _n(s2, n2));
          }
        }
        this.Ao(i);
      } else
        null === this.Ih && (this.Ao(new Ri(-0.5, 0.5)), this.xo = cn(null));
      var r2, h2;
      this.oo._o = true;
    }
    Ho() {
      return this.Mh() ? en : this.Oo() ? hn : this.ro() ? (t) => an(t, this.xo) : null;
    }
    a_(t, i, n) {
      return void 0 === i ? (void 0 === n && (n = this.ba()), n.format(t)) : i(t);
    }
    Wh(t, i) {
      return this.a_(t, this.yo.priceFormatter, i);
    }
    s_(t, i) {
      return this.a_(t, this.yo.percentageFormatter, i);
    }
  };
  var gn = class {
    constructor(t, i) {
      this.po = [], this.o_ = /* @__PURE__ */ new Map(), this.ho = 0, this.__ = 0, this.u_ = 1e3, this.mo = null, this.c_ = new D(), this.yl = t, this.$i = i, this.d_ = new nn(this);
      const n = i.W();
      this.f_ = this.v_("left", n.leftPriceScale), this.p_ = this.v_("right", n.rightPriceScale), this.f_.zo().l(this.m_.bind(this, this.f_), this), this.p_.zo().l(this.m_.bind(this, this.p_), this), this.b_(n);
    }
    b_(t) {
      if (t.leftPriceScale && this.f_.$h(t.leftPriceScale), t.rightPriceScale && this.p_.$h(t.rightPriceScale), t.localization && (this.f_.Ra(), this.p_.Ra()), t.overlayPriceScales) {
        const i = Array.from(this.o_.values());
        for (const n of i) {
          const i2 = b(n[0].Dt());
          i2.$h(t.overlayPriceScales), t.localization && i2.Ra();
        }
      }
    }
    w_(t) {
      switch (t) {
        case "left":
          return this.f_;
        case "right":
          return this.p_;
      }
      return this.o_.has(t) ? m(this.o_.get(t))[0].Dt() : null;
    }
    S() {
      this.$t().g_().p(this), this.f_.zo().p(this), this.p_.zo().p(this), this.po.forEach((t) => {
        t.S && t.S();
      }), this.c_.m();
    }
    M_() {
      return this.u_;
    }
    x_(t) {
      this.u_ = t;
    }
    $t() {
      return this.$i;
    }
    Hi() {
      return this.__;
    }
    At() {
      return this.ho;
    }
    S_(t) {
      this.__ = t, this.k_();
    }
    Lo(t) {
      this.ho = t, this.f_.Lo(t), this.p_.Lo(t), this.po.forEach((i) => {
        if (this.vr(i)) {
          const n = i.Dt();
          null !== n && n.Lo(t);
        }
      }), this.k_();
    }
    Ba() {
      return this.po;
    }
    vr(t) {
      const i = t.Dt();
      return null === i || this.f_ !== i && this.p_ !== i;
    }
    qo(t, i, n) {
      const s = void 0 !== n ? n : this.C_().y_ + 1;
      this.T_(t, i, s);
    }
    Zo(t) {
      const i = this.po.indexOf(t);
      p(-1 !== i, "removeDataSource: invalid data source"), this.po.splice(i, 1);
      const n = b(t.Dt()).Pa();
      if (this.o_.has(n)) {
        const i2 = m(this.o_.get(n)), s2 = i2.indexOf(t);
        -1 !== s2 && (i2.splice(s2, 1), 0 === i2.length && this.o_.delete(n));
      }
      const s = t.Dt();
      s && s.Ba().indexOf(t) >= 0 && s.Zo(t), null !== s && (s.Yo(), this.P_(s)), this.mo = null;
    }
    mr(t) {
      return t === this.f_ ? "left" : t === this.p_ ? "right" : "overlay";
    }
    R_() {
      return this.f_;
    }
    D_() {
      return this.p_;
    }
    V_(t, i) {
      t.Go(i);
    }
    O_(t, i) {
      t.Jo(i), this.k_();
    }
    B_(t) {
      t.Qo();
    }
    A_(t, i) {
      t.t_(i);
    }
    I_(t, i) {
      t.i_(i), this.k_();
    }
    z_(t) {
      t.n_();
    }
    k_() {
      this.po.forEach((t) => {
        t.Vn();
      });
    }
    vn() {
      let t = null;
      return this.$i.W().rightPriceScale.visible && 0 !== this.p_.Ba().length ? t = this.p_ : this.$i.W().leftPriceScale.visible && 0 !== this.f_.Ba().length ? t = this.f_ : 0 !== this.po.length && (t = this.po[0].Dt()), null === t && (t = this.p_), t;
    }
    pr() {
      let t = null;
      return this.$i.W().rightPriceScale.visible ? t = this.p_ : this.$i.W().leftPriceScale.visible && (t = this.f_), t;
    }
    P_(t) {
      null !== t && t.Vo() && this.L_(t);
    }
    E_(t) {
      const i = this.yl.Xs();
      t.Ro({ Wn: true }), null !== i && t.h_(i), this.k_();
    }
    N_() {
      this.L_(this.f_), this.L_(this.p_);
    }
    F_() {
      this.P_(this.f_), this.P_(this.p_), this.po.forEach((t) => {
        this.vr(t) && this.P_(t.Dt());
      }), this.k_(), this.$i.Uh();
    }
    Uo() {
      return null === this.mo && (this.mo = vn(this.po)), this.mo;
    }
    W_() {
      return this.c_;
    }
    j_() {
      return this.d_;
    }
    L_(t) {
      const i = t.r_();
      if (i && i.length > 0 && !this.yl.Ni()) {
        const i2 = this.yl.Xs();
        null !== i2 && t.h_(i2);
      }
      t.Vn();
    }
    C_() {
      const t = this.Uo();
      if (0 === t.length)
        return { H_: 0, y_: 0 };
      let i = 0, n = 0;
      for (let s = 0; s < t.length; s++) {
        const e2 = t[s].Xi();
        null !== e2 && (e2 < i && (i = e2), e2 > n && (n = e2));
      }
      return { H_: i, y_: n };
    }
    T_(t, i, n) {
      let s = this.w_(i);
      if (null === s && (s = this.v_(i, this.$i.W().overlayPriceScales)), this.po.push(t), !_t(i)) {
        const n2 = this.o_.get(i) || [];
        n2.push(t), this.o_.set(i, n2);
      }
      s.qo(t), t.Gi(s), t.Ki(n), this.P_(s), this.mo = null;
    }
    m_(t, i, n) {
      i.Cr !== n.Cr && this.L_(t);
    }
    v_(t, i) {
      const n = Object.assign({ visible: true, autoScale: true }, z(i)), s = new wn(t, n, this.$i.W().layout, this.$i.W().localization);
      return s.Lo(this.At()), s;
    }
  };
  var Mn = class {
    constructor(t, i, n = 50) {
      this.Ke = 0, this.Ge = 1, this.Je = 1, this.tr = /* @__PURE__ */ new Map(), this.Qe = /* @__PURE__ */ new Map(), this.U_ = t, this.q_ = i, this.ir = n;
    }
    Y_(t) {
      const i = t.time, n = this.q_.cacheKey(i), s = this.tr.get(n);
      if (void 0 !== s)
        return s.Z_;
      if (this.Ke === this.ir) {
        const t2 = this.Qe.get(this.Je);
        this.Qe.delete(this.Je), this.tr.delete(m(t2)), this.Je++, this.Ke--;
      }
      const e2 = this.U_(t);
      return this.tr.set(n, { Z_: e2, rr: this.Ge }), this.Qe.set(this.Ge, n), this.Ke++, this.Ge++, e2;
    }
  };
  var xn = class {
    constructor(t, i) {
      p(t <= i, "right should be >= left"), this.X_ = t, this.K_ = i;
    }
    Os() {
      return this.X_;
    }
    ui() {
      return this.K_;
    }
    G_() {
      return this.K_ - this.X_ + 1;
    }
    Kr(t) {
      return this.X_ <= t && t <= this.K_;
    }
    Ch(t) {
      return this.X_ === t.Os() && this.K_ === t.ui();
    }
  };
  function Sn(t, i) {
    return null === t || null === i ? t === i : t.Ch(i);
  }
  var kn = class {
    constructor() {
      this.J_ = /* @__PURE__ */ new Map(), this.tr = null, this.Q_ = false;
    }
    tu(t) {
      this.Q_ = t, this.tr = null;
    }
    iu(t, i) {
      this.nu(i), this.tr = null;
      for (let n = i; n < t.length; ++n) {
        const i2 = t[n];
        let s = this.J_.get(i2.timeWeight);
        void 0 === s && (s = [], this.J_.set(i2.timeWeight, s)), s.push({ index: n, time: i2.time, weight: i2.timeWeight, originalTime: i2.originalTime });
      }
    }
    su(t, i) {
      const n = Math.ceil(i / t);
      return null !== this.tr && this.tr.eu === n || (this.tr = { Ha: this.ru(n), eu: n }), this.tr.Ha;
    }
    nu(t) {
      if (0 === t)
        return void this.J_.clear();
      const i = [];
      this.J_.forEach((n, s) => {
        t <= n[0].index ? i.push(s) : n.splice(Bt(n, t, (i2) => i2.index < t), 1 / 0);
      });
      for (const t2 of i)
        this.J_.delete(t2);
    }
    ru(t) {
      let i = [];
      for (const n of Array.from(this.J_.keys()).sort((t2, i2) => i2 - t2)) {
        if (!this.J_.get(n))
          continue;
        const s = i;
        i = [];
        const e2 = s.length;
        let r2 = 0;
        const h2 = m(this.J_.get(n)), l2 = h2.length;
        let a2 = 1 / 0, o2 = -1 / 0;
        for (let n2 = 0; n2 < l2; n2++) {
          const l3 = h2[n2], _2 = l3.index;
          for (; r2 < e2; ) {
            const t2 = s[r2], n3 = t2.index;
            if (!(n3 < _2)) {
              a2 = n3;
              break;
            }
            r2++, i.push(t2), o2 = n3, a2 = 1 / 0;
          }
          if (a2 - _2 >= t && _2 - o2 >= t)
            i.push(l3), o2 = _2;
          else if (this.Q_)
            return s;
        }
        for (; r2 < e2; r2++)
          i.push(s[r2]);
      }
      return i;
    }
  };
  var yn = class _yn {
    constructor(t) {
      this.hu = t;
    }
    lu() {
      return null === this.hu ? null : new xn(Math.floor(this.hu.Os()), Math.ceil(this.hu.ui()));
    }
    au() {
      return this.hu;
    }
    static ou() {
      return new _yn(null);
    }
  };
  function Cn(t, i) {
    return t.weight > i.weight ? t : i;
  }
  var Tn = class {
    constructor(t, i, n, s) {
      this.__ = 0, this._u = null, this.uu = [], this.Mo = null, this.wo = null, this.cu = new kn(), this.du = /* @__PURE__ */ new Map(), this.fu = yn.ou(), this.vu = true, this.pu = new D(), this.mu = new D(), this.bu = new D(), this.wu = null, this.gu = null, this.Mu = [], this.cn = i, this.yo = n, this.xu = i.rightOffset, this.Su = i.barSpacing, this.$i = t, this.q_ = s, this.ku(), this.cu.tu(i.uniformDistribution);
    }
    W() {
      return this.cn;
    }
    yu(t) {
      V(this.yo, t), this.Cu(), this.ku();
    }
    $h(t, i) {
      var n;
      V(this.cn, t), this.cn.fixLeftEdge && this.Tu(), this.cn.fixRightEdge && this.Pu(), void 0 !== t.barSpacing && this.$i.Gn(t.barSpacing), void 0 !== t.rightOffset && this.$i.Jn(t.rightOffset), void 0 !== t.minBarSpacing && this.$i.Gn(null !== (n = t.barSpacing) && void 0 !== n ? n : this.Su), this.Cu(), this.ku(), this.bu.m();
    }
    mn(t) {
      var i, n;
      return null !== (n = null === (i = this.uu[t]) || void 0 === i ? void 0 : i.time) && void 0 !== n ? n : null;
    }
    Ui(t) {
      var i;
      return null !== (i = this.uu[t]) && void 0 !== i ? i : null;
    }
    Va(t, i) {
      if (this.uu.length < 1)
        return null;
      if (this.q_.key(t) > this.q_.key(this.uu[this.uu.length - 1].time))
        return i ? this.uu.length - 1 : null;
      const n = Bt(this.uu, this.q_.key(t), (t2, i2) => this.q_.key(t2.time) < i2);
      return this.q_.key(t) < this.q_.key(this.uu[n].time) ? i ? n : null : n;
    }
    Ni() {
      return 0 === this.__ || 0 === this.uu.length || null === this._u;
    }
    Da() {
      return this.uu.length > 0;
    }
    Xs() {
      return this.Ru(), this.fu.lu();
    }
    Du() {
      return this.Ru(), this.fu.au();
    }
    Vu() {
      const t = this.Xs();
      if (null === t)
        return null;
      const i = { from: t.Os(), to: t.ui() };
      return this.Ou(i);
    }
    Ou(t) {
      const i = Math.round(t.from), n = Math.round(t.to), s = b(this.Bu()), e2 = b(this.Au());
      return { from: b(this.Ui(Math.max(s, i))), to: b(this.Ui(Math.min(e2, n))) };
    }
    Iu(t) {
      return { from: b(this.Va(t.from, true)), to: b(this.Va(t.to, true)) };
    }
    Hi() {
      return this.__;
    }
    S_(t) {
      if (!isFinite(t) || t <= 0)
        return;
      if (this.__ === t)
        return;
      const i = this.Du(), n = this.__;
      if (this.__ = t, this.vu = true, this.cn.lockVisibleTimeRangeOnResize && 0 !== n) {
        const i2 = this.Su * t / n;
        this.Su = i2;
      }
      if (this.cn.fixLeftEdge && null !== i && i.Os() <= 0) {
        const i2 = n - t;
        this.xu -= Math.round(i2 / this.Su) + 1, this.vu = true;
      }
      this.zu(), this.Lu();
    }
    It(t) {
      if (this.Ni() || !B(t))
        return 0;
      const i = this.Eu() + this.xu - t;
      return this.__ - (i + 0.5) * this.Su - 1;
    }
    Qs(t, i) {
      const n = this.Eu(), s = void 0 === i ? 0 : i.from, e2 = void 0 === i ? t.length : i.to;
      for (let i2 = s; i2 < e2; i2++) {
        const s2 = t[i2].ot, e3 = n + this.xu - s2, r2 = this.__ - (e3 + 0.5) * this.Su - 1;
        t[i2].nt = r2;
      }
    }
    Nu(t) {
      return Math.ceil(this.Fu(t));
    }
    Jn(t) {
      this.vu = true, this.xu = t, this.Lu(), this.$i.Wu(), this.$i.Uh();
    }
    le() {
      return this.Su;
    }
    Gn(t) {
      this.ju(t), this.Lu(), this.$i.Wu(), this.$i.Uh();
    }
    Hu() {
      return this.xu;
    }
    Ha() {
      if (this.Ni())
        return null;
      if (null !== this.gu)
        return this.gu;
      const t = this.Su, i = 5 * (this.$i.W().layout.fontSize + 4) / 8 * (this.cn.tickMarkMaxCharacterLength || 8), n = Math.round(i / t), s = b(this.Xs()), e2 = Math.max(s.Os(), s.Os() - n), r2 = Math.max(s.ui(), s.ui() - n), h2 = this.cu.su(t, i), l2 = this.Bu() + n, a2 = this.Au() - n, o2 = this.$u(), _2 = this.cn.fixLeftEdge || o2, u2 = this.cn.fixRightEdge || o2;
      let c2 = 0;
      for (const t2 of h2) {
        if (!(e2 <= t2.index && t2.index <= r2))
          continue;
        let n2;
        c2 < this.Mu.length ? (n2 = this.Mu[c2], n2.coord = this.It(t2.index), n2.label = this.Uu(t2), n2.weight = t2.weight) : (n2 = { needAlignCoordinate: false, coord: this.It(t2.index), label: this.Uu(t2), weight: t2.weight }, this.Mu.push(n2)), this.Su > i / 2 && !o2 ? n2.needAlignCoordinate = false : n2.needAlignCoordinate = _2 && t2.index <= l2 || u2 && t2.index >= a2, c2++;
      }
      return this.Mu.length = c2, this.gu = this.Mu, this.Mu;
    }
    qu() {
      this.vu = true, this.Gn(this.cn.barSpacing), this.Jn(this.cn.rightOffset);
    }
    Yu(t) {
      this.vu = true, this._u = t, this.Lu(), this.Tu();
    }
    Zu(t, i) {
      const n = this.Fu(t), s = this.le(), e2 = s + i * (s / 10);
      this.Gn(e2), this.cn.rightBarStaysOnScroll || this.Jn(this.Hu() + (n - this.Fu(t)));
    }
    Go(t) {
      this.Mo && this.n_(), null === this.wo && null === this.wu && (this.Ni() || (this.wo = t, this.Xu()));
    }
    Jo(t) {
      if (null === this.wu)
        return;
      const i = kt(this.__ - t, 0, this.__), n = kt(this.__ - b(this.wo), 0, this.__);
      0 !== i && 0 !== n && this.Gn(this.wu.le * i / n);
    }
    Qo() {
      null !== this.wo && (this.wo = null, this.Ku());
    }
    t_(t) {
      null === this.Mo && null === this.wu && (this.Ni() || (this.Mo = t, this.Xu()));
    }
    i_(t) {
      if (null === this.Mo)
        return;
      const i = (this.Mo - t) / this.le();
      this.xu = b(this.wu).Hu + i, this.vu = true, this.Lu();
    }
    n_() {
      null !== this.Mo && (this.Mo = null, this.Ku());
    }
    Gu() {
      this.Ju(this.cn.rightOffset);
    }
    Ju(t, i = 400) {
      if (!isFinite(t))
        throw new RangeError("offset is required and must be finite number");
      if (!isFinite(i) || i <= 0)
        throw new RangeError("animationDuration (optional) must be finite positive number");
      const n = this.xu, s = performance.now();
      this.$i.Zn({ Qu: (t2) => (t2 - s) / i >= 1, tc: (e2) => {
        const r2 = (e2 - s) / i;
        return r2 >= 1 ? t : n + (t - n) * r2;
      } });
    }
    bt(t, i) {
      this.vu = true, this.uu = t, this.cu.iu(t, i), this.Lu();
    }
    nc() {
      return this.pu;
    }
    sc() {
      return this.mu;
    }
    ec() {
      return this.bu;
    }
    Eu() {
      return this._u || 0;
    }
    rc(t) {
      const i = t.G_();
      this.ju(this.__ / i), this.xu = t.ui() - this.Eu(), this.Lu(), this.vu = true, this.$i.Wu(), this.$i.Uh();
    }
    hc() {
      const t = this.Bu(), i = this.Au();
      null !== t && null !== i && this.rc(new xn(t, i + this.cn.rightOffset));
    }
    lc(t) {
      const i = new xn(t.from, t.to);
      this.rc(i);
    }
    qi(t) {
      return void 0 !== this.yo.timeFormatter ? this.yo.timeFormatter(t.originalTime) : this.q_.formatHorzItem(t.time);
    }
    $u() {
      const { handleScroll: t, handleScale: i } = this.$i.W();
      return !(t.horzTouchDrag || t.mouseWheel || t.pressedMouseMove || t.vertTouchDrag || i.axisDoubleClickReset.time || i.axisPressedMouseMove.time || i.mouseWheel || i.pinch);
    }
    Bu() {
      return 0 === this.uu.length ? null : 0;
    }
    Au() {
      return 0 === this.uu.length ? null : this.uu.length - 1;
    }
    ac(t) {
      return (this.__ - 1 - t) / this.Su;
    }
    Fu(t) {
      const i = this.ac(t), n = this.Eu() + this.xu - i;
      return Math.round(1e6 * n) / 1e6;
    }
    ju(t) {
      const i = this.Su;
      this.Su = t, this.zu(), i !== this.Su && (this.vu = true, this.oc());
    }
    Ru() {
      if (!this.vu)
        return;
      if (this.vu = false, this.Ni())
        return void this._c(yn.ou());
      const t = this.Eu(), i = this.__ / this.Su, n = this.xu + t, s = new xn(n - i + 1, n);
      this._c(new yn(s));
    }
    zu() {
      const t = this.uc();
      if (this.Su < t && (this.Su = t, this.vu = true), 0 !== this.__) {
        const t2 = 0.5 * this.__;
        this.Su > t2 && (this.Su = t2, this.vu = true);
      }
    }
    uc() {
      return this.cn.fixLeftEdge && this.cn.fixRightEdge && 0 !== this.uu.length ? this.__ / this.uu.length : this.cn.minBarSpacing;
    }
    Lu() {
      const t = this.cc();
      null !== t && this.xu < t && (this.xu = t, this.vu = true);
      const i = this.dc();
      this.xu > i && (this.xu = i, this.vu = true);
    }
    cc() {
      const t = this.Bu(), i = this._u;
      if (null === t || null === i)
        return null;
      return t - i - 1 + (this.cn.fixLeftEdge ? this.__ / this.Su : Math.min(2, this.uu.length));
    }
    dc() {
      return this.cn.fixRightEdge ? 0 : this.__ / this.Su - Math.min(2, this.uu.length);
    }
    Xu() {
      this.wu = { le: this.le(), Hu: this.Hu() };
    }
    Ku() {
      this.wu = null;
    }
    Uu(t) {
      let i = this.du.get(t.weight);
      return void 0 === i && (i = new Mn((t2) => this.fc(t2), this.q_), this.du.set(t.weight, i)), i.Y_(t);
    }
    fc(t) {
      return this.q_.formatTickmark(t, this.yo);
    }
    _c(t) {
      const i = this.fu;
      this.fu = t, Sn(i.lu(), this.fu.lu()) || this.pu.m(), Sn(i.au(), this.fu.au()) || this.mu.m(), this.oc();
    }
    oc() {
      this.gu = null;
    }
    Cu() {
      this.oc(), this.du.clear();
    }
    ku() {
      this.q_.updateFormatter(this.yo);
    }
    Tu() {
      if (!this.cn.fixLeftEdge)
        return;
      const t = this.Bu();
      if (null === t)
        return;
      const i = this.Xs();
      if (null === i)
        return;
      const n = i.Os() - t;
      if (n < 0) {
        const t2 = this.xu - n - 1;
        this.Jn(t2);
      }
      this.zu();
    }
    Pu() {
      this.Lu(), this.zu();
    }
  };
  var Pn = class {
    X(t, i, n) {
      t.useMediaCoordinateSpace((t2) => this.K(t2, i, n));
    }
    gl(t, i, n) {
      t.useMediaCoordinateSpace((t2) => this.vc(t2, i, n));
    }
    vc(t, i, n) {
    }
  };
  var Rn = class extends Pn {
    constructor(t) {
      super(), this.mc = /* @__PURE__ */ new Map(), this.zt = t;
    }
    K(t) {
    }
    vc(t) {
      if (!this.zt.yt)
        return;
      const { context: i, mediaSize: n } = t;
      let s = 0;
      for (const t2 of this.zt.bc) {
        if (0 === t2.Kt.length)
          continue;
        i.font = t2.R;
        const e3 = this.wc(i, t2.Kt);
        e3 > n.width ? t2.Zu = n.width / e3 : t2.Zu = 1, s += t2.gc * t2.Zu;
      }
      let e2 = 0;
      switch (this.zt.Mc) {
        case "top":
          e2 = 0;
          break;
        case "center":
          e2 = Math.max((n.height - s) / 2, 0);
          break;
        case "bottom":
          e2 = Math.max(n.height - s, 0);
      }
      i.fillStyle = this.zt.V;
      for (const t2 of this.zt.bc) {
        i.save();
        let s2 = 0;
        switch (this.zt.xc) {
          case "left":
            i.textAlign = "left", s2 = t2.gc / 2;
            break;
          case "center":
            i.textAlign = "center", s2 = n.width / 2;
            break;
          case "right":
            i.textAlign = "right", s2 = n.width - 1 - t2.gc / 2;
        }
        i.translate(s2, e2), i.textBaseline = "top", i.font = t2.R, i.scale(t2.Zu, t2.Zu), i.fillText(t2.Kt, 0, t2.Sc), i.restore(), e2 += t2.gc * t2.Zu;
      }
    }
    wc(t, i) {
      const n = this.kc(t.font);
      let s = n.get(i);
      return void 0 === s && (s = t.measureText(i).width, n.set(i, s)), s;
    }
    kc(t) {
      let i = this.mc.get(t);
      return void 0 === i && (i = /* @__PURE__ */ new Map(), this.mc.set(t, i)), i;
    }
  };
  var Dn = class {
    constructor(t) {
      this.ft = true, this.Ft = { yt: false, V: "", bc: [], Mc: "center", xc: "center" }, this.Wt = new Rn(this.Ft), this.jt = t;
    }
    bt() {
      this.ft = true;
    }
    gt() {
      return this.ft && (this.Mt(), this.ft = false), this.Wt;
    }
    Mt() {
      const t = this.jt.W(), i = this.Ft;
      i.yt = t.visible, i.yt && (i.V = t.color, i.xc = t.horzAlign, i.Mc = t.vertAlign, i.bc = [{ Kt: t.text, R: F(t.fontSize, t.fontFamily, t.fontStyle), gc: 1.2 * t.fontSize, Sc: 0, Zu: 0 }]);
    }
  };
  var Vn = class extends lt {
    constructor(t, i) {
      super(), this.cn = i, this.wn = new Dn(this);
    }
    Rn() {
      return [];
    }
    Pn() {
      return [this.wn];
    }
    W() {
      return this.cn;
    }
    Vn() {
      this.wn.bt();
    }
  };
  var On;
  var Bn;
  var An;
  var In;
  var zn;
  !function(t) {
    t[t.OnTouchEnd = 0] = "OnTouchEnd", t[t.OnNextTap = 1] = "OnNextTap";
  }(On || (On = {}));
  var Ln = class {
    constructor(t, i, n) {
      this.yc = [], this.Cc = [], this.__ = 0, this.Tc = null, this.Pc = new D(), this.Rc = new D(), this.Dc = null, this.Vc = t, this.cn = i, this.q_ = n, this.Oc = new W(this), this.yl = new Tn(this, i.timeScale, this.cn.localization, n), this.vt = new ot(this, i.crosshair), this.Bc = new Ji(i.crosshair), this.Ac = new Vn(this, i.watermark), this.Ic(), this.yc[0].x_(2e3), this.zc = this.Lc(0), this.Ec = this.Lc(1);
    }
    Kl() {
      this.Nc(ut.es());
    }
    Uh() {
      this.Nc(ut.ss());
    }
    oa() {
      this.Nc(new ut(1));
    }
    Gl(t) {
      const i = this.Fc(t);
      this.Nc(i);
    }
    Wc() {
      return this.Tc;
    }
    jc(t) {
      const i = this.Tc;
      this.Tc = t, null !== i && this.Gl(i.Hc), null !== t && this.Gl(t.Hc);
    }
    W() {
      return this.cn;
    }
    $h(t) {
      V(this.cn, t), this.yc.forEach((i) => i.b_(t)), void 0 !== t.timeScale && this.yl.$h(t.timeScale), void 0 !== t.localization && this.yl.yu(t.localization), (t.leftPriceScale || t.rightPriceScale) && this.Pc.m(), this.zc = this.Lc(0), this.Ec = this.Lc(1), this.Kl();
    }
    $c(t, i) {
      if ("left" === t)
        return void this.$h({ leftPriceScale: i });
      if ("right" === t)
        return void this.$h({ rightPriceScale: i });
      const n = this.Uc(t);
      null !== n && (n.Dt.$h(i), this.Pc.m());
    }
    Uc(t) {
      for (const i of this.yc) {
        const n = i.w_(t);
        if (null !== n)
          return { Ht: i, Dt: n };
      }
      return null;
    }
    St() {
      return this.yl;
    }
    qc() {
      return this.yc;
    }
    Yc() {
      return this.Ac;
    }
    Zc() {
      return this.vt;
    }
    Xc() {
      return this.Rc;
    }
    Kc(t, i) {
      t.Lo(i), this.Wu();
    }
    S_(t) {
      this.__ = t, this.yl.S_(this.__), this.yc.forEach((i) => i.S_(t)), this.Wu();
    }
    Ic(t) {
      const i = new gn(this.yl, this);
      void 0 !== t ? this.yc.splice(t, 0, i) : this.yc.push(i);
      const n = void 0 === t ? this.yc.length - 1 : t, s = ut.es();
      return s.Nn(n, { Fn: 0, Wn: true }), this.Nc(s), i;
    }
    V_(t, i, n) {
      t.V_(i, n);
    }
    O_(t, i, n) {
      t.O_(i, n), this.Jl(), this.Nc(this.Gc(t, 2));
    }
    B_(t, i) {
      t.B_(i), this.Nc(this.Gc(t, 2));
    }
    A_(t, i, n) {
      i.Vo() || t.A_(i, n);
    }
    I_(t, i, n) {
      i.Vo() || (t.I_(i, n), this.Jl(), this.Nc(this.Gc(t, 2)));
    }
    z_(t, i) {
      i.Vo() || (t.z_(i), this.Nc(this.Gc(t, 2)));
    }
    E_(t, i) {
      t.E_(i), this.Nc(this.Gc(t, 2));
    }
    Jc(t) {
      this.yl.Go(t);
    }
    Qc(t, i) {
      const n = this.St();
      if (n.Ni() || 0 === i)
        return;
      const s = n.Hi();
      t = Math.max(1, Math.min(t, s)), n.Zu(t, i), this.Wu();
    }
    td(t) {
      this.nd(0), this.sd(t), this.ed();
    }
    rd(t) {
      this.yl.Jo(t), this.Wu();
    }
    hd() {
      this.yl.Qo(), this.Uh();
    }
    nd(t) {
      this.yl.t_(t);
    }
    sd(t) {
      this.yl.i_(t), this.Wu();
    }
    ed() {
      this.yl.n_(), this.Uh();
    }
    wt() {
      return this.Cc;
    }
    ld(t, i, n, s, e2) {
      this.vt.gn(t, i);
      let r2 = NaN, h2 = this.yl.Nu(t);
      const l2 = this.yl.Xs();
      null !== l2 && (h2 = Math.min(Math.max(l2.Os(), h2), l2.ui()));
      const a2 = s.vn(), o2 = a2.Ct();
      null !== o2 && (r2 = a2.pn(i, o2)), r2 = this.Bc.Oa(r2, h2, s), this.vt.kn(h2, r2, s), this.oa(), e2 || this.Rc.m(this.vt.xt(), { x: t, y: i }, n);
    }
    ad(t, i, n) {
      const s = n.vn(), e2 = s.Ct(), r2 = s.Rt(t, b(e2)), h2 = this.yl.Va(i, true), l2 = this.yl.It(b(h2));
      this.ld(l2, r2, null, n, true);
    }
    od(t) {
      this.Zc().Cn(), this.oa(), t || this.Rc.m(null, null, null);
    }
    Jl() {
      const t = this.vt.Ht();
      if (null !== t) {
        const i = this.vt.xn(), n = this.vt.Sn();
        this.ld(i, n, null, t);
      }
      this.vt.Vn();
    }
    _d(t, i, n) {
      const s = this.yl.mn(0);
      void 0 !== i && void 0 !== n && this.yl.bt(i, n);
      const e2 = this.yl.mn(0), r2 = this.yl.Eu(), h2 = this.yl.Xs();
      if (null !== h2 && null !== s && null !== e2) {
        const i2 = h2.Kr(r2), l2 = this.q_.key(s) > this.q_.key(e2), a2 = null !== t && t > r2 && !l2, o2 = this.yl.W().allowShiftVisibleRangeOnWhitespaceReplacement, _2 = i2 && (!(void 0 === n) || o2) && this.yl.W().shiftVisibleRangeOnNewBar;
        if (a2 && !_2) {
          const i3 = t - r2;
          this.yl.Jn(this.yl.Hu() - i3);
        }
      }
      this.yl.Yu(t);
    }
    ia(t) {
      null !== t && t.F_();
    }
    dr(t) {
      const i = this.yc.find((i2) => i2.Uo().includes(t));
      return void 0 === i ? null : i;
    }
    Wu() {
      this.Ac.Vn(), this.yc.forEach((t) => t.F_()), this.Jl();
    }
    S() {
      this.yc.forEach((t) => t.S()), this.yc.length = 0, this.cn.localization.priceFormatter = void 0, this.cn.localization.percentageFormatter = void 0, this.cn.localization.timeFormatter = void 0;
    }
    ud() {
      return this.Oc;
    }
    br() {
      return this.Oc.W();
    }
    g_() {
      return this.Pc;
    }
    dd(t, i, n) {
      const s = this.yc[0], e2 = this.fd(i, t, s, n);
      return this.Cc.push(e2), 1 === this.Cc.length ? this.Kl() : this.Uh(), e2;
    }
    vd(t) {
      const i = this.dr(t), n = this.Cc.indexOf(t);
      p(-1 !== n, "Series not found"), this.Cc.splice(n, 1), b(i).Zo(t), t.S && t.S();
    }
    Xl(t, i) {
      const n = b(this.dr(t));
      n.Zo(t);
      const s = this.Uc(i);
      if (null === s) {
        const s2 = t.Xi();
        n.qo(t, i, s2);
      } else {
        const e2 = s.Ht === n ? t.Xi() : void 0;
        s.Ht.qo(t, i, e2);
      }
    }
    hc() {
      const t = ut.ss();
      t.$n(), this.Nc(t);
    }
    pd(t) {
      const i = ut.ss();
      i.Yn(t), this.Nc(i);
    }
    Kn() {
      const t = ut.ss();
      t.Kn(), this.Nc(t);
    }
    Gn(t) {
      const i = ut.ss();
      i.Gn(t), this.Nc(i);
    }
    Jn(t) {
      const i = ut.ss();
      i.Jn(t), this.Nc(i);
    }
    Zn(t) {
      const i = ut.ss();
      i.Zn(t), this.Nc(i);
    }
    Un() {
      const t = ut.ss();
      t.Un(), this.Nc(t);
    }
    md() {
      return this.cn.rightPriceScale.visible ? "right" : "left";
    }
    bd() {
      return this.Ec;
    }
    q() {
      return this.zc;
    }
    Bt(t) {
      const i = this.Ec, n = this.zc;
      if (i === n)
        return i;
      if (t = Math.max(0, Math.min(100, Math.round(100 * t))), null === this.Dc || this.Dc.Ps !== n || this.Dc.Rs !== i)
        this.Dc = { Ps: n, Rs: i, wd: /* @__PURE__ */ new Map() };
      else {
        const i2 = this.Dc.wd.get(t);
        if (void 0 !== i2)
          return i2;
      }
      const s = function(t2, i2, n2) {
        const [s2, e2, r2, h2] = T(t2), [l2, a2, o2, _2] = T(i2), u2 = [M(s2 + n2 * (l2 - s2)), M(e2 + n2 * (a2 - e2)), M(r2 + n2 * (o2 - r2)), x(h2 + n2 * (_2 - h2))];
        return `rgba(${u2[0]}, ${u2[1]}, ${u2[2]}, ${u2[3]})`;
      }(n, i, t / 100);
      return this.Dc.wd.set(t, s), s;
    }
    Gc(t, i) {
      const n = new ut(i);
      if (null !== t) {
        const s = this.yc.indexOf(t);
        n.Nn(s, { Fn: i });
      }
      return n;
    }
    Fc(t, i) {
      return void 0 === i && (i = 2), this.Gc(this.dr(t), i);
    }
    Nc(t) {
      this.Vc && this.Vc(t), this.yc.forEach((t2) => t2.j_().qh().bt());
    }
    fd(t, i, n, s) {
      const e2 = new Gi(this, t, i, n, s), r2 = void 0 !== t.priceScaleId ? t.priceScaleId : this.md();
      return n.qo(e2, r2), _t(r2) || e2.$h(t), e2;
    }
    Lc(t) {
      const i = this.cn.layout;
      return "gradient" === i.background.type ? 0 === t ? i.background.topColor : i.background.bottomColor : i.background.color;
    }
  };
  function En(t) {
    return !O(t) && !A(t);
  }
  function Nn(t) {
    return O(t);
  }
  !function(t) {
    t[t.Disabled = 0] = "Disabled", t[t.Continuous = 1] = "Continuous", t[t.OnDataUpdate = 2] = "OnDataUpdate";
  }(Bn || (Bn = {})), function(t) {
    t[t.LastBar = 0] = "LastBar", t[t.LastVisible = 1] = "LastVisible";
  }(An || (An = {})), function(t) {
    t.Solid = "solid", t.VerticalGradient = "gradient";
  }(In || (In = {})), function(t) {
    t[t.Year = 0] = "Year", t[t.Month = 1] = "Month", t[t.DayOfMonth = 2] = "DayOfMonth", t[t.Time = 3] = "Time", t[t.TimeWithSeconds = 4] = "TimeWithSeconds";
  }(zn || (zn = {}));
  var Fn = (t) => t.getUTCFullYear();
  function Wn(t, i, n) {
    return i.replace(/yyyy/g, ((t2) => dt(Fn(t2), 4))(t)).replace(/yy/g, ((t2) => dt(Fn(t2) % 100, 2))(t)).replace(/MMMM/g, ((t2, i2) => new Date(t2.getUTCFullYear(), t2.getUTCMonth(), 1).toLocaleString(i2, { month: "long" }))(t, n)).replace(/MMM/g, ((t2, i2) => new Date(t2.getUTCFullYear(), t2.getUTCMonth(), 1).toLocaleString(i2, { month: "short" }))(t, n)).replace(/MM/g, ((t2) => dt(((t3) => t3.getUTCMonth() + 1)(t2), 2))(t)).replace(/dd/g, ((t2) => dt(((t3) => t3.getUTCDate())(t2), 2))(t));
  }
  var jn = class {
    constructor(t = "yyyy-MM-dd", i = "default") {
      this.gd = t, this.Md = i;
    }
    Y_(t) {
      return Wn(t, this.gd, this.Md);
    }
  };
  var Hn = class {
    constructor(t) {
      this.xd = t || "%h:%m:%s";
    }
    Y_(t) {
      return this.xd.replace("%h", dt(t.getUTCHours(), 2)).replace("%m", dt(t.getUTCMinutes(), 2)).replace("%s", dt(t.getUTCSeconds(), 2));
    }
  };
  var $n = { Sd: "yyyy-MM-dd", kd: "%h:%m:%s", yd: " ", Cd: "default" };
  var Un = class {
    constructor(t = {}) {
      const i = Object.assign(Object.assign({}, $n), t);
      this.Td = new jn(i.Sd, i.Cd), this.Pd = new Hn(i.kd), this.Rd = i.yd;
    }
    Y_(t) {
      return `${this.Td.Y_(t)}${this.Rd}${this.Pd.Y_(t)}`;
    }
  };
  function qn(t) {
    return 60 * t * 60 * 1e3;
  }
  function Yn(t) {
    return 60 * t * 1e3;
  }
  var Zn = [{ Dd: (Xn = 1, 1e3 * Xn), Vd: 10 }, { Dd: Yn(1), Vd: 20 }, { Dd: Yn(5), Vd: 21 }, { Dd: Yn(30), Vd: 22 }, { Dd: qn(1), Vd: 30 }, { Dd: qn(3), Vd: 31 }, { Dd: qn(6), Vd: 32 }, { Dd: qn(12), Vd: 33 }];
  var Xn;
  function Kn(t, i) {
    if (t.getUTCFullYear() !== i.getUTCFullYear())
      return 70;
    if (t.getUTCMonth() !== i.getUTCMonth())
      return 60;
    if (t.getUTCDate() !== i.getUTCDate())
      return 50;
    for (let n = Zn.length - 1; n >= 0; --n)
      if (Math.floor(i.getTime() / Zn[n].Dd) !== Math.floor(t.getTime() / Zn[n].Dd))
        return Zn[n].Vd;
    return 0;
  }
  function Gn(t) {
    let i = t;
    if (A(t) && (i = Qn(t)), !En(i))
      throw new Error("time must be of type BusinessDay");
    const n = new Date(Date.UTC(i.year, i.month - 1, i.day, 0, 0, 0, 0));
    return { Od: Math.round(n.getTime() / 1e3), Bd: i };
  }
  function Jn(t) {
    if (!Nn(t))
      throw new Error("time must be of type isUTCTimestamp");
    return { Od: t };
  }
  function Qn(t) {
    const i = new Date(t);
    if (isNaN(i.getTime()))
      throw new Error(`Invalid date string=${t}, expected format=yyyy-mm-dd`);
    return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
  }
  function ts(t) {
    A(t.time) && (t.time = Qn(t.time));
  }
  var is = class {
    options() {
      return this.cn;
    }
    setOptions(t) {
      this.cn = t, this.updateFormatter(t.localization);
    }
    preprocessData(t) {
      Array.isArray(t) ? function(t2) {
        t2.forEach(ts);
      }(t) : ts(t);
    }
    createConverterToInternalObj(t) {
      return b(function(t2) {
        return 0 === t2.length ? null : En(t2[0].time) || A(t2[0].time) ? Gn : Jn;
      }(t));
    }
    key(t) {
      return "object" == typeof t && "Od" in t ? t.Od : this.key(this.convertHorzItemToInternal(t));
    }
    cacheKey(t) {
      const i = t;
      return void 0 === i.Bd ? new Date(1e3 * i.Od).getTime() : new Date(Date.UTC(i.Bd.year, i.Bd.month - 1, i.Bd.day)).getTime();
    }
    convertHorzItemToInternal(t) {
      return Nn(i = t) ? Jn(i) : En(i) ? Gn(i) : Gn(Qn(i));
      var i;
    }
    updateFormatter(t) {
      if (!this.cn)
        return;
      const i = t.dateFormat;
      this.cn.timeScale.timeVisible ? this.Ad = new Un({ Sd: i, kd: this.cn.timeScale.secondsVisible ? "%h:%m:%s" : "%h:%m", yd: "   ", Cd: t.locale }) : this.Ad = new jn(i, t.locale);
    }
    formatHorzItem(t) {
      const i = t;
      return this.Ad.Y_(new Date(1e3 * i.Od));
    }
    formatTickmark(t, i) {
      const n = function(t2, i2, n2) {
        switch (t2) {
          case 0:
          case 10:
            return i2 ? n2 ? 4 : 3 : 2;
          case 20:
          case 21:
          case 22:
          case 30:
          case 31:
          case 32:
          case 33:
            return i2 ? 3 : 2;
          case 50:
            return 2;
          case 60:
            return 1;
          case 70:
            return 0;
        }
      }(t.weight, this.cn.timeScale.timeVisible, this.cn.timeScale.secondsVisible), s = this.cn.timeScale;
      if (void 0 !== s.tickMarkFormatter) {
        const e2 = s.tickMarkFormatter(t.originalTime, n, i.locale);
        if (null !== e2)
          return e2;
      }
      return function(t2, i2, n2) {
        const s2 = {};
        switch (i2) {
          case 0:
            s2.year = "numeric";
            break;
          case 1:
            s2.month = "short";
            break;
          case 2:
            s2.day = "numeric";
            break;
          case 3:
            s2.hour12 = false, s2.hour = "2-digit", s2.minute = "2-digit";
            break;
          case 4:
            s2.hour12 = false, s2.hour = "2-digit", s2.minute = "2-digit", s2.second = "2-digit";
        }
        const e2 = void 0 === t2.Bd ? new Date(1e3 * t2.Od) : new Date(Date.UTC(t2.Bd.year, t2.Bd.month - 1, t2.Bd.day));
        return new Date(e2.getUTCFullYear(), e2.getUTCMonth(), e2.getUTCDate(), e2.getUTCHours(), e2.getUTCMinutes(), e2.getUTCSeconds(), e2.getUTCMilliseconds()).toLocaleString(n2, s2);
      }(t.time, n, i.locale);
    }
    maxTickMarkWeight(t) {
      let i = t.reduce(Cn, t[0]).weight;
      return i > 30 && i < 50 && (i = 30), i;
    }
    fillWeightsForPoints(t, i) {
      !function(t2, i2 = 0) {
        if (0 === t2.length)
          return;
        let n = 0 === i2 ? null : t2[i2 - 1].time.Od, s = null !== n ? new Date(1e3 * n) : null, e2 = 0;
        for (let r2 = i2; r2 < t2.length; ++r2) {
          const i3 = t2[r2], h2 = new Date(1e3 * i3.time.Od);
          null !== s && (i3.timeWeight = Kn(h2, s)), e2 += i3.time.Od - (n || i3.time.Od), n = i3.time.Od, s = h2;
        }
        if (0 === i2 && t2.length > 1) {
          const i3 = Math.ceil(e2 / (t2.length - 1)), n2 = new Date(1e3 * (t2[0].time.Od - i3));
          t2[0].timeWeight = Kn(new Date(1e3 * t2[0].time.Od), n2);
        }
      }(t, i);
    }
    static Id(t) {
      return V({ localization: { dateFormat: "dd MMM 'yy" } }, null != t ? t : {});
    }
  };
  var ns = "undefined" != typeof window;
  function ss() {
    return !!ns && window.navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  }
  function es() {
    return !!ns && /iPhone|iPad|iPod/.test(window.navigator.platform);
  }
  function rs(t) {
    return t + t % 2;
  }
  function hs(t, i) {
    return t.zd - i.zd;
  }
  function ls(t, i, n) {
    const s = (t.zd - i.zd) / (t.ot - i.ot);
    return Math.sign(s) * Math.min(Math.abs(s), n);
  }
  var as = class {
    constructor(t, i, n, s) {
      this.Ld = null, this.Ed = null, this.Nd = null, this.Fd = null, this.Wd = null, this.jd = 0, this.Hd = 0, this.$d = t, this.Ud = i, this.qd = n, this.rs = s;
    }
    Yd(t, i) {
      if (null !== this.Ld) {
        if (this.Ld.ot === i)
          return void (this.Ld.zd = t);
        if (Math.abs(this.Ld.zd - t) < this.rs)
          return;
      }
      this.Fd = this.Nd, this.Nd = this.Ed, this.Ed = this.Ld, this.Ld = { ot: i, zd: t };
    }
    Vr(t, i) {
      if (null === this.Ld || null === this.Ed)
        return;
      if (i - this.Ld.ot > 50)
        return;
      let n = 0;
      const s = ls(this.Ld, this.Ed, this.Ud), e2 = hs(this.Ld, this.Ed), r2 = [s], h2 = [e2];
      if (n += e2, null !== this.Nd) {
        const t2 = ls(this.Ed, this.Nd, this.Ud);
        if (Math.sign(t2) === Math.sign(s)) {
          const i2 = hs(this.Ed, this.Nd);
          if (r2.push(t2), h2.push(i2), n += i2, null !== this.Fd) {
            const t3 = ls(this.Nd, this.Fd, this.Ud);
            if (Math.sign(t3) === Math.sign(s)) {
              const i3 = hs(this.Nd, this.Fd);
              r2.push(t3), h2.push(i3), n += i3;
            }
          }
        }
      }
      let l2 = 0;
      for (let t2 = 0; t2 < r2.length; ++t2)
        l2 += h2[t2] / n * r2[t2];
      Math.abs(l2) < this.$d || (this.Wd = { zd: t, ot: i }, this.Hd = l2, this.jd = function(t2, i2) {
        const n2 = Math.log(i2);
        return Math.log(1 * n2 / -t2) / n2;
      }(Math.abs(l2), this.qd));
    }
    tc(t) {
      const i = b(this.Wd), n = t - i.ot;
      return i.zd + this.Hd * (Math.pow(this.qd, n) - 1) / Math.log(this.qd);
    }
    Qu(t) {
      return null === this.Wd || this.Zd(t) === this.jd;
    }
    Zd(t) {
      const i = t - b(this.Wd).ot;
      return Math.min(i, this.jd);
    }
  };
  var os = class {
    constructor(t, i) {
      this.Xd = void 0, this.Kd = void 0, this.Gd = void 0, this.en = false, this.Jd = t, this.Qd = i, this.tf();
    }
    bt() {
      this.tf();
    }
    if() {
      this.Xd && this.Jd.removeChild(this.Xd), this.Kd && this.Jd.removeChild(this.Kd), this.Xd = void 0, this.Kd = void 0;
    }
    nf() {
      return this.en !== this.sf() || this.Gd !== this.ef();
    }
    ef() {
      return P(T(this.Qd.W().layout.textColor)) > 160 ? "dark" : "light";
    }
    sf() {
      return this.Qd.W().layout.attributionLogo;
    }
    rf() {
      const t = new URL(location.href);
      return t.hostname ? "&utm_source=" + t.hostname + t.pathname : "";
    }
    tf() {
      this.nf() && (this.if(), this.en = this.sf(), this.en && (this.Gd = this.ef(), this.Kd = document.createElement("style"), this.Kd.innerText = "a#tv-attr-logo{--fill:#131722;--stroke:#fff;position:absolute;left:10px;bottom:10px;height:19px;width:35px;margin:0;padding:0;border:0;z-index:3;}a#tv-attr-logo[data-dark]{--fill:#D1D4DC;--stroke:#131722;}", this.Xd = document.createElement("a"), this.Xd.href = `https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart${this.rf()}`, this.Xd.title = "Charting by TradingView", this.Xd.id = "tv-attr-logo", this.Xd.target = "_blank", this.Xd.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 19" width="35" height="19" fill="none"><g fill-rule="evenodd" clip-path="url(#a)" clip-rule="evenodd"><path fill="var(--stroke)" d="M2 0H0v10h6v9h21.4l.5-1.3 6-15 1-2.7H23.7l-.5 1.3-.2.6a5 5 0 0 0-7-.9V0H2Zm20 17h4l5.2-13 .8-2h-7l-1 2.5-.2.5-1.5 3.8-.3.7V17Zm-.8-10a3 3 0 0 0 .7-2.7A3 3 0 1 0 16.8 7h4.4ZM14 7V2H2v6h6v9h4V7h2Z"/><path fill="var(--fill)" d="M14 2H2v6h6v9h6V2Zm12 15h-7l6-15h7l-6 15Zm-7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></g><defs><clipPath id="a"><path fill="var(--stroke)" d="M0 0h35v19H0z"/></clipPath></defs></svg>', this.Xd.toggleAttribute("data-dark", "dark" === this.Gd), this.Jd.appendChild(this.Kd), this.Jd.appendChild(this.Xd)));
    }
  };
  function _s(t, n) {
    const s = b(t.ownerDocument).createElement("canvas");
    t.appendChild(s);
    const e2 = bindTo(s, { type: "device-pixel-content-box", options: { allowResizeObserver: false }, transform: (t2, i) => ({ width: Math.max(t2.width, i.width), height: Math.max(t2.height, i.height) }) });
    return e2.resizeCanvasElement(n), e2;
  }
  function us(t) {
    var i;
    t.width = 1, t.height = 1, null === (i = t.getContext("2d")) || void 0 === i || i.clearRect(0, 0, 1, 1);
  }
  function cs(t, i, n, s) {
    t.gl && t.gl(i, n, s);
  }
  function ds(t, i, n, s) {
    t.X(i, n, s);
  }
  function fs(t, i, n, s) {
    const e2 = t(n, s);
    for (const t2 of e2) {
      const n2 = t2.gt();
      null !== n2 && i(n2);
    }
  }
  function vs(t) {
    ns && void 0 !== window.chrome && t.addEventListener("mousedown", (t2) => {
      if (1 === t2.button)
        return t2.preventDefault(), false;
    });
  }
  var ps = class {
    constructor(t, i, n) {
      this.hf = 0, this.lf = null, this.af = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY }, this._f = 0, this.uf = null, this.cf = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY }, this.df = null, this.ff = false, this.vf = null, this.pf = null, this.mf = false, this.bf = false, this.wf = false, this.gf = null, this.Mf = null, this.xf = null, this.Sf = null, this.kf = null, this.yf = null, this.Cf = null, this.Tf = 0, this.Pf = false, this.Rf = false, this.Df = false, this.Vf = 0, this.Of = null, this.Bf = !es(), this.Af = (t2) => {
        this.If(t2);
      }, this.zf = (t2) => {
        if (this.Lf(t2)) {
          const i2 = this.Ef(t2);
          if (++this._f, this.uf && this._f > 1) {
            const { Nf: n2 } = this.Ff(ws(t2), this.cf);
            n2 < 30 && !this.wf && this.Wf(i2, this.Hf.jf), this.$f();
          }
        } else {
          const i2 = this.Ef(t2);
          if (++this.hf, this.lf && this.hf > 1) {
            const { Nf: n2 } = this.Ff(ws(t2), this.af);
            n2 < 5 && !this.bf && this.Uf(i2, this.Hf.qf), this.Yf();
          }
        }
      }, this.Zf = t, this.Hf = i, this.cn = n, this.Xf();
    }
    S() {
      null !== this.gf && (this.gf(), this.gf = null), null !== this.Mf && (this.Mf(), this.Mf = null), null !== this.Sf && (this.Sf(), this.Sf = null), null !== this.kf && (this.kf(), this.kf = null), null !== this.yf && (this.yf(), this.yf = null), null !== this.xf && (this.xf(), this.xf = null), this.Kf(), this.Yf();
    }
    Gf(t) {
      this.Sf && this.Sf();
      const i = this.Jf.bind(this);
      if (this.Sf = () => {
        this.Zf.removeEventListener("mousemove", i);
      }, this.Zf.addEventListener("mousemove", i), this.Lf(t))
        return;
      const n = this.Ef(t);
      this.Uf(n, this.Hf.Qf), this.Bf = true;
    }
    Yf() {
      null !== this.lf && clearTimeout(this.lf), this.hf = 0, this.lf = null, this.af = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY };
    }
    $f() {
      null !== this.uf && clearTimeout(this.uf), this._f = 0, this.uf = null, this.cf = { nt: Number.NEGATIVE_INFINITY, st: Number.POSITIVE_INFINITY };
    }
    Jf(t) {
      if (this.Df || null !== this.pf)
        return;
      if (this.Lf(t))
        return;
      const i = this.Ef(t);
      this.Uf(i, this.Hf.tv), this.Bf = true;
    }
    iv(t) {
      const i = Ms(t.changedTouches, b(this.Of));
      if (null === i)
        return;
      if (this.Vf = gs(t), null !== this.Cf)
        return;
      if (this.Rf)
        return;
      this.Pf = true;
      const n = this.Ff(ws(i), b(this.pf)), { nv: s, sv: e2, Nf: r2 } = n;
      if (this.mf || !(r2 < 5)) {
        if (!this.mf) {
          const t2 = 0.5 * s, i2 = e2 >= t2 && !this.cn.ev(), n2 = t2 > e2 && !this.cn.rv();
          i2 || n2 || (this.Rf = true), this.mf = true, this.wf = true, this.Kf(), this.$f();
        }
        if (!this.Rf) {
          const n2 = this.Ef(t, i);
          this.Wf(n2, this.Hf.hv), bs(t);
        }
      }
    }
    lv(t) {
      if (0 !== t.button)
        return;
      const i = this.Ff(ws(t), b(this.vf)), { Nf: n } = i;
      if (n >= 5 && (this.bf = true, this.Yf()), this.bf) {
        const i2 = this.Ef(t);
        this.Uf(i2, this.Hf.av);
      }
    }
    Ff(t, i) {
      const n = Math.abs(i.nt - t.nt), s = Math.abs(i.st - t.st);
      return { nv: n, sv: s, Nf: n + s };
    }
    ov(t) {
      let i = Ms(t.changedTouches, b(this.Of));
      if (null === i && 0 === t.touches.length && (i = t.changedTouches[0]), null === i)
        return;
      this.Of = null, this.Vf = gs(t), this.Kf(), this.pf = null, this.yf && (this.yf(), this.yf = null);
      const n = this.Ef(t, i);
      if (this.Wf(n, this.Hf._v), ++this._f, this.uf && this._f > 1) {
        const { Nf: t2 } = this.Ff(ws(i), this.cf);
        t2 < 30 && !this.wf && this.Wf(n, this.Hf.jf), this.$f();
      } else
        this.wf || (this.Wf(n, this.Hf.uv), this.Hf.uv && bs(t));
      0 === this._f && bs(t), 0 === t.touches.length && this.ff && (this.ff = false, bs(t));
    }
    If(t) {
      if (0 !== t.button)
        return;
      const i = this.Ef(t);
      if (this.vf = null, this.Df = false, this.kf && (this.kf(), this.kf = null), ss()) {
        this.Zf.ownerDocument.documentElement.removeEventListener("mouseleave", this.Af);
      }
      if (!this.Lf(t))
        if (this.Uf(i, this.Hf.cv), ++this.hf, this.lf && this.hf > 1) {
          const { Nf: n } = this.Ff(ws(t), this.af);
          n < 5 && !this.bf && this.Uf(i, this.Hf.qf), this.Yf();
        } else
          this.bf || this.Uf(i, this.Hf.dv);
    }
    Kf() {
      null !== this.df && (clearTimeout(this.df), this.df = null);
    }
    fv(t) {
      if (null !== this.Of)
        return;
      const i = t.changedTouches[0];
      this.Of = i.identifier, this.Vf = gs(t);
      const n = this.Zf.ownerDocument.documentElement;
      this.wf = false, this.mf = false, this.Rf = false, this.pf = ws(i), this.yf && (this.yf(), this.yf = null);
      {
        const i2 = this.iv.bind(this), s2 = this.ov.bind(this);
        this.yf = () => {
          n.removeEventListener("touchmove", i2), n.removeEventListener("touchend", s2);
        }, n.addEventListener("touchmove", i2, { passive: false }), n.addEventListener("touchend", s2, { passive: false }), this.Kf(), this.df = setTimeout(this.vv.bind(this, t), 240);
      }
      const s = this.Ef(t, i);
      this.Wf(s, this.Hf.pv), this.uf || (this._f = 0, this.uf = setTimeout(this.$f.bind(this), 500), this.cf = ws(i));
    }
    mv(t) {
      if (0 !== t.button)
        return;
      const i = this.Zf.ownerDocument.documentElement;
      ss() && i.addEventListener("mouseleave", this.Af), this.bf = false, this.vf = ws(t), this.kf && (this.kf(), this.kf = null);
      {
        const t2 = this.lv.bind(this), n2 = this.If.bind(this);
        this.kf = () => {
          i.removeEventListener("mousemove", t2), i.removeEventListener("mouseup", n2);
        }, i.addEventListener("mousemove", t2), i.addEventListener("mouseup", n2);
      }
      if (this.Df = true, this.Lf(t))
        return;
      const n = this.Ef(t);
      this.Uf(n, this.Hf.bv), this.lf || (this.hf = 0, this.lf = setTimeout(this.Yf.bind(this), 500), this.af = ws(t));
    }
    Xf() {
      this.Zf.addEventListener("mouseenter", this.Gf.bind(this)), this.Zf.addEventListener("touchcancel", this.Kf.bind(this));
      {
        const t = this.Zf.ownerDocument, i = (t2) => {
          this.Hf.wv && (t2.composed && this.Zf.contains(t2.composedPath()[0]) || t2.target && this.Zf.contains(t2.target) || this.Hf.wv());
        };
        this.Mf = () => {
          t.removeEventListener("touchstart", i);
        }, this.gf = () => {
          t.removeEventListener("mousedown", i);
        }, t.addEventListener("mousedown", i), t.addEventListener("touchstart", i, { passive: true });
      }
      es() && (this.xf = () => {
        this.Zf.removeEventListener("dblclick", this.zf);
      }, this.Zf.addEventListener("dblclick", this.zf)), this.Zf.addEventListener("mouseleave", this.gv.bind(this)), this.Zf.addEventListener("touchstart", this.fv.bind(this), { passive: true }), vs(this.Zf), this.Zf.addEventListener("mousedown", this.mv.bind(this)), this.Mv(), this.Zf.addEventListener("touchmove", () => {
      }, { passive: false });
    }
    Mv() {
      void 0 === this.Hf.xv && void 0 === this.Hf.Sv && void 0 === this.Hf.kv || (this.Zf.addEventListener("touchstart", (t) => this.yv(t.touches), { passive: true }), this.Zf.addEventListener("touchmove", (t) => {
        if (2 === t.touches.length && null !== this.Cf && void 0 !== this.Hf.Sv) {
          const i = ms(t.touches[0], t.touches[1]) / this.Tf;
          this.Hf.Sv(this.Cf, i), bs(t);
        }
      }, { passive: false }), this.Zf.addEventListener("touchend", (t) => {
        this.yv(t.touches);
      }));
    }
    yv(t) {
      1 === t.length && (this.Pf = false), 2 !== t.length || this.Pf || this.ff ? this.Cv() : this.Tv(t);
    }
    Tv(t) {
      const i = this.Zf.getBoundingClientRect() || { left: 0, top: 0 };
      this.Cf = { nt: (t[0].clientX - i.left + (t[1].clientX - i.left)) / 2, st: (t[0].clientY - i.top + (t[1].clientY - i.top)) / 2 }, this.Tf = ms(t[0], t[1]), void 0 !== this.Hf.xv && this.Hf.xv(), this.Kf();
    }
    Cv() {
      null !== this.Cf && (this.Cf = null, void 0 !== this.Hf.kv && this.Hf.kv());
    }
    gv(t) {
      if (this.Sf && this.Sf(), this.Lf(t))
        return;
      if (!this.Bf)
        return;
      const i = this.Ef(t);
      this.Uf(i, this.Hf.Pv), this.Bf = !es();
    }
    vv(t) {
      const i = Ms(t.touches, b(this.Of));
      if (null === i)
        return;
      const n = this.Ef(t, i);
      this.Wf(n, this.Hf.Rv), this.wf = true, this.ff = true;
    }
    Lf(t) {
      return t.sourceCapabilities && void 0 !== t.sourceCapabilities.firesTouchEvents ? t.sourceCapabilities.firesTouchEvents : gs(t) < this.Vf + 500;
    }
    Wf(t, i) {
      i && i.call(this.Hf, t);
    }
    Uf(t, i) {
      i && i.call(this.Hf, t);
    }
    Ef(t, i) {
      const n = i || t, s = this.Zf.getBoundingClientRect() || { left: 0, top: 0 };
      return { clientX: n.clientX, clientY: n.clientY, pageX: n.pageX, pageY: n.pageY, screenX: n.screenX, screenY: n.screenY, localX: n.clientX - s.left, localY: n.clientY - s.top, ctrlKey: t.ctrlKey, altKey: t.altKey, shiftKey: t.shiftKey, metaKey: t.metaKey, Dv: !t.type.startsWith("mouse") && "contextmenu" !== t.type && "click" !== t.type, Vv: t.type, Ov: n.target, Bv: t.view, Av: () => {
        "touchstart" !== t.type && bs(t);
      } };
    }
  };
  function ms(t, i) {
    const n = t.clientX - i.clientX, s = t.clientY - i.clientY;
    return Math.sqrt(n * n + s * s);
  }
  function bs(t) {
    t.cancelable && t.preventDefault();
  }
  function ws(t) {
    return { nt: t.pageX, st: t.pageY };
  }
  function gs(t) {
    return t.timeStamp || performance.now();
  }
  function Ms(t, i) {
    for (let n = 0; n < t.length; ++n)
      if (t[n].identifier === i)
        return t[n];
    return null;
  }
  function xs(t) {
    return { Hc: t.Hc, Iv: { gr: t.zv.externalId }, Lv: t.zv.cursorStyle };
  }
  function Ss(t, i, n) {
    for (const s of t) {
      const t2 = s.gt();
      if (null !== t2 && t2.wr) {
        const e2 = t2.wr(i, n);
        if (null !== e2)
          return { Bv: s, Iv: e2 };
      }
    }
    return null;
  }
  function ks(t, i) {
    return (n) => {
      var s, e2, r2, h2;
      return (null !== (e2 = null === (s = n.Dt()) || void 0 === s ? void 0 : s.Pa()) && void 0 !== e2 ? e2 : "") !== i ? [] : null !== (h2 = null === (r2 = n.da) || void 0 === r2 ? void 0 : r2.call(n, t)) && void 0 !== h2 ? h2 : [];
    };
  }
  function ys(t, i, n, s) {
    if (!t.length)
      return;
    let e2 = 0;
    const r2 = n / 2, h2 = t[0].At(s, true);
    let l2 = 1 === i ? r2 - (t[0].Vi() - h2 / 2) : t[0].Vi() - h2 / 2 - r2;
    l2 = Math.max(0, l2);
    for (let r3 = 1; r3 < t.length; r3++) {
      const h3 = t[r3], a2 = t[r3 - 1], o2 = a2.At(s, false), _2 = h3.Vi(), u2 = a2.Vi();
      if (1 === i ? _2 > u2 - o2 : _2 < u2 + o2) {
        const s2 = u2 - o2 * i;
        h3.Oi(s2);
        const r4 = s2 - i * o2 / 2;
        if ((1 === i ? r4 < 0 : r4 > n) && l2 > 0) {
          const s3 = 1 === i ? -1 - r4 : r4 - n, h4 = Math.min(s3, l2);
          for (let n2 = e2; n2 < t.length; n2++)
            t[n2].Oi(t[n2].Vi() + i * h4);
          l2 -= h4;
        }
      } else
        e2 = r3, l2 = 1 === i ? u2 - o2 - _2 : _2 - (u2 + o2);
    }
  }
  var Cs = class {
    constructor(i, n, s, e2) {
      this.Li = null, this.Ev = null, this.Nv = false, this.Fv = new ni(200), this.Qr = null, this.Wv = 0, this.jv = false, this.Hv = () => {
        this.jv || this.tn.$v().$t().Uh();
      }, this.Uv = () => {
        this.jv || this.tn.$v().$t().Uh();
      }, this.tn = i, this.cn = n, this.ko = n.layout, this.Oc = s, this.qv = "left" === e2, this.Yv = ks("normal", e2), this.Zv = ks("top", e2), this.Xv = ks("bottom", e2), this.Kv = document.createElement("div"), this.Kv.style.height = "100%", this.Kv.style.overflow = "hidden", this.Kv.style.width = "25px", this.Kv.style.left = "0", this.Kv.style.position = "relative", this.Gv = _s(this.Kv, size({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
      const r2 = this.Gv.canvasElement;
      r2.style.position = "absolute", r2.style.zIndex = "1", r2.style.left = "0", r2.style.top = "0", this.Jv = _s(this.Kv, size({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
      const h2 = this.Jv.canvasElement;
      h2.style.position = "absolute", h2.style.zIndex = "2", h2.style.left = "0", h2.style.top = "0";
      const l2 = { bv: this.Qv.bind(this), pv: this.Qv.bind(this), av: this.tp.bind(this), hv: this.tp.bind(this), wv: this.ip.bind(this), cv: this.np.bind(this), _v: this.np.bind(this), qf: this.sp.bind(this), jf: this.sp.bind(this), Qf: this.ep.bind(this), Pv: this.rp.bind(this) };
      this.hp = new ps(this.Jv.canvasElement, l2, { ev: () => !this.cn.handleScroll.vertTouchDrag, rv: () => true });
    }
    S() {
      this.hp.S(), this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), us(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), us(this.Gv.canvasElement), this.Gv.dispose(), null !== this.Li && this.Li.Ko().p(this), this.Li = null;
    }
    lp() {
      return this.Kv;
    }
    P() {
      return this.ko.fontSize;
    }
    ap() {
      const t = this.Oc.W();
      return this.Qr !== t.R && (this.Fv.nr(), this.Qr = t.R), t;
    }
    op() {
      if (null === this.Li)
        return 0;
      let t = 0;
      const i = this.ap(), n = b(this.Gv.canvasElement.getContext("2d"));
      n.save();
      const s = this.Li.Ha();
      n.font = this._p(), s.length > 0 && (t = Math.max(this.Fv.xi(n, s[0].so), this.Fv.xi(n, s[s.length - 1].so)));
      const e2 = this.up();
      for (let i2 = e2.length; i2--; ) {
        const s2 = this.Fv.xi(n, e2[i2].Kt());
        s2 > t && (t = s2);
      }
      const r2 = this.Li.Ct();
      if (null !== r2 && null !== this.Ev && (2 !== (h2 = this.cn.crosshair).mode && h2.horzLine.visible && h2.horzLine.labelVisible)) {
        const i2 = this.Li.pn(1, r2), s2 = this.Li.pn(this.Ev.height - 2, r2);
        t = Math.max(t, this.Fv.xi(n, this.Li.Fi(Math.floor(Math.min(i2, s2)) + 0.11111111111111, r2)), this.Fv.xi(n, this.Li.Fi(Math.ceil(Math.max(i2, s2)) - 0.11111111111111, r2)));
      }
      var h2;
      n.restore();
      const l2 = t || 34;
      return rs(Math.ceil(i.C + i.T + i.A + i.I + 5 + l2));
    }
    cp(t) {
      null !== this.Ev && equalSizes(this.Ev, t) || (this.Ev = t, this.jv = true, this.Gv.resizeCanvasElement(t), this.Jv.resizeCanvasElement(t), this.jv = false, this.Kv.style.width = `${t.width}px`, this.Kv.style.height = `${t.height}px`);
    }
    dp() {
      return b(this.Ev).width;
    }
    Gi(t) {
      this.Li !== t && (null !== this.Li && this.Li.Ko().p(this), this.Li = t, t.Ko().l(this.fo.bind(this), this));
    }
    Dt() {
      return this.Li;
    }
    nr() {
      const t = this.tn.fp();
      this.tn.$v().$t().E_(t, b(this.Dt()));
    }
    vp(t) {
      if (null === this.Ev)
        return;
      if (1 !== t) {
        this.pp(), this.Gv.applySuggestedBitmapSize();
        const t2 = tryCreateCanvasRenderingTarget2D(this.Gv);
        null !== t2 && (t2.useBitmapCoordinateSpace((t3) => {
          this.mp(t3), this.Ie(t3);
        }), this.tn.bp(t2, this.Xv), this.wp(t2), this.tn.bp(t2, this.Yv), this.gp(t2));
      }
      this.Jv.applySuggestedBitmapSize();
      const i = tryCreateCanvasRenderingTarget2D(this.Jv);
      null !== i && (i.useBitmapCoordinateSpace(({ context: t2, bitmapSize: i2 }) => {
        t2.clearRect(0, 0, i2.width, i2.height);
      }), this.Mp(i), this.tn.bp(i, this.Zv));
    }
    xp() {
      return this.Gv.bitmapSize;
    }
    Sp(t, i, n) {
      const s = this.xp();
      s.width > 0 && s.height > 0 && t.drawImage(this.Gv.canvasElement, i, n);
    }
    bt() {
      var t;
      null === (t = this.Li) || void 0 === t || t.Ha();
    }
    Qv(t) {
      if (null === this.Li || this.Li.Ni() || !this.cn.handleScale.axisPressedMouseMove.price)
        return;
      const i = this.tn.$v().$t(), n = this.tn.fp();
      this.Nv = true, i.V_(n, this.Li, t.localY);
    }
    tp(t) {
      if (null === this.Li || !this.cn.handleScale.axisPressedMouseMove.price)
        return;
      const i = this.tn.$v().$t(), n = this.tn.fp(), s = this.Li;
      i.O_(n, s, t.localY);
    }
    ip() {
      if (null === this.Li || !this.cn.handleScale.axisPressedMouseMove.price)
        return;
      const t = this.tn.$v().$t(), i = this.tn.fp(), n = this.Li;
      this.Nv && (this.Nv = false, t.B_(i, n));
    }
    np(t) {
      if (null === this.Li || !this.cn.handleScale.axisPressedMouseMove.price)
        return;
      const i = this.tn.$v().$t(), n = this.tn.fp();
      this.Nv = false, i.B_(n, this.Li);
    }
    sp(t) {
      this.cn.handleScale.axisDoubleClickReset.price && this.nr();
    }
    ep(t) {
      if (null === this.Li)
        return;
      !this.tn.$v().$t().W().handleScale.axisPressedMouseMove.price || this.Li.Mh() || this.Li.Oo() || this.kp(1);
    }
    rp(t) {
      this.kp(0);
    }
    up() {
      const t = [], i = null === this.Li ? void 0 : this.Li;
      return ((n) => {
        for (let s = 0; s < n.length; ++s) {
          const e2 = n[s].Rn(this.tn.fp(), i);
          for (let i2 = 0; i2 < e2.length; i2++)
            t.push(e2[i2]);
        }
      })(this.tn.fp().Uo()), t;
    }
    mp({ context: t, bitmapSize: i }) {
      const { width: n, height: s } = i, e2 = this.tn.fp().$t(), r2 = e2.q(), h2 = e2.bd();
      r2 === h2 ? G(t, 0, 0, n, s, r2) : tt(t, 0, 0, n, s, r2, h2);
    }
    Ie({ context: t, bitmapSize: i, horizontalPixelRatio: n }) {
      if (null === this.Ev || null === this.Li || !this.Li.W().borderVisible)
        return;
      t.fillStyle = this.Li.W().borderColor;
      const s = Math.max(1, Math.floor(this.ap().C * n));
      let e2;
      e2 = this.qv ? i.width - s : 0, t.fillRect(e2, 0, s, i.height);
    }
    wp(t) {
      if (null === this.Ev || null === this.Li)
        return;
      const i = this.Li.Ha(), n = this.Li.W(), s = this.ap(), e2 = this.qv ? this.Ev.width - s.T : 0;
      n.borderVisible && n.ticksVisible && t.useBitmapCoordinateSpace(({ context: t2, horizontalPixelRatio: r2, verticalPixelRatio: h2 }) => {
        t2.fillStyle = n.borderColor;
        const l2 = Math.max(1, Math.floor(h2)), a2 = Math.floor(0.5 * h2), o2 = Math.round(s.T * r2);
        t2.beginPath();
        for (const n2 of i)
          t2.rect(Math.floor(e2 * r2), Math.round(n2.Ea * h2) - a2, o2, l2);
        t2.fill();
      }), t.useMediaCoordinateSpace(({ context: t2 }) => {
        var r2;
        t2.font = this._p(), t2.fillStyle = null !== (r2 = n.textColor) && void 0 !== r2 ? r2 : this.ko.textColor, t2.textAlign = this.qv ? "right" : "left", t2.textBaseline = "middle";
        const h2 = this.qv ? Math.round(e2 - s.A) : Math.round(e2 + s.T + s.A), l2 = i.map((i2) => this.Fv.Mi(t2, i2.so));
        for (let n2 = i.length; n2--; ) {
          const s2 = i[n2];
          t2.fillText(s2.so, h2, s2.Ea + l2[n2]);
        }
      });
    }
    pp() {
      if (null === this.Ev || null === this.Li)
        return;
      const t = [], i = this.Li.Uo().slice(), n = this.tn.fp(), s = this.ap();
      this.Li === n.pr() && this.tn.fp().Uo().forEach((t2) => {
        n.vr(t2) && i.push(t2);
      });
      const e2 = this.Li;
      i.forEach((i2) => {
        i2.Rn(n, e2).forEach((i3) => {
          i3.Oi(null), i3.Bi() && t.push(i3);
        });
      }), t.forEach((t2) => t2.Oi(t2.ki()));
      this.Li.W().alignLabels && this.yp(t, s);
    }
    yp(t, i) {
      if (null === this.Ev)
        return;
      const n = this.Ev.height / 2, s = t.filter((t2) => t2.ki() <= n), e2 = t.filter((t2) => t2.ki() > n);
      s.sort((t2, i2) => i2.ki() - t2.ki()), e2.sort((t2, i2) => t2.ki() - i2.ki());
      for (const n2 of t) {
        const t2 = Math.floor(n2.At(i) / 2), s2 = n2.ki();
        s2 > -t2 && s2 < t2 && n2.Oi(t2), s2 > this.Ev.height - t2 && s2 < this.Ev.height + t2 && n2.Oi(this.Ev.height - t2);
      }
      ys(s, 1, this.Ev.height, i), ys(e2, -1, this.Ev.height, i);
    }
    gp(t) {
      if (null === this.Ev)
        return;
      const i = this.up(), n = this.ap(), s = this.qv ? "right" : "left";
      i.forEach((i2) => {
        if (i2.Ai()) {
          i2.gt(b(this.Li)).X(t, n, this.Fv, s);
        }
      });
    }
    Mp(t) {
      if (null === this.Ev || null === this.Li)
        return;
      const i = this.tn.$v().$t(), n = [], s = this.tn.fp(), e2 = i.Zc().Rn(s, this.Li);
      e2.length && n.push(e2);
      const r2 = this.ap(), h2 = this.qv ? "right" : "left";
      n.forEach((i2) => {
        i2.forEach((i3) => {
          i3.gt(b(this.Li)).X(t, r2, this.Fv, h2);
        });
      });
    }
    kp(t) {
      this.Kv.style.cursor = 1 === t ? "ns-resize" : "default";
    }
    fo() {
      const t = this.op();
      this.Wv < t && this.tn.$v().$t().Kl(), this.Wv = t;
    }
    _p() {
      return F(this.ko.fontSize, this.ko.fontFamily);
    }
  };
  function Ts(t, i) {
    var n, s;
    return null !== (s = null === (n = t.ua) || void 0 === n ? void 0 : n.call(t, i)) && void 0 !== s ? s : [];
  }
  function Ps(t, i) {
    var n, s;
    return null !== (s = null === (n = t.Pn) || void 0 === n ? void 0 : n.call(t, i)) && void 0 !== s ? s : [];
  }
  function Rs(t, i) {
    var n, s;
    return null !== (s = null === (n = t.Ji) || void 0 === n ? void 0 : n.call(t, i)) && void 0 !== s ? s : [];
  }
  function Ds(t, i) {
    var n, s;
    return null !== (s = null === (n = t.aa) || void 0 === n ? void 0 : n.call(t, i)) && void 0 !== s ? s : [];
  }
  var Vs = class _Vs {
    constructor(i, n) {
      this.Ev = size({ width: 0, height: 0 }), this.Cp = null, this.Tp = null, this.Pp = null, this.Rp = null, this.Dp = false, this.Vp = new D(), this.Op = new D(), this.Bp = 0, this.Ap = false, this.Ip = null, this.zp = false, this.Lp = null, this.Ep = null, this.jv = false, this.Hv = () => {
        this.jv || null === this.Np || this.$i().Uh();
      }, this.Uv = () => {
        this.jv || null === this.Np || this.$i().Uh();
      }, this.Qd = i, this.Np = n, this.Np.W_().l(this.Fp.bind(this), this, true), this.Wp = document.createElement("td"), this.Wp.style.padding = "0", this.Wp.style.position = "relative";
      const s = document.createElement("div");
      s.style.width = "100%", s.style.height = "100%", s.style.position = "relative", s.style.overflow = "hidden", this.jp = document.createElement("td"), this.jp.style.padding = "0", this.Hp = document.createElement("td"), this.Hp.style.padding = "0", this.Wp.appendChild(s), this.Gv = _s(s, size({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
      const e2 = this.Gv.canvasElement;
      e2.style.position = "absolute", e2.style.zIndex = "1", e2.style.left = "0", e2.style.top = "0", this.Jv = _s(s, size({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
      const r2 = this.Jv.canvasElement;
      r2.style.position = "absolute", r2.style.zIndex = "2", r2.style.left = "0", r2.style.top = "0", this.$p = document.createElement("tr"), this.$p.appendChild(this.jp), this.$p.appendChild(this.Wp), this.$p.appendChild(this.Hp), this.Up(), this.hp = new ps(this.Jv.canvasElement, this, { ev: () => null === this.Ip && !this.Qd.W().handleScroll.vertTouchDrag, rv: () => null === this.Ip && !this.Qd.W().handleScroll.horzTouchDrag });
    }
    S() {
      null !== this.Cp && this.Cp.S(), null !== this.Tp && this.Tp.S(), this.Pp = null, this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), us(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), us(this.Gv.canvasElement), this.Gv.dispose(), null !== this.Np && this.Np.W_().p(this), this.hp.S();
    }
    fp() {
      return b(this.Np);
    }
    qp(t) {
      var i, n;
      null !== this.Np && this.Np.W_().p(this), this.Np = t, null !== this.Np && this.Np.W_().l(_Vs.prototype.Fp.bind(this), this, true), this.Up(), this.Qd.Yp().indexOf(this) === this.Qd.Yp().length - 1 ? (this.Pp = null !== (i = this.Pp) && void 0 !== i ? i : new os(this.Wp, this.Qd), this.Pp.bt()) : (null === (n = this.Pp) || void 0 === n || n.if(), this.Pp = null);
    }
    $v() {
      return this.Qd;
    }
    lp() {
      return this.$p;
    }
    Up() {
      if (null !== this.Np && (this.Zp(), 0 !== this.$i().wt().length)) {
        if (null !== this.Cp) {
          const t = this.Np.R_();
          this.Cp.Gi(b(t));
        }
        if (null !== this.Tp) {
          const t = this.Np.D_();
          this.Tp.Gi(b(t));
        }
      }
    }
    Xp() {
      null !== this.Cp && this.Cp.bt(), null !== this.Tp && this.Tp.bt();
    }
    M_() {
      return null !== this.Np ? this.Np.M_() : 0;
    }
    x_(t) {
      this.Np && this.Np.x_(t);
    }
    Qf(t) {
      if (!this.Np)
        return;
      this.Kp();
      const i = t.localX, n = t.localY;
      this.Gp(i, n, t);
    }
    bv(t) {
      this.Kp(), this.Jp(), this.Gp(t.localX, t.localY, t);
    }
    tv(t) {
      var i;
      if (!this.Np)
        return;
      this.Kp();
      const n = t.localX, s = t.localY;
      this.Gp(n, s, t);
      const e2 = this.wr(n, s);
      this.Qd.Qp(null !== (i = null == e2 ? void 0 : e2.Lv) && void 0 !== i ? i : null), this.$i().jc(e2 && { Hc: e2.Hc, Iv: e2.Iv });
    }
    dv(t) {
      null !== this.Np && (this.Kp(), this.tm(t));
    }
    qf(t) {
      null !== this.Np && this.im(this.Op, t);
    }
    jf(t) {
      this.qf(t);
    }
    av(t) {
      this.Kp(), this.nm(t), this.Gp(t.localX, t.localY, t);
    }
    cv(t) {
      null !== this.Np && (this.Kp(), this.Ap = false, this.sm(t));
    }
    uv(t) {
      null !== this.Np && this.tm(t);
    }
    Rv(t) {
      if (this.Ap = true, null === this.Ip) {
        const i = { x: t.localX, y: t.localY };
        this.rm(i, i, t);
      }
    }
    Pv(t) {
      null !== this.Np && (this.Kp(), this.Np.$t().jc(null), this.hm());
    }
    lm() {
      return this.Vp;
    }
    am() {
      return this.Op;
    }
    xv() {
      this.Bp = 1, this.$i().Un();
    }
    Sv(t, i) {
      if (!this.Qd.W().handleScale.pinch)
        return;
      const n = 5 * (i - this.Bp);
      this.Bp = i, this.$i().Qc(t.nt, n);
    }
    pv(t) {
      this.Ap = false, this.zp = null !== this.Ip, this.Jp();
      const i = this.$i().Zc();
      null !== this.Ip && i.yt() && (this.Lp = { x: i.Yt(), y: i.Zt() }, this.Ip = { x: t.localX, y: t.localY });
    }
    hv(t) {
      if (null === this.Np)
        return;
      const i = t.localX, n = t.localY;
      if (null === this.Ip)
        this.nm(t);
      else {
        this.zp = false;
        const s = b(this.Lp), e2 = s.x + (i - this.Ip.x), r2 = s.y + (n - this.Ip.y);
        this.Gp(e2, r2, t);
      }
    }
    _v(t) {
      0 === this.$v().W().trackingMode.exitMode && (this.zp = true), this.om(), this.sm(t);
    }
    wr(t, i) {
      const n = this.Np;
      return null === n ? null : function(t2, i2, n2) {
        const s = t2.Uo(), e2 = function(t3, i3, n3) {
          var s2, e3;
          let r2, h2;
          for (const o2 of t3) {
            const t4 = null !== (e3 = null === (s2 = o2.va) || void 0 === s2 ? void 0 : s2.call(o2, i3, n3)) && void 0 !== e3 ? e3 : [];
            for (const i4 of t4)
              l2 = i4.zOrder, (!(a2 = null == r2 ? void 0 : r2.zOrder) || "top" === l2 && "top" !== a2 || "normal" === l2 && "bottom" === a2) && (r2 = i4, h2 = o2);
          }
          var l2, a2;
          return r2 && h2 ? { zv: r2, Hc: h2 } : null;
        }(s, i2, n2);
        if ("top" === (null == e2 ? void 0 : e2.zv.zOrder))
          return xs(e2);
        for (const r2 of s) {
          if (e2 && e2.Hc === r2 && "bottom" !== e2.zv.zOrder && !e2.zv.isBackground)
            return xs(e2);
          const s2 = Ss(r2.Pn(t2), i2, n2);
          if (null !== s2)
            return { Hc: r2, Bv: s2.Bv, Iv: s2.Iv };
          if (e2 && e2.Hc === r2 && "bottom" !== e2.zv.zOrder && e2.zv.isBackground)
            return xs(e2);
        }
        return (null == e2 ? void 0 : e2.zv) ? xs(e2) : null;
      }(n, t, i);
    }
    _m(i, n) {
      b("left" === n ? this.Cp : this.Tp).cp(size({ width: i, height: this.Ev.height }));
    }
    um() {
      return this.Ev;
    }
    cp(t) {
      equalSizes(this.Ev, t) || (this.Ev = t, this.jv = true, this.Gv.resizeCanvasElement(t), this.Jv.resizeCanvasElement(t), this.jv = false, this.Wp.style.width = t.width + "px", this.Wp.style.height = t.height + "px");
    }
    dm() {
      const t = b(this.Np);
      t.P_(t.R_()), t.P_(t.D_());
      for (const i of t.Ba())
        if (t.vr(i)) {
          const n = i.Dt();
          null !== n && t.P_(n), i.Vn();
        }
    }
    xp() {
      return this.Gv.bitmapSize;
    }
    Sp(t, i, n) {
      const s = this.xp();
      s.width > 0 && s.height > 0 && t.drawImage(this.Gv.canvasElement, i, n);
    }
    vp(t) {
      if (0 === t)
        return;
      if (null === this.Np)
        return;
      if (t > 1 && this.dm(), null !== this.Cp && this.Cp.vp(t), null !== this.Tp && this.Tp.vp(t), 1 !== t) {
        this.Gv.applySuggestedBitmapSize();
        const t2 = tryCreateCanvasRenderingTarget2D(this.Gv);
        null !== t2 && (t2.useBitmapCoordinateSpace((t3) => {
          this.mp(t3);
        }), this.Np && (this.fm(t2, Ts), this.vm(t2), this.pm(t2), this.fm(t2, Ps), this.fm(t2, Rs)));
      }
      this.Jv.applySuggestedBitmapSize();
      const i = tryCreateCanvasRenderingTarget2D(this.Jv);
      null !== i && (i.useBitmapCoordinateSpace(({ context: t2, bitmapSize: i2 }) => {
        t2.clearRect(0, 0, i2.width, i2.height);
      }), this.bm(i), this.fm(i, Ds));
    }
    wm() {
      return this.Cp;
    }
    gm() {
      return this.Tp;
    }
    bp(t, i) {
      this.fm(t, i);
    }
    Fp() {
      null !== this.Np && this.Np.W_().p(this), this.Np = null;
    }
    tm(t) {
      this.im(this.Vp, t);
    }
    im(t, i) {
      const n = i.localX, s = i.localY;
      t.M() && t.m(this.$i().St().Nu(n), { x: n, y: s }, i);
    }
    mp({ context: t, bitmapSize: i }) {
      const { width: n, height: s } = i, e2 = this.$i(), r2 = e2.q(), h2 = e2.bd();
      r2 === h2 ? G(t, 0, 0, n, s, h2) : tt(t, 0, 0, n, s, r2, h2);
    }
    vm(t) {
      const i = b(this.Np).j_().qh().gt();
      null !== i && i.X(t, false);
    }
    pm(t) {
      const i = this.$i().Yc();
      this.Mm(t, Ps, cs, i), this.Mm(t, Ps, ds, i);
    }
    bm(t) {
      this.Mm(t, Ps, ds, this.$i().Zc());
    }
    fm(t, i) {
      const n = b(this.Np).Uo();
      for (const s of n)
        this.Mm(t, i, cs, s);
      for (const s of n)
        this.Mm(t, i, ds, s);
    }
    Mm(t, i, n, s) {
      const e2 = b(this.Np), r2 = e2.$t().Wc(), h2 = null !== r2 && r2.Hc === s, l2 = null !== r2 && h2 && void 0 !== r2.Iv ? r2.Iv.Mr : void 0;
      fs(i, (i2) => n(i2, t, h2, l2), s, e2);
    }
    Zp() {
      if (null === this.Np)
        return;
      const t = this.Qd, i = this.Np.R_().W().visible, n = this.Np.D_().W().visible;
      i || null === this.Cp || (this.jp.removeChild(this.Cp.lp()), this.Cp.S(), this.Cp = null), n || null === this.Tp || (this.Hp.removeChild(this.Tp.lp()), this.Tp.S(), this.Tp = null);
      const s = t.$t().ud();
      i && null === this.Cp && (this.Cp = new Cs(this, t.W(), s, "left"), this.jp.appendChild(this.Cp.lp())), n && null === this.Tp && (this.Tp = new Cs(this, t.W(), s, "right"), this.Hp.appendChild(this.Tp.lp()));
    }
    xm(t) {
      return t.Dv && this.Ap || null !== this.Ip;
    }
    Sm(t) {
      return Math.max(0, Math.min(t, this.Ev.width - 1));
    }
    km(t) {
      return Math.max(0, Math.min(t, this.Ev.height - 1));
    }
    Gp(t, i, n) {
      this.$i().ld(this.Sm(t), this.km(i), n, b(this.Np));
    }
    hm() {
      this.$i().od();
    }
    om() {
      this.zp && (this.Ip = null, this.hm());
    }
    rm(t, i, n) {
      this.Ip = t, this.zp = false, this.Gp(i.x, i.y, n);
      const s = this.$i().Zc();
      this.Lp = { x: s.Yt(), y: s.Zt() };
    }
    $i() {
      return this.Qd.$t();
    }
    sm(t) {
      if (!this.Dp)
        return;
      const i = this.$i(), n = this.fp();
      if (i.z_(n, n.vn()), this.Rp = null, this.Dp = false, i.ed(), null !== this.Ep) {
        const t2 = performance.now(), n2 = i.St();
        this.Ep.Vr(n2.Hu(), t2), this.Ep.Qu(t2) || i.Zn(this.Ep);
      }
    }
    Kp() {
      this.Ip = null;
    }
    Jp() {
      if (!this.Np)
        return;
      if (this.$i().Un(), document.activeElement !== document.body && document.activeElement !== document.documentElement)
        b(document.activeElement).blur();
      else {
        const t = document.getSelection();
        null !== t && t.removeAllRanges();
      }
      !this.Np.vn().Ni() && this.$i().St().Ni();
    }
    nm(t) {
      if (null === this.Np)
        return;
      const i = this.$i(), n = i.St();
      if (n.Ni())
        return;
      const s = this.Qd.W(), e2 = s.handleScroll, r2 = s.kineticScroll;
      if ((!e2.pressedMouseMove || t.Dv) && (!e2.horzTouchDrag && !e2.vertTouchDrag || !t.Dv))
        return;
      const h2 = this.Np.vn(), l2 = performance.now();
      if (null !== this.Rp || this.xm(t) || (this.Rp = { x: t.clientX, y: t.clientY, Od: l2, ym: t.localX, Cm: t.localY }), null !== this.Rp && !this.Dp && (this.Rp.x !== t.clientX || this.Rp.y !== t.clientY)) {
        if (t.Dv && r2.touch || !t.Dv && r2.mouse) {
          const t2 = n.le();
          this.Ep = new as(0.2 / t2, 7 / t2, 0.997, 15 / t2), this.Ep.Yd(n.Hu(), this.Rp.Od);
        } else
          this.Ep = null;
        h2.Ni() || i.A_(this.Np, h2, t.localY), i.nd(t.localX), this.Dp = true;
      }
      this.Dp && (h2.Ni() || i.I_(this.Np, h2, t.localY), i.sd(t.localX), null !== this.Ep && this.Ep.Yd(n.Hu(), l2));
    }
  };
  var Os = class {
    constructor(i, n, s, e2, r2) {
      this.ft = true, this.Ev = size({ width: 0, height: 0 }), this.Hv = () => this.vp(3), this.qv = "left" === i, this.Oc = s.ud, this.cn = n, this.Tm = e2, this.Pm = r2, this.Kv = document.createElement("div"), this.Kv.style.width = "25px", this.Kv.style.height = "100%", this.Kv.style.overflow = "hidden", this.Gv = _s(this.Kv, size({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
    }
    S() {
      this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), us(this.Gv.canvasElement), this.Gv.dispose();
    }
    lp() {
      return this.Kv;
    }
    um() {
      return this.Ev;
    }
    cp(t) {
      equalSizes(this.Ev, t) || (this.Ev = t, this.Gv.resizeCanvasElement(t), this.Kv.style.width = `${t.width}px`, this.Kv.style.height = `${t.height}px`, this.ft = true);
    }
    vp(t) {
      if (t < 3 && !this.ft)
        return;
      if (0 === this.Ev.width || 0 === this.Ev.height)
        return;
      this.ft = false, this.Gv.applySuggestedBitmapSize();
      const i = tryCreateCanvasRenderingTarget2D(this.Gv);
      null !== i && i.useBitmapCoordinateSpace((t2) => {
        this.mp(t2), this.Ie(t2);
      });
    }
    xp() {
      return this.Gv.bitmapSize;
    }
    Sp(t, i, n) {
      const s = this.xp();
      s.width > 0 && s.height > 0 && t.drawImage(this.Gv.canvasElement, i, n);
    }
    Ie({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
      if (!this.Tm())
        return;
      t.fillStyle = this.cn.timeScale.borderColor;
      const e2 = Math.floor(this.Oc.W().C * n), r2 = Math.floor(this.Oc.W().C * s), h2 = this.qv ? i.width - e2 : 0;
      t.fillRect(h2, 0, e2, r2);
    }
    mp({ context: t, bitmapSize: i }) {
      G(t, 0, 0, i.width, i.height, this.Pm());
    }
  };
  function Bs(t) {
    return (i) => {
      var n, s;
      return null !== (s = null === (n = i.fa) || void 0 === n ? void 0 : n.call(i, t)) && void 0 !== s ? s : [];
    };
  }
  var As = Bs("normal");
  var Is = Bs("top");
  var zs = Bs("bottom");
  var Ls = class {
    constructor(i, n) {
      this.Rm = null, this.Dm = null, this.k = null, this.Vm = false, this.Ev = size({ width: 0, height: 0 }), this.Om = new D(), this.Fv = new ni(5), this.jv = false, this.Hv = () => {
        this.jv || this.Qd.$t().Uh();
      }, this.Uv = () => {
        this.jv || this.Qd.$t().Uh();
      }, this.Qd = i, this.q_ = n, this.cn = i.W().layout, this.Xd = document.createElement("tr"), this.Bm = document.createElement("td"), this.Bm.style.padding = "0", this.Am = document.createElement("td"), this.Am.style.padding = "0", this.Kv = document.createElement("td"), this.Kv.style.height = "25px", this.Kv.style.padding = "0", this.Im = document.createElement("div"), this.Im.style.width = "100%", this.Im.style.height = "100%", this.Im.style.position = "relative", this.Im.style.overflow = "hidden", this.Kv.appendChild(this.Im), this.Gv = _s(this.Im, size({ width: 16, height: 16 })), this.Gv.subscribeSuggestedBitmapSizeChanged(this.Hv);
      const s = this.Gv.canvasElement;
      s.style.position = "absolute", s.style.zIndex = "1", s.style.left = "0", s.style.top = "0", this.Jv = _s(this.Im, size({ width: 16, height: 16 })), this.Jv.subscribeSuggestedBitmapSizeChanged(this.Uv);
      const e2 = this.Jv.canvasElement;
      e2.style.position = "absolute", e2.style.zIndex = "2", e2.style.left = "0", e2.style.top = "0", this.Xd.appendChild(this.Bm), this.Xd.appendChild(this.Kv), this.Xd.appendChild(this.Am), this.zm(), this.Qd.$t().g_().l(this.zm.bind(this), this), this.hp = new ps(this.Jv.canvasElement, this, { ev: () => true, rv: () => !this.Qd.W().handleScroll.horzTouchDrag });
    }
    S() {
      this.hp.S(), null !== this.Rm && this.Rm.S(), null !== this.Dm && this.Dm.S(), this.Jv.unsubscribeSuggestedBitmapSizeChanged(this.Uv), us(this.Jv.canvasElement), this.Jv.dispose(), this.Gv.unsubscribeSuggestedBitmapSizeChanged(this.Hv), us(this.Gv.canvasElement), this.Gv.dispose();
    }
    lp() {
      return this.Xd;
    }
    Lm() {
      return this.Rm;
    }
    Em() {
      return this.Dm;
    }
    bv(t) {
      if (this.Vm)
        return;
      this.Vm = true;
      const i = this.Qd.$t();
      !i.St().Ni() && this.Qd.W().handleScale.axisPressedMouseMove.time && i.Jc(t.localX);
    }
    pv(t) {
      this.bv(t);
    }
    wv() {
      const t = this.Qd.$t();
      !t.St().Ni() && this.Vm && (this.Vm = false, this.Qd.W().handleScale.axisPressedMouseMove.time && t.hd());
    }
    av(t) {
      const i = this.Qd.$t();
      !i.St().Ni() && this.Qd.W().handleScale.axisPressedMouseMove.time && i.rd(t.localX);
    }
    hv(t) {
      this.av(t);
    }
    cv() {
      this.Vm = false;
      const t = this.Qd.$t();
      t.St().Ni() && !this.Qd.W().handleScale.axisPressedMouseMove.time || t.hd();
    }
    _v() {
      this.cv();
    }
    qf() {
      this.Qd.W().handleScale.axisDoubleClickReset.time && this.Qd.$t().Kn();
    }
    jf() {
      this.qf();
    }
    Qf() {
      this.Qd.$t().W().handleScale.axisPressedMouseMove.time && this.kp(1);
    }
    Pv() {
      this.kp(0);
    }
    um() {
      return this.Ev;
    }
    Nm() {
      return this.Om;
    }
    Fm(i, s, e2) {
      equalSizes(this.Ev, i) || (this.Ev = i, this.jv = true, this.Gv.resizeCanvasElement(i), this.Jv.resizeCanvasElement(i), this.jv = false, this.Kv.style.width = `${i.width}px`, this.Kv.style.height = `${i.height}px`, this.Om.m(i)), null !== this.Rm && this.Rm.cp(size({ width: s, height: i.height })), null !== this.Dm && this.Dm.cp(size({ width: e2, height: i.height }));
    }
    Wm() {
      const t = this.jm();
      return Math.ceil(t.C + t.T + t.P + t.L + t.B + t.Hm);
    }
    bt() {
      this.Qd.$t().St().Ha();
    }
    xp() {
      return this.Gv.bitmapSize;
    }
    Sp(t, i, n) {
      const s = this.xp();
      s.width > 0 && s.height > 0 && t.drawImage(this.Gv.canvasElement, i, n);
    }
    vp(t) {
      if (0 === t)
        return;
      if (1 !== t) {
        this.Gv.applySuggestedBitmapSize();
        const i2 = tryCreateCanvasRenderingTarget2D(this.Gv);
        null !== i2 && (i2.useBitmapCoordinateSpace((t2) => {
          this.mp(t2), this.Ie(t2), this.$m(i2, zs);
        }), this.wp(i2), this.$m(i2, As)), null !== this.Rm && this.Rm.vp(t), null !== this.Dm && this.Dm.vp(t);
      }
      this.Jv.applySuggestedBitmapSize();
      const i = tryCreateCanvasRenderingTarget2D(this.Jv);
      null !== i && (i.useBitmapCoordinateSpace(({ context: t2, bitmapSize: i2 }) => {
        t2.clearRect(0, 0, i2.width, i2.height);
      }), this.Um([...this.Qd.$t().wt(), this.Qd.$t().Zc()], i), this.$m(i, Is));
    }
    $m(t, i) {
      const n = this.Qd.$t().wt();
      for (const s of n)
        fs(i, (i2) => cs(i2, t, false, void 0), s, void 0);
      for (const s of n)
        fs(i, (i2) => ds(i2, t, false, void 0), s, void 0);
    }
    mp({ context: t, bitmapSize: i }) {
      G(t, 0, 0, i.width, i.height, this.Qd.$t().bd());
    }
    Ie({ context: t, bitmapSize: i, verticalPixelRatio: n }) {
      if (this.Qd.W().timeScale.borderVisible) {
        t.fillStyle = this.qm();
        const s = Math.max(1, Math.floor(this.jm().C * n));
        t.fillRect(0, 0, i.width, s);
      }
    }
    wp(t) {
      const i = this.Qd.$t().St(), n = i.Ha();
      if (!n || 0 === n.length)
        return;
      const s = this.q_.maxTickMarkWeight(n), e2 = this.jm(), r2 = i.W();
      r2.borderVisible && r2.ticksVisible && t.useBitmapCoordinateSpace(({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) => {
        t2.strokeStyle = this.qm(), t2.fillStyle = this.qm();
        const r3 = Math.max(1, Math.floor(i2)), h2 = Math.floor(0.5 * i2);
        t2.beginPath();
        const l2 = Math.round(e2.T * s2);
        for (let s3 = n.length; s3--; ) {
          const e3 = Math.round(n[s3].coord * i2);
          t2.rect(e3 - h2, 0, r3, l2);
        }
        t2.fill();
      }), t.useMediaCoordinateSpace(({ context: t2 }) => {
        const i2 = e2.C + e2.T + e2.L + e2.P / 2;
        t2.textAlign = "center", t2.textBaseline = "middle", t2.fillStyle = this.$(), t2.font = this._p();
        for (const e3 of n)
          if (e3.weight < s) {
            const n2 = e3.needAlignCoordinate ? this.Ym(t2, e3.coord, e3.label) : e3.coord;
            t2.fillText(e3.label, n2, i2);
          }
        this.Qd.W().timeScale.allowBoldLabels && (t2.font = this.Zm());
        for (const e3 of n)
          if (e3.weight >= s) {
            const n2 = e3.needAlignCoordinate ? this.Ym(t2, e3.coord, e3.label) : e3.coord;
            t2.fillText(e3.label, n2, i2);
          }
      });
    }
    Ym(t, i, n) {
      const s = this.Fv.xi(t, n), e2 = s / 2, r2 = Math.floor(i - e2) + 0.5;
      return r2 < 0 ? i += Math.abs(0 - r2) : r2 + s > this.Ev.width && (i -= Math.abs(this.Ev.width - (r2 + s))), i;
    }
    Um(t, i) {
      const n = this.jm();
      for (const s of t)
        for (const t2 of s.Qi())
          t2.gt().X(i, n);
    }
    qm() {
      return this.Qd.W().timeScale.borderColor;
    }
    $() {
      return this.cn.textColor;
    }
    j() {
      return this.cn.fontSize;
    }
    _p() {
      return F(this.j(), this.cn.fontFamily);
    }
    Zm() {
      return F(this.j(), this.cn.fontFamily, "bold");
    }
    jm() {
      null === this.k && (this.k = { C: 1, N: NaN, L: NaN, B: NaN, ji: NaN, T: 5, P: NaN, R: "", Wi: new ni(), Hm: 0 });
      const t = this.k, i = this._p();
      if (t.R !== i) {
        const n = this.j();
        t.P = n, t.R = i, t.L = 3 * n / 12, t.B = 3 * n / 12, t.ji = 9 * n / 12, t.N = 0, t.Hm = 4 * n / 12, t.Wi.nr();
      }
      return this.k;
    }
    kp(t) {
      this.Kv.style.cursor = 1 === t ? "ew-resize" : "default";
    }
    zm() {
      const t = this.Qd.$t(), i = t.W();
      i.leftPriceScale.visible || null === this.Rm || (this.Bm.removeChild(this.Rm.lp()), this.Rm.S(), this.Rm = null), i.rightPriceScale.visible || null === this.Dm || (this.Am.removeChild(this.Dm.lp()), this.Dm.S(), this.Dm = null);
      const n = { ud: this.Qd.$t().ud() }, s = () => i.leftPriceScale.borderVisible && t.St().W().borderVisible, e2 = () => t.bd();
      i.leftPriceScale.visible && null === this.Rm && (this.Rm = new Os("left", i, n, s, e2), this.Bm.appendChild(this.Rm.lp())), i.rightPriceScale.visible && null === this.Dm && (this.Dm = new Os("right", i, n, s, e2), this.Am.appendChild(this.Dm.lp()));
    }
  };
  var Es = !!ns && !!navigator.userAgentData && navigator.userAgentData.brands.some((t) => t.brand.includes("Chromium")) && !!ns && ((null === (Ns = null === navigator || void 0 === navigator ? void 0 : navigator.userAgentData) || void 0 === Ns ? void 0 : Ns.platform) ? "Windows" === navigator.userAgentData.platform : navigator.userAgent.toLowerCase().indexOf("win") >= 0);
  var Ns;
  var Fs = class {
    constructor(t, i, n) {
      var s;
      this.Xm = [], this.Km = 0, this.ho = 0, this.__ = 0, this.Gm = 0, this.Jm = 0, this.Qm = null, this.tb = false, this.Vp = new D(), this.Op = new D(), this.Rc = new D(), this.ib = null, this.nb = null, this.Jd = t, this.cn = i, this.q_ = n, this.Xd = document.createElement("div"), this.Xd.classList.add("tv-lightweight-charts"), this.Xd.style.overflow = "hidden", this.Xd.style.direction = "ltr", this.Xd.style.width = "100%", this.Xd.style.height = "100%", (s = this.Xd).style.userSelect = "none", s.style.webkitUserSelect = "none", s.style.msUserSelect = "none", s.style.MozUserSelect = "none", s.style.webkitTapHighlightColor = "transparent", this.sb = document.createElement("table"), this.sb.setAttribute("cellspacing", "0"), this.Xd.appendChild(this.sb), this.eb = this.rb.bind(this), Ws(this.cn) && this.hb(true), this.$i = new Ln(this.Vc.bind(this), this.cn, n), this.$t().Xc().l(this.lb.bind(this), this), this.ab = new Ls(this, this.q_), this.sb.appendChild(this.ab.lp());
      const e2 = i.autoSize && this.ob();
      let r2 = this.cn.width, h2 = this.cn.height;
      if (e2 || 0 === r2 || 0 === h2) {
        const i2 = t.getBoundingClientRect();
        r2 = r2 || i2.width, h2 = h2 || i2.height;
      }
      this._b(r2, h2), this.ub(), t.appendChild(this.Xd), this.cb(), this.$i.St().ec().l(this.$i.Kl.bind(this.$i), this), this.$i.g_().l(this.$i.Kl.bind(this.$i), this);
    }
    $t() {
      return this.$i;
    }
    W() {
      return this.cn;
    }
    Yp() {
      return this.Xm;
    }
    fb() {
      return this.ab;
    }
    S() {
      this.hb(false), 0 !== this.Km && window.cancelAnimationFrame(this.Km), this.$i.Xc().p(this), this.$i.St().ec().p(this), this.$i.g_().p(this), this.$i.S();
      for (const t of this.Xm)
        this.sb.removeChild(t.lp()), t.lm().p(this), t.am().p(this), t.S();
      this.Xm = [], b(this.ab).S(), null !== this.Xd.parentElement && this.Xd.parentElement.removeChild(this.Xd), this.Rc.S(), this.Vp.S(), this.Op.S(), this.pb();
    }
    _b(i, n, s = false) {
      if (this.ho === n && this.__ === i)
        return;
      const e2 = function(i2) {
        const n2 = Math.floor(i2.width), s2 = Math.floor(i2.height);
        return size({ width: n2 - n2 % 2, height: s2 - s2 % 2 });
      }(size({ width: i, height: n }));
      this.ho = e2.height, this.__ = e2.width;
      const r2 = this.ho + "px", h2 = this.__ + "px";
      b(this.Xd).style.height = r2, b(this.Xd).style.width = h2, this.sb.style.height = r2, this.sb.style.width = h2, s ? this.mb(ut.es(), performance.now()) : this.$i.Kl();
    }
    vp(t) {
      void 0 === t && (t = ut.es());
      for (let i = 0; i < this.Xm.length; i++)
        this.Xm[i].vp(t.Hn(i).Fn);
      this.cn.timeScale.visible && this.ab.vp(t.jn());
    }
    $h(t) {
      const i = Ws(this.cn);
      this.$i.$h(t);
      const n = Ws(this.cn);
      n !== i && this.hb(n), this.cb(), this.bb(t);
    }
    lm() {
      return this.Vp;
    }
    am() {
      return this.Op;
    }
    Xc() {
      return this.Rc;
    }
    wb() {
      null !== this.Qm && (this.mb(this.Qm, performance.now()), this.Qm = null);
      const t = this.gb(null), i = document.createElement("canvas");
      i.width = t.width, i.height = t.height;
      const n = b(i.getContext("2d"));
      return this.gb(n), i;
    }
    Mb(t) {
      if ("left" === t && !this.xb())
        return 0;
      if ("right" === t && !this.Sb())
        return 0;
      if (0 === this.Xm.length)
        return 0;
      return b("left" === t ? this.Xm[0].wm() : this.Xm[0].gm()).dp();
    }
    kb() {
      return this.cn.autoSize && null !== this.ib;
    }
    yb() {
      return this.Xd;
    }
    Qp(t) {
      this.nb = t, this.nb ? this.yb().style.setProperty("cursor", t) : this.yb().style.removeProperty("cursor");
    }
    Cb() {
      return this.nb;
    }
    Tb() {
      return m(this.Xm[0]).um();
    }
    bb(t) {
      (void 0 !== t.autoSize || !this.ib || void 0 === t.width && void 0 === t.height) && (t.autoSize && !this.ib && this.ob(), false === t.autoSize && null !== this.ib && this.pb(), t.autoSize || void 0 === t.width && void 0 === t.height || this._b(t.width || this.__, t.height || this.ho));
    }
    gb(i) {
      let n = 0, s = 0;
      const e2 = this.Xm[0], r2 = (t, n2) => {
        let s2 = 0;
        for (let e3 = 0; e3 < this.Xm.length; e3++) {
          const r3 = this.Xm[e3], h3 = b("left" === t ? r3.wm() : r3.gm()), l2 = h3.xp();
          null !== i && h3.Sp(i, n2, s2), s2 += l2.height;
        }
      };
      if (this.xb()) {
        r2("left", 0);
        n += b(e2.wm()).xp().width;
      }
      for (let t = 0; t < this.Xm.length; t++) {
        const e3 = this.Xm[t], r3 = e3.xp();
        null !== i && e3.Sp(i, n, s), s += r3.height;
      }
      if (n += e2.xp().width, this.Sb()) {
        r2("right", n);
        n += b(e2.gm()).xp().width;
      }
      const h2 = (t, n2, s2) => {
        b("left" === t ? this.ab.Lm() : this.ab.Em()).Sp(b(i), n2, s2);
      };
      if (this.cn.timeScale.visible) {
        const t = this.ab.xp();
        if (null !== i) {
          let n2 = 0;
          this.xb() && (h2("left", n2, s), n2 = b(e2.wm()).xp().width), this.ab.Sp(i, n2, s), n2 += t.width, this.Sb() && h2("right", n2, s);
        }
        s += t.height;
      }
      return size({ width: n, height: s });
    }
    Pb() {
      let i = 0, n = 0, s = 0;
      for (const t of this.Xm)
        this.xb() && (n = Math.max(n, b(t.wm()).op(), this.cn.leftPriceScale.minimumWidth)), this.Sb() && (s = Math.max(s, b(t.gm()).op(), this.cn.rightPriceScale.minimumWidth)), i += t.M_();
      n = rs(n), s = rs(s);
      const e2 = this.__, r2 = this.ho, h2 = Math.max(e2 - n - s, 0), l2 = this.cn.timeScale.visible;
      let a2 = l2 ? Math.max(this.ab.Wm(), this.cn.timeScale.minimumHeight) : 0;
      var o2;
      a2 = (o2 = a2) + o2 % 2;
      const _2 = 0 + a2, u2 = r2 < _2 ? 0 : r2 - _2, c2 = u2 / i;
      let d2 = 0;
      for (let i2 = 0; i2 < this.Xm.length; ++i2) {
        const e3 = this.Xm[i2];
        e3.qp(this.$i.qc()[i2]);
        let r3 = 0, l3 = 0;
        l3 = i2 === this.Xm.length - 1 ? u2 - d2 : Math.round(e3.M_() * c2), r3 = Math.max(l3, 2), d2 += r3, e3.cp(size({ width: h2, height: r3 })), this.xb() && e3._m(n, "left"), this.Sb() && e3._m(s, "right"), e3.fp() && this.$i.Kc(e3.fp(), r3);
      }
      this.ab.Fm(size({ width: l2 ? h2 : 0, height: a2 }), l2 ? n : 0, l2 ? s : 0), this.$i.S_(h2), this.Gm !== n && (this.Gm = n), this.Jm !== s && (this.Jm = s);
    }
    hb(t) {
      t ? this.Xd.addEventListener("wheel", this.eb, { passive: false }) : this.Xd.removeEventListener("wheel", this.eb);
    }
    Rb(t) {
      switch (t.deltaMode) {
        case t.DOM_DELTA_PAGE:
          return 120;
        case t.DOM_DELTA_LINE:
          return 32;
      }
      return Es ? 1 / window.devicePixelRatio : 1;
    }
    rb(t) {
      if (!(0 !== t.deltaX && this.cn.handleScroll.mouseWheel || 0 !== t.deltaY && this.cn.handleScale.mouseWheel))
        return;
      const i = this.Rb(t), n = i * t.deltaX / 100, s = -i * t.deltaY / 100;
      if (t.cancelable && t.preventDefault(), 0 !== s && this.cn.handleScale.mouseWheel) {
        const i2 = Math.sign(s) * Math.min(1, Math.abs(s)), n2 = t.clientX - this.Xd.getBoundingClientRect().left;
        this.$t().Qc(n2, i2);
      }
      0 !== n && this.cn.handleScroll.mouseWheel && this.$t().td(-80 * n);
    }
    mb(t, i) {
      var n;
      const s = t.jn();
      3 === s && this.Db(), 3 !== s && 2 !== s || (this.Vb(t), this.Ob(t, i), this.ab.bt(), this.Xm.forEach((t2) => {
        t2.Xp();
      }), 3 === (null === (n = this.Qm) || void 0 === n ? void 0 : n.jn()) && (this.Qm.ts(t), this.Db(), this.Vb(this.Qm), this.Ob(this.Qm, i), t = this.Qm, this.Qm = null)), this.vp(t);
    }
    Ob(t, i) {
      for (const n of t.Qn())
        this.ns(n, i);
    }
    Vb(t) {
      const i = this.$i.qc();
      for (let n = 0; n < i.length; n++)
        t.Hn(n).Wn && i[n].N_();
    }
    ns(t, i) {
      const n = this.$i.St();
      switch (t.qn) {
        case 0:
          n.hc();
          break;
        case 1:
          n.lc(t.Vt);
          break;
        case 2:
          n.Gn(t.Vt);
          break;
        case 3:
          n.Jn(t.Vt);
          break;
        case 4:
          n.qu();
          break;
        case 5:
          t.Vt.Qu(i) || n.Jn(t.Vt.tc(i));
      }
    }
    Vc(t) {
      null !== this.Qm ? this.Qm.ts(t) : this.Qm = t, this.tb || (this.tb = true, this.Km = window.requestAnimationFrame((t2) => {
        if (this.tb = false, this.Km = 0, null !== this.Qm) {
          const i = this.Qm;
          this.Qm = null, this.mb(i, t2);
          for (const n of i.Qn())
            if (5 === n.qn && !n.Vt.Qu(t2)) {
              this.$t().Zn(n.Vt);
              break;
            }
        }
      }));
    }
    Db() {
      this.ub();
    }
    ub() {
      const t = this.$i.qc(), i = t.length, n = this.Xm.length;
      for (let t2 = i; t2 < n; t2++) {
        const t3 = m(this.Xm.pop());
        this.sb.removeChild(t3.lp()), t3.lm().p(this), t3.am().p(this), t3.S();
      }
      for (let s = n; s < i; s++) {
        const i2 = new Vs(this, t[s]);
        i2.lm().l(this.Bb.bind(this), this), i2.am().l(this.Ab.bind(this), this), this.Xm.push(i2), this.sb.insertBefore(i2.lp(), this.ab.lp());
      }
      for (let n2 = 0; n2 < i; n2++) {
        const i2 = t[n2], s = this.Xm[n2];
        s.fp() !== i2 ? s.qp(i2) : s.Up();
      }
      this.cb(), this.Pb();
    }
    Ib(t, i, n) {
      var s;
      const e2 = /* @__PURE__ */ new Map();
      if (null !== t) {
        this.$i.wt().forEach((i2) => {
          const n2 = i2.In().ll(t);
          null !== n2 && e2.set(i2, n2);
        });
      }
      let r2;
      if (null !== t) {
        const i2 = null === (s = this.$i.St().Ui(t)) || void 0 === s ? void 0 : s.originalTime;
        void 0 !== i2 && (r2 = i2);
      }
      const h2 = this.$t().Wc(), l2 = null !== h2 && h2.Hc instanceof Gi ? h2.Hc : void 0, a2 = null !== h2 && void 0 !== h2.Iv ? h2.Iv.gr : void 0;
      return { zb: r2, ee: null != t ? t : void 0, Lb: null != i ? i : void 0, Eb: l2, Nb: e2, Fb: a2, Wb: null != n ? n : void 0 };
    }
    Bb(t, i, n) {
      this.Vp.m(() => this.Ib(t, i, n));
    }
    Ab(t, i, n) {
      this.Op.m(() => this.Ib(t, i, n));
    }
    lb(t, i, n) {
      this.Rc.m(() => this.Ib(t, i, n));
    }
    cb() {
      const t = this.cn.timeScale.visible ? "" : "none";
      this.ab.lp().style.display = t;
    }
    xb() {
      return this.Xm[0].fp().R_().W().visible;
    }
    Sb() {
      return this.Xm[0].fp().D_().W().visible;
    }
    ob() {
      return "ResizeObserver" in window && (this.ib = new ResizeObserver((t) => {
        const i = t.find((t2) => t2.target === this.Jd);
        i && this._b(i.contentRect.width, i.contentRect.height);
      }), this.ib.observe(this.Jd, { box: "border-box" }), true);
    }
    pb() {
      null !== this.ib && this.ib.disconnect(), this.ib = null;
    }
  };
  function Ws(t) {
    return Boolean(t.handleScroll.mouseWheel || t.handleScale.mouseWheel);
  }
  function js(t) {
    return function(t2) {
      return void 0 !== t2.open;
    }(t) || function(t2) {
      return void 0 !== t2.value;
    }(t);
  }
  function Hs(t, i) {
    var n = {};
    for (var s in t)
      Object.prototype.hasOwnProperty.call(t, s) && i.indexOf(s) < 0 && (n[s] = t[s]);
    if (null != t && "function" == typeof Object.getOwnPropertySymbols) {
      var e2 = 0;
      for (s = Object.getOwnPropertySymbols(t); e2 < s.length; e2++)
        i.indexOf(s[e2]) < 0 && Object.prototype.propertyIsEnumerable.call(t, s[e2]) && (n[s[e2]] = t[s[e2]]);
    }
    return n;
  }
  function $s(t, i, n, s) {
    const e2 = n.value, r2 = { ee: i, ot: t, Vt: [e2, e2, e2, e2], zb: s };
    return void 0 !== n.color && (r2.V = n.color), r2;
  }
  function Us(t, i, n, s) {
    const e2 = n.value, r2 = { ee: i, ot: t, Vt: [e2, e2, e2, e2], zb: s };
    return void 0 !== n.lineColor && (r2.lt = n.lineColor), void 0 !== n.topColor && (r2.Ps = n.topColor), void 0 !== n.bottomColor && (r2.Rs = n.bottomColor), r2;
  }
  function qs(t, i, n, s) {
    const e2 = n.value, r2 = { ee: i, ot: t, Vt: [e2, e2, e2, e2], zb: s };
    return void 0 !== n.topLineColor && (r2.Re = n.topLineColor), void 0 !== n.bottomLineColor && (r2.De = n.bottomLineColor), void 0 !== n.topFillColor1 && (r2.ke = n.topFillColor1), void 0 !== n.topFillColor2 && (r2.ye = n.topFillColor2), void 0 !== n.bottomFillColor1 && (r2.Ce = n.bottomFillColor1), void 0 !== n.bottomFillColor2 && (r2.Te = n.bottomFillColor2), r2;
  }
  function Ys(t, i, n, s) {
    const e2 = { ee: i, ot: t, Vt: [n.open, n.high, n.low, n.close], zb: s };
    return void 0 !== n.color && (e2.V = n.color), e2;
  }
  function Zs(t, i, n, s) {
    const e2 = { ee: i, ot: t, Vt: [n.open, n.high, n.low, n.close], zb: s };
    return void 0 !== n.color && (e2.V = n.color), void 0 !== n.borderColor && (e2.Ot = n.borderColor), void 0 !== n.wickColor && (e2.Xh = n.wickColor), e2;
  }
  function Xs(t, i, n, s, e2) {
    const r2 = m(e2)(n), h2 = Math.max(...r2), l2 = Math.min(...r2), a2 = r2[r2.length - 1], o2 = [a2, h2, l2, a2], _2 = n, { time: u2, color: c2 } = _2;
    return { ee: i, ot: t, Vt: o2, zb: s, $e: Hs(_2, ["time", "color"]), V: c2 };
  }
  function Ks(t) {
    return void 0 !== t.Vt;
  }
  function Gs(t, i) {
    return void 0 !== i.customValues && (t.jb = i.customValues), t;
  }
  function Js(t) {
    return (i, n, s, e2, r2, h2) => function(t2, i2) {
      return i2 ? i2(t2) : void 0 === (n2 = t2).open && void 0 === n2.value;
      var n2;
    }(s, h2) ? Gs({ ot: i, ee: n, zb: e2 }, s) : Gs(t(i, n, s, e2, r2), s);
  }
  function Qs(t) {
    return { Candlestick: Js(Zs), Bar: Js(Ys), Area: Js(Us), Baseline: Js(qs), Histogram: Js($s), Line: Js($s), Custom: Js(Xs) }[t];
  }
  function te(t) {
    return { ee: 0, Hb: /* @__PURE__ */ new Map(), la: t };
  }
  function ie(t, i) {
    if (void 0 !== t && 0 !== t.length)
      return { $b: i.key(t[0].ot), Ub: i.key(t[t.length - 1].ot) };
  }
  function ne(t) {
    let i;
    return t.forEach((t2) => {
      void 0 === i && (i = t2.zb);
    }), m(i);
  }
  var se = class {
    constructor(t) {
      this.qb = /* @__PURE__ */ new Map(), this.Yb = /* @__PURE__ */ new Map(), this.Zb = /* @__PURE__ */ new Map(), this.Xb = [], this.q_ = t;
    }
    S() {
      this.qb.clear(), this.Yb.clear(), this.Zb.clear(), this.Xb = [];
    }
    Kb(t, i) {
      let n = 0 !== this.qb.size, s = false;
      const e2 = this.Yb.get(t);
      if (void 0 !== e2)
        if (1 === this.Yb.size)
          n = false, s = true, this.qb.clear();
        else
          for (const i2 of this.Xb)
            i2.pointData.Hb.delete(t) && (s = true);
      let r2 = [];
      if (0 !== i.length) {
        const n2 = i.map((t2) => t2.time), e3 = this.q_.createConverterToInternalObj(i), h3 = Qs(t.Qh()), l2 = t.Ca(), a2 = t.Ta();
        r2 = i.map((i2, r3) => {
          const o2 = e3(i2.time), _2 = this.q_.key(o2);
          let u2 = this.qb.get(_2);
          void 0 === u2 && (u2 = te(o2), this.qb.set(_2, u2), s = true);
          const c2 = h3(o2, u2.ee, i2, n2[r3], l2, a2);
          return u2.Hb.set(t, c2), c2;
        });
      }
      n && this.Gb(), this.Jb(t, r2);
      let h2 = -1;
      if (s) {
        const t2 = [];
        this.qb.forEach((i2) => {
          t2.push({ timeWeight: 0, time: i2.la, pointData: i2, originalTime: ne(i2.Hb) });
        }), t2.sort((t3, i2) => this.q_.key(t3.time) - this.q_.key(i2.time)), h2 = this.Qb(t2);
      }
      return this.tw(t, h2, function(t2, i2, n2) {
        const s2 = ie(t2, n2), e3 = ie(i2, n2);
        if (void 0 !== s2 && void 0 !== e3)
          return { ta: s2.Ub >= e3.Ub && s2.$b >= e3.$b };
      }(this.Yb.get(t), e2, this.q_));
    }
    vd(t) {
      return this.Kb(t, []);
    }
    iw(t, i) {
      const n = i;
      !function(t2) {
        void 0 === t2.zb && (t2.zb = t2.time);
      }(n), this.q_.preprocessData(i);
      const s = this.q_.createConverterToInternalObj([i])(i.time), e2 = this.Zb.get(t);
      if (void 0 !== e2 && this.q_.key(s) < this.q_.key(e2))
        throw new Error(`Cannot update oldest data, last time=${e2}, new time=${s}`);
      let r2 = this.qb.get(this.q_.key(s));
      const h2 = void 0 === r2;
      void 0 === r2 && (r2 = te(s), this.qb.set(this.q_.key(s), r2));
      const l2 = Qs(t.Qh()), a2 = t.Ca(), o2 = t.Ta(), _2 = l2(s, r2.ee, i, n.zb, a2, o2);
      r2.Hb.set(t, _2), this.nw(t, _2);
      const u2 = { ta: Ks(_2) };
      if (!h2)
        return this.tw(t, -1, u2);
      const c2 = { timeWeight: 0, time: r2.la, pointData: r2, originalTime: ne(r2.Hb) }, d2 = Bt(this.Xb, this.q_.key(c2.time), (t2, i2) => this.q_.key(t2.time) < i2);
      this.Xb.splice(d2, 0, c2);
      for (let t2 = d2; t2 < this.Xb.length; ++t2)
        ee(this.Xb[t2].pointData, t2);
      return this.q_.fillWeightsForPoints(this.Xb, d2), this.tw(t, d2, u2);
    }
    nw(t, i) {
      let n = this.Yb.get(t);
      void 0 === n && (n = [], this.Yb.set(t, n));
      const s = 0 !== n.length ? n[n.length - 1] : null;
      null === s || this.q_.key(i.ot) > this.q_.key(s.ot) ? Ks(i) && n.push(i) : Ks(i) ? n[n.length - 1] = i : n.splice(-1, 1), this.Zb.set(t, i.ot);
    }
    Jb(t, i) {
      0 !== i.length ? (this.Yb.set(t, i.filter(Ks)), this.Zb.set(t, i[i.length - 1].ot)) : (this.Yb.delete(t), this.Zb.delete(t));
    }
    Gb() {
      for (const t of this.Xb)
        0 === t.pointData.Hb.size && this.qb.delete(this.q_.key(t.time));
    }
    Qb(t) {
      let i = -1;
      for (let n = 0; n < this.Xb.length && n < t.length; ++n) {
        const s = this.Xb[n], e2 = t[n];
        if (this.q_.key(s.time) !== this.q_.key(e2.time)) {
          i = n;
          break;
        }
        e2.timeWeight = s.timeWeight, ee(e2.pointData, n);
      }
      if (-1 === i && this.Xb.length !== t.length && (i = Math.min(this.Xb.length, t.length)), -1 === i)
        return -1;
      for (let n = i; n < t.length; ++n)
        ee(t[n].pointData, n);
      return this.q_.fillWeightsForPoints(t, i), this.Xb = t, i;
    }
    sw() {
      if (0 === this.Yb.size)
        return null;
      let t = 0;
      return this.Yb.forEach((i) => {
        0 !== i.length && (t = Math.max(t, i[i.length - 1].ee));
      }), t;
    }
    tw(t, i, n) {
      const s = { ew: /* @__PURE__ */ new Map(), St: { Eu: this.sw() } };
      if (-1 !== i)
        this.Yb.forEach((i2, e2) => {
          s.ew.set(e2, { $e: i2, rw: e2 === t ? n : void 0 });
        }), this.Yb.has(t) || s.ew.set(t, { $e: [], rw: n }), s.St.hw = this.Xb, s.St.lw = i;
      else {
        const i2 = this.Yb.get(t);
        s.ew.set(t, { $e: i2 || [], rw: n });
      }
      return s;
    }
  };
  function ee(t, i) {
    t.ee = i, t.Hb.forEach((t2) => {
      t2.ee = i;
    });
  }
  function re(t) {
    const i = { value: t.Vt[3], time: t.zb };
    return void 0 !== t.jb && (i.customValues = t.jb), i;
  }
  function he(t) {
    const i = re(t);
    return void 0 !== t.V && (i.color = t.V), i;
  }
  function le(t) {
    const i = re(t);
    return void 0 !== t.lt && (i.lineColor = t.lt), void 0 !== t.Ps && (i.topColor = t.Ps), void 0 !== t.Rs && (i.bottomColor = t.Rs), i;
  }
  function ae(t) {
    const i = re(t);
    return void 0 !== t.Re && (i.topLineColor = t.Re), void 0 !== t.De && (i.bottomLineColor = t.De), void 0 !== t.ke && (i.topFillColor1 = t.ke), void 0 !== t.ye && (i.topFillColor2 = t.ye), void 0 !== t.Ce && (i.bottomFillColor1 = t.Ce), void 0 !== t.Te && (i.bottomFillColor2 = t.Te), i;
  }
  function oe(t) {
    const i = { open: t.Vt[0], high: t.Vt[1], low: t.Vt[2], close: t.Vt[3], time: t.zb };
    return void 0 !== t.jb && (i.customValues = t.jb), i;
  }
  function _e(t) {
    const i = oe(t);
    return void 0 !== t.V && (i.color = t.V), i;
  }
  function ue(t) {
    const i = oe(t), { V: n, Ot: s, Xh: e2 } = t;
    return void 0 !== n && (i.color = n), void 0 !== s && (i.borderColor = s), void 0 !== e2 && (i.wickColor = e2), i;
  }
  function ce(t) {
    return { Area: le, Line: he, Baseline: ae, Histogram: he, Bar: _e, Candlestick: ue, Custom: de }[t];
  }
  function de(t) {
    const i = t.zb;
    return Object.assign(Object.assign({}, t.$e), { time: i });
  }
  var fe = { vertLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, horzLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, mode: 1 };
  var ve = { vertLines: { color: "#D6DCDE", style: 0, visible: true }, horzLines: { color: "#D6DCDE", style: 0, visible: true } };
  var pe = { background: { type: "solid", color: "#FFFFFF" }, textColor: "#191919", fontSize: 12, fontFamily: N, attributionLogo: true };
  var me = { autoScale: true, mode: 0, invertScale: false, alignLabels: true, borderVisible: true, borderColor: "#2B2B43", entireTextOnly: false, visible: false, ticksVisible: false, scaleMargins: { bottom: 0.1, top: 0.2 }, minimumWidth: 0 };
  var be = { rightOffset: 0, barSpacing: 6, minBarSpacing: 0.5, fixLeftEdge: false, fixRightEdge: false, lockVisibleTimeRangeOnResize: false, rightBarStaysOnScroll: false, borderVisible: true, borderColor: "#2B2B43", visible: true, timeVisible: false, secondsVisible: true, shiftVisibleRangeOnNewBar: true, allowShiftVisibleRangeOnWhitespaceReplacement: false, ticksVisible: false, uniformDistribution: false, minimumHeight: 0, allowBoldLabels: true };
  var we = { color: "rgba(0, 0, 0, 0)", visible: false, fontSize: 48, fontFamily: N, fontStyle: "", text: "", horzAlign: "center", vertAlign: "center" };
  function ge() {
    return { width: 0, height: 0, autoSize: false, layout: pe, crosshair: fe, grid: ve, overlayPriceScales: Object.assign({}, me), leftPriceScale: Object.assign(Object.assign({}, me), { visible: false }), rightPriceScale: Object.assign(Object.assign({}, me), { visible: true }), timeScale: be, watermark: we, localization: { locale: ns ? navigator.language : "", dateFormat: "dd MMM 'yy" }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true }, kineticScroll: { mouse: false, touch: true }, trackingMode: { exitMode: 1 } };
  }
  var Me = class {
    constructor(t, i) {
      this.aw = t, this.ow = i;
    }
    applyOptions(t) {
      this.aw.$t().$c(this.ow, t);
    }
    options() {
      return this.Li().W();
    }
    width() {
      return _t(this.ow) ? this.aw.Mb(this.ow) : 0;
    }
    Li() {
      return b(this.aw.$t().Uc(this.ow)).Dt;
    }
  };
  function xe(t, i, n) {
    const s = Hs(t, ["time", "originalTime"]), e2 = Object.assign({ time: i }, s);
    return void 0 !== n && (e2.originalTime = n), e2;
  }
  var Se = { color: "#FF0000", price: 0, lineStyle: 2, lineWidth: 1, lineVisible: true, axisLabelVisible: true, title: "", axisLabelColor: "", axisLabelTextColor: "" };
  var ke = class {
    constructor(t) {
      this.Nh = t;
    }
    applyOptions(t) {
      this.Nh.$h(t);
    }
    options() {
      return this.Nh.W();
    }
    _w() {
      return this.Nh;
    }
  };
  var ye = class {
    constructor(t, i, n, s, e2) {
      this.uw = new D(), this.Es = t, this.cw = i, this.dw = n, this.q_ = e2, this.fw = s;
    }
    S() {
      this.uw.S();
    }
    priceFormatter() {
      return this.Es.ba();
    }
    priceToCoordinate(t) {
      const i = this.Es.Ct();
      return null === i ? null : this.Es.Dt().Rt(t, i.Vt);
    }
    coordinateToPrice(t) {
      const i = this.Es.Ct();
      return null === i ? null : this.Es.Dt().pn(t, i.Vt);
    }
    barsInLogicalRange(t) {
      if (null === t)
        return null;
      const i = new yn(new xn(t.from, t.to)).lu(), n = this.Es.In();
      if (n.Ni())
        return null;
      const s = n.ll(i.Os(), 1), e2 = n.ll(i.ui(), -1), r2 = b(n.el()), h2 = b(n.An());
      if (null !== s && null !== e2 && s.ee > e2.ee)
        return { barsBefore: t.from - r2, barsAfter: h2 - t.to };
      const l2 = { barsBefore: null === s || s.ee === r2 ? t.from - r2 : s.ee - r2, barsAfter: null === e2 || e2.ee === h2 ? h2 - t.to : h2 - e2.ee };
      return null !== s && null !== e2 && (l2.from = s.zb, l2.to = e2.zb), l2;
    }
    setData(t) {
      this.q_, this.Es.Qh(), this.cw.pw(this.Es, t), this.mw("full");
    }
    update(t) {
      this.Es.Qh(), this.cw.bw(this.Es, t), this.mw("update");
    }
    dataByIndex(t, i) {
      const n = this.Es.In().ll(t, i);
      if (null === n)
        return null;
      return ce(this.seriesType())(n);
    }
    data() {
      const t = ce(this.seriesType());
      return this.Es.In().ne().map((i) => t(i));
    }
    subscribeDataChanged(t) {
      this.uw.l(t);
    }
    unsubscribeDataChanged(t) {
      this.uw.v(t);
    }
    setMarkers(t) {
      this.q_;
      const i = t.map((t2) => xe(t2, this.q_.convertHorzItemToInternal(t2.time), t2.time));
      this.Es.na(i);
    }
    markers() {
      return this.Es.sa().map((t) => xe(t, t.originalTime, void 0));
    }
    applyOptions(t) {
      this.Es.$h(t);
    }
    options() {
      return z(this.Es.W());
    }
    priceScale() {
      return this.dw.priceScale(this.Es.Dt().Pa());
    }
    createPriceLine(t) {
      const i = V(z(Se), t), n = this.Es.ea(i);
      return new ke(n);
    }
    removePriceLine(t) {
      this.Es.ra(t._w());
    }
    seriesType() {
      return this.Es.Qh();
    }
    attachPrimitive(t) {
      this.Es.ka(t), t.attached && t.attached({ chart: this.fw, series: this, requestUpdate: () => this.Es.$t().Kl() });
    }
    detachPrimitive(t) {
      this.Es.ya(t), t.detached && t.detached();
    }
    mw(t) {
      this.uw.M() && this.uw.m(t);
    }
  };
  var Ce = class {
    constructor(t, i, n) {
      this.ww = new D(), this.mu = new D(), this.Om = new D(), this.$i = t, this.yl = t.St(), this.ab = i, this.yl.nc().l(this.gw.bind(this)), this.yl.sc().l(this.Mw.bind(this)), this.ab.Nm().l(this.xw.bind(this)), this.q_ = n;
    }
    S() {
      this.yl.nc().p(this), this.yl.sc().p(this), this.ab.Nm().p(this), this.ww.S(), this.mu.S(), this.Om.S();
    }
    scrollPosition() {
      return this.yl.Hu();
    }
    scrollToPosition(t, i) {
      i ? this.yl.Ju(t, 1e3) : this.$i.Jn(t);
    }
    scrollToRealTime() {
      this.yl.Gu();
    }
    getVisibleRange() {
      const t = this.yl.Vu();
      return null === t ? null : { from: t.from.originalTime, to: t.to.originalTime };
    }
    setVisibleRange(t) {
      const i = { from: this.q_.convertHorzItemToInternal(t.from), to: this.q_.convertHorzItemToInternal(t.to) }, n = this.yl.Iu(i);
      this.$i.pd(n);
    }
    getVisibleLogicalRange() {
      const t = this.yl.Du();
      return null === t ? null : { from: t.Os(), to: t.ui() };
    }
    setVisibleLogicalRange(t) {
      p(t.from <= t.to, "The from index cannot be after the to index."), this.$i.pd(t);
    }
    resetTimeScale() {
      this.$i.Kn();
    }
    fitContent() {
      this.$i.hc();
    }
    logicalToCoordinate(t) {
      const i = this.$i.St();
      return i.Ni() ? null : i.It(t);
    }
    coordinateToLogical(t) {
      return this.yl.Ni() ? null : this.yl.Nu(t);
    }
    timeToCoordinate(t) {
      const i = this.q_.convertHorzItemToInternal(t), n = this.yl.Va(i, false);
      return null === n ? null : this.yl.It(n);
    }
    coordinateToTime(t) {
      const i = this.$i.St(), n = i.Nu(t), s = i.Ui(n);
      return null === s ? null : s.originalTime;
    }
    width() {
      return this.ab.um().width;
    }
    height() {
      return this.ab.um().height;
    }
    subscribeVisibleTimeRangeChange(t) {
      this.ww.l(t);
    }
    unsubscribeVisibleTimeRangeChange(t) {
      this.ww.v(t);
    }
    subscribeVisibleLogicalRangeChange(t) {
      this.mu.l(t);
    }
    unsubscribeVisibleLogicalRangeChange(t) {
      this.mu.v(t);
    }
    subscribeSizeChange(t) {
      this.Om.l(t);
    }
    unsubscribeSizeChange(t) {
      this.Om.v(t);
    }
    applyOptions(t) {
      this.yl.$h(t);
    }
    options() {
      return Object.assign(Object.assign({}, z(this.yl.W())), { barSpacing: this.yl.le() });
    }
    gw() {
      this.ww.M() && this.ww.m(this.getVisibleRange());
    }
    Mw() {
      this.mu.M() && this.mu.m(this.getVisibleLogicalRange());
    }
    xw(t) {
      this.Om.m(t.width, t.height);
    }
  };
  function Te(t) {
    if (void 0 === t || "custom" === t.type)
      return;
    const i = t;
    void 0 !== i.minMove && void 0 === i.precision && (i.precision = function(t2) {
      if (t2 >= 1)
        return 0;
      let i2 = 0;
      for (; i2 < 8; i2++) {
        const n = Math.round(t2);
        if (Math.abs(n - t2) < 1e-8)
          return i2;
        t2 *= 10;
      }
      return i2;
    }(i.minMove));
  }
  function Pe(t) {
    return function(t2) {
      if (I(t2.handleScale)) {
        const i2 = t2.handleScale;
        t2.handleScale = { axisDoubleClickReset: { time: i2, price: i2 }, axisPressedMouseMove: { time: i2, price: i2 }, mouseWheel: i2, pinch: i2 };
      } else if (void 0 !== t2.handleScale) {
        const { axisPressedMouseMove: i2, axisDoubleClickReset: n } = t2.handleScale;
        I(i2) && (t2.handleScale.axisPressedMouseMove = { time: i2, price: i2 }), I(n) && (t2.handleScale.axisDoubleClickReset = { time: n, price: n });
      }
      const i = t2.handleScroll;
      I(i) && (t2.handleScroll = { horzTouchDrag: i, vertTouchDrag: i, mouseWheel: i, pressedMouseMove: i });
    }(t), t;
  }
  var Re = class {
    constructor(t, i, n) {
      this.Sw = /* @__PURE__ */ new Map(), this.kw = /* @__PURE__ */ new Map(), this.yw = new D(), this.Cw = new D(), this.Tw = new D(), this.Pw = new se(i);
      const s = void 0 === n ? z(ge()) : V(z(ge()), Pe(n));
      this.q_ = i, this.aw = new Fs(t, s, i), this.aw.lm().l((t2) => {
        this.yw.M() && this.yw.m(this.Rw(t2()));
      }, this), this.aw.am().l((t2) => {
        this.Cw.M() && this.Cw.m(this.Rw(t2()));
      }, this), this.aw.Xc().l((t2) => {
        this.Tw.M() && this.Tw.m(this.Rw(t2()));
      }, this);
      const e2 = this.aw.$t();
      this.Dw = new Ce(e2, this.aw.fb(), this.q_);
    }
    remove() {
      this.aw.lm().p(this), this.aw.am().p(this), this.aw.Xc().p(this), this.Dw.S(), this.aw.S(), this.Sw.clear(), this.kw.clear(), this.yw.S(), this.Cw.S(), this.Tw.S(), this.Pw.S();
    }
    resize(t, i, n) {
      this.autoSizeActive() || this.aw._b(t, i, n);
    }
    addCustomSeries(t, i) {
      const n = w(t), s = Object.assign(Object.assign({}, _), n.defaultOptions());
      return this.Vw("Custom", s, i, n);
    }
    addAreaSeries(t) {
      return this.Vw("Area", l, t);
    }
    addBaselineSeries(t) {
      return this.Vw("Baseline", a, t);
    }
    addBarSeries(t) {
      return this.Vw("Bar", r, t);
    }
    addCandlestickSeries(t = {}) {
      return function(t2) {
        void 0 !== t2.borderColor && (t2.borderUpColor = t2.borderColor, t2.borderDownColor = t2.borderColor), void 0 !== t2.wickColor && (t2.wickUpColor = t2.wickColor, t2.wickDownColor = t2.wickColor);
      }(t), this.Vw("Candlestick", e, t);
    }
    addHistogramSeries(t) {
      return this.Vw("Histogram", o, t);
    }
    addLineSeries(t) {
      return this.Vw("Line", h, t);
    }
    removeSeries(t) {
      const i = m(this.Sw.get(t)), n = this.Pw.vd(i);
      this.aw.$t().vd(i), this.Ow(n), this.Sw.delete(t), this.kw.delete(i);
    }
    pw(t, i) {
      this.Ow(this.Pw.Kb(t, i));
    }
    bw(t, i) {
      this.Ow(this.Pw.iw(t, i));
    }
    subscribeClick(t) {
      this.yw.l(t);
    }
    unsubscribeClick(t) {
      this.yw.v(t);
    }
    subscribeCrosshairMove(t) {
      this.Tw.l(t);
    }
    unsubscribeCrosshairMove(t) {
      this.Tw.v(t);
    }
    subscribeDblClick(t) {
      this.Cw.l(t);
    }
    unsubscribeDblClick(t) {
      this.Cw.v(t);
    }
    priceScale(t) {
      return new Me(this.aw, t);
    }
    timeScale() {
      return this.Dw;
    }
    applyOptions(t) {
      this.aw.$h(Pe(t));
    }
    options() {
      return this.aw.W();
    }
    takeScreenshot() {
      return this.aw.wb();
    }
    autoSizeActive() {
      return this.aw.kb();
    }
    chartElement() {
      return this.aw.yb();
    }
    paneSize() {
      const t = this.aw.Tb();
      return { height: t.height, width: t.width };
    }
    setCrosshairPosition(t, i, n) {
      const s = this.Sw.get(n);
      if (void 0 === s)
        return;
      const e2 = this.aw.$t().dr(s);
      null !== e2 && this.aw.$t().ad(t, i, e2);
    }
    clearCrosshairPosition() {
      this.aw.$t().od(true);
    }
    Vw(t, i, n = {}, s) {
      Te(n.priceFormat);
      const e2 = V(z(u), z(i), n), r2 = this.aw.$t().dd(t, e2, s), h2 = new ye(r2, this, this, this, this.q_);
      return this.Sw.set(h2, r2), this.kw.set(r2, h2), h2;
    }
    Ow(t) {
      const i = this.aw.$t();
      i._d(t.St.Eu, t.St.hw, t.St.lw), t.ew.forEach((t2, i2) => i2.J(t2.$e, t2.rw)), i.Wu();
    }
    Bw(t) {
      return m(this.kw.get(t));
    }
    Rw(t) {
      const i = /* @__PURE__ */ new Map();
      t.Nb.forEach((t2, n2) => {
        const s = n2.Qh(), e2 = ce(s)(t2);
        if ("Custom" !== s)
          p(js(e2));
        else {
          const t3 = n2.Ta();
          p(!t3 || false === t3(e2));
        }
        i.set(this.Bw(n2), e2);
      });
      const n = void 0 !== t.Eb && this.kw.has(t.Eb) ? this.Bw(t.Eb) : void 0;
      return { time: t.zb, logical: t.ee, point: t.Lb, hoveredSeries: n, hoveredObjectId: t.Fb, seriesData: i, sourceEvent: t.Wb };
    }
  };
  function De(t, i, n) {
    let s;
    if (A(t)) {
      const i2 = document.getElementById(t);
      p(null !== i2, `Cannot find element in DOM with id=${t}`), s = i2;
    } else
      s = t;
    const e2 = new Re(s, i, n);
    return i.setOptions(e2.options()), e2;
  }
  function Ve(t, i) {
    return De(t, new is(), is.Id(i));
  }
  var Be = Object.assign(Object.assign({}, u), _);

  // node_modules/technicalindicators/lib/Utils/LinkedList.js
  var Item = class {
    constructor(data, prev, next) {
      this.next = next;
      if (next)
        next.prev = this;
      this.prev = prev;
      if (prev)
        prev.next = this;
      this.data = data;
    }
  };
  var LinkedList = class {
    constructor() {
      this._length = 0;
    }
    get head() {
      return this._head && this._head.data;
    }
    get tail() {
      return this._tail && this._tail.data;
    }
    get current() {
      return this._current && this._current.data;
    }
    get length() {
      return this._length;
    }
    push(data) {
      this._tail = new Item(data, this._tail);
      if (this._length === 0) {
        this._head = this._tail;
        this._current = this._head;
        this._next = this._head;
      }
      this._length++;
    }
    pop() {
      var tail = this._tail;
      if (this._length === 0) {
        return;
      }
      this._length--;
      if (this._length === 0) {
        this._head = this._tail = this._current = this._next = void 0;
        return tail.data;
      }
      this._tail = tail.prev;
      this._tail.next = void 0;
      if (this._current === tail) {
        this._current = this._tail;
        this._next = void 0;
      }
      return tail.data;
    }
    shift() {
      var head = this._head;
      if (this._length === 0) {
        return;
      }
      this._length--;
      if (this._length === 0) {
        this._head = this._tail = this._current = this._next = void 0;
        return head.data;
      }
      this._head = this._head.next;
      if (this._current === head) {
        this._current = this._head;
        this._next = this._current.next;
      }
      return head.data;
    }
    unshift(data) {
      this._head = new Item(data, void 0, this._head);
      if (this._length === 0) {
        this._tail = this._head;
        this._next = this._head;
      }
      this._length++;
    }
    unshiftCurrent() {
      var current = this._current;
      if (current === this._head || this._length < 2) {
        return current && current.data;
      }
      if (current === this._tail) {
        this._tail = current.prev;
        this._tail.next = void 0;
        this._current = this._tail;
      } else {
        current.next.prev = current.prev;
        current.prev.next = current.next;
        this._current = current.prev;
      }
      this._next = this._current.next;
      current.next = this._head;
      current.prev = void 0;
      this._head.prev = current;
      this._head = current;
      return current.data;
    }
    removeCurrent() {
      var current = this._current;
      if (this._length === 0) {
        return;
      }
      this._length--;
      if (this._length === 0) {
        this._head = this._tail = this._current = this._next = void 0;
        return current.data;
      }
      if (current === this._tail) {
        this._tail = current.prev;
        this._tail.next = void 0;
        this._current = this._tail;
      } else if (current === this._head) {
        this._head = current.next;
        this._head.prev = void 0;
        this._current = this._head;
      } else {
        current.next.prev = current.prev;
        current.prev.next = current.next;
        this._current = current.prev;
      }
      this._next = this._current.next;
      return current.data;
    }
    resetCursor() {
      this._current = this._next = this._head;
      return this;
    }
    next() {
      var next = this._next;
      if (next !== void 0) {
        this._next = next.next;
        this._current = next;
        return next.data;
      }
    }
  };

  // node_modules/technicalindicators/lib/Utils/FixedSizeLinkedList.js
  var FixedSizeLinkedList = class extends LinkedList {
    constructor(size2, maintainHigh, maintainLow, maintainSum) {
      super();
      this.size = size2;
      this.maintainHigh = maintainHigh;
      this.maintainLow = maintainLow;
      this.maintainSum = maintainSum;
      this.totalPushed = 0;
      this.periodHigh = 0;
      this.periodLow = Infinity;
      this.periodSum = 0;
      if (!size2 || typeof size2 !== "number") {
        throw "Size required and should be a number.";
      }
      this._push = this.push;
      this.push = function(data) {
        this.add(data);
        this.totalPushed++;
      };
    }
    add(data) {
      if (this.length === this.size) {
        this.lastShift = this.shift();
        this._push(data);
        if (this.maintainHigh) {
          if (this.lastShift == this.periodHigh)
            this.calculatePeriodHigh();
        }
        if (this.maintainLow) {
          if (this.lastShift == this.periodLow)
            this.calculatePeriodLow();
        }
        if (this.maintainSum) {
          this.periodSum = this.periodSum - this.lastShift;
        }
      } else {
        this._push(data);
      }
      if (this.maintainHigh) {
        if (this.periodHigh <= data)
          this.periodHigh = data;
      }
      if (this.maintainLow) {
        if (this.periodLow >= data)
          this.periodLow = data;
      }
      if (this.maintainSum) {
        this.periodSum = this.periodSum + data;
      }
    }
    *iterator() {
      this.resetCursor();
      while (this.next()) {
        yield this.current;
      }
    }
    calculatePeriodHigh() {
      this.resetCursor();
      if (this.next())
        this.periodHigh = this.current;
      while (this.next()) {
        if (this.periodHigh <= this.current) {
          this.periodHigh = this.current;
        }
        ;
      }
      ;
    }
    calculatePeriodLow() {
      this.resetCursor();
      if (this.next())
        this.periodLow = this.current;
      while (this.next()) {
        if (this.periodLow >= this.current) {
          this.periodLow = this.current;
        }
        ;
      }
      ;
    }
  };

  // node_modules/technicalindicators/lib/config.js
  var config = {};
  function getConfig(key) {
    return config[key];
  }

  // node_modules/technicalindicators/lib/Utils/NumberFormatter.js
  function format(v2) {
    let precision = getConfig("precision");
    if (precision) {
      return parseFloat(v2.toPrecision(precision));
    }
    return v2;
  }

  // node_modules/technicalindicators/lib/indicator/indicator.js
  var Indicator = class {
    constructor(input) {
      this.format = input.format || format;
    }
    static reverseInputs(input) {
      if (input.reversedInput) {
        input.values ? input.values.reverse() : void 0;
        input.open ? input.open.reverse() : void 0;
        input.high ? input.high.reverse() : void 0;
        input.low ? input.low.reverse() : void 0;
        input.close ? input.close.reverse() : void 0;
        input.volume ? input.volume.reverse() : void 0;
        input.timestamp ? input.timestamp.reverse() : void 0;
      }
    }
    getResult() {
      return this.result;
    }
  };

  // node_modules/technicalindicators/lib/moving_averages/SMA.js
  var SMA = class extends Indicator {
    constructor(input) {
      super(input);
      this.period = input.period;
      this.price = input.values;
      var genFn = function* (period) {
        var list = new LinkedList();
        var sum = 0;
        var counter = 1;
        var current = yield;
        var result;
        list.push(0);
        while (true) {
          if (counter < period) {
            counter++;
            list.push(current);
            sum = sum + current;
          } else {
            sum = sum - list.shift() + current;
            result = sum / period;
            list.push(current);
          }
          current = yield result;
        }
      };
      this.generator = genFn(this.period);
      this.generator.next();
      this.result = [];
      this.price.forEach((tick) => {
        var result = this.generator.next(tick);
        if (result.value !== void 0) {
          this.result.push(this.format(result.value));
        }
      });
    }
    nextValue(price) {
      var result = this.generator.next(price).value;
      if (result != void 0)
        return this.format(result);
    }
  };
  SMA.calculate = sma;
  function sma(input) {
    Indicator.reverseInputs(input);
    var result = new SMA(input).result;
    if (input.reversedInput) {
      result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
  }

  // node_modules/technicalindicators/lib/moving_averages/EMA.js
  var EMA = class extends Indicator {
    constructor(input) {
      super(input);
      var period = input.period;
      var priceArray = input.values;
      var exponent = 2 / (period + 1);
      var sma2;
      this.result = [];
      sma2 = new SMA({ period, values: [] });
      var genFn = function* () {
        var tick = yield;
        var prevEma;
        while (true) {
          if (prevEma !== void 0 && tick !== void 0) {
            prevEma = (tick - prevEma) * exponent + prevEma;
            tick = yield prevEma;
          } else {
            tick = yield;
            prevEma = sma2.nextValue(tick);
            if (prevEma)
              tick = yield prevEma;
          }
        }
      };
      this.generator = genFn();
      this.generator.next();
      this.generator.next();
      priceArray.forEach((tick) => {
        var result = this.generator.next(tick);
        if (result.value != void 0) {
          this.result.push(this.format(result.value));
        }
      });
    }
    nextValue(price) {
      var result = this.generator.next(price).value;
      if (result != void 0)
        return this.format(result);
    }
  };
  EMA.calculate = ema;
  function ema(input) {
    Indicator.reverseInputs(input);
    var result = new EMA(input).result;
    if (input.reversedInput) {
      result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
  }

  // node_modules/technicalindicators/lib/Utils/SD.js
  var SD = class extends Indicator {
    constructor(input) {
      super(input);
      var period = input.period;
      var priceArray = input.values;
      var sma2 = new SMA({ period, values: [], format: (v2) => {
        return v2;
      } });
      this.result = [];
      this.generator = function* () {
        var tick;
        var mean;
        var currentSet = new FixedSizeLinkedList(period);
        ;
        tick = yield;
        var sd2;
        while (true) {
          currentSet.push(tick);
          mean = sma2.nextValue(tick);
          if (mean) {
            let sum = 0;
            for (let x2 of currentSet.iterator()) {
              sum = sum + Math.pow(x2 - mean, 2);
            }
            sd2 = Math.sqrt(sum / period);
          }
          tick = yield sd2;
        }
      }();
      this.generator.next();
      priceArray.forEach((tick) => {
        var result = this.generator.next(tick);
        if (result.value != void 0) {
          this.result.push(this.format(result.value));
        }
      });
    }
    nextValue(price) {
      var nextResult = this.generator.next(price);
      if (nextResult.value != void 0)
        return this.format(nextResult.value);
    }
  };
  SD.calculate = sd;
  function sd(input) {
    Indicator.reverseInputs(input);
    var result = new SD(input).result;
    if (input.reversedInput) {
      result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
  }

  // node_modules/technicalindicators/lib/volatility/BollingerBands.js
  var BollingerBands = class extends Indicator {
    constructor(input) {
      super(input);
      var period = input.period;
      var priceArray = input.values;
      var stdDev = input.stdDev;
      var format2 = this.format;
      var sma2, sd2;
      this.result = [];
      sma2 = new SMA({ period, values: [], format: (v2) => {
        return v2;
      } });
      sd2 = new SD({ period, values: [], format: (v2) => {
        return v2;
      } });
      this.generator = function* () {
        var result;
        var tick;
        var calcSMA;
        var calcsd;
        tick = yield;
        while (true) {
          calcSMA = sma2.nextValue(tick);
          calcsd = sd2.nextValue(tick);
          if (calcSMA) {
            let middle = format2(calcSMA);
            let upper = format2(calcSMA + calcsd * stdDev);
            let lower = format2(calcSMA - calcsd * stdDev);
            let pb = format2((tick - lower) / (upper - lower));
            result = {
              middle,
              upper,
              lower,
              pb
            };
          }
          tick = yield result;
        }
      }();
      this.generator.next();
      priceArray.forEach((tick) => {
        var result = this.generator.next(tick);
        if (result.value != void 0) {
          this.result.push(result.value);
        }
      });
    }
    nextValue(price) {
      return this.generator.next(price).value;
    }
  };
  BollingerBands.calculate = bollingerbands;
  function bollingerbands(input) {
    Indicator.reverseInputs(input);
    var result = new BollingerBands(input).result;
    if (input.reversedInput) {
      result.reverse();
    }
    Indicator.reverseInputs(input);
    return result;
  }

  // client.js
  var tickersInput = document.getElementById("tickers-input");
  var intervalSelect = document.getElementById("interval-select");
  var startButton = document.getElementById("start-button");
  var chartsContainer = document.getElementById("charts-container");
  var statusMessage = document.getElementById("status-message");
  var stockToggle = document.getElementById("stockToggle");
  var usdJpyToggle = document.getElementById("usdJpyToggle");
  var tickersInputGroup = tickersInput.closest(".input-group");
  var toggleBbButton = document.getElementById("toggle-bb-button");
  var toggleEmaButton = document.getElementById("toggle-ema-button");
  var bbPeriodInput = document.getElementById("bb-period");
  var ema1PeriodInput = document.getElementById("ema1-period");
  var ema2PeriodInput = document.getElementById("ema2-period");
  var ema3PeriodInput = document.getElementById("ema3-period");
  var applyIndicatorsButton = document.getElementById("apply-indicators-button");
  var toggleSettingsButton = document.getElementById("toggle-settings-button");
  var indicatorSettings = document.getElementById("indicator-settings");
  var toggleSubscribeButton = document.getElementById("toggle-subscribe-button");
  var subscribeSettings = document.getElementById("subscribe-settings");
  var emailInput = document.getElementById("email-input");
  var subscribeButton = document.getElementById("subscribe-button");
  var toggleEmailListButton = document.getElementById("toggle-email-list-button");
  var emailListPanel = document.getElementById("email-list-panel");
  var emailList = document.getElementById("email-list");
  var chartObjects = [];
  var updateIntervalId = null;
  var currentDataType = "stock";
  var currentInterval = "1d";
  var currentTickers = [];
  var areBollingerBandsVisible = true;
  var areEmaVisible = true;
  async function refreshChartData() {
    statusMessage.textContent = `\u66F4\u65B0\u4E2D: ${currentDataType === "stock" ? currentTickers.join(", ") : "USD/JPY"} (${currentInterval}) - \u30C7\u30FC\u30BF\u53D6\u5F97\u4E2D...`;
    for (const chartObj of chartObjects) {
      let data;
      try {
        if (currentDataType === "stock") {
          data = await fetchStockData(chartObj.ticker, currentInterval);
        } else {
          data = await fetchUsdJpyData(chartObj.interval);
        }
        if (!data || data.length < 20) {
          console.warn(`Not enough data to update indicators for ${chartObj.ticker}.`);
          continue;
        }
        const closePrices = data.map((d2) => d2.close);
        const bbPeriod = parseInt(bbPeriodInput.value) || 20;
        const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
        const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };
        const bb1 = BollingerBands.calculate(bbInput1);
        const bb2 = BollingerBands.calculate(bbInput2);
        const emaPeriods = [
          { period: parseInt(ema1PeriodInput.value) || 10, color: "yellow" },
          { period: parseInt(ema2PeriodInput.value) || 25, color: "yellow" },
          { period: parseInt(ema3PeriodInput.value) || 50, color: "yellow" }
        ];
        const emaDataArray = emaPeriods.map(({ period }) => {
          const emaInput = { period, values: closePrices, exact: false };
          const ema2 = EMA.calculate(emaInput);
          const emaOffset = data.length - ema2.length;
          return ema2.map((d2, i) => ({ time: data[i + emaOffset].time, value: d2 }));
        });
        const dataOffset = data.length - bb1.length;
        const middleBandData = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.middle }));
        const upperBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
        const lowerBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
        const upperBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
        const lowerBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
        chartObj.candleSeries.setData(data);
        chartObj.middleBandSeries.setData(middleBandData);
        chartObj.upperBand1Series.setData(upperBand1Data);
        chartObj.lowerBand1Series.setData(lowerBand1Data);
        chartObj.upperBand2Series.setData(upperBand2Data);
        chartObj.lowerBand2Series.setData(lowerBand2Data);
        if (chartObj.emaSeriesArray && chartObj.emaSeriesArray.length > 0) {
          chartObj.emaSeriesArray.forEach((emaSeries, index) => {
            emaSeries.setData(emaDataArray[index]);
          });
        }
      } catch (error) {
        console.error(`Failed to refresh data for ${chartObj.ticker}:`, error);
        statusMessage.textContent = `\u30A8\u30E9\u30FC: ${chartObj.ticker} \u306E\u30C7\u30FC\u30BF\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002`;
      }
    }
    statusMessage.textContent = `\u8868\u793A\u4E2D: ${currentDataType === "stock" ? currentTickers.join(", ") : "USD/JPY"} (${currentInterval}) - 60\u79D2\u3054\u3068\u306B\u66F4\u65B0`;
  }
  var stockIntervalOptions = [
    { value: "5m", text: "5\u5206" },
    { value: "15m", text: "15\u5206" },
    { value: "30m", text: "30\u5206" },
    { value: "1h", text: "1\u6642\u9593" },
    { value: "1d", text: "\u65E5\u8DB3" },
    { value: "1wk", text: "1\u9031\u9593" }
  ];
  var usdJpyIntervalOptions = [
    { value: "5m", text: "5\u5206" },
    { value: "15m", text: "15\u5206" },
    { value: "30m", text: "30\u5206" },
    { value: "1h", text: "1\u6642\u9593" },
    { value: "1d", text: "\u65E5\u8DB3" },
    { value: "1wk", text: "1\u9031\u9593" }
  ];
  function updateIntervalOptions(options, defaultValue) {
    intervalSelect.innerHTML = "";
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.text;
      intervalSelect.appendChild(opt);
    });
    intervalSelect.value = options.some((opt) => opt.value === defaultValue) ? defaultValue : options[0].value;
  }
  var chartLayoutOptions = {
    layout: {
      background: { color: "#0a0a0a" },
      textColor: "#ffffff"
    },
    grid: {
      vertLines: { color: "rgba(255, 255, 255, 0.15)" },
      horzLines: { color: "rgba(255, 255, 255, 0.15)" }
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: "#555555",
      localization: {
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1e3);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const isIntraday = currentInterval.includes("m") || currentInterval.includes("h");
          if (isIntraday) {
            const hours = date.getHours().toString().padStart(2, "0");
            const minutes = date.getMinutes().toString().padStart(2, "0");
            return `${month}\u6708${day}\u65E5 ${hours}:${minutes}`;
          } else {
            return `${month}\u6708${day}\u65E5`;
          }
        }
      }
    }
  };
  function createChart(container, options = {}) {
    const chart = Ve(container, {
      ...chartLayoutOptions,
      ...options,
      width: container.clientWidth,
      height: container.clientHeight
    });
    return chart;
  }
  function updateTickerInputVisibility() {
    if (currentDataType === "usd_jpy") {
      tickersInputGroup.style.display = "none";
    } else {
      tickersInputGroup.style.display = "flex";
    }
  }
  function toggleBollingerBandsVisibility() {
    areBollingerBandsVisible = !areBollingerBandsVisible;
    toggleBbButton.textContent = areBollingerBandsVisible ? "BB\u975E\u8868\u793A" : "BB\u8868\u793A";
    start(currentDataType);
  }
  function toggleEmaVisibility() {
    areEmaVisible = !areEmaVisible;
    toggleEmaButton.textContent = areEmaVisible ? "EMA\u975E\u8868\u793A" : "EMA\u8868\u793A";
    start(currentDataType);
  }
  async function fetchStockData(ticker, interval) {
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/data?ticker=${ticker}&interval=${interval}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const formattedData = data.filter((d2) => d2.date && d2.open && d2.high && d2.low && d2.close).map((d2) => ({
        time: new Date(d2.date).getTime() / 1e3,
        // Convert to UNIX timestamp (seconds)
        open: d2.open,
        high: d2.high,
        low: d2.low,
        close: d2.close
      })).sort((a2, b2) => a2.time - b2.time);
      return formattedData;
    } catch (error) {
      console.error(`Failed to fetch data for ${ticker}:`, error);
      throw error;
    }
  }
  async function fetchUsdJpyData(interval) {
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/usd_jpy_data?interval=${interval}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const formattedData = data.filter((d2) => d2.date && d2.open && d2.high && d2.low && d2.close).map((d2) => ({
        time: new Date(d2.date).getTime() / 1e3,
        // Convert to UNIX timestamp (seconds)
        open: d2.open,
        high: d2.high,
        low: d2.low,
        close: d2.close
      })).sort((a2, b2) => a2.time - b2.time);
      return formattedData;
    } catch (error) {
      console.error(`Failed to fetch USD/JPY data:`, error);
      throw error;
    }
  }
  async function renderChartForTicker(ticker, interval) {
    const sanitizedTicker = ticker.replace(/\./g, "");
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    wrapper.innerHTML = `
        <h2 class="chart-title">${ticker}</h2>
        <div class="chart-container" id="ohlc-${sanitizedTicker}"></div>
    `;
    chartsContainer.appendChild(wrapper);
    let data;
    try {
      data = await fetchStockData(ticker, interval);
      if (!data || data.length < 20) {
        throw new Error("Not enough data to calculate indicators.");
      }
    } catch (error) {
      wrapper.querySelector(`#ohlc-${sanitizedTicker}`).innerText = `Error loading data for ${ticker}: ${error.message}`;
      return;
    }
    const closePrices = data.map((d2) => d2.close);
    const bbPeriod = parseInt(bbPeriodInput.value) || 20;
    const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
    const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };
    const bb1 = BollingerBands.calculate(bbInput1);
    const bb2 = BollingerBands.calculate(bbInput2);
    const emaPeriods = [
      { period: parseInt(ema1PeriodInput.value) || 10, color: "yellow" },
      { period: parseInt(ema2PeriodInput.value) || 25, color: "yellow" },
      { period: parseInt(ema3PeriodInput.value) || 50, color: "yellow" }
    ];
    const emaDataArray = emaPeriods.map(({ period }) => {
      const emaInput = { period, values: closePrices, exact: false };
      const ema2 = EMA.calculate(emaInput);
      const emaOffset = data.length - ema2.length;
      return ema2.map((d2, i) => ({ time: data[i + emaOffset].time, value: d2 }));
    });
    const dataOffset = data.length - bb1.length;
    const middleBandData = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.middle }));
    const upperBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
    const lowerBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
    const upperBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
    const lowerBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
    const ohlcChart = createChart(wrapper.querySelector(`#ohlc-${sanitizedTicker}`));
    const middleBandSeries = ohlcChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB 0\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const upperBand1Series = ohlcChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB +1\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const lowerBand1Series = ohlcChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB -1\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const upperBand2Series = ohlcChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB +2\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const lowerBand2Series = ohlcChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB -2\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    middleBandSeries.setData(middleBandData);
    upperBand1Series.setData(upperBand1Data);
    lowerBand1Series.setData(lowerBand1Data);
    upperBand2Series.setData(upperBand2Data);
    lowerBand2Series.setData(lowerBand2Data);
    const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
      const emaSeries = ohlcChart.addLineSeries({
        color: emaConfig.color,
        lineWidth: 1,
        title: `EMA ${emaConfig.period}`,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        // Enable last value label
        visible: areEmaVisible
      });
      emaSeries.setData(emaDataArray[index]);
      return emaSeries;
    });
    const candleSeries = ohlcChart.addCandlestickSeries({
      upColor: "#ff4c4c",
      downColor: "#4c6aff",
      borderVisible: false,
      wickUpColor: "#ff4c4c",
      wickDownColor: "#4c6aff"
    });
    candleSeries.setData(data);
    return {
      chart: ohlcChart,
      container: wrapper.querySelector(`#ohlc-${sanitizedTicker}`),
      candleSeries,
      middleBandSeries,
      upperBand1Series,
      lowerBand1Series,
      upperBand2Series,
      lowerBand2Series,
      emaSeriesArray,
      // Store EMA series array
      ticker,
      // Store ticker for easy access during updates
      interval
      // Store interval for easy access during updates
    };
  }
  async function renderChartsForStocks(tickers, interval) {
    const renderedCharts = await Promise.all(
      tickers.map((ticker) => renderChartForTicker(ticker, interval))
    );
    chartObjects.push(...renderedCharts);
  }
  async function renderChartForUsdJpy(interval) {
    const defaultInterval = "1d";
    let currentInterval2 = interval;
    let dataFetchAttempted = 0;
    while (dataFetchAttempted < 2) {
      const wrapper = document.createElement("div");
      wrapper.className = "chart-wrapper";
      wrapper.innerHTML = `
            <h2 class="chart-title">USD/JPY</h2>
            <div class="chart-container" id="usd-jpy-chart"></div>
        `;
      chartsContainer.appendChild(wrapper);
      let data;
      let errorMessage = "";
      try {
        data = await fetchUsdJpyData(currentInterval2);
        if (!data || data.length < 20) {
          throw new Error(`Not enough data to calculate indicators for USD/JPY with interval ${currentInterval2}.`);
        }
      } catch (error) {
        errorMessage = `Error loading USD/JPY data for interval '${currentInterval2}': ${error.message}`;
        if (error.message.includes("not supported by Yahoo Finance for currency pairs")) {
          errorMessage = `\u30A8\u30E9\u30FC: \u30C9\u30EB\u5186\u306E '${currentInterval2}' \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB\u306FYahoo Finance\u3067\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u306A\u3044\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002`;
        } else if (error.message.includes("Not enough data")) {
          errorMessage = `\u30A8\u30E9\u30FC: \u30C9\u30EB\u5186\u306E '${currentInterval2}' \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB\u3067\u5341\u5206\u306A\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002`;
        }
        console.error(errorMessage);
        if (currentInterval2 !== defaultInterval && dataFetchAttempted === 0) {
          wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} \u65E5\u8DB3\u3067\u518D\u8A66\u884C\u3057\u307E\u3059...`;
          currentInterval2 = defaultInterval;
          dataFetchAttempted++;
          chartsContainer.innerHTML = "";
          continue;
        } else {
          wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} \u65E5\u8DB3\u30C7\u30FC\u30BF\u3082\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002`;
          return;
        }
      }
      if (data && data.length > 0) {
        if (interval !== currentInterval2) {
          statusMessage.textContent = `\u6CE8\u610F: \u30C9\u30EB\u5186\u306E '${interval}' \u30A4\u30F3\u30BF\u30FC\u30D0\u30EB\u306F\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u65E5\u8DB3\u30C7\u30FC\u30BF\u304C\u8868\u793A\u3055\u308C\u3066\u3044\u307E\u3059\u3002`;
        } else {
          statusMessage.textContent = `\u8868\u793A\u4E2D: USD/JPY (${currentInterval2}) - 60\u79D2\u3054\u3068\u306B\u66F4\u65B0`;
        }
        const closePrices = data.map((d2) => d2.close);
        const bbPeriod = parseInt(bbPeriodInput.value) || 20;
        const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
        const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };
        const bb1 = BollingerBands.calculate(bbInput1);
        const bb2 = BollingerBands.calculate(bbInput2);
        const emaPeriods = [
          { period: parseInt(ema1PeriodInput.value) || 10, color: "yellow" },
          { period: parseInt(ema2PeriodInput.value) || 25, color: "yellow" },
          { period: parseInt(ema3PeriodInput.value) || 50, color: "yellow" }
        ];
        const emaDataArray = emaPeriods.map(({ period }) => {
          const emaInput = { period, values: closePrices, exact: false };
          const ema2 = EMA.calculate(emaInput);
          const emaOffset = data.length - ema2.length;
          return ema2.map((d2, i) => ({ time: data[i + emaOffset].time, value: d2 }));
        });
        const dataOffset = data.length - bb1.length;
        const middleBandData = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.middle }));
        const upperBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
        const lowerBand1Data = bb1.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
        const upperBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.upper }));
        const lowerBand2Data = bb2.map((d2, i) => ({ time: data[i + dataOffset].time, value: d2.lower }));
        const usdJpyChart = createChart(wrapper.querySelector(`#usd-jpy-chart`));
        const middleBandSeries = usdJpyChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB 0\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
        const upperBand1Series = usdJpyChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB +1\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
        const lowerBand1Series = usdJpyChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB -1\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
        const upperBand2Series = usdJpyChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB +2\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
        const lowerBand2Series = usdJpyChart.addLineSeries({ color: "purple", lineWidth: 2, title: "BB -2\u03C3", crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
        middleBandSeries.setData(middleBandData);
        upperBand1Series.setData(upperBand1Data);
        lowerBand1Series.setData(lowerBand1Data);
        upperBand2Series.setData(upperBand2Data);
        lowerBand2Series.setData(lowerBand2Data);
        const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
          const emaSeries = usdJpyChart.addLineSeries({
            color: emaConfig.color,
            lineWidth: 1,
            title: `EMA ${emaConfig.period}`,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            // Enable last value label
            visible: areEmaVisible
          });
          emaSeries.setData(emaDataArray[index]);
          return emaSeries;
        });
        const candleSeries = usdJpyChart.addCandlestickSeries({
          upColor: "#ff4c4c",
          downColor: "#4c6aff",
          borderVisible: false,
          wickUpColor: "#ff4c4c",
          wickDownColor: "#4c6aff"
        });
        candleSeries.setData(data);
        usdJpyChart.timeScale().fitContent();
        return {
          chart: usdJpyChart,
          container: wrapper.querySelector(`#usd-jpy-chart`),
          candleSeries,
          middleBandSeries,
          upperBand1Series,
          lowerBand1Series,
          upperBand2Series,
          lowerBand2Series,
          emaSeriesArray,
          // Store EMA series array
          ticker: "USDJPY=X",
          // Store ticker for easy access during updates
          interval: currentInterval2
          // Store currentInterval as the actual interval used
        };
      }
      dataFetchAttempted++;
    }
    return null;
  }
  async function start(dataType) {
    if (updateIntervalId) {
      clearInterval(updateIntervalId);
    }
    chartsContainer.innerHTML = "";
    chartObjects = [];
    statusMessage.textContent = "\u30C1\u30E3\u30FC\u30C8\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059...";
    currentDataType = dataType;
    if (dataType === "stock") {
      currentTickers = tickersInput.value.split(",").map((t) => t.trim()).filter((t) => t);
      currentInterval = intervalSelect.value;
      const formattedTickers = currentTickers.map((c2) => c2.endsWith(".T") ? c2 : `${c2}.T`);
      await renderChartsForStocks(formattedTickers, currentInterval);
      statusMessage.textContent = `\u8868\u793A\u4E2D: ${formattedTickers.join(", ")} (${currentInterval}) - 60\u79D2\u3054\u3068\u306B\u66F4\u65B0`;
      updateIntervalId = setInterval(refreshChartData, 60 * 1e3);
    } else if (dataType === "usd_jpy") {
      currentTickers = ["USDJPY=X"];
      currentInterval = intervalSelect.value;
      const usdJpyChartObj = await renderChartForUsdJpy(currentInterval);
      if (usdJpyChartObj) {
        chartObjects.push(usdJpyChartObj);
      }
      statusMessage.textContent = `\u8868\u793A\u4E2D: USD/JPY (${currentInterval}) - 60\u79D2\u3054\u3068\u306B\u66F4\u65B0`;
      updateIntervalId = setInterval(refreshChartData, 60 * 1e3);
    }
  }
  window.addEventListener("resize", () => {
    chartObjects.forEach(({ container, chart }) => {
      chart.resize(container.clientWidth, container.clientHeight);
    });
  });
  startButton.addEventListener("click", () => start(currentDataType));
  toggleBbButton.addEventListener("click", toggleBollingerBandsVisibility);
  toggleEmaButton.addEventListener("click", toggleEmaVisibility);
  applyIndicatorsButton.addEventListener("click", () => {
    start(currentDataType);
    indicatorSettings.classList.add("hidden");
  });
  toggleSettingsButton.addEventListener("click", () => {
    indicatorSettings.classList.toggle("hidden");
  });
  toggleSubscribeButton.addEventListener("click", () => {
    subscribeSettings.classList.toggle("hidden");
  });
  subscribeButton.addEventListener("click", async () => {
    const email = emailInput.value;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      statusMessage.textContent = "\u6709\u52B9\u306A\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      return;
    }
    try {
      statusMessage.textContent = "\u767B\u9332\u4E2D...";
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (response.ok) {
        statusMessage.textContent = result.message;
        emailInput.value = "";
        setTimeout(() => {
          subscribeSettings.classList.add("hidden");
        }, 1500);
      } else {
        throw new Error(result.error || "\u767B\u9332\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
      }
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  });
  toggleEmailListButton.addEventListener("click", async () => {
    const isHidden = emailListPanel.classList.contains("hidden");
    if (isHidden) {
      try {
        const response = await fetch("/api/emails");
        if (!response.ok) {
          throw new Error("Could not fetch email list.");
        }
        const emails = await response.json();
        emailList.innerHTML = "";
        if (emails.length === 0) {
          const li2 = document.createElement("li");
          li2.textContent = "\u767B\u9332\u3055\u308C\u3066\u3044\u308B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306F\u3042\u308A\u307E\u305B\u3093\u3002";
          emailList.appendChild(li2);
        } else {
          emails.forEach((item) => {
            const li2 = document.createElement("li");
            li2.textContent = item.email;
            li2.classList.add("email-list-item");
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "\u524A\u9664";
            deleteButton.classList.add("delete-email-button");
            deleteButton.dataset.email = item.email;
            deleteButton.addEventListener("click", async (event) => {
              event.stopPropagation();
              const emailToDelete = event.target.dataset.email;
              await deleteEmail(emailToDelete);
              await refreshEmailList();
            });
            li2.appendChild(deleteButton);
            emailList.appendChild(li2);
          });
        }
        emailListPanel.classList.remove("hidden");
      } catch (error) {
        console.error("Failed to fetch emails:", error);
        statusMessage.textContent = "\u30E1\u30FC\u30EB\u30EA\u30B9\u30C8\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
      }
    } else {
      emailListPanel.classList.add("hidden");
    }
  });
  async function deleteEmail(email) {
    statusMessage.textContent = `\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9 ${email} \u3092\u524A\u9664\u4E2D...`;
    try {
      const response = await fetch(`/api/emails/${email}`, {
        method: "DELETE"
      });
      const result = await response.json();
      if (response.ok) {
        statusMessage.textContent = result.message;
      } else {
        throw new Error(result.error || "\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
      }
    } catch (error) {
      console.error("Email deletion error:", error);
      statusMessage.textContent = error.message;
    }
  }
  async function refreshEmailList() {
    try {
      const response = await fetch("/api/emails");
      if (!response.ok) {
        throw new Error("Could not fetch email list.");
      }
      const emails = await response.json();
      emailList.innerHTML = "";
      if (emails.length === 0) {
        const li2 = document.createElement("li");
        li2.textContent = "\u767B\u9332\u3055\u308C\u3066\u3044\u308B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306F\u3042\u308A\u307E\u305B\u3093\u3002";
        emailList.appendChild(li2);
      } else {
        emails.forEach((item) => {
          const li2 = document.createElement("li");
          li2.textContent = item.email;
          li2.classList.add("email-list-item");
          const deleteButton = document.createElement("button");
          deleteButton.textContent = "\u524A\u9664";
          deleteButton.classList.add("delete-email-button");
          deleteButton.dataset.email = item.email;
          deleteButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            const emailToDelete = event.target.dataset.email;
            await deleteEmail(emailToDelete);
            await refreshEmailList();
          });
          li2.appendChild(deleteButton);
          emailList.appendChild(li2);
        });
      }
    } catch (error) {
      console.error("Failed to refresh email list:", error);
      statusMessage.textContent = "\u30E1\u30FC\u30EB\u30EA\u30B9\u30C8\u306E\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
    }
  }
  stockToggle.addEventListener("click", () => {
    currentDataType = "stock";
    stockToggle.classList.add("active");
    usdJpyToggle.classList.remove("active");
    updateIntervalOptions(stockIntervalOptions, "1d");
    updateTickerInputVisibility();
    start(currentDataType);
  });
  usdJpyToggle.addEventListener("click", () => {
    currentDataType = "usd_jpy";
    usdJpyToggle.classList.add("active");
    stockToggle.classList.remove("active");
    updateIntervalOptions(usdJpyIntervalOptions, "1d");
    updateTickerInputVisibility();
    start(currentDataType);
  });
  if (currentDataType === "stock") {
    stockToggle.classList.add("active");
    updateIntervalOptions(stockIntervalOptions, "1d");
  } else {
    usdJpyToggle.classList.add("active");
    updateIntervalOptions(usdJpyIntervalOptions, "1d");
  }
  updateTickerInputVisibility();
  start(currentDataType);
})();
/*! Bundled license information:

lightweight-charts/dist/lightweight-charts.production.mjs:
  (*!
   * @license
   * TradingView Lightweight Charts™ v4.2.3
   * Copyright (c) 2025 TradingView, Inc.
   * Licensed under Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0
   *)
*/
