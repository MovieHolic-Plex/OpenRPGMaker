"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS({
  "node_modules/pngjs/lib/chunkstream.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var ChunkStream = module2.exports = function() {
      Stream.call(this);
      this._buffers = [];
      this._buffered = 0;
      this._reads = [];
      this._paused = false;
      this._encoding = "utf8";
      this.writable = true;
    };
    util.inherits(ChunkStream, Stream);
    ChunkStream.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
      process.nextTick(function() {
        this._process();
        if (this._paused && this._reads.length > 0) {
          this._paused = false;
          this.emit("drain");
        }
      }.bind(this));
    };
    ChunkStream.prototype.write = function(data, encoding) {
      if (!this.writable) {
        this.emit("error", new Error("Stream not writable"));
        return false;
      }
      var dataBuffer;
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else {
        dataBuffer = new Buffer(data, encoding || this._encoding);
      }
      this._buffers.push(dataBuffer);
      this._buffered += dataBuffer.length;
      this._process();
      if (this._reads && this._reads.length === 0) {
        this._paused = true;
      }
      return this.writable && !this._paused;
    };
    ChunkStream.prototype.end = function(data, encoding) {
      if (data) {
        this.write(data, encoding);
      }
      this.writable = false;
      if (!this._buffers) {
        return;
      }
      if (this._buffers.length === 0) {
        this._end();
      } else {
        this._buffers.push(null);
        this._process();
      }
    };
    ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
    ChunkStream.prototype._end = function() {
      if (this._reads.length > 0) {
        this.emit(
          "error",
          new Error("Unexpected end of input")
        );
      }
      this.destroy();
    };
    ChunkStream.prototype.destroy = function() {
      if (!this._buffers) {
        return;
      }
      this.writable = false;
      this._reads = null;
      this._buffers = null;
      this.emit("close");
    };
    ChunkStream.prototype._processReadAllowingLess = function(read) {
      this._reads.shift();
      var smallerBuf = this._buffers[0];
      if (smallerBuf.length > read.length) {
        this._buffered -= read.length;
        this._buffers[0] = smallerBuf.slice(read.length);
        read.func.call(this, smallerBuf.slice(0, read.length));
      } else {
        this._buffered -= smallerBuf.length;
        this._buffers.shift();
        read.func.call(this, smallerBuf);
      }
    };
    ChunkStream.prototype._processRead = function(read) {
      this._reads.shift();
      var pos = 0;
      var count = 0;
      var data = new Buffer(read.length);
      while (pos < read.length) {
        var buf = this._buffers[count++];
        var len = Math.min(buf.length, read.length - pos);
        buf.copy(data, pos, 0, len);
        pos += len;
        if (len !== buf.length) {
          this._buffers[--count] = buf.slice(len);
        }
      }
      if (count > 0) {
        this._buffers.splice(0, count);
      }
      this._buffered -= read.length;
      read.func.call(this, data);
    };
    ChunkStream.prototype._process = function() {
      try {
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
          var read = this._reads[0];
          if (read.allowLess) {
            this._processReadAllowingLess(read);
          } else if (this._buffered >= read.length) {
            this._processRead(read);
          } else {
            break;
          }
        }
        if (this._buffers && !this.writable) {
          this._end();
        }
      } catch (ex) {
        this.emit("error", ex);
      }
    };
  }
});

// node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS({
  "node_modules/pngjs/lib/interlace.js"(exports2) {
    "use strict";
    var imagePasses = [
      {
        // pass 1 - 1px
        x: [0],
        y: [0]
      },
      {
        // pass 2 - 1px
        x: [4],
        y: [0]
      },
      {
        // pass 3 - 2px
        x: [0, 4],
        y: [4]
      },
      {
        // pass 4 - 4px
        x: [2, 6],
        y: [0, 4]
      },
      {
        // pass 5 - 8px
        x: [0, 2, 4, 6],
        y: [2, 6]
      },
      {
        // pass 6 - 16px
        x: [1, 3, 5, 7],
        y: [0, 2, 4, 6]
      },
      {
        // pass 7 - 32px
        x: [0, 1, 2, 3, 4, 5, 6, 7],
        y: [1, 3, 5, 7]
      }
    ];
    exports2.getImagePasses = function(width, height) {
      var images = [];
      var xLeftOver = width % 8;
      var yLeftOver = height % 8;
      var xRepeats = (width - xLeftOver) / 8;
      var yRepeats = (height - yLeftOver) / 8;
      for (var i = 0; i < imagePasses.length; i++) {
        var pass = imagePasses[i];
        var passWidth = xRepeats * pass.x.length;
        var passHeight = yRepeats * pass.y.length;
        for (var j = 0; j < pass.x.length; j++) {
          if (pass.x[j] < xLeftOver) {
            passWidth++;
          } else {
            break;
          }
        }
        for (j = 0; j < pass.y.length; j++) {
          if (pass.y[j] < yLeftOver) {
            passHeight++;
          } else {
            break;
          }
        }
        if (passWidth > 0 && passHeight > 0) {
          images.push({ width: passWidth, height: passHeight, index: i });
        }
      }
      return images;
    };
    exports2.getInterlaceIterator = function(width) {
      return function(x, y, pass) {
        var outerXLeftOver = x % imagePasses[pass].x.length;
        var outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
        var outerYLeftOver = y % imagePasses[pass].y.length;
        var outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
        return outerX * 4 + outerY * width * 4;
      };
    };
  }
});

// node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS({
  "node_modules/pngjs/lib/paeth-predictor.js"(exports2, module2) {
    "use strict";
    module2.exports = function paethPredictor(left, above, upLeft) {
      var paeth = left + above - upLeft;
      var pLeft = Math.abs(paeth - left);
      var pAbove = Math.abs(paeth - above);
      var pUpLeft = Math.abs(paeth - upLeft);
      if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
      }
      if (pAbove <= pUpLeft) {
        return above;
      }
      return upLeft;
    };
  }
});

// node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS({
  "node_modules/pngjs/lib/filter-parse.js"(exports2, module2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var paethPredictor = require_paeth_predictor();
    function getByteWidth(width, bpp, depth) {
      var byteWidth = width * bpp;
      if (depth !== 8) {
        byteWidth = Math.ceil(byteWidth / (8 / depth));
      }
      return byteWidth;
    }
    var Filter = module2.exports = function(bitmapInfo, dependencies) {
      var width = bitmapInfo.width;
      var height = bitmapInfo.height;
      var interlace = bitmapInfo.interlace;
      var bpp = bitmapInfo.bpp;
      var depth = bitmapInfo.depth;
      this.read = dependencies.read;
      this.write = dependencies.write;
      this.complete = dependencies.complete;
      this._imageIndex = 0;
      this._images = [];
      if (interlace) {
        var passes = interlaceUtils.getImagePasses(width, height);
        for (var i = 0; i < passes.length; i++) {
          this._images.push({
            byteWidth: getByteWidth(passes[i].width, bpp, depth),
            height: passes[i].height,
            lineIndex: 0
          });
        }
      } else {
        this._images.push({
          byteWidth: getByteWidth(width, bpp, depth),
          height,
          lineIndex: 0
        });
      }
      if (depth === 8) {
        this._xComparison = bpp;
      } else if (depth === 16) {
        this._xComparison = bpp * 2;
      } else {
        this._xComparison = 1;
      }
    };
    Filter.prototype.start = function() {
      this.read(this._images[this._imageIndex].byteWidth + 1, this._reverseFilterLine.bind(this));
    };
    Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
      var xComparison = this._xComparison;
      var xBiggerThan = xComparison - 1;
      for (var x = 0; x < byteWidth; x++) {
        var rawByte = rawData[1 + x];
        var f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        unfilteredLine[x] = rawByte + f1Left;
      }
    };
    Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
      var lastLine = this._lastLine;
      for (var x = 0; x < byteWidth; x++) {
        var rawByte = rawData[1 + x];
        var f2Up = lastLine ? lastLine[x] : 0;
        unfilteredLine[x] = rawByte + f2Up;
      }
    };
    Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
      var xComparison = this._xComparison;
      var xBiggerThan = xComparison - 1;
      var lastLine = this._lastLine;
      for (var x = 0; x < byteWidth; x++) {
        var rawByte = rawData[1 + x];
        var f3Up = lastLine ? lastLine[x] : 0;
        var f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        var f3Add = Math.floor((f3Left + f3Up) / 2);
        unfilteredLine[x] = rawByte + f3Add;
      }
    };
    Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
      var xComparison = this._xComparison;
      var xBiggerThan = xComparison - 1;
      var lastLine = this._lastLine;
      for (var x = 0; x < byteWidth; x++) {
        var rawByte = rawData[1 + x];
        var f4Up = lastLine ? lastLine[x] : 0;
        var f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        var f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
        var f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        unfilteredLine[x] = rawByte + f4Add;
      }
    };
    Filter.prototype._reverseFilterLine = function(rawData) {
      var filter = rawData[0];
      var unfilteredLine;
      var currentImage = this._images[this._imageIndex];
      var byteWidth = currentImage.byteWidth;
      if (filter === 0) {
        unfilteredLine = rawData.slice(1, byteWidth + 1);
      } else {
        unfilteredLine = new Buffer(byteWidth);
        switch (filter) {
          case 1:
            this._unFilterType1(rawData, unfilteredLine, byteWidth);
            break;
          case 2:
            this._unFilterType2(rawData, unfilteredLine, byteWidth);
            break;
          case 3:
            this._unFilterType3(rawData, unfilteredLine, byteWidth);
            break;
          case 4:
            this._unFilterType4(rawData, unfilteredLine, byteWidth);
            break;
          default:
            throw new Error("Unrecognised filter type - " + filter);
        }
      }
      this.write(unfilteredLine);
      currentImage.lineIndex++;
      if (currentImage.lineIndex >= currentImage.height) {
        this._lastLine = null;
        this._imageIndex++;
        currentImage = this._images[this._imageIndex];
      } else {
        this._lastLine = unfilteredLine;
      }
      if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
      } else {
        this._lastLine = null;
        this.complete();
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS({
  "node_modules/pngjs/lib/filter-parse-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var ChunkStream = require_chunkstream();
    var Filter = require_filter_parse();
    var FilterAsync = module2.exports = function(bitmapInfo) {
      ChunkStream.call(this);
      var buffers = [];
      var that = this;
      this._filter = new Filter(bitmapInfo, {
        read: this.read.bind(this),
        write: function(buffer) {
          buffers.push(buffer);
        },
        complete: function() {
          that.emit("complete", Buffer.concat(buffers));
        }
      });
      this._filter.start();
    };
    util.inherits(FilterAsync, ChunkStream);
  }
});

// node_modules/pngjs/lib/constants.js
var require_constants = __commonJS({
  "node_modules/pngjs/lib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
      TYPE_IHDR: 1229472850,
      TYPE_IEND: 1229278788,
      TYPE_IDAT: 1229209940,
      TYPE_PLTE: 1347179589,
      TYPE_tRNS: 1951551059,
      // eslint-disable-line camelcase
      TYPE_gAMA: 1732332865,
      // eslint-disable-line camelcase
      // color-type bits
      COLORTYPE_GRAYSCALE: 0,
      COLORTYPE_PALETTE: 1,
      COLORTYPE_COLOR: 2,
      COLORTYPE_ALPHA: 4,
      // e.g. grayscale and alpha
      // color-type combinations
      COLORTYPE_PALETTE_COLOR: 3,
      COLORTYPE_COLOR_ALPHA: 6,
      COLORTYPE_TO_BPP_MAP: {
        0: 1,
        2: 3,
        3: 1,
        4: 2,
        6: 4
      },
      GAMMA_DIVISION: 1e5
    };
  }
});

// node_modules/pngjs/lib/crc.js
var require_crc = __commonJS({
  "node_modules/pngjs/lib/crc.js"(exports2, module2) {
    "use strict";
    var crcTable = [];
    (function() {
      for (var i = 0; i < 256; i++) {
        var currentCrc = i;
        for (var j = 0; j < 8; j++) {
          if (currentCrc & 1) {
            currentCrc = 3988292384 ^ currentCrc >>> 1;
          } else {
            currentCrc = currentCrc >>> 1;
          }
        }
        crcTable[i] = currentCrc;
      }
    })();
    var CrcCalculator = module2.exports = function() {
      this._crc = -1;
    };
    CrcCalculator.prototype.write = function(data) {
      for (var i = 0; i < data.length; i++) {
        this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
      }
      return true;
    };
    CrcCalculator.prototype.crc32 = function() {
      return this._crc ^ -1;
    };
    CrcCalculator.crc32 = function(buf) {
      var crc = -1;
      for (var i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    };
  }
});

// node_modules/pngjs/lib/parser.js
var require_parser = __commonJS({
  "node_modules/pngjs/lib/parser.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcCalculator = require_crc();
    var Parser = module2.exports = function(options, dependencies) {
      this._options = options;
      options.checkCRC = options.checkCRC !== false;
      this._hasIHDR = false;
      this._hasIEND = false;
      this._emittedHeadersFinished = false;
      this._palette = [];
      this._colorType = 0;
      this._chunks = {};
      this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
      this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
      this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
      this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
      this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
      this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
      this.read = dependencies.read;
      this.error = dependencies.error;
      this.metadata = dependencies.metadata;
      this.gamma = dependencies.gamma;
      this.transColor = dependencies.transColor;
      this.palette = dependencies.palette;
      this.parsed = dependencies.parsed;
      this.inflateData = dependencies.inflateData;
      this.finished = dependencies.finished;
      this.simpleTransparency = dependencies.simpleTransparency;
      this.headersFinished = dependencies.headersFinished || function() {
      };
    };
    Parser.prototype.start = function() {
      this.read(
        constants.PNG_SIGNATURE.length,
        this._parseSignature.bind(this)
      );
    };
    Parser.prototype._parseSignature = function(data) {
      var signature = constants.PNG_SIGNATURE;
      for (var i = 0; i < signature.length; i++) {
        if (data[i] !== signature[i]) {
          this.error(new Error("Invalid file signature"));
          return;
        }
      }
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function(data) {
      var length = data.readUInt32BE(0);
      var type = data.readUInt32BE(4);
      var name = "";
      for (var i = 4; i < 8; i++) {
        name += String.fromCharCode(data[i]);
      }
      var ancillary = Boolean(data[4] & 32);
      if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
        this.error(new Error("Expected IHDR on beggining"));
        return;
      }
      this._crc = new CrcCalculator();
      this._crc.write(new Buffer(name));
      if (this._chunks[type]) {
        return this._chunks[type](length);
      }
      if (!ancillary) {
        this.error(new Error("Unsupported critical chunk type " + name));
        return;
      }
      this.read(length + 4, this._skipChunk.bind(this));
    };
    Parser.prototype._skipChunk = function() {
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function() {
      this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function(data) {
      var fileCrc = data.readInt32BE(0);
      var calcCrc = this._crc.crc32();
      if (this._options.checkCRC && calcCrc !== fileCrc) {
        this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
        return;
      }
      if (!this._hasIEND) {
        this.read(8, this._parseChunkBegin.bind(this));
      }
    };
    Parser.prototype._handleIHDR = function(length) {
      this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function(data) {
      this._crc.write(data);
      var width = data.readUInt32BE(0);
      var height = data.readUInt32BE(4);
      var depth = data[8];
      var colorType = data[9];
      var compr = data[10];
      var filter = data[11];
      var interlace = data[12];
      if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
        this.error(new Error("Unsupported bit depth " + depth));
        return;
      }
      if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
        this.error(new Error("Unsupported color type"));
        return;
      }
      if (compr !== 0) {
        this.error(new Error("Unsupported compression method"));
        return;
      }
      if (filter !== 0) {
        this.error(new Error("Unsupported filter method"));
        return;
      }
      if (interlace !== 0 && interlace !== 1) {
        this.error(new Error("Unsupported interlace method"));
        return;
      }
      this._colorType = colorType;
      var bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
      this._hasIHDR = true;
      this.metadata({
        width,
        height,
        depth,
        interlace: Boolean(interlace),
        palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
        color: Boolean(colorType & constants.COLORTYPE_COLOR),
        alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
        bpp,
        colorType
      });
      this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function(length) {
      this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function(data) {
      this._crc.write(data);
      var entries = Math.floor(data.length / 3);
      for (var i = 0; i < entries; i++) {
        this._palette.push([
          data[i * 3],
          data[i * 3 + 1],
          data[i * 3 + 2],
          255
        ]);
      }
      this.palette(this._palette);
      this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function(length) {
      this.simpleTransparency();
      this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function(data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
        if (this._palette.length === 0) {
          this.error(new Error("Transparency chunk must be after palette"));
          return;
        }
        if (data.length > this._palette.length) {
          this.error(new Error("More transparent colors than palette size"));
          return;
        }
        for (var i = 0; i < data.length; i++) {
          this._palette[i][3] = data[i];
        }
        this.palette(this._palette);
      }
      if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
        this.transColor([data.readUInt16BE(0)]);
      }
      if (this._colorType === constants.COLORTYPE_COLOR) {
        this.transColor([data.readUInt16BE(0), data.readUInt16BE(2), data.readUInt16BE(4)]);
      }
      this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function(length) {
      this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function(data) {
      this._crc.write(data);
      this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
      this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function(length) {
      if (!this._emittedHeadersFinished) {
        this._emittedHeadersFinished = true;
        this.headersFinished();
      }
      this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function(length, data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
        throw new Error("Expected palette not found");
      }
      this.inflateData(data);
      var leftOverLength = length - data.length;
      if (leftOverLength > 0) {
        this._handleIDAT(leftOverLength);
      } else {
        this._handleChunkEnd();
      }
    };
    Parser.prototype._handleIEND = function(length) {
      this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function(data) {
      this._crc.write(data);
      this._hasIEND = true;
      this._handleChunkEnd();
      if (this.finished) {
        this.finished();
      }
    };
  }
});

// node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS({
  "node_modules/pngjs/lib/bitmapper.js"(exports2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var pixelBppMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos === data.length) {
          throw new Error("Ran out of data");
        }
        var pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = 255;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 1 >= data.length) {
          throw new Error("Ran out of data");
        }
        var pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = data[rawPos + 1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 2 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = 255;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 3 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = data[rawPos + 3];
      }
    ];
    var pixelBppCustomMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        var pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = maxBit;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, pixelData, pxPos) {
        var pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = pixelData[1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = maxBit;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, pixelData, pxPos) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = pixelData[3];
      }
    ];
    function bitRetriever(data, depth) {
      var leftOver = [];
      var i = 0;
      function split() {
        if (i === data.length) {
          throw new Error("Ran out of data");
        }
        var byte = data[i];
        i++;
        var byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
        switch (depth) {
          default:
            throw new Error("unrecognised depth");
          case 16:
            byte2 = data[i];
            i++;
            leftOver.push((byte << 8) + byte2);
            break;
          case 4:
            byte2 = byte & 15;
            byte1 = byte >> 4;
            leftOver.push(byte1, byte2);
            break;
          case 2:
            byte4 = byte & 3;
            byte3 = byte >> 2 & 3;
            byte2 = byte >> 4 & 3;
            byte1 = byte >> 6 & 3;
            leftOver.push(byte1, byte2, byte3, byte4);
            break;
          case 1:
            byte8 = byte & 1;
            byte7 = byte >> 1 & 1;
            byte6 = byte >> 2 & 1;
            byte5 = byte >> 3 & 1;
            byte4 = byte >> 4 & 1;
            byte3 = byte >> 5 & 1;
            byte2 = byte >> 6 & 1;
            byte1 = byte >> 7 & 1;
            leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
            break;
        }
      }
      return {
        get: function(count) {
          while (leftOver.length < count) {
            split();
          }
          var returner = leftOver.slice(0, count);
          leftOver = leftOver.slice(count);
          return returner;
        },
        resetAfterLine: function() {
          leftOver.length = 0;
        },
        end: function() {
          if (i !== data.length) {
            throw new Error("extra data found");
          }
        }
      };
    }
    function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
      var imageWidth = image.width;
      var imageHeight = image.height;
      var imagePass = image.index;
      for (var y = 0; y < imageHeight; y++) {
        for (var x = 0; x < imageWidth; x++) {
          var pxPos = getPxPos(x, y, imagePass);
          pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
          rawPos += bpp;
        }
      }
      return rawPos;
    }
    function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
      var imageWidth = image.width;
      var imageHeight = image.height;
      var imagePass = image.index;
      for (var y = 0; y < imageHeight; y++) {
        for (var x = 0; x < imageWidth; x++) {
          var pixelData = bits.get(bpp);
          var pxPos = getPxPos(x, y, imagePass);
          pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
        }
        bits.resetAfterLine();
      }
    }
    exports2.dataToBitMap = function(data, bitmapInfo) {
      var width = bitmapInfo.width;
      var height = bitmapInfo.height;
      var depth = bitmapInfo.depth;
      var bpp = bitmapInfo.bpp;
      var interlace = bitmapInfo.interlace;
      if (depth !== 8) {
        var bits = bitRetriever(data, depth);
      }
      var pxData;
      if (depth <= 8) {
        pxData = new Buffer(width * height * 4);
      } else {
        pxData = new Uint16Array(width * height * 4);
      }
      var maxBit = Math.pow(2, depth) - 1;
      var rawPos = 0;
      var images;
      var getPxPos;
      if (interlace) {
        images = interlaceUtils.getImagePasses(width, height);
        getPxPos = interlaceUtils.getInterlaceIterator(width, height);
      } else {
        var nonInterlacedPxPos = 0;
        getPxPos = function() {
          var returner = nonInterlacedPxPos;
          nonInterlacedPxPos += 4;
          return returner;
        };
        images = [{ width, height }];
      }
      for (var imageIndex = 0; imageIndex < images.length; imageIndex++) {
        if (depth === 8) {
          rawPos = mapImage8Bit(images[imageIndex], pxData, getPxPos, bpp, data, rawPos);
        } else {
          mapImageCustomBit(images[imageIndex], pxData, getPxPos, bpp, bits, maxBit);
        }
      }
      if (depth === 8) {
        if (rawPos !== data.length) {
          throw new Error("extra data found");
        }
      } else {
        bits.end();
      }
      return pxData;
    };
  }
});

// node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS({
  "node_modules/pngjs/lib/format-normaliser.js"(exports2, module2) {
    "use strict";
    function dePalette(indata, outdata, width, height, palette) {
      var pxPos = 0;
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var color = palette[indata[pxPos]];
          if (!color) {
            throw new Error("index " + indata[pxPos] + " not in palette");
          }
          for (var i = 0; i < 4; i++) {
            outdata[pxPos + i] = color[i];
          }
          pxPos += 4;
        }
      }
    }
    function replaceTransparentColor(indata, outdata, width, height, transColor) {
      var pxPos = 0;
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var makeTrans = false;
          if (transColor.length === 1) {
            if (transColor[0] === indata[pxPos]) {
              makeTrans = true;
            }
          } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
            makeTrans = true;
          }
          if (makeTrans) {
            for (var i = 0; i < 4; i++) {
              outdata[pxPos + i] = 0;
            }
          }
          pxPos += 4;
        }
      }
    }
    function scaleDepth(indata, outdata, width, height, depth) {
      var maxOutSample = 255;
      var maxInSample = Math.pow(2, depth) - 1;
      var pxPos = 0;
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          for (var i = 0; i < 4; i++) {
            outdata[pxPos + i] = Math.floor(indata[pxPos + i] * maxOutSample / maxInSample + 0.5);
          }
          pxPos += 4;
        }
      }
    }
    module2.exports = function(indata, imageData) {
      var depth = imageData.depth;
      var width = imageData.width;
      var height = imageData.height;
      var colorType = imageData.colorType;
      var transColor = imageData.transColor;
      var palette = imageData.palette;
      var outdata = indata;
      if (colorType === 3) {
        dePalette(indata, outdata, width, height, palette);
      } else {
        if (transColor) {
          replaceTransparentColor(indata, outdata, width, height, transColor);
        }
        if (depth !== 8) {
          if (depth === 16) {
            outdata = new Buffer(width * height * 4);
          }
          scaleDepth(indata, outdata, width, height, depth);
        }
      }
      return outdata;
    };
  }
});

// node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS({
  "node_modules/pngjs/lib/parser-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var zlib = require("zlib");
    var ChunkStream = require_chunkstream();
    var FilterAsync = require_filter_parse_async();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    var ParserAsync = module2.exports = function(options) {
      ChunkStream.call(this);
      this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this._handleError.bind(this),
        metadata: this._handleMetaData.bind(this),
        gamma: this.emit.bind(this, "gamma"),
        palette: this._handlePalette.bind(this),
        transColor: this._handleTransColor.bind(this),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        simpleTransparency: this._simpleTransparency.bind(this),
        headersFinished: this._headersFinished.bind(this)
      });
      this._options = options;
      this.writable = true;
      this._parser.start();
    };
    util.inherits(ParserAsync, ChunkStream);
    ParserAsync.prototype._handleError = function(err) {
      this.emit("error", err);
      this.writable = false;
      this.destroy();
      if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
      }
      if (this._filter) {
        this._filter.destroy();
        this._filter.on("error", function() {
        });
      }
      this.errord = true;
    };
    ParserAsync.prototype._inflateData = function(data) {
      if (!this._inflate) {
        if (this._bitmapInfo.interlace) {
          this._inflate = zlib.createInflate();
          this._inflate.on("error", this.emit.bind(this, "error"));
          this._filter.on("complete", this._complete.bind(this));
          this._inflate.pipe(this._filter);
        } else {
          var rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
          var imageSize = rowSize * this._bitmapInfo.height;
          var chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
          this._inflate = zlib.createInflate({ chunkSize });
          var leftToInflate = imageSize;
          var emitError = this.emit.bind(this, "error");
          this._inflate.on("error", function(err) {
            if (!leftToInflate) {
              return;
            }
            emitError(err);
          });
          this._filter.on("complete", this._complete.bind(this));
          var filterWrite = this._filter.write.bind(this._filter);
          this._inflate.on("data", function(chunk) {
            if (!leftToInflate) {
              return;
            }
            if (chunk.length > leftToInflate) {
              chunk = chunk.slice(0, leftToInflate);
            }
            leftToInflate -= chunk.length;
            filterWrite(chunk);
          });
          this._inflate.on("end", this._filter.end.bind(this._filter));
        }
      }
      this._inflate.write(data);
    };
    ParserAsync.prototype._handleMetaData = function(metaData) {
      this._metaData = metaData;
      this._bitmapInfo = Object.create(metaData);
      this._filter = new FilterAsync(this._bitmapInfo);
    };
    ParserAsync.prototype._handleTransColor = function(transColor) {
      this._bitmapInfo.transColor = transColor;
    };
    ParserAsync.prototype._handlePalette = function(palette) {
      this._bitmapInfo.palette = palette;
    };
    ParserAsync.prototype._simpleTransparency = function() {
      this._metaData.alpha = true;
    };
    ParserAsync.prototype._headersFinished = function() {
      this.emit("metadata", this._metaData);
    };
    ParserAsync.prototype._finished = function() {
      if (this.errord) {
        return;
      }
      if (!this._inflate) {
        this.emit("error", "No Inflate block");
      } else {
        this._inflate.end();
      }
      this.destroySoon();
    };
    ParserAsync.prototype._complete = function(filteredData) {
      if (this.errord) {
        return;
      }
      try {
        var bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
        var normalisedBitmapData = formatNormaliser(bitmapData, this._bitmapInfo);
        bitmapData = null;
      } catch (ex) {
        this._handleError(ex);
        return;
      }
      this.emit("parsed", normalisedBitmapData);
    };
  }
});

// node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS({
  "node_modules/pngjs/lib/bitpacker.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    module2.exports = function(dataIn, width, height, options) {
      var outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(options.colorType) !== -1;
      if (options.colorType === options.inputColorType) {
        var bigEndian = (function() {
          var buffer = new ArrayBuffer(2);
          new DataView(buffer).setInt16(
            0,
            256,
            true
            /* littleEndian */
          );
          return new Int16Array(buffer)[0] !== 256;
        })();
        if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
          return dataIn;
        }
      }
      var data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
      var maxValue = 255;
      var inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
      if (inBpp === 4 && !options.inputHasAlpha) {
        inBpp = 3;
      }
      var outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
      if (options.bitDepth === 16) {
        maxValue = 65535;
        outBpp *= 2;
      }
      var outData = new Buffer(width * height * outBpp);
      var inIndex = 0;
      var outIndex = 0;
      var bgColor = options.bgColor || {};
      if (bgColor.red === void 0) {
        bgColor.red = maxValue;
      }
      if (bgColor.green === void 0) {
        bgColor.green = maxValue;
      }
      if (bgColor.blue === void 0) {
        bgColor.blue = maxValue;
      }
      function getRGBA() {
        var red;
        var green;
        var blue;
        var alpha = maxValue;
        switch (options.inputColorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
            alpha = data[inIndex + 3];
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_COLOR:
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_ALPHA:
            alpha = data[inIndex + 1];
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          case constants.COLORTYPE_GRAYSCALE:
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          default:
            throw new Error("input color type:" + options.inputColorType + " is not supported at present");
        }
        if (options.inputHasAlpha) {
          if (!outHasAlpha) {
            alpha /= maxValue;
            red = Math.min(Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0), maxValue);
            green = Math.min(Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0), maxValue);
            blue = Math.min(Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0), maxValue);
          }
        }
        return { red, green, blue, alpha };
      }
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var rgba = getRGBA(data, inIndex);
          switch (options.colorType) {
            case constants.COLORTYPE_COLOR_ALPHA:
            case constants.COLORTYPE_COLOR:
              if (options.bitDepth === 8) {
                outData[outIndex] = rgba.red;
                outData[outIndex + 1] = rgba.green;
                outData[outIndex + 2] = rgba.blue;
                if (outHasAlpha) {
                  outData[outIndex + 3] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(rgba.red, outIndex);
                outData.writeUInt16BE(rgba.green, outIndex + 2);
                outData.writeUInt16BE(rgba.blue, outIndex + 4);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 6);
                }
              }
              break;
            case constants.COLORTYPE_ALPHA:
            case constants.COLORTYPE_GRAYSCALE:
              var grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
              if (options.bitDepth === 8) {
                outData[outIndex] = grayscale;
                if (outHasAlpha) {
                  outData[outIndex + 1] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(grayscale, outIndex);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 2);
                }
              }
              break;
            default:
              throw new Error("unrecognised color Type " + options.colorType);
          }
          inIndex += inBpp;
          outIndex += outBpp;
        }
      }
      return outData;
    };
  }
});

// node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS({
  "node_modules/pngjs/lib/filter-pack.js"(exports2, module2) {
    "use strict";
    var paethPredictor = require_paeth_predictor();
    function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (var x = 0; x < byteWidth; x++) {
        rawData[rawPos + x] = pxData[pxPos + x];
      }
    }
    function filterSumNone(pxData, pxPos, byteWidth) {
      var sum = 0;
      var length = pxPos + byteWidth;
      for (var i = pxPos; i < length; i++) {
        sum += Math.abs(pxData[i]);
      }
      return sum;
    }
    function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var val = pxData[pxPos + x] - left;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumSub(pxData, pxPos, byteWidth, bpp) {
      var sum = 0;
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var val = pxData[pxPos + x] - left;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (var x = 0; x < byteWidth; x++) {
        var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        var val = pxData[pxPos + x] - up;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumUp(pxData, pxPos, byteWidth) {
      var sum = 0;
      var length = pxPos + byteWidth;
      for (var x = pxPos; x < length; x++) {
        var up = pxPos > 0 ? pxData[x - byteWidth] : 0;
        var val = pxData[x] - up;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        var val = pxData[pxPos + x] - (left + up >> 1);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
      var sum = 0;
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        var val = pxData[pxPos + x] - (left + up >> 1);
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        var upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        var val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
      var sum = 0;
      for (var x = 0; x < byteWidth; x++) {
        var left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        var up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        var upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        var val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        sum += Math.abs(val);
      }
      return sum;
    }
    var filters = {
      0: filterNone,
      1: filterSub,
      2: filterUp,
      3: filterAvg,
      4: filterPaeth
    };
    var filterSums = {
      0: filterSumNone,
      1: filterSumSub,
      2: filterSumUp,
      3: filterSumAvg,
      4: filterSumPaeth
    };
    module2.exports = function(pxData, width, height, options, bpp) {
      var filterTypes;
      if (!("filterType" in options) || options.filterType === -1) {
        filterTypes = [0, 1, 2, 3, 4];
      } else if (typeof options.filterType === "number") {
        filterTypes = [options.filterType];
      } else {
        throw new Error("unrecognised filter types");
      }
      if (options.bitDepth === 16) {
        bpp *= 2;
      }
      var byteWidth = width * bpp;
      var rawPos = 0;
      var pxPos = 0;
      var rawData = new Buffer((byteWidth + 1) * height);
      var sel = filterTypes[0];
      for (var y = 0; y < height; y++) {
        if (filterTypes.length > 1) {
          var min = Infinity;
          for (var i = 0; i < filterTypes.length; i++) {
            var sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
            if (sum < min) {
              sel = filterTypes[i];
              min = sum;
            }
          }
        }
        rawData[rawPos] = sel;
        rawPos++;
        filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
        rawPos += byteWidth;
        pxPos += byteWidth;
      }
      return rawData;
    };
  }
});

// node_modules/pngjs/lib/packer.js
var require_packer = __commonJS({
  "node_modules/pngjs/lib/packer.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcStream = require_crc();
    var bitPacker = require_bitpacker();
    var filter = require_filter_pack();
    var zlib = require("zlib");
    var Packer = module2.exports = function(options) {
      this._options = options;
      options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
      options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
      options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
      options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
      options.deflateFactory = options.deflateFactory || zlib.createDeflate;
      options.bitDepth = options.bitDepth || 8;
      options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
      options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.colorType) === -1) {
        throw new Error("option color type:" + options.colorType + " is not supported at present");
      }
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.inputColorType) === -1) {
        throw new Error("option input color type:" + options.inputColorType + " is not supported at present");
      }
      if (options.bitDepth !== 8 && options.bitDepth !== 16) {
        throw new Error("option bit depth:" + options.bitDepth + " is not supported at present");
      }
    };
    Packer.prototype.getDeflateOptions = function() {
      return {
        chunkSize: this._options.deflateChunkSize,
        level: this._options.deflateLevel,
        strategy: this._options.deflateStrategy
      };
    };
    Packer.prototype.createDeflate = function() {
      return this._options.deflateFactory(this.getDeflateOptions());
    };
    Packer.prototype.filterData = function(data, width, height) {
      var packedData = bitPacker(data, width, height, this._options);
      var bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
      var filteredData = filter(packedData, width, height, this._options, bpp);
      return filteredData;
    };
    Packer.prototype._packChunk = function(type, data) {
      var len = data ? data.length : 0;
      var buf = new Buffer(len + 12);
      buf.writeUInt32BE(len, 0);
      buf.writeUInt32BE(type, 4);
      if (data) {
        data.copy(buf, 8);
      }
      buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
      return buf;
    };
    Packer.prototype.packGAMA = function(gamma) {
      var buf = new Buffer(4);
      buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
      return this._packChunk(constants.TYPE_gAMA, buf);
    };
    Packer.prototype.packIHDR = function(width, height) {
      var buf = new Buffer(13);
      buf.writeUInt32BE(width, 0);
      buf.writeUInt32BE(height, 4);
      buf[8] = this._options.bitDepth;
      buf[9] = this._options.colorType;
      buf[10] = 0;
      buf[11] = 0;
      buf[12] = 0;
      return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype.packIDAT = function(data) {
      return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype.packIEND = function() {
      return this._packChunk(constants.TYPE_IEND, null);
    };
  }
});

// node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS({
  "node_modules/pngjs/lib/packer-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var constants = require_constants();
    var Packer = require_packer();
    var PackerAsync = module2.exports = function(opt) {
      Stream.call(this);
      var options = opt || {};
      this._packer = new Packer(options);
      this._deflate = this._packer.createDeflate();
      this.readable = true;
    };
    util.inherits(PackerAsync, Stream);
    PackerAsync.prototype.pack = function(data, width, height, gamma) {
      this.emit("data", new Buffer(constants.PNG_SIGNATURE));
      this.emit("data", this._packer.packIHDR(width, height));
      if (gamma) {
        this.emit("data", this._packer.packGAMA(gamma));
      }
      var filteredData = this._packer.filterData(data, width, height);
      this._deflate.on("error", this.emit.bind(this, "error"));
      this._deflate.on("data", function(compressedData) {
        this.emit("data", this._packer.packIDAT(compressedData));
      }.bind(this));
      this._deflate.on("end", function() {
        this.emit("data", this._packer.packIEND());
        this.emit("end");
      }.bind(this));
      this._deflate.end(filteredData);
    };
  }
});

// node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS({
  "node_modules/pngjs/lib/sync-inflate.js"(exports2, module2) {
    "use strict";
    var assert = require("assert").ok;
    var zlib = require("zlib");
    var util = require("util");
    var kMaxLength = require("buffer").kMaxLength;
    function Inflate(opts) {
      if (!(this instanceof Inflate)) {
        return new Inflate(opts);
      }
      if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
        opts.chunkSize = zlib.Z_MIN_CHUNK;
      }
      zlib.Inflate.call(this, opts);
      this._offset = this._offset === void 0 ? this._outOffset : this._offset;
      this._buffer = this._buffer || this._outBuffer;
      if (opts && opts.maxLength != null) {
        this._maxLength = opts.maxLength;
      }
    }
    function createInflate(opts) {
      return new Inflate(opts);
    }
    function _close(engine, callback) {
      if (callback) {
        process.nextTick(callback);
      }
      if (!engine._handle) {
        return;
      }
      engine._handle.close();
      engine._handle = null;
    }
    Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
      if (typeof asyncCb === "function") {
        return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
      }
      var self = this;
      var availInBefore = chunk && chunk.length;
      var availOutBefore = this._chunkSize - this._offset;
      var leftToInflate = this._maxLength;
      var inOff = 0;
      var buffers = [];
      var nread = 0;
      var error;
      this.on("error", function(err) {
        error = err;
      });
      function handleChunk(availInAfter, availOutAfter) {
        if (self._hadError) {
          return;
        }
        var have = availOutBefore - availOutAfter;
        assert(have >= 0, "have should not go down");
        if (have > 0) {
          var out = self._buffer.slice(self._offset, self._offset + have);
          self._offset += have;
          if (out.length > leftToInflate) {
            out = out.slice(0, leftToInflate);
          }
          buffers.push(out);
          nread += out.length;
          leftToInflate -= out.length;
          if (leftToInflate === 0) {
            return false;
          }
        }
        if (availOutAfter === 0 || self._offset >= self._chunkSize) {
          availOutBefore = self._chunkSize;
          self._offset = 0;
          self._buffer = Buffer.allocUnsafe(self._chunkSize);
        }
        if (availOutAfter === 0) {
          inOff += availInBefore - availInAfter;
          availInBefore = availInAfter;
          return true;
        }
        return false;
      }
      assert(this._handle, "zlib binding closed");
      do {
        var res = this._handle.writeSync(
          flushFlag,
          chunk,
          // in
          inOff,
          // in_off
          availInBefore,
          // in_len
          this._buffer,
          // out
          this._offset,
          //out_off
          availOutBefore
        );
        res = res || this._writeState;
      } while (!this._hadError && handleChunk(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError("Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes");
      }
      var buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    };
    util.inherits(Inflate, zlib.Inflate);
    function zlibBufferSync(engine, buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
      }
      if (!(buffer instanceof Buffer)) {
        throw new TypeError("Not a string or buffer");
      }
      var flushFlag = engine._finishFlushFlag;
      if (flushFlag == null) {
        flushFlag = zlib.Z_FINISH;
      }
      return engine._processChunk(buffer, flushFlag);
    }
    function inflateSync(buffer, opts) {
      return zlibBufferSync(new Inflate(opts), buffer);
    }
    module2.exports = exports2 = inflateSync;
    exports2.Inflate = Inflate;
    exports2.createInflate = createInflate;
    exports2.inflateSync = inflateSync;
  }
});

// node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS({
  "node_modules/pngjs/lib/sync-reader.js"(exports2, module2) {
    "use strict";
    var SyncReader = module2.exports = function(buffer) {
      this._buffer = buffer;
      this._reads = [];
    };
    SyncReader.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
    };
    SyncReader.prototype.process = function() {
      while (this._reads.length > 0 && this._buffer.length) {
        var read = this._reads[0];
        if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
          this._reads.shift();
          var buf = this._buffer;
          this._buffer = buf.slice(read.length);
          read.func.call(this, buf.slice(0, read.length));
        } else {
          break;
        }
      }
      if (this._reads.length > 0) {
        return new Error("There are some read requests waitng on finished stream");
      }
      if (this._buffer.length > 0) {
        return new Error("unrecognised content at end of stream");
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS({
  "node_modules/pngjs/lib/filter-parse-sync.js"(exports2) {
    "use strict";
    var SyncReader = require_sync_reader();
    var Filter = require_filter_parse();
    exports2.process = function(inBuffer, bitmapInfo) {
      var outBuffers = [];
      var reader = new SyncReader(inBuffer);
      var filter = new Filter(bitmapInfo, {
        read: reader.read.bind(reader),
        write: function(bufferPart) {
          outBuffers.push(bufferPart);
        },
        complete: function() {
        }
      });
      filter.start();
      reader.process();
      return Buffer.concat(outBuffers);
    };
  }
});

// node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS({
  "node_modules/pngjs/lib/parser-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    var inflateSync = require_sync_inflate();
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var SyncReader = require_sync_reader();
    var FilterSync = require_filter_parse_sync();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    module2.exports = function(buffer, options) {
      if (!hasSyncZlib) {
        throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
      }
      var err;
      function handleError(_err_) {
        err = _err_;
      }
      var metaData;
      function handleMetaData(_metaData_) {
        metaData = _metaData_;
      }
      function handleTransColor(transColor) {
        metaData.transColor = transColor;
      }
      function handlePalette(palette) {
        metaData.palette = palette;
      }
      function handleSimpleTransparency() {
        metaData.alpha = true;
      }
      var gamma;
      function handleGamma(_gamma_) {
        gamma = _gamma_;
      }
      var inflateDataList = [];
      function handleInflateData(inflatedData2) {
        inflateDataList.push(inflatedData2);
      }
      var reader = new SyncReader(buffer);
      var parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: handleError,
        metadata: handleMetaData,
        gamma: handleGamma,
        palette: handlePalette,
        transColor: handleTransColor,
        inflateData: handleInflateData,
        simpleTransparency: handleSimpleTransparency
      });
      parser.start();
      reader.process();
      if (err) {
        throw err;
      }
      var inflateData = Buffer.concat(inflateDataList);
      inflateDataList.length = 0;
      var inflatedData;
      if (metaData.interlace) {
        inflatedData = zlib.inflateSync(inflateData);
      } else {
        var rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
        var imageSize = rowSize * metaData.height;
        inflatedData = inflateSync(inflateData, { chunkSize: imageSize, maxLength: imageSize });
      }
      inflateData = null;
      if (!inflatedData || !inflatedData.length) {
        throw new Error("bad png - invalid inflate data response");
      }
      var unfilteredData = FilterSync.process(inflatedData, metaData);
      inflateData = null;
      var bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
      unfilteredData = null;
      var normalisedBitmapData = formatNormaliser(bitmapData, metaData);
      metaData.data = normalisedBitmapData;
      metaData.gamma = gamma || 0;
      return metaData;
    };
  }
});

// node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS({
  "node_modules/pngjs/lib/packer-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var constants = require_constants();
    var Packer = require_packer();
    module2.exports = function(metaData, opt) {
      if (!hasSyncZlib) {
        throw new Error("To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0");
      }
      var options = opt || {};
      var packer = new Packer(options);
      var chunks = [];
      chunks.push(new Buffer(constants.PNG_SIGNATURE));
      chunks.push(packer.packIHDR(metaData.width, metaData.height));
      if (metaData.gamma) {
        chunks.push(packer.packGAMA(metaData.gamma));
      }
      var filteredData = packer.filterData(metaData.data, metaData.width, metaData.height);
      var compressedData = zlib.deflateSync(filteredData, packer.getDeflateOptions());
      filteredData = null;
      if (!compressedData || !compressedData.length) {
        throw new Error("bad png - invalid compressed data response");
      }
      chunks.push(packer.packIDAT(compressedData));
      chunks.push(packer.packIEND());
      return Buffer.concat(chunks);
    };
  }
});

// node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS({
  "node_modules/pngjs/lib/png-sync.js"(exports2) {
    "use strict";
    var parse = require_parser_sync();
    var pack2 = require_packer_sync();
    exports2.read = function(buffer, options) {
      return parse(buffer, options || {});
    };
    exports2.write = function(png, options) {
      return pack2(png, options);
    };
  }
});

// node_modules/pngjs/lib/png.js
var require_png = __commonJS({
  "node_modules/pngjs/lib/png.js"(exports2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var Parser = require_parser_async();
    var Packer = require_packer_async();
    var PNGSync = require_png_sync();
    var PNG2 = exports2.PNG = function(options) {
      Stream.call(this);
      options = options || {};
      this.width = options.width | 0;
      this.height = options.height | 0;
      this.data = this.width > 0 && this.height > 0 ? new Buffer(4 * this.width * this.height) : null;
      if (options.fill && this.data) {
        this.data.fill(0);
      }
      this.gamma = 0;
      this.readable = this.writable = true;
      this._parser = new Parser(options);
      this._parser.on("error", this.emit.bind(this, "error"));
      this._parser.on("close", this._handleClose.bind(this));
      this._parser.on("metadata", this._metadata.bind(this));
      this._parser.on("gamma", this._gamma.bind(this));
      this._parser.on("parsed", function(data) {
        this.data = data;
        this.emit("parsed", data);
      }.bind(this));
      this._packer = new Packer(options);
      this._packer.on("data", this.emit.bind(this, "data"));
      this._packer.on("end", this.emit.bind(this, "end"));
      this._parser.on("close", this._handleClose.bind(this));
      this._packer.on("error", this.emit.bind(this, "error"));
    };
    util.inherits(PNG2, Stream);
    PNG2.sync = PNGSync;
    PNG2.prototype.pack = function() {
      if (!this.data || !this.data.length) {
        this.emit("error", "No data provided");
        return this;
      }
      process.nextTick(function() {
        this._packer.pack(this.data, this.width, this.height, this.gamma);
      }.bind(this));
      return this;
    };
    PNG2.prototype.parse = function(data, callback) {
      if (callback) {
        var onParsed, onError;
        onParsed = function(parsedData) {
          this.removeListener("error", onError);
          this.data = parsedData;
          callback(null, this);
        }.bind(this);
        onError = function(err) {
          this.removeListener("parsed", onParsed);
          callback(err, null);
        }.bind(this);
        this.once("parsed", onParsed);
        this.once("error", onError);
      }
      this.end(data);
      return this;
    };
    PNG2.prototype.write = function(data) {
      this._parser.write(data);
      return true;
    };
    PNG2.prototype.end = function(data) {
      this._parser.end(data);
    };
    PNG2.prototype._metadata = function(metadata) {
      this.width = metadata.width;
      this.height = metadata.height;
      this.emit("metadata", metadata);
    };
    PNG2.prototype._gamma = function(gamma) {
      this.gamma = gamma;
    };
    PNG2.prototype._handleClose = function() {
      if (!this._parser.writable && !this._packer.readable) {
        this.emit("close");
      }
    };
    PNG2.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
      srcX |= 0;
      srcY |= 0;
      width |= 0;
      height |= 0;
      deltaX |= 0;
      deltaY |= 0;
      if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
        throw new Error("bitblt reading outside image");
      }
      if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
        throw new Error("bitblt writing outside image");
      }
      for (var y = 0; y < height; y++) {
        src.data.copy(
          dst.data,
          (deltaY + y) * dst.width + deltaX << 2,
          (srcY + y) * src.width + srcX << 2,
          (srcY + y) * src.width + srcX + width << 2
        );
      }
    };
    PNG2.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
      PNG2.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
      return this;
    };
    PNG2.adjustGamma = function(src) {
      if (src.gamma) {
        for (var y = 0; y < src.height; y++) {
          for (var x = 0; x < src.width; x++) {
            var idx = src.width * y + x << 2;
            for (var i = 0; i < 3; i++) {
              var sample = src.data[idx + i] / 255;
              sample = Math.pow(sample, 1 / 2.2 / src.gamma);
              src.data[idx + i] = Math.round(sample * 255);
            }
          }
        }
        src.gamma = 0;
      }
    };
    PNG2.prototype.adjustGamma = function() {
      PNG2.adjustGamma(this);
    };
  }
});

// core/cli.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");

// core/png.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_pngjs = __toESM(require_png(), 1);
function decodePng(bytes) {
  const png = import_pngjs.PNG.sync.read(bytes);
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length) };
}
function readPng(path) {
  return decodePng((0, import_node_fs.readFileSync)(path));
}
function encodePng(image) {
  const png = new import_pngjs.PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length);
  return import_pngjs.PNG.sync.write(png);
}
function writePng(path, image) {
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(path), { recursive: true });
  (0, import_node_fs.writeFileSync)(path, encodePng(image));
}

// core/image.ts
function createImage(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
function pixelAt(image, x, y) {
  const i = (y * image.width + x) * 4;
  const d = image.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}
function setPixel(image, x, y, rgba) {
  const i = (y * image.width + x) * 4;
  image.data[i] = rgba[0];
  image.data[i + 1] = rgba[1];
  image.data[i + 2] = rgba[2];
  image.data[i + 3] = rgba[3];
}
function isOpaque(image, x, y) {
  return image.data[(y * image.width + x) * 4 + 3] > 0;
}
function rgbKey(r, g, b) {
  return r << 16 | g << 8 | b;
}
function keyRgb(key) {
  return [key >> 16 & 255, key >> 8 & 255, key & 255];
}
function opaqueBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
function cropImage(image, box) {
  const out = createImage(box.width, box.height);
  for (let y = 0; y < box.height; y += 1) {
    const src = ((box.y + y) * image.width + box.x) * 4;
    out.data.set(image.data.subarray(src, src + box.width * 4), y * box.width * 4);
  }
  return out;
}
function cropToInk(image) {
  const box = opaqueBounds(image);
  if (!box) throw new Error("\uADF8\uB9BC\uC5D0 \uBD88\uD22C\uBA85 \uD53D\uC140\uC774 \uC5C6\uB2E4");
  return cropImage(image, box);
}

// core/motion.ts
var import_node_crypto = require("node:crypto");

// core/oklab.ts
function linear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function oklab(r, g, b) {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function labDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
var cache = /* @__PURE__ */ new Map();
function oklabCached(r, g, b) {
  const key = r << 16 | g << 8 | b;
  let lab = cache.get(key);
  if (!lab) {
    lab = oklab(r, g, b);
    cache.set(key, lab);
  }
  return lab;
}
var MAGENTA_LAB = oklab(255, 0, 255);

// core/grid.ts
function isMagentaBackground(r, g, b) {
  return r > 170 && b > 170 && g < 120 && Math.abs(r - b) < 70;
}
function backgroundMask(image) {
  const { width, height } = image;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const d = image.data;
    if (d[i * 4 + 3] < 128) {
      mask[i] = 1;
    } else if (isMagentaBackground(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])) mask[i] = 1;
  }
  const corner = [];
  let magentaCorners = 0;
  let alphaCorners = 0;
  const size = Math.min(12, width, height);
  for (const [cx, cy] of [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]]) {
    for (let y = cy; y < cy + size; y += 1) {
      for (let x = cx; x < cx + size; x += 1) {
        const p = pixelAt(image, x, y);
        corner.push([p[0], p[1], p[2]]);
        if (p[3] < 128) alphaCorners += 1;
        if (isMagentaBackground(p[0], p[1], p[2])) magentaCorners += 1;
      }
    }
  }
  if (alphaCorners * 2 > corner.length) return mask;
  if (magentaCorners * 2 > corner.length) return mask;
  const median2 = [0, 1, 2].map((c) => {
    const values = corner.map((p) => p[c]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const ref = oklab(median2[0], median2[1], median2[2]);
  const near = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const d = image.data;
    if (labDistance(oklabCached(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]), ref) < 0.07) near[i] = 1;
  }
  const stack = [];
  const seen = new Uint8Array(width * height);
  const push = (i) => {
    if (near[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop();
    mask[i] = 1;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }
  return mask;
}
function smooth(profile) {
  return profile.map((v, i) => 0.25 * (profile[i - 1] ?? 0) + 0.5 * v + 0.25 * (profile[i + 1] ?? 0));
}
function peaksOf(profile) {
  const pr = smooth(profile);
  const mean = pr.reduce((a, b) => a + b, 0) / pr.length;
  const std = Math.sqrt(pr.reduce((a, b) => a + (b - mean) ** 2, 0) / pr.length);
  const threshold = mean + 0.5 * std;
  const peaks = [];
  for (let i = 1; i < pr.length - 1; i += 1) {
    if (pr[i] >= pr[i - 1] && pr[i] > pr[i + 1] && pr[i] > threshold) peaks.push(i);
  }
  return peaks;
}
var DEFAULT_MIN_BLOCK = 5;
function peakGaps(profile, minBlock = DEFAULT_MIN_BLOCK) {
  const peaks = peaksOf(profile);
  const gaps = [];
  for (let i = 1; i < peaks.length; i += 1) {
    const gap = peaks[i] - peaks[i - 1];
    if (gap >= minBlock && gap <= 40) gaps.push(gap);
  }
  return gaps;
}
function chooseBlock(gaps, minBlock = DEFAULT_MIN_BLOCK, maxBlock = 40) {
  let best = 0;
  let bestScore = 0;
  for (let p = minBlock; p <= maxBlock; p += 1) {
    let score = 0;
    for (const gap of gaps) {
      const k = Math.max(1, Math.round(gap / p));
      if (k <= 3 && Math.abs(gap / p - k) < 0.15) score += 1 / k;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
function gridLines(profile, p) {
  const n = profile.length;
  const peaks = peaksOf(profile);
  const peakSet = new Set(peaks);
  let cur = peaks.length > 0 ? peaks[0] % p : 0;
  if (cur > 0) cur -= p;
  const out = [cur];
  while (cur < n) {
    const lo = Math.trunc(cur + 0.6 * p);
    const hi = Math.trunc(cur + 1.4 * p);
    let next = cur + p;
    let best = Infinity;
    for (let q = lo; q <= hi; q += 1) {
      if (peakSet.has(q) && Math.abs(q - cur - p) < best) {
        best = Math.abs(q - cur - p);
        next = q;
      }
    }
    out.push(next);
    cur = next;
  }
  return out.map((v) => Math.max(0, Math.min(n, v)));
}
function edgeProfiles(source) {
  const { width, height } = source;
  const bg = backgroundMask(source);
  const labs = new Array(width * height);
  const BG_LAB = [2, 2, 2];
  for (let i = 0; i < width * height; i += 1) {
    const d = source.data;
    labs[i] = bg[i] ? BG_LAB : oklabCached(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  }
  const step = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const dx = new Array(width).fill(0);
  const dy = new Array(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) dx[x] += step(labs[y * width + x], labs[y * width + x - 1]);
  }
  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) dy[y] += step(labs[y * width + x], labs[(y - 1) * width + x]);
  }
  return { bg, dx, dy };
}
function extractGrid(source, options = {}) {
  const { width } = source;
  const { bg, dx, dy } = edgeProfiles(source);
  const lo = options.around ? Math.max(2, Math.floor(options.around * 0.7)) : options.minBlock ?? DEFAULT_MIN_BLOCK;
  const hi = options.around ? Math.ceil(options.around * 1.3) : 40;
  if (options.block !== void 0 && (!Number.isInteger(options.block) || options.block < 2 || options.block > 40)) {
    throw new Error("\uACE0\uC815 \uD53D\uC140 \uBE14\uB85D\uC740 2~40 \uC0AC\uC774\uC758 \uC815\uC218\uC5EC\uC57C \uD55C\uB2E4");
  }
  const block = options.block ?? (chooseBlock([...peakGaps(dx, lo), ...peakGaps(dy, lo)], lo, hi) || (options.around ? Math.round(options.around) : 0));
  if (block === 0) throw new Error("\uD53D\uC140 \uACA9\uC790\uB97C \uCC3E\uC9C0 \uBABB\uD588\uB2E4 \u2014 \uB3C4\uD2B8\uD48D \uADF8\uB9BC\uC774 \uC544\uB2C8\uB2E4");
  const xs = gridLines(dx, block);
  const ys = gridLines(dy, block);
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const cells = createImage(cols, rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const y0 = ys[j];
      const y1 = ys[j + 1];
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;
      const mx = Math.floor((x1 - x0) / 4);
      const my = Math.floor((y1 - y0) / 4);
      let total = 0;
      let background = 0;
      const buckets = /* @__PURE__ */ new Map();
      for (let y = y0 + my; y < y1 - my; y += 1) {
        for (let x = x0 + mx; x < x1 - mx; x += 1) {
          total += 1;
          const idx = y * width + x;
          if (bg[idx]) {
            background += 1;
            continue;
          }
          const d = source.data;
          const r2 = d[idx * 4];
          const g2 = d[idx * 4 + 1];
          const b2 = d[idx * 4 + 2];
          const key = Math.floor(r2 / 6) << 16 | Math.floor(g2 / 6) << 8 | Math.floor(b2 / 6);
          const list = buckets.get(key);
          if (list) list.push(r2, g2, b2);
          else buckets.set(key, [r2, g2, b2]);
        }
      }
      if (total === 0 || background * 2 > total) continue;
      let pick;
      for (const list of buckets.values()) if (!pick || list.length > pick.length) pick = list;
      if (!pick) continue;
      const n = pick.length / 3;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < pick.length; k += 3) {
        r += pick[k];
        g += pick[k + 1];
        b += pick[k + 2];
      }
      setPixel(cells, i, j, [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255]);
    }
  }
  return { cells: cropToInk(cells), block };
}

// core/motion.ts
var WIDTH = 16;
var HEIGHT = 32;
var ROWS = ["up", "right", "down", "left"];
var ORDER = [0, 1, 2, 1];
var LIMITS = { paletteUnionMax: 15, inkHeightMin: 18, inkHeightMax: 22, topMin: 10, topMax: 13, feetBottomMin: 30, feetBottomMax: 32, fitInkHeight: 21, headJitterMax: 1, bodySizeRatioMax: 1.25, areaRatioMax: 1.3, seamChangeMax: 0.36, stepChangeMin: 4, margin: 0 };
var VERSION = "pokemon-motion-2";
var EDITOR_WIDTH = 24;
var EDITOR_PADDING_X = 4;
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
function framesFromNative(image, slot) {
  if (image.width === 48 && image.height === 128) {
    if (slot !== void 0 && slot !== 0) throw Error("single native role only has slot0");
    return Array.from({ length: 12 }, (_, i) => cropImage(image, { x: i % 3 * WIDTH, y: Math.floor(i / 3) * HEIGHT, width: WIDTH, height: HEIGHT }));
  }
  if (image.width === 72 && image.height === 128) {
    if (slot !== void 0 && slot !== 0) throw Error("single editor role only has slot0");
  } else if (image.width === 288 && image.height === 256) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 7) throw Error("editor288x256 pack requires --slot0..7");
  } else throw Error(`charset dimensions ${image.width}x${image.height}; expected native48x128 or editor72x128/288x256`);
  const sx = image.width === 72 ? 0 : slot % 4 * 72, sy = image.width === 72 ? 0 : Math.floor(slot / 4) * 128;
  return Array.from({ length: 12 }, (_, i) => {
    const cell = cropImage(image, { x: sx + i % 3 * EDITOR_WIDTH, y: sy + Math.floor(i / 3) * HEIGHT, width: EDITOR_WIDTH, height: HEIGHT });
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < EDITOR_WIDTH; x++) if ((x < EDITOR_PADDING_X || x >= EDITOR_PADDING_X + WIDTH) && pixelAt(cell, x, y)[3]) throw Error(`editor frame${i} ink outside central16px; source contract wrong, do not crop it`);
    return cropImage(cell, { x: EDITOR_PADDING_X, y: 0, width: WIDTH, height: HEIGHT });
  });
}
function pack(frames) {
  if (frames.length !== 12) throw Error("12 frames required");
  const out = createImage(WIDTH * 3, HEIGHT * 4);
  frames.forEach((f, i) => {
    if (f.width !== WIDTH || f.height !== HEIGHT) throw Error("frame dimensions");
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) setPixel(out, i % 3 * WIDTH + x, Math.floor(i / 3) * HEIGHT + y, pixelAt(f, x, y));
  });
  return out;
}
function toEditorCharset(native) {
  const frames = framesFromNative(native), out = createImage(EDITOR_WIDTH * 3, HEIGHT * 4);
  frames.forEach((f, i) => {
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) setPixel(out, i % 3 * EDITOR_WIDTH + EDITOR_PADDING_X + x, Math.floor(i / 3) * HEIGHT + y, pixelAt(f, x, y));
  });
  return out;
}
function normalizeIdleBaseline(frames) {
  return frames.map((f, i) => {
    const row = Math.floor(i / 3), idle = opaqueBounds(frames[row * 3 + 1]);
    if (!idle) throw Error("idle frame missing");
    const offset = 31 - idle.y - idle.height;
    if (Math.abs(offset) > 1) throw Error(`idle baseline alignment exceeds1px (${offset})`);
    const out = createImage(WIDTH, HEIGHT);
    for (let y = 0; y < f.height; y++) for (let x = 0; x < WIDTH; x++) {
      const p = pixelAt(f, x, y);
      if (!p[3]) continue;
      if (y + offset < 0 || y + offset >= HEIGHT) throw Error("idle baseline alignment clips source");
      setPixel(out, x, y + offset, p);
    }
    return out;
  });
}
var median = (values) => {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
function skullRows(width, start, end, isInk) {
  const rows = [];
  for (let y = start; y < end; y++) {
    let bestStart = -1, bestLength = 0, run2 = -1;
    for (let x = 0; x <= width; x++) {
      if (x < width && isInk(x, y)) {
        if (run2 < 0) run2 = x;
      } else if (run2 >= 0) {
        if (x - run2 > bestLength) {
          bestStart = run2;
          bestLength = x - run2;
        }
        run2 = -1;
      }
    }
    if (bestLength) rows.push({ center: bestStart + (bestLength - 1) / 2, width: bestLength });
  }
  return rows;
}
function head(image) {
  const b = opaqueBounds(image);
  if (!b) return null;
  const rows = skullRows(image.width, b.y, Math.min(b.y + 9, b.y + b.height), (x, y) => pixelAt(image, x, y)[3] > 0);
  const centers = rows.slice(0, 6).map((r) => r.center);
  return { x: Math.round(median(centers)), y: b.y, width: median(rows.map((r) => r.width)), skullCenter: median(centers) };
}
function clipHead(image) {
  const b = opaqueBounds(image);
  if (!b) return null;
  let sum = 0, count = 0;
  for (let y = b.y; y < Math.min(b.y + 9, b.y + b.height); y++) for (let x = 0; x < image.width; x++) if (pixelAt(image, x, y)[3]) {
    sum += x;
    count++;
  }
  return { x: Math.round(sum / count), y: b.y };
}
function pixels(image) {
  let n = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) n++;
  return n;
}
function diff(a, b, fromY = 0, toY = a.height) {
  let n = 0;
  for (let y = fromY; y < Math.min(toY, a.height); y++) for (let x = 0; x < a.width; x++) {
    const pa = pixelAt(a, x, y), pb = pixelAt(b, x, y);
    if (pa[3] > 0 !== pb[3] > 0) {
      n++;
      continue;
    }
    if (pa[3] && labDistance(oklabCached(pa[0], pa[1], pa[2]), oklabCached(pb[0], pb[1], pb[2])) >= 0.12) n++;
  }
  return n;
}
function torso(image) {
  const b = opaqueBounds(image), h = head(image), start = b.y + 9, end = Math.min(b.y + b.height, b.y + Math.round(b.height * 0.65));
  const widths = [];
  let core = 0;
  for (let y = start; y < end; y++) {
    let l = h.x, r = h.x;
    if (pixelAt(image, h.x, y)[3]) {
      while (l > 0 && pixelAt(image, l - 1, y)[3]) l--;
      while (r + 1 < image.width && pixelAt(image, r + 1, y)[3]) r++;
      widths.push(r - l + 1);
    }
    for (let x = Math.max(0, h.x - 3); x <= Math.min(image.width - 1, h.x + 3); x++) if (pixelAt(image, x, y)[3]) core++;
  }
  widths.sort((a, b2) => a - b2);
  let headArea = 0;
  for (let y = b.y; y < Math.min(b.y + 9, image.height); y++) for (let x = 0; x < image.width; x++) if (pixelAt(image, x, y)[3]) headArea++;
  return { width: widths[Math.floor(widths.length * 0.3)] ?? 0, core, headArea };
}
function stableChange(a, b, endY) {
  const ha = head(a), hb = head(b), requestedShiftX = hb.x - ha.x, requestedShiftY = hb.y - ha.y;
  const registrationRejected = Math.abs(requestedShiftX) > 1 || Math.abs(requestedShiftY) > 1;
  const compare = (shiftX, shiftY) => {
    let changed = 0, alphaChanged = 0, union = 0;
    for (let y = 0; y < endY; y++) for (let x = 0; x < a.width; x++) {
      if (y >= ha.y + 9 && Math.abs(x - ha.x) > 3) continue;
      const pa = pixelAt(a, x, y), bx = x + shiftX, by = y + shiftY, pb = bx >= 0 && bx < b.width && by >= 0 && by < b.height ? pixelAt(b, bx, by) : [0, 0, 0, 0];
      if (pa[3] || pb[3]) union++;
      if (pa[3] > 0 !== pb[3] > 0) {
        changed++;
        alphaChanged++;
      } else if (pa[3] && labDistance(oklabCached(pa[0], pa[1], pa[2]), oklabCached(pb[0], pb[1], pb[2])) >= 0.12) changed++;
    }
    return { significant: changed / Math.max(1, union), alpha: alphaChanged / Math.max(1, union), compareShiftX: shiftX, compareShiftY: shiftY };
  };
  const options = registrationRejected ? [compare(0, 0)] : [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => compare(x, y)));
  options.sort((u, v) => u.significant - v.significant || u.alpha - v.alpha || Math.abs(u.compareShiftX) + Math.abs(u.compareShiftY) - (Math.abs(v.compareShiftX) + Math.abs(v.compareShiftY)) || Math.abs(u.compareShiftX - requestedShiftX) + Math.abs(u.compareShiftY - requestedShiftY) - Math.abs(v.compareShiftX - requestedShiftX) - Math.abs(v.compareShiftY - requestedShiftY));
  return { ...options[0], requestedShiftX, requestedShiftY, registrationRejected };
}
function canonicalTorso(trio, boxes) {
  const reference = trio[1], root = head(reference), startY = root.y + 9, endY = root.y + Math.round(Math.min(...boxes.map((b) => b.height)) * 0.65);
  const registration = trio.map((frame) => stableChange(reference, frame, endY));
  const core = trio.map((frame, i) => {
    const r = registration[i];
    let area = 0;
    for (let y = startY; y < endY; y++) for (let x = Math.max(0, root.x - 3); x <= Math.min(WIDTH - 1, root.x + 3); x++) {
      const sx = x + r.compareShiftX, sy = y + r.compareShiftY;
      if (sx >= 0 && sx < WIDTH && sy >= 0 && sy < HEIGHT && pixelAt(frame, sx, sy)[3]) area++;
    }
    return area;
  });
  return { core, band: { referenceFrame: 1, startY, endY, rows: endY - startY, centerX: root.x, halfWidth: 3 }, registration: registration.map((r) => ({ x: r.compareShiftX, y: r.compareShiftY, requestedX: r.requestedShiftX, requestedY: r.requestedShiftY, rejected: r.registrationRejected })) };
}
function exactDifference(a, b) {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if ((a.data[i + 3] || b.data[i + 3]) && a.data.subarray(i, i + 4).some((v, j) => v !== b.data[i + j])) n++;
  return n / Math.max(pixels(a), pixels(b));
}
var spread = (v) => Math.max(...v) - Math.min(...v);
var ratio = (v) => Math.max(...v) / Math.max(1, Math.min(...v));
function checkCharset(image, limits = LIMITS) {
  const errors = [], warnings = [], metrics = {};
  let frames;
  try {
    frames = framesFromNative(image);
  } catch (e) {
    return { pass: false, errors: [String(e)], warnings, metrics };
  }
  const colors = /* @__PURE__ */ new Set();
  let alpha = 0;
  image.data.forEach((v, i) => {
    if (i % 4 === 3) {
      if (v !== 0 && v !== 255) alpha++;
      if (v) colors.add(rgbKey(image.data[i - 3], image.data[i - 2], image.data[i - 1]));
    }
  });
  metrics.paletteUnion = colors.size;
  metrics.nonBinaryAlpha = alpha;
  if (alpha) errors.push(`alpha: ${alpha} non-binary pixels`);
  if (colors.size > limits.paletteUnionMax) errors.push(`palette union ${colors.size}>${limits.paletteUnionMax}`);
  ROWS.forEach((dir, row) => {
    const trio = frames.slice(row * 3, row * 3 + 3), bounds = trio.map(opaqueBounds), heads = trio.map(head);
    if (bounds.some((b) => !b) || heads.some((h) => !h)) {
      errors.push(`${dir}: empty/truncated frame`);
      return;
    }
    const boxes = bounds, landmarks = heads;
    const jitterX = spread(landmarks.map((h) => h.x)), jitterY = spread(landmarks.map((h) => h.y));
    if (jitterX > limits.headJitterMax || jitterY > limits.headJitterMax) errors.push(`${dir}: head jitter ${jitterX},${jitterY}`);
    if (boxes.some((b) => b.width > WIDTH || b.x < 0 || b.x + b.width > WIDTH || b.y < limits.topMin || b.y > limits.topMax || b.height < limits.inkHeightMin || b.height > limits.inkHeightMax || b.y + b.height < limits.feetBottomMin || b.y + b.height > limits.feetBottomMax)) errors.push(`${dir}: Emerald native ink bounds/height/top/feet contract`);
    const canonical = canonicalTorso(trio, boxes), torsos = trio.map((frame, i) => ({ ...torso(frame), core: canonical.core[i] })), widthRatio = ratio(torsos.map((t) => t.width)), heightRatio = ratio(boxes.map((b) => b.height)), areaRatio = ratio(torsos.map((t) => t.core)), headWidthRatio = ratio(landmarks.map((h) => h.width)), headAreaRatio = ratio(torsos.map((t) => t.headArea));
    if (heightRatio > limits.bodySizeRatioMax || areaRatio > limits.areaRatioMax || headWidthRatio > limits.bodySizeRatioMax || headAreaRatio > limits.areaRatioMax) errors.push(`${dir}: gross head/torso size drift`);
    const lowerY = Math.min(...boxes.map((b) => b.y)) + Math.round(Math.min(...boxes.map((b) => b.height)) * 0.6);
    const stepChange = diff(trio[0], trio[2], lowerY);
    if (stepChange < limits.stepChangeMin) errors.push(`${dir}: duplicate/frozen lower body (${stepChange})`);
    const upperEnd = Math.min(...boxes.map((b) => b.y + Math.round(b.height * 0.65)));
    const stable = ORDER.map((idx, i) => stableChange(trio[idx], trio[ORDER[(i + 1) % ORDER.length]], upperEnd));
    const changes = stable.map((v) => v.significant), alphaChanges = stable.map((v) => v.alpha), wholeExactChanges = ORDER.map((idx, i) => exactDifference(trio[idx], trio[ORDER[(i + 1) % ORDER.length]]));
    if (Math.max(...wholeExactChanges) > limits.seamChangeMax) warnings.push(`${dir}: whole-frame exact color/pose change ${Math.max(...wholeExactChanges).toFixed(3)}; semantic playback required`);
    if (Math.max(...changes) > limits.seamChangeMax) errors.push(`${dir}: discontinuous cycle/seam ${Math.max(...changes).toFixed(3)}`);
    metrics[dir] = { jitterX, jitterY, widthRatio, heightRatio, areaRatio, headWidthRatio, headAreaRatio, stepChange, changes, alphaChanges, comparisonRegistration: stable.map((v) => ({ x: v.compareShiftX, y: v.compareShiftY, requestedX: v.requestedShiftX, requestedY: v.requestedShiftY, rejected: v.registrationRejected })), wholeExactChanges, upperEnd, bounds: boxes, head: landmarks, torso: torsos, torsoBand: canonical.band, torsoRegistration: canonical.registration };
  });
  return { pass: errors.length === 0, errors, warnings, metrics };
}
function ranges(profile, expected) {
  const occupied = profile.map((v) => v > 0);
  const spans = [];
  let start = -1;
  for (let i = 0; i <= occupied.length; i++) {
    if (occupied[i] && start < 0) start = i;
    if (!occupied[i] && start >= 0) {
      spans.push({ start, end: i });
      start = -1;
    }
  }
  const large = spans.filter((s) => s.end - s.start >= Math.max(2, profile.length / expected / 12));
  if (large.length === expected) return large.map((s) => ({ start: s.start, end: s.end }));
  const cuts = [0];
  for (let k = 1; k < expected; k++) {
    const nominal = Math.round(profile.length * k / expected), lo = Math.round(nominal - profile.length / expected * 0.25), hi = Math.round(nominal + profile.length / expected * 0.25);
    let best = -1, bestDistance = Infinity;
    for (let i = Math.max(1, lo); i < Math.min(profile.length - 1, hi); i++) if (profile[i] === 0 && Math.abs(i - nominal) < bestDistance) {
      best = i;
      bestDistance = Math.abs(i - nominal);
    }
    if (best < 0) throw Error(`cannot find transparent gutter ${k}/${expected}`);
    cuts.push(best);
  }
  cuts.push(profile.length);
  return cuts.slice(0, -1).map((s, i) => ({ start: s, end: cuts[i + 1] }));
}
function importAtlas(source, fixedBlock) {
  const bg = edgeProfiles(source).bg, px = new Array(source.width).fill(0), py = new Array(source.height).fill(0);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (!bg[y * source.width + x]) {
    px[x]++;
    py[y]++;
  }
  const ys = ranges(py, 4), rects = [];
  ys.forEach((y) => {
    const local = new Array(source.width).fill(0);
    for (let yy = y.start; yy < y.end; yy++) for (let x = 0; x < source.width; x++) if (!bg[yy * source.width + x]) local[x]++;
    ranges(local, 3).forEach((x) => rects.push({ x: x.start, y: y.start, width: x.end - x.start, height: y.end - y.start }));
  });
  const cropped = rects.map((r) => cropImage(source, r));
  const inferred = fixedBlock === void 0 ? cropped.map((c) => extractGrid(c, { minBlock: 2 }).block) : [];
  const block = fixedBlock ?? Math.round([...inferred].sort((a, b) => a - b)[Math.floor(inferred.length / 2)]);
  const grids = cropped.map((c) => extractGrid(c, { block }).cells);
  const scale = Math.min(1, WIDTH / Math.max(...grids.map((g) => g.width)), LIMITS.fitInkHeight / Math.max(...grids.map((g) => g.height)));
  const scaled = grids.map((g) => {
    const out = createImage(Math.max(1, Math.round(g.width * scale)), Math.max(1, Math.round(g.height * scale)));
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) setPixel(out, x, y, pixelAt(g, Math.min(g.width - 1, Math.floor(x / scale)), Math.min(g.height - 1, Math.floor(y / scale))));
    return out;
  });
  const frames = scaled.map((g) => {
    const h = head(g);
    const left = Math.round((WIDTH - 1) / 2 - h.x), top = 11;
    const out = createImage(WIDTH, HEIGHT);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      const p = pixelAt(g, x, y);
      if (!p[3]) continue;
      const xx = left + x, yy = top + y;
      if (xx < 0 || xx >= WIDTH || yy < 0 || yy >= HEIGHT) throw Error("aligned body clips: regenerate source, do not crop it");
      setPixel(out, xx, yy, p);
    }
    return out;
  });
  const image = pack(normalizeIdleBaseline(frames));
  const palette = quantizePalette(image, 15);
  return { image, rects, block, inferredBlocks: inferred, scale, palette };
}
function quantizePalette(image, max) {
  const counts = /* @__PURE__ */ new Map();
  for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3]) {
    const k = rgbKey(image.data[i], image.data[i + 1], image.data[i + 2]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const order = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a - b), labs = new Map(order.map((k) => [k, oklabCached(...keyRgb(k))]));
  let reps = [], mapping = /* @__PURE__ */ new Map();
  for (let threshold = 5e-3; threshold <= 2; threshold += 5e-3) {
    reps = [];
    mapping = /* @__PURE__ */ new Map();
    for (const k of order) {
      let best = -1, dist = Infinity;
      for (const r of reps) {
        const d = labDistance(labs.get(k), labs.get(r));
        if (d < dist) {
          best = r;
          dist = d;
        }
      }
      if (best >= 0 && dist < threshold) mapping.set(k, best);
      else {
        reps.push(k);
        mapping.set(k, k);
      }
    }
    if (reps.length <= max) break;
  }
  for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3]) {
    const p = keyRgb(mapping.get(rgbKey(image.data[i], image.data[i + 1], image.data[i + 2])));
    image.data[i] = p[0];
    image.data[i + 1] = p[1];
    image.data[i + 2] = p[2];
    image.data[i + 3] = 255;
  }
  return reps.map(keyRgb);
}
function checkClip(source, meta) {
  const errors = [];
  const int = (n) => Number.isInteger(n) && n > 0;
  if (!meta || !int(meta.frameWidth) || !int(meta.frameHeight) || !Number.isFinite(meta.fps) || meta.fps <= 0 || meta.fps > 60 || !Array.isArray(meta.sourceRects) || meta.sourceRects.length < 2 || meta.sourceRects.length > 64 || !Array.isArray(meta.frameOrder) || meta.frameOrder.length < 2) throw Error("clip metadata invalid (size/fps/count/order)");
  if (meta.kind !== "drawn" && meta.kind !== "translation") errors.push("clip kind must be explicit drawn or translation");
  if (meta.frameOrder.some((i) => !Number.isInteger(i) || i < 0 || i >= meta.sourceRects.length) || new Set(meta.frameOrder).size !== meta.sourceRects.length) errors.push("clip order missing/out-of-range frames");
  if (meta.durationsMs && (meta.durationsMs.length !== meta.frameOrder.length || meta.durationsMs.some((v) => !Number.isFinite(v) || v < 16 || v > 1e4))) errors.push("clip durations invalid");
  const frames = [];
  meta.sourceRects.forEach((r, i) => {
    if (!r || ![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width !== meta.frameWidth || r.height !== meta.frameHeight || r.x + r.width > source.width || r.y + r.height > source.height) {
      errors.push(`clip crop ${i} bounds/size`);
      return;
    }
    const f = cropImage(source, r);
    if (f.data.some((v, j) => j % 4 === 3 && v !== 0 && v !== 255)) errors.push(`clip ${i} nonbinary alpha`);
    if (!opaqueBounds(f)) {
      errors.push(`clip ${i} empty`);
      return;
    }
    frames.push(f);
  });
  const colors = /* @__PURE__ */ new Set();
  frames.forEach((f, i) => {
    const b = opaqueBounds(f);
    if (b.x < 1 || b.y < 1 || b.x + b.width > f.width - 1 || b.y + b.height > f.height - 1) errors.push(`clip ${i} clipped/missing transparent margin`);
    for (let n = 0; n < f.data.length; n += 4) if (f.data[n + 3]) colors.add(rgbKey(f.data[n], f.data[n + 1], f.data[n + 2]));
  });
  const paletteMax = meta.paletteUnionMax ?? 15;
  if (!Number.isInteger(paletteMax) || paletteMax < 1 || paletteMax > 24) errors.push("clip palette ceiling invalid");
  if (colors.size > paletteMax) errors.push(`clip palette union ${colors.size}>${paletteMax}`);
  const normalized = frames.map((f) => {
    const c = cropToInk(f);
    for (let i = 0; i < c.data.length; i += 4) if (!c.data[i + 3]) c.data.fill(0, i, i + 4);
    return sha(`${c.width},${c.height}:` + sha(c.data));
  });
  if (meta.kind === "drawn" && new Set(normalized).size < 2) errors.push("advertised drawn clip is duplicate/translation-only");
  if (frames.length === meta.sourceRects.length) {
    let max = 0;
    for (let i = 1; i < frames.length; i++) max = Math.max(max, diff(frames[0], frames[i]));
    if (max < 4) errors.push("clip has fewer than 4 meaningful changed pixels");
  }
  return { pass: errors.length === 0, errors, frames, normalized, paletteUnion: colors.size };
}
function generatedClipSource(source, options) {
  const { columns, rows, frameWidth, frameHeight } = options;
  if (![columns, rows, frameWidth, frameHeight].every((v) => Number.isInteger(v) && v > 0) || columns * rows < 2 || columns * rows > 64 || frameWidth < 4 || frameHeight < 4) throw Error("generated clip layout invalid");
  const alphaThreshold = options.alphaThreshold ?? 128;
  if (alphaThreshold !== 128) throw Error("generated clip alpha threshold must retain harness contract128");
  const visible = createImage(source.width, source.height);
  for (let i = 0; i < source.data.length; i += 4) if (source.data[i + 3] >= alphaThreshold) {
    visible.data.set(source.data.subarray(i, i + 3), i);
    visible.data[i + 3] = 255;
  }
  let rects;
  if (options.sourceRects) {
    rects = options.sourceRects;
    if (rects.length !== columns * rows || rects.some((r) => ![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x + r.width > source.width || r.y + r.height > source.height)) throw Error("generated source crop count/bounds");
  } else {
    const py = new Array(source.height).fill(0);
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (visible.data[(y * source.width + x) * 4 + 3]) py[y]++;
    const ys = ranges(py, rows);
    rects = [];
    ys.forEach((y) => {
      const px = new Array(source.width).fill(0);
      for (let yy = y.start; yy < y.end; yy++) for (let x = 0; x < source.width; x++) if (visible.data[(yy * source.width + x) * 4 + 3]) px[x]++;
      ranges(px, columns).forEach((x) => rects.push({ x: x.start, y: y.start, width: x.end - x.start, height: y.end - y.start }));
    });
  }
  return { visible, rects, alphaThreshold };
}
function importGeneratedClip(source, options) {
  if (options.sampling === "raster") return importGeneratedClipRaster(source, options);
  if (options.sampling && options.sampling !== "grid") throw Error("--sampling grid|raster");
  const { frameWidth, frameHeight } = options, { visible, rects, alphaThreshold } = generatedClipSource(source, options);
  const crops = rects.map((r) => cropImage(visible, r));
  const inferred = options.block === void 0 ? crops.map((c) => extractGrid(c, { minBlock: 2 }).block) : [];
  const block = options.block ?? Math.round([...inferred].sort((a, b) => a - b)[Math.floor(inferred.length / 2)]);
  const grids = crops.map((c) => extractGrid(c, { block }).cells), scale = Math.min(1, (frameWidth - 4) / Math.max(...grids.map((g) => g.width)), (frameHeight - 4) / Math.max(...grids.map((g) => g.height)));
  const frames = grids.map((g) => {
    const scaled = createImage(Math.max(1, Math.round(g.width * scale)), Math.max(1, Math.round(g.height * scale)));
    for (let y = 0; y < scaled.height; y++) for (let x = 0; x < scaled.width; x++) setPixel(scaled, x, y, pixelAt(g, Math.min(g.width - 1, Math.floor(x / scale)), Math.min(g.height - 1, Math.floor(y / scale))));
    const landmark = clipHead(scaled);
    const left = Math.round((frameWidth - 1) / 2 - landmark.x), top = 2, out = createImage(frameWidth, frameHeight);
    for (let y = 0; y < scaled.height; y++) for (let x = 0; x < scaled.width; x++) {
      const p = pixelAt(scaled, x, y);
      if (!p[3]) continue;
      const xx = left + x, yy = top + y;
      if (xx < 1 || xx >= frameWidth - 1 || yy < 1 || yy >= frameHeight - 1) throw Error("generated clip alignment clips: regenerate source or author source crops");
      setPixel(out, xx, yy, p);
    }
    return out;
  });
  const image = createImage(frameWidth * frames.length, frameHeight);
  frames.forEach((f, i) => {
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) setPixel(image, i * frameWidth + x, y, pixelAt(f, x, y));
  });
  const maxColors = options.maxColors ?? 15;
  if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 24) throw Error("clip palette ceiling1..24");
  const palette = quantizePalette(image, maxColors);
  return { image, rects, block, inferredBlocks: inferred, scale, palette, alphaThreshold, frameCount: frames.length };
}
function importGeneratedClipRaster(source, options) {
  const { frameWidth, frameHeight, columns } = options, { visible, rects, alphaThreshold } = generatedClipSource(source, options);
  const ink = rects.map((r) => {
    const b = opaqueBounds(cropImage(visible, r));
    if (!b) throw Error("empty generated clip source frame");
    return b;
  });
  const origins = rects.map((_, i) => Math.min(...rects.slice(Math.floor(i / columns) * columns, Math.floor(i / columns) * columns + columns).map((r) => r.y)));
  const heightScale = (frameHeight - 4) / Math.max(...ink.map((b, i) => rects[i].y + b.y + b.height - origins[i])), widthScale = (frameWidth - 4) / Math.max(...ink.map((b) => b.width));
  let scale = Math.min(1, heightScale, widthScale);
  const iterations = [];
  let fit = [];
  for (let iteration = 0; iteration < 16; iteration++) {
    fit = rects.map((r, i) => {
      const b = ink[i], rows = skullRows(r.width, b.y, Math.min(r.height, b.y + 6 / scale), (x, y) => pixelAt(visible, r.x + x, r.y + y)[3] > 0);
      if (!rows.length) throw Error("empty generated clip source head");
      const skullCenter = median(rows.map((row) => row.center));
      return { skullCenter, leftExtent: skullCenter - b.x + 0.5, rightExtent: b.x + b.width - 0.5 - skullCenter, sourceRowOriginY: origins[i], sourceHeadTop: r.y + b.y, sourceFeetBottom: r.y + b.y + b.height, sourceInk: { x: r.x + b.x, y: r.y + b.y, width: b.width, height: b.height } };
    });
    const leftScale = (frameWidth - 4) / 2 / Math.max(...fit.map((f) => f.leftExtent)), rightScale = (frameWidth - 4) / 2 / Math.max(...fit.map((f) => f.rightExtent));
    iterations.push({ scale, leftScale, rightScale });
    const next = Math.min(scale, leftScale, rightScale);
    if (Math.abs(next - scale) < 1e-10) break;
    scale = next;
    if (iteration === 15) throw Error("generated clip common source skull/extent scale did not converge");
  }
  const commonScaleFit = { anchorX: (frameWidth - 1) / 2, anchorY: 2, halfWidth: (frameWidth - 4) / 2, fitInkHeight: frameHeight - 4, heightScale, widthScale, scale, iterations, frames: fit };
  const frames = rects.map((r, i) => {
    const f = fit[i], out = createImage(frameWidth, frameHeight), endY = Math.ceil((f.sourceFeetBottom - f.sourceRowOriginY) * scale) + 3;
    for (let y = 2; y < endY; y++) for (let x = -frameWidth; x < frameWidth * 2; x++) {
      const sx = Math.floor(f.skullCenter + (x - (frameWidth - 1) / 2) / scale), sy = f.sourceRowOriginY + Math.floor((y - 2 + 0.5) / scale);
      if (sx < 0 || sx >= r.width || sy < r.y || sy >= r.y + r.height) continue;
      const pixel = pixelAt(visible, r.x + sx, sy);
      if (!pixel[3]) continue;
      if (x < 1 || x >= frameWidth - 1 || y < 1 || y >= frameHeight - 1) throw Error("generated clip aligned source raster clips; common fit=" + JSON.stringify(commonScaleFit));
      setPixel(out, x, y, pixel);
    }
    return out;
  });
  const image = createImage(frameWidth * frames.length, frameHeight);
  frames.forEach((f, i) => {
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) setPixel(image, i * frameWidth + x, y, pixelAt(f, x, y));
  });
  const maxColors = options.maxColors ?? 15;
  if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 24) throw Error("clip palette ceiling1..24");
  const palette = quantizePalette(image, maxColors);
  return { image, rects, block: null, inferredBlocks: [], scale, palette, alphaThreshold, frameCount: frames.length, sampling: "common-source-raster", phase: 0.5, headBandRows: 6, headAlignment: "source dominant contiguous skull-row median before sampling", commonScaleFit, sourceFrameMetrics: fit.map((f, i) => ({ ...f, sourceHeadCenterX: rects[i].x + f.skullCenter, outputInk: opaqueBounds(frames[i]) })) };
}
function importRasterAtlas(source) {
  const bg = edgeProfiles(source).bg, py = new Array(source.height).fill(0);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (!bg[y * source.width + x]) py[y]++;
  const rects = [];
  ranges(py, 4).forEach((y) => {
    const profile = new Array(source.width).fill(0);
    for (let yy = y.start; yy < y.end; yy++) for (let x = 0; x < source.width; x++) if (!bg[yy * source.width + x]) profile[x]++;
    ranges(profile, 3).forEach((x) => rects.push({ x: x.start, y: y.start, width: x.end - x.start, height: y.end - y.start }));
  });
  const inkBoxes = rects.map((r) => {
    const visible = createImage(r.width, r.height);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (!bg[(r.y + y) * source.width + r.x + x]) setPixel(visible, x, y, [0, 0, 0, 255]);
    const b = opaqueBounds(visible);
    if (!b) throw Error("empty source head silhouette");
    return b;
  });
  const widthScale = WIDTH / Math.max(...inkBoxes.map((r) => r.width)), heightScale = LIMITS.fitInkHeight / Math.max(...inkBoxes.map((r) => r.y + r.height));
  let scale = Math.min(1, widthScale, heightScale);
  const iterations = [];
  let fit = [];
  for (let iteration = 0; iteration < 16; iteration++) {
    fit = rects.map((r, i) => {
      const ink = inkBoxes[i], isInk = (x, y) => !bg[(r.y + y) * source.width + r.x + x], rows = skullRows(r.width, ink.y, Math.min(r.height, ink.y + 6 / scale), isInk);
      if (!rows.length) throw Error("empty source head silhouette");
      const skullCenter = median(rows.map((row) => row.center));
      return { skullCenter, leftExtent: skullCenter - ink.x + 0.5, rightExtent: ink.x + ink.width - 0.5 - skullCenter, topRelativeHeight: ink.y + ink.height, ink };
    });
    const leftScale = WIDTH / 2 / Math.max(...fit.map((f) => f.leftExtent)), rightScale = WIDTH / 2 / Math.max(...fit.map((f) => f.rightExtent));
    iterations.push({ scale, leftScale, rightScale });
    const next = Math.min(scale, leftScale, rightScale);
    if (Math.abs(next - scale) < 1e-10) break;
    scale = next;
    if (iteration === 15) throw Error("common source skull/extent scale did not converge; regenerate source");
  }
  const commonScaleFit = { anchorX: 7.5, anchorY: 11, halfWidth: WIDTH / 2, fitInkHeight: LIMITS.fitInkHeight, widthScale, heightScale, scale, iterations, frames: fit };
  const frames = rects.map((r, i) => {
    const isInk = (x, y) => !bg[(r.y + y) * source.width + r.x + x];
    const cx = fit[i].skullCenter, out = createImage(WIDTH, HEIGHT + 2);
    for (let y = 11; y < Math.ceil(r.height * scale) + 12; y++) for (let x = -WIDTH; x < WIDTH * 2; x++) {
      const sx = Math.floor(cx + (x - 7.5) / scale), sy = Math.floor((y - 11 + 0.5) / scale);
      if (sx < 0 || sx >= r.width || sy < 0 || sy >= r.height || !isInk(sx, sy)) continue;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT + 2) throw Error("aligned source raster clips: regenerate source; common fit=" + JSON.stringify(commonScaleFit));
      const pixel = pixelAt(source, r.x + sx, r.y + sy);
      setPixel(out, x, y, [pixel[0], pixel[1], pixel[2], 255]);
    }
    return out;
  });
  let aligned;
  try {
    aligned = normalizeIdleBaseline(frames);
  } catch (error) {
    throw Error(String(error) + "; common fit=" + JSON.stringify(commonScaleFit));
  }
  const image = pack(aligned), palette = quantizePalette(image, 15);
  return { image, rects, scale, commonScaleFit, palette, sampling: "common-source-raster", alphaThreshold: 128, phase: 0.5, nativeFrameWidth: 16, nativeFrameHeight: 32, fitInkHeight: 21, idleFeetBottomExclusive: 31, headBandRows: 6, headAlignment: "source dominant contiguous skull-row median before sampling" };
}

// core/portrait.ts
var TRAINER_PORTRAIT = { width: 64, height: 64, maxOpaqueColors: 15, alphaThreshold: 128, fitInkMax: 62, bottomExclusive: 63, margin: 1 };
var TRAINER_ROLES = ["hero", "rival", "professor", "nurse", "merchant", "mother", "resident", "gym_leader", "company_agent", "captain", "worker", "explorer", "student", "ranger", "moon_leader", "hiker", "hero_back"];
function prepareTrainerPortrait(source) {
  const ink = cropToInk(source), bounds = opaqueBounds(ink);
  if (!bounds) throw Error("Empty trainer portrait");
  const scale = Math.min(1, TRAINER_PORTRAIT.fitInkMax / ink.width, TRAINER_PORTRAIT.fitInkMax / ink.height);
  const width = Math.max(1, Math.round(ink.width * scale)), height = Math.max(1, Math.round(ink.height * scale));
  const image = createImage(TRAINER_PORTRAIT.width, TRAINER_PORTRAIT.height), left = Math.floor((TRAINER_PORTRAIT.width - width) / 2), top = TRAINER_PORTRAIT.bottomExclusive - height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = pixelAt(ink, Math.min(ink.width - 1, Math.floor((x + 0.5) / scale)), Math.min(ink.height - 1, Math.floor((y + 0.5) / scale)));
    if (p[3] >= TRAINER_PORTRAIT.alphaThreshold) setPixel(image, left + x, top + y, [p[0], p[1], p[2], 255]);
  }
  if (!opaqueBounds(image)) throw Error("Empty trainer portrait after alpha128 threshold");
  const palette = quantizePalette(image, TRAINER_PORTRAIT.maxOpaqueColors);
  return { image, sourceInk: { width: ink.width, height: ink.height }, scale, palette, alphaThreshold: TRAINER_PORTRAIT.alphaThreshold, sampling: "nearest-existing-pixels", nativeFrame: TRAINER_PORTRAIT };
}
function checkTrainerPortrait(image) {
  const errors = [], colors = /* @__PURE__ */ new Set();
  if (image.width !== 64 || image.height !== 64) errors.push("Emerald trainer portrait must be64x64");
  let nonBinaryAlpha = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3];
    if (alpha !== 0 && alpha !== 255) nonBinaryAlpha++;
    if (alpha) colors.add(image.data.slice(i, i + 3).join(","));
  }
  if (nonBinaryAlpha) errors.push("Nonbinary trainer alpha");
  if (colors.size > 15) errors.push("Trainer exceeds15 opaque colors plus transparency");
  const bounds = opaqueBounds(image);
  if (!bounds) errors.push("Empty trainer portrait");
  else if (bounds.x < 1 || bounds.y < 1 || bounds.x + bounds.width > 63 || bounds.y + bounds.height > 63) errors.push("Trainer ink clips its declared transparent margin");
  return { pass: errors.length === 0, errors, warnings: [], metrics: { paletteUnion: colors.size, nonBinaryAlpha, bounds } };
}

// core/cli.ts
var ROOT = (0, import_node_path2.resolve)(__dirname, "..");
var DEFAULT = (0, import_node_path2.resolve)(ROOT, ".data/native");
var json = (path) => JSON.parse((0, import_node_fs2.readFileSync)(path, "utf8"));
var save = (path, value) => {
  (0, import_node_fs2.mkdirSync)((0, import_node_path2.dirname)(path), { recursive: true });
  (0, import_node_fs2.writeFileSync)(path, JSON.stringify(value, null, 2) + "\n");
};
var hashFile = (p) => sha((0, import_node_fs2.readFileSync)(p));
var escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function args(argv) {
  const flags = {};
  const bool = /* @__PURE__ */ new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw Error(`unexpected argument ${a}`);
    if (a === "--native" || a === "--structural-only") {
      bool.add(a.slice(2));
      continue;
    }
    const val = argv[++i];
    if (!val || val.startsWith("--")) throw Error(`missing value ${a}`);
    flags[a.slice(2)] = val;
  }
  return { flags, bool };
}
function pathRoot(f) {
  return (0, import_node_path2.resolve)(f.sandbox ?? process.env.POKEMON_MOTION_SANDBOX ?? DEFAULT);
}
function candidatePath(f) {
  if (!f.candidate) throw Error("--candidate required");
  return (0, import_node_path2.resolve)(f.candidate);
}
function snapshot(c) {
  const p = json((0, import_node_path2.join)(c, "provenance.json"));
  if (p.version !== VERSION) throw Error("obsolete provenance contract version; re-import source");
  if (p.kind === "portrait") {
    if (!equal(p.contract, TRAINER_PORTRAIT) || !TRAINER_ROLES.includes(p.role)) throw Error("wrong native trainer portrait contract or role");
  } else if (p.kind !== "clip" && (p.contract?.frameWidth !== WIDTH || p.contract?.frameHeight !== HEIGHT)) throw Error("wrong native charset contract; editor container is separate");
  const finalFile = p.kind === "portrait" ? "portrait.png" : p.kind === "clip" ? "clip.png" : "charset.png";
  const files = p.kind === "portrait" ? ["source.png", "prompt.txt", "portrait.png"] : p.kind === "clip" ? ["source.png", "prompt.txt", "clip.png", "clip-metadata.json"] : ["source.png", "prompt.txt", "charset.png", ...p.clip ? ["clip-source.png", "clip-metadata.json", "clip.png"] : []];
  const hashes = Object.fromEntries(files.map((file) => [file, hashFile((0, import_node_path2.join)(c, file))]));
  if (hashes["source.png"] !== p.sourceSha256 || hashes["prompt.txt"] !== p.promptSha256 || hashes[finalFile] !== p.finalSha256) throw Error("immutable provenance hash mismatch");
  if (p.kind === "clip" && hashes["clip-metadata.json"] !== p.metadataSha256) throw Error("immutable clip metadata hash mismatch");
  if (p.clip && ["clip-source.png", "clip-metadata.json", "clip.png"].some((file) => hashes[file] !== p.clip.hashes[file])) throw Error("immutable clip provenance hash mismatch");
  const implementationSha256 = sha(["cli.ts", "motion.ts", "portrait.ts", "./grid.ts", "./image.ts", "./oklab.ts", "./png.ts"].map((file) => hashFile((0, import_node_path2.resolve)(__dirname, "../core", file))).join(":"));
  return { provenance: p, hashes, implementationSha256, provenanceSha256: hashFile((0, import_node_path2.join)(c, "provenance.json")), version: VERSION, limits: p.kind === "portrait" ? TRAINER_PORTRAIT : LIMITS };
}
function runCheck(c) {
  const snap = snapshot(c);
  if (snap.provenance.kind === "portrait") return { kind: "structural", ...snap, ...checkTrainerPortrait(readPng((0, import_node_path2.join)(c, "portrait.png"))), clip: null, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  if (snap.provenance.kind === "clip") {
    const r = checkClip(readPng((0, import_node_path2.join)(c, "clip.png")), json((0, import_node_path2.join)(c, "clip-metadata.json")));
    return { kind: "structural", ...snap, pass: r.pass, errors: r.errors, warnings: [], metrics: { paletteUnion: r.paletteUnion, normalized: r.normalized, frames: r.frames.length }, clip: { pass: r.pass, errors: r.errors, normalized: r.normalized }, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  const result = checkCharset(readPng((0, import_node_path2.join)(c, "charset.png")));
  let clip = null;
  if (snap.provenance.clip) {
    const r = checkClip(readPng((0, import_node_path2.join)(c, "clip-source.png")), json((0, import_node_path2.join)(c, "clip-metadata.json")));
    clip = { pass: r.pass, errors: r.errors, normalized: r.normalized };
    if (!r.pass) {
      result.pass = false;
      result.errors.push(...r.errors);
    }
  }
  return { kind: "structural", ...snap, ...result, clip, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function reviewFresh(c, snap) {
  const p = (0, import_node_path2.join)(c, "review.json");
  if (!(0, import_node_fs2.existsSync)(p)) throw Error("missing semantic review; run preview then review with evidence");
  const r = json(p);
  if (!equal(r.hashes, snap.hashes) || r.provenanceSha256 !== snap.provenanceSha256 || r.version !== VERSION || r.implementationSha256 !== snap.implementationSha256 || !equal(r.limits, snap.limits)) throw Error("stale review/source/final hash");
  if (r.evidence.some((e) => !(0, import_node_fs2.existsSync)((0, import_node_path2.join)(c, e.file)) || hashFile((0, import_node_path2.join)(c, e.file)) !== e.sha256)) throw Error("review evidence changed/missing");
  if (r.previewSha256 !== hashFile((0, import_node_path2.join)(c, "preview.html"))) throw Error("review preview changed/missing");
  if (r.verdict !== "pass") throw Error("semantic review rejected");
  return r;
}
function gate(c) {
  const report = runCheck(c);
  let review = null;
  try {
    review = reviewFresh(c, report);
  } catch (e) {
    report.pass = false;
    report.errors.push(String(e));
  }
  const out = { ...report, kind: "gate", reviewSha256: review ? hashFile((0, import_node_path2.join)(c, "review.json")) : null };
  save((0, import_node_path2.join)(c, "gate.json"), out);
  return out;
}
function preview(c) {
  const snap = snapshot(c);
  if (snap.provenance.kind === "portrait") return previewPortrait(c, snap);
  if (snap.provenance.kind === "clip") return previewStandaloneClip(c, snap);
  const s = snap, src = `data:image/png;base64,${(0, import_node_fs2.readFileSync)((0, import_node_path2.join)(c, "charset.png")).toString("base64")}`;
  const clip = s.provenance.clip ? { src: `data:image/png;base64,${(0, import_node_fs2.readFileSync)((0, import_node_path2.join)(c, "clip.png")).toString("base64")}`, meta: json((0, import_node_path2.join)(c, "clip-metadata.json")) } : null;
  const model = { src, clip, rows: ROWS, order: ORDER, frameWidth: WIDTH, frameHeight: HEIGHT };
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\uCE90\uB9AD\uD130 \uBAA8\uC158 \uAC80\uC218</title><style>body{background:#17202b;color:#eee;font:16px system-ui;margin:24px}section{display:flex;flex-wrap:wrap;gap:24px}article{background:#344152;padding:16px}canvas{image-rendering:pixelated;background:repeating-conic-gradient(#344152 0% 25%,#526075 0% 50%) 50% / 8px 8px;vertical-align:bottom}button,input{font:inherit}small{display:block;max-width:70ch}</style><h1>${escape(s.provenance.role)} \uBAA8\uC158 \uAC80\uC218</h1><p>\uC6D0\uBCF8 1\uBC30\xB7\uAC8C\uC784 3\uBC30. \uBC29\uD5A5 \uC758\uBBF8, \uBC1C \uAD50\uB300, \uC0C1\uCCB4 \uACE0\uC815, \uC18C\uD488 \uC77C\uAD00\uC131\uACFC \uB8E8\uD504 \uACBD\uACC4\uB97C \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694.</p><button id="pause">\uC77C\uC2DC\uC815\uC9C0</button> <label>\uC18D\uB3C4 <input id="speed" type="range" min="60" max="300" value="130"></label> <span id="frame"></span><section id="walk"></section><h2>12\uAC1C \uC6D0\uBCF8 \uD3EC\uC988</h2><img style="image-rendering:pixelated;width:144px" src="${src}" alt="4\uBC29\uD5A5 3\uD3EC\uC988 \uC6D0\uBCF8"><section id="clip"></section><small>\uCD9C\uCC98 ${s.hashes["source.png"]}<br>\uCD5C\uC885 ${s.hashes["charset.png"]}<br>\uAD6C\uC870 \uAD00\uBB38\uC740 \uBC29\uD5A5\uC774\uB098 \uB2E4\uB9AC \uAD50\uB300\uC758 \uC758\uBBF8\uB97C \uC99D\uBA85\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC80\uC218 \uD6C4 \uBCC4\uB3C4 review \uBA85\uB839\uC73C\uB85C \uD310\uC815\uC744 \uB0A8\uAE41\uB2C8\uB2E4.</small><script type="application/json" id="model">${JSON.stringify(model).replace(/</g, "\\u003c")}</script><script>
const m=JSON.parse(document.querySelector('#model').textContent);let step=0,paused=false,last=0;const img=new Image();img.src=m.src;const canvases=[];m.rows.forEach((dir,row)=>{const card=document.createElement('article');card.append(document.createTextNode(dir+' '));[1,3].forEach(scale=>{const cv=document.createElement('canvas');cv.width=m.frameWidth;cv.height=m.frameHeight;cv.style.width=m.frameWidth*scale+'px';cv.style.height=m.frameHeight*scale+'px';card.append(cv);canvases.push({cv,row});});document.querySelector('#walk').append(card);});const clipImage=new Image(),clips=[];if(m.clip){clipImage.src=m.clip.src;const cv=document.createElement('canvas');cv.width=m.clip.meta.frameWidth;cv.height=m.clip.meta.frameHeight;cv.style.width=cv.width*3+'px';cv.style.height=cv.height*3+'px';document.querySelector('#clip').append(cv);clips.push(cv);}let clipStep=0,clipLast=0;document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'\uC7AC\uC0DD':'\uC77C\uC2DC\uC815\uC9C0';};function draw(t){if(!paused&&t-last>=+document.querySelector('#speed').value){step=(step+1)%4;last=t;}canvases.forEach(({cv,row})=>{const ctx=cv.getContext('2d');ctx.clearRect(0,0,m.frameWidth,m.frameHeight);ctx.drawImage(img,m.order[step]*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,0,0,m.frameWidth,m.frameHeight);});document.querySelector('#frame').textContent='pose '+m.order[step];if(m.clip){const meta=m.clip.meta;if(!paused&&t-clipLast>=(meta.durationsMs?.[clipStep]??1000/meta.fps)){clipStep=(clipStep+1)%meta.frameOrder.length;clipLast=t;}clips.forEach(cv=>{const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(clipImage,meta.frameOrder[clipStep]*cv.width,0,cv.width,cv.height,0,0,cv.width,cv.height);});}requestAnimationFrame(draw);}img.onload=()=>requestAnimationFrame(draw);
</script></html>`;
  const p = (0, import_node_path2.join)(c, "preview.html");
  (0, import_node_fs2.writeFileSync)(p, html);
  save((0, import_node_path2.join)(c, "preview-receipt.json"), { ...s, previewSha256: hashFile(p) });
  return p;
}
async function run(argv) {
  const [command, ...rest] = argv;
  try {
    const { flags: f, bool } = args(rest), base = pathRoot(f);
    if (command === "portrait-import") {
      if (!f.role || !f.source || !f["prompt-file"]) throw Error("portrait-import requires --role --source --prompt-file");
      if (!TRAINER_ROLES.includes(f.role)) throw Error("portrait role must be one of16 cast roles or hero_back");
      const sourceBytes = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f.source)), prompt = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f["prompt-file"]));
      if (!prompt.toString().trim()) throw Error("prompt cannot be blank");
      const source = readPng((0, import_node_path2.resolve)(f.source)), prepared = bool.has("native") ? { image: source, sourceDimensions: { width: source.width, height: source.height }, scale: 1, sampling: "native-pixels-unchanged" } : prepareTrainerPortrait(source), checked = checkTrainerPortrait(prepared.image);
      if (!checked.pass) throw Error(checked.errors.join("; "));
      const id = `portrait-${f.role}-${Date.now()}-${sha(sourceBytes).slice(0, 8)}`, c = (0, import_node_path2.join)(base, "candidates", id);
      (0, import_node_fs2.mkdirSync)(c, { recursive: true });
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "source.png"), sourceBytes);
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "prompt.txt"), prompt);
      writePng((0, import_node_path2.join)(c, "portrait.png"), prepared.image);
      const { image: _, ...processing } = prepared;
      save((0, import_node_path2.join)(c, "provenance.json"), { version: VERSION, kind: "portrait", mode: bool.has("native") ? "native" : "extracted-existing-pixels", createdAt: (/* @__PURE__ */ new Date()).toISOString(), role: f.role, sourceSha256: sha(sourceBytes), promptSha256: sha(prompt), finalSha256: hashFile((0, import_node_path2.join)(c, "portrait.png")), sourceDimensions: { width: source.width, height: source.height }, contract: TRAINER_PORTRAIT, limits: TRAINER_PORTRAIT, ...processing });
      console.log(c);
      return 0;
    }
    if (command === "status") {
      const seed = json((0, import_node_path2.resolve)(f.seed ?? (0, import_node_path2.join)(ROOT, "core/seed.json")));
      const dir = (0, import_node_path2.join)(base, "candidates");
      console.log(JSON.stringify({ base, roles: seed.roles, candidates: (0, import_node_fs2.existsSync)(dir) ? (0, import_node_fs2.readdirSync)(dir).map((id) => {
        const c = (0, import_node_path2.join)(dir, id);
        try {
          const snap = snapshot(c);
          const gatePath = (0, import_node_path2.join)(c, "gate.json"), g = (0, import_node_fs2.existsSync)(gatePath) ? json(gatePath) : null;
          let reviewed = false;
          try {
            reviewFresh(c, snap);
            reviewed = true;
          } catch {
          }
          return { id, role: snap.provenance.role, hashes: snap.hashes, reviewed, gateFresh: !!g && g.pass && equal(g.hashes, snap.hashes) && g.provenanceSha256 === snap.provenanceSha256 && g.version === VERSION && g.implementationSha256 === snap.implementationSha256 && equal(g.limits, snap.limits) && reviewed && g.reviewSha256 === hashFile((0, import_node_path2.join)(c, "review.json")) };
        } catch (error) {
          return { id, error: String(error) };
        }
      }) : [] }, null, 2));
      return 0;
    }
    if (command === "clip-import") {
      if (!f.role || !f.source || !f["prompt-file"]) throw Error("clip-import requires --role --source --prompt-file");
      const seed = json((0, import_node_path2.resolve)(f.seed ?? (0, import_node_path2.join)(ROOT, "core/seed.json")));
      if (!seed.roles.includes(f.role)) throw Error("clip role not in seed");
      const defaults = seed.openingClips, authored = f["clip-spec"] ? json((0, import_node_path2.resolve)(f["clip-spec"])) : {};
      const sourceBytes = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f.source)), prompt = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f["prompt-file"]));
      if (!prompt.toString().trim()) throw Error("prompt cannot be blank");
      const columns = Number(f.columns ?? authored.columns ?? defaults.columns), rows = Number(f.rows ?? authored.rows ?? defaults.rows), frameWidth = Number(f["frame-width"] ?? authored.frameWidth ?? defaults.frameWidth), frameHeight = Number(f["frame-height"] ?? authored.frameHeight ?? defaults.frameHeight), block = f.block === void 0 ? void 0 : Number(f.block);
      const sampling = f.sampling ?? authored.sampling ?? (block === void 0 ? "raster" : "grid");
      if (sampling !== "raster" && sampling !== "grid") throw Error("--sampling raster|grid");
      const sourceImage = readPng((0, import_node_path2.resolve)(f.source));
      let imported;
      if (bool.has("native")) {
        if (![columns, rows, frameWidth, frameHeight].every((n) => Number.isInteger(n) && n > 0) || columns * rows < 2 || columns * rows > 64 || sourceImage.width !== columns * frameWidth || sourceImage.height !== rows * frameHeight) throw Error("native clip must exactly match its declared grid");
        const image = createImage(columns * rows * frameWidth, frameHeight);
        for (let i = 0; i < columns * rows; i++) for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) setPixel(image, i * frameWidth + x, y, pixelAt(sourceImage, i % columns * frameWidth + x, Math.floor(i / columns) * frameHeight + y));
        imported = { image, frameCount: columns * rows, scale: 1, sampling: "native-pixels-unchanged", rects: Array.from({ length: columns * rows }, (_, i) => ({ x: i % columns * frameWidth, y: Math.floor(i / columns) * frameHeight, width: frameWidth, height: frameHeight })) };
      } else imported = importGeneratedClip(sourceImage, { columns, rows, frameWidth, frameHeight, block, sampling, sourceRects: authored.sourceRects, alphaThreshold: 128, maxColors: Number(f["max-colors"] ?? authored.paletteUnionMax ?? defaults.paletteUnionMax) });
      const clipId = f["clip-id"] ?? authored.id ?? `${f.role}-intro`;
      if (!/^[a-z][a-z0-9-]*$/.test(clipId)) throw Error("clip id must be kebab-case");
      const meta = { id: clipId, frameWidth, frameHeight, fps: Number(f.fps ?? authored.fps ?? defaults.fps), frameOrder: f["frame-order"] ? f["frame-order"].split(",").map(Number) : authored.frameOrder ?? Array.from({ length: imported.frameCount }, (_, i) => i), sourceRects: Array.from({ length: imported.frameCount }, (_, i) => ({ x: i * frameWidth, y: 0, width: frameWidth, height: frameHeight })), kind: authored.kind ?? "drawn", paletteUnionMax: Number(f["max-colors"] ?? authored.paletteUnionMax ?? defaults.paletteUnionMax), ...authored.durationsMs ? { durationsMs: authored.durationsMs } : {} };
      const checked = checkClip(imported.image, meta);
      if (!checked.pass) throw Error(checked.errors.join("; "));
      const id = `clip-${clipId}-${Date.now()}-${sha(sourceBytes).slice(0, 8)}`, c = (0, import_node_path2.join)(base, "candidates", id);
      (0, import_node_fs2.mkdirSync)(c, { recursive: true });
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "source.png"), sourceBytes);
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "prompt.txt"), prompt);
      writePng((0, import_node_path2.join)(c, "clip.png"), imported.image);
      save((0, import_node_path2.join)(c, "clip-metadata.json"), meta);
      const { image: preparedImage, ...processing } = imported;
      save((0, import_node_path2.join)(c, "provenance.json"), { version: VERSION, kind: "clip", mode: bool.has("native") ? "native" : "generated", createdAt: (/* @__PURE__ */ new Date()).toISOString(), role: f.role, clipId, sourceSha256: sha(sourceBytes), promptSha256: sha(prompt), finalSha256: hashFile((0, import_node_path2.join)(c, "clip.png")), metadataSha256: hashFile((0, import_node_path2.join)(c, "clip-metadata.json")), columns, rows, frameWidth, frameHeight, frameCount: imported.frameCount, sourceRects: imported.rects, commonScale: imported.scale, headAlignment: "top silhouette root, native translations only", ...processing, limits: LIMITS });
      console.log(c);
      return 0;
    }
    if (command === "import") {
      if (!f.role || !f.source || !f["prompt-file"]) throw Error("import requires --role --source --prompt-file");
      const seed = json((0, import_node_path2.resolve)(f.seed ?? (0, import_node_path2.join)(ROOT, "core/seed.json")));
      if (!seed.roles.includes(f.role)) throw Error("role not in seed");
      const sourceBytes = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f.source)), prompt = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f["prompt-file"]));
      if (!prompt.toString().trim()) throw Error("prompt cannot be blank; document legacy origin if native");
      const block = f.block === void 0 ? void 0 : Number(f.block);
      if (block !== void 0 && (!Number.isInteger(block) || block < 2 || block > 40)) throw Error("--block integer 2..40");
      let preparedClip = null;
      if (f["clip-metadata"] || f["clip-source"]) {
        if (!f["clip-metadata"] || !f["clip-source"]) throw Error("clip requires metadata and source");
        const metaBytes = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f["clip-metadata"])), meta = JSON.parse(metaBytes.toString()), sourceBytes2 = (0, import_node_fs2.readFileSync)((0, import_node_path2.resolve)(f["clip-source"])), checked = checkClip(readPng((0, import_node_path2.resolve)(f["clip-source"])), meta);
        if (!checked.pass) throw Error(checked.errors.join("; "));
        preparedClip = { metaBytes, sourceBytes: sourceBytes2, meta, checked };
      }
      const source = readPng((0, import_node_path2.resolve)(f.source));
      let imported, image;
      if (bool.has("native")) {
        const slot = f.slot === void 0 ? void 0 : Number(f.slot);
        image = pack(framesFromNative(source, slot));
        imported = { mode: "native", slot: slot ?? 0, scale: 1 };
      } else if ((f.sampling ?? (block === void 0 ? "raster" : "grid")) === "raster") {
        const r = importRasterAtlas(source);
        image = r.image;
        imported = { mode: "generated", ...r, image: void 0 };
      } else {
        if (f.sampling && f.sampling !== "grid") throw Error("--sampling grid|raster");
        const r = importAtlas(source, block);
        image = r.image;
        imported = { mode: "generated", commonBlock: r.block, inferredBlocks: r.inferredBlocks, sourceRects: r.rects, commonScale: r.scale, palette: r.palette, headAlignment: "top silhouette root, native translations only" };
      }
      const id = `${f.role}-${Date.now()}-${sha(sourceBytes).slice(0, 8)}`, c = (0, import_node_path2.join)(base, "candidates", id);
      (0, import_node_fs2.mkdirSync)(c, { recursive: true });
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "source.png"), sourceBytes);
      (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "prompt.txt"), prompt);
      writePng((0, import_node_path2.join)(c, "charset.png"), image);
      let clip = null;
      if (preparedClip) {
        const { metaBytes, sourceBytes: sourceBytes2, meta, checked: r } = preparedClip;
        (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "clip-source.png"), sourceBytes2);
        (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(c, "clip-metadata.json"), metaBytes);
        const strip = createImage(meta.frameWidth * r.frames.length, meta.frameHeight);
        r.frames.forEach((fr, i) => {
          for (let y = 0; y < fr.height; y++) for (let x = 0; x < fr.width; x++) setPixel(strip, i * fr.width + x, y, pixelAt(fr, x, y));
        });
        writePng((0, import_node_path2.join)(c, "clip.png"), strip);
        clip = { hashes: Object.fromEntries(["clip-source.png", "clip-metadata.json", "clip.png"].map((file) => [file, hashFile((0, import_node_path2.join)(c, file))])) };
      }
      save((0, import_node_path2.join)(c, "provenance.json"), { version: VERSION, createdAt: (/* @__PURE__ */ new Date()).toISOString(), role: f.role, sourceSha256: sha(sourceBytes), promptSha256: sha(prompt), finalSha256: hashFile((0, import_node_path2.join)(c, "charset.png")), contract: seed.charset, limits: LIMITS, ...imported, clip });
      console.log(c);
      return 0;
    }
    if (command === "check") {
      if (f.source && f.kind === "portrait") {
        const r2 = checkTrainerPortrait(readPng((0, import_node_path2.resolve)(f.source)));
        console.log(JSON.stringify(r2, null, 2));
        if (f.report) save((0, import_node_path2.resolve)(f.report), { ...r2, version: VERSION, limits: TRAINER_PORTRAIT, sourceSha256: hashFile((0, import_node_path2.resolve)(f.source)) });
        return r2.pass ? 0 : 1;
      }
      if (f.source) {
        const source = readPng((0, import_node_path2.resolve)(f.source)), image = pack(framesFromNative(source, f.slot === void 0 ? void 0 : Number(f.slot))), r2 = checkCharset(image);
        console.log(JSON.stringify(r2, null, 2));
        if (f.report) save((0, import_node_path2.resolve)(f.report), { ...r2, version: VERSION, limits: LIMITS, sourceSha256: hashFile((0, import_node_path2.resolve)(f.source)) });
        return r2.pass ? 0 : 1;
      }
      const c = candidatePath(f), r = runCheck(c);
      save((0, import_node_path2.join)(c, "check.json"), r);
      console.log(JSON.stringify(r, null, 2));
      return r.pass ? 0 : 1;
    }
    if (command === "preview") {
      console.log(preview(candidatePath(f)));
      return 0;
    }
    if (command === "review") {
      const c = candidatePath(f), snap = snapshot(c), r = runCheck(c);
      if (!r.pass) throw Error("structural check fails; cannot record pass review");
      if (!f.who || !f.why || !f.evidence || !["pass", "redo"].includes(f.verdict ?? "")) throw Error("review requires --who --why --evidence file[,file] --verdict pass|redo");
      const previewPath = (0, import_node_path2.join)(c, "preview.html"), receiptPath = (0, import_node_path2.join)(c, "preview-receipt.json");
      if (!(0, import_node_fs2.existsSync)(previewPath) || !(0, import_node_fs2.existsSync)(receiptPath)) throw Error("preview required before review");
      const pr = json(receiptPath);
      if (pr.previewSha256 !== hashFile(previewPath) || !equal(pr.hashes, snap.hashes) || pr.implementationSha256 !== snap.implementationSha256 || pr.provenanceSha256 !== snap.provenanceSha256 || pr.version !== snap.version || !equal(pr.limits, snap.limits)) throw Error("stale preview");
      const evidence = f.evidence.split(",").map((path, i) => {
        const file = `review-evidence-${i}${path.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".bin"}`;
        (0, import_node_fs2.copyFileSync)((0, import_node_path2.resolve)(path), (0, import_node_path2.join)(c, file));
        return { file, sha256: hashFile((0, import_node_path2.join)(c, file)) };
      });
      if ((0, import_node_fs2.existsSync)((0, import_node_path2.join)(c, "review.json"))) {
        const previous = hashFile((0, import_node_path2.join)(c, "review.json"));
        (0, import_node_fs2.copyFileSync)((0, import_node_path2.join)(c, "review.json"), (0, import_node_path2.join)(c, `review-history-${previous}.json`));
      }
      save((0, import_node_path2.join)(c, "review.json"), { ...snap, createdAt: (/* @__PURE__ */ new Date()).toISOString(), verdict: f.verdict, who: f.who, why: f.why, evidence, semanticChecklist: snap.provenance.kind === "portrait" ? ["native1x silhouette and anatomy readable", "role/outfit matches declared source identity", "palette and edge pixels reviewed at1x2x3x", snap.provenance.mode === "native" ? "native source pixels and complete pose retained without fit" : "uniform nearest fit retains aspect and complete pose", "front/back orientation is correct for declared role"] : snap.provenance.kind === "clip" ? ["blink/talk and gestures visible if authored", "all source poses retained in declared order", "head/body identity and root stable", "actual shapes change if advertised drawn", "timing and loop natural"] : ["correct four directions", "alternating feet read while walking", "head/body identity stable", "loop seam natural", "clip is actual drawn poses if advertised drawn"], previewSha256: hashFile(previewPath) });
      console.log((0, import_node_path2.join)(c, "review.json"));
      return 0;
    }
    if (command === "gate") {
      const c = candidatePath(f), r = bool.has("structural-only") ? runCheck(c) : gate(c);
      if (bool.has("structural-only")) save((0, import_node_path2.join)(c, "check.json"), r);
      console.log(JSON.stringify(r, null, 2));
      return r.pass ? 0 : 1;
    }
    if (command === "build") {
      const c = candidatePath(f), snap = snapshot(c), gp = (0, import_node_path2.join)(c, "gate.json");
      if (!(0, import_node_fs2.existsSync)(gp)) throw Error("missing gate; run gate first");
      const g = json(gp);
      if (!g.pass || g.kind !== "gate" || g.version !== VERSION || g.implementationSha256 !== snap.implementationSha256 || !equal(g.hashes, snap.hashes) || g.provenanceSha256 !== snap.provenanceSha256 || !equal(g.limits, snap.limits) || g.reviewSha256 !== hashFile((0, import_node_path2.join)(c, "review.json"))) throw Error("failed/stale gate hash");
      reviewFresh(c, snap);
      const current = runCheck(c);
      if (!current.pass) throw Error("current structure fails");
      if (snap.provenance.kind === "portrait") {
        const out2 = (0, import_node_path2.resolve)(f.out ?? (0, import_node_path2.join)(base, "output", "portraits", snap.provenance.role));
        (0, import_node_fs2.mkdirSync)(out2, { recursive: true });
        ["portrait.png", "provenance.json", "review.json", "gate.json"].forEach((file) => (0, import_node_fs2.copyFileSync)((0, import_node_path2.join)(c, file), (0, import_node_path2.join)(out2, file)));
        save((0, import_node_path2.join)(out2, "motion.json"), { kind: "portrait", profile: "emerald-trainer-native", role: snap.provenance.role, width: TRAINER_PORTRAIT.width, height: TRAINER_PORTRAIT.height, frameCount: 1, paletteUnionMax: TRAINER_PORTRAIT.maxOpaqueColors, alphaThreshold: TRAINER_PORTRAIT.alphaThreshold, sourceSha256: snap.hashes["source.png"], promptSha256: snap.hashes["prompt.txt"], portraitSha256: snap.hashes["portrait.png"], gateSha256: hashFile(gp) });
        console.log(out2);
        return 0;
      }
      const out = (0, import_node_path2.resolve)(f.out ?? (0, import_node_path2.join)(base, "output", snap.provenance.role));
      (0, import_node_fs2.mkdirSync)(out, { recursive: true });
      if (snap.provenance.kind === "clip") {
        const clipOut = (0, import_node_path2.resolve)(f.out ?? (0, import_node_path2.join)(base, "output", "clips", snap.provenance.clipId));
        (0, import_node_fs2.mkdirSync)(clipOut, { recursive: true });
        ["clip.png", "clip-metadata.json", "provenance.json", "review.json", "gate.json"].forEach((file) => (0, import_node_fs2.copyFileSync)((0, import_node_path2.join)(c, file), (0, import_node_path2.join)(clipOut, file)));
        save((0, import_node_path2.join)(clipOut, "motion.json"), { ...json((0, import_node_path2.join)(c, "clip-metadata.json")), role: snap.provenance.role, sourceSha256: snap.hashes["source.png"], clipSha256: snap.hashes["clip.png"], gateSha256: hashFile(gp) });
        console.log(clipOut);
        return 0;
      }
      const files = ["charset.png", "provenance.json", "review.json", "gate.json", ...snap.provenance.clip ? ["clip.png", "clip-metadata.json"] : []];
      files.forEach((file) => (0, import_node_fs2.copyFileSync)((0, import_node_path2.join)(c, file), (0, import_node_path2.join)(out, file)));
      writePng((0, import_node_path2.join)(out, "editor-charset.png"), toEditorCharset(readPng((0, import_node_path2.join)(c, "charset.png"))));
      save((0, import_node_path2.join)(out, "motion.json"), { role: snap.provenance.role, frameWidth: WIDTH, frameHeight: HEIGHT, rows: ROWS, columns: ["stepA", "idle", "stepB"], idle: 1, order: ORDER, frameMs: 130, sourceSha256: snap.hashes["source.png"], charsetSha256: snap.hashes["charset.png"], nativeSheetWidth: WIDTH * 3, nativeSheetHeight: HEIGHT * 4, editorAdapter: { file: "editor-charset.png", frameWidth: EDITOR_WIDTH, frameHeight: HEIGHT, paddingX: EDITOR_PADDING_X, resize: false, sha256: hashFile((0, import_node_path2.join)(out, "editor-charset.png")) }, gateSha256: hashFile(gp), clip: snap.provenance.clip ? json((0, import_node_path2.join)(c, "clip-metadata.json")) : null });
      console.log(out);
      return 0;
    }
    throw Error("stages: status import clip-import portrait-import check preview review gate build");
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}
function previewPortrait(c, s) {
  const src = `data:image/png;base64,${(0, import_node_fs2.readFileSync)((0, import_node_path2.join)(c, "portrait.png")).toString("base64")}`;
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\uD2B8\uB808\uC774\uB108 \uB3C4\uD2B8 \uAC80\uC218</title><style>body{background:#17202b;color:#eee;font:16px system-ui;margin:24px}section{display:flex;flex-wrap:wrap;gap:24px;align-items:end}img{image-rendering:pixelated;display:block;background:repeating-conic-gradient(#344152 0% 25%,#526075 0% 50%) 50% / 8px 8px}small{display:block;max-width:80ch}</style><h1>${escape(s.provenance.role)} \uD2B8\uB808\uC774\uB10864\xD764 \uAC80\uC218</h1><p>\uC815\uC801 \uC6D0\uBCF81\uBC30\xB72\uBC30\xB73\uBC30. \uC5BC\uAD74\xB7\uC637\xB7\uC55E\uB4A4 \uBC29\uD5A5\xB7\uC2E4\uB8E8\uC5E3\xB7\uAC00\uC7A5\uC790\uB9AC \uD53D\uC140\uC744 \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694. \uAD6C\uC870 \uD1B5\uACFC\uAC00 \uADF8\uB9BC\uC758 \uD488\uC9C8 \uC2B9\uC778\uC740 \uC544\uB2D9\uB2C8\uB2E4.</p><section>${[1, 2, 3].map((scale) => `<article><h2>${scale}\xD7</h2><img data-scale="${scale}" width="${64 * scale}" height="${64 * scale}" src="${src}" alt="${escape(s.provenance.role)} \uD2B8\uB808\uC774\uB108 ${scale}\uBC30"></article>`).join("")}</section><small>\uC6D0\uBCF8 ${s.hashes["source.png"]}<br>\uD504\uB86C\uD504\uD2B8 ${s.hashes["prompt.txt"]}<br>\uD6C4\uBCF4 ${s.hashes["portrait.png"]}</small></html>`;
  const p = (0, import_node_path2.join)(c, "preview.html");
  (0, import_node_fs2.writeFileSync)(p, html);
  save((0, import_node_path2.join)(c, "preview-receipt.json"), { ...s, previewSha256: hashFile(p) });
  return p;
}
function previewStandaloneClip(c, s) {
  const src = `data:image/png;base64,${(0, import_node_fs2.readFileSync)((0, import_node_path2.join)(c, "clip.png")).toString("base64")}`, meta = json((0, import_node_path2.join)(c, "clip-metadata.json"));
  const model = { src, meta };
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\uC624\uD504\uB2DD \uD074\uB9BD \uAC80\uC218</title><style>body{background:#17202b;color:#eee;font:16px system-ui;margin:24px}section{display:flex;flex-wrap:wrap;gap:24px}canvas{image-rendering:pixelated;background:repeating-conic-gradient(#344152 0% 25%,#526075 0% 50%) 50% / 8px 8px;vertical-align:bottom}button,input{font:inherit}img{max-width:100%;image-rendering:pixelated}</style><h1>${escape(s.provenance.clipId)} \uC2E4\uC81C \uC0DD\uC131 \uD074\uB9BD</h1><p>\uC6D0\uBCF8 1\uBC30\xB73\uBC30 \uC7AC\uC0DD. \uB208 \uAE5C\uBE61\uC784, \uB9D0\uD558\uB294 \uC785, \uC190\uACFC \uC18C\uD488\uC758 \uC2E4\uC81C \uBCC0\uD654 \uBC0F \uC778\uBB3C \uC815\uCCB4\uC131\uC744 \uD655\uC778\uD558\uC138\uC694.</p><button id="pause">\uC77C\uC2DC\uC815\uC9C0</button> <button id="next">\uB2E4\uC74C \uD504\uB808\uC784</button> <span id="frame"></span><section id="clips"></section><h2>\uC804\uCCB4 ${meta.sourceRects.length}\uD3EC\uC988</h2><img src="${src}" alt="\uC2E4\uC81C \uC0DD\uC131 \uD3EC\uC988 \uC2A4\uD2B8\uB9BD"><p>\uC6D0\uBCF8 ${s.hashes["source.png"]}<br>\uCD5C\uC885 ${s.hashes["clip.png"]}</p><script type="application/json" id="model">${JSON.stringify(model).replace(/</g, "\\u003c")}</script><script>
const m=JSON.parse(document.querySelector('#model').textContent),img=new Image();let step=0,paused=false,last=0;const canvases=[];[1,3].forEach(scale=>{const cv=document.createElement('canvas');cv.width=m.meta.frameWidth;cv.height=m.meta.frameHeight;cv.style.width=cv.width*scale+'px';cv.style.height=cv.height*scale+'px';document.querySelector('#clips').append(cv);canvases.push(cv);});document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'\uC7AC\uC0DD':'\uC77C\uC2DC\uC815\uC9C0';};document.querySelector('#next').onclick=()=>{paused=true;step=(step+1)%m.meta.frameOrder.length;};function draw(t){if(!paused&&t-last>=(m.meta.durationsMs?.[step]??1000/m.meta.fps)){step=(step+1)%m.meta.frameOrder.length;last=t;}const index=m.meta.frameOrder[step];canvases.forEach(cv=>{const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(img,index*cv.width,0,cv.width,cv.height,0,0,cv.width,cv.height);});document.querySelector('#frame').textContent='frame '+index;requestAnimationFrame(draw);}img.onload=()=>requestAnimationFrame(draw);img.src=m.src;
</script></html>`;
  const path = (0, import_node_path2.join)(c, "preview.html");
  (0, import_node_fs2.writeFileSync)(path, html);
  save((0, import_node_path2.join)(c, "preview-receipt.json"), { ...s, previewSha256: hashFile(path) });
  return path;
}

// core/entry.ts
run(process.argv.slice(2)).then((code) => process.exitCode = code);
