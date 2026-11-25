// Prosty renderer RGBA + enkoder PNG (bez zewnętrznych bibliotek).
const zlib = require("zlib");

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const hex = (h) => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Float32Array(w * h * 4); }

  // nałożenie koloru (r,g,b 0-255) z kryciem a (0-1) na piksel
  blend(x, y, r, g, b, a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, p = this.px, da = p[i + 3], oa = a + da * (1 - a);
    if (oa <= 0) return;
    p[i] = (r * a + p[i] * da * (1 - a)) / oa;
    p[i + 1] = (g * a + p[i + 1] * da * (1 - a)) / oa;
    p[i + 2] = (b * a + p[i + 2] * da * (1 - a)) / oa;
    p[i + 3] = oa;
  }

  // zaokrąglony prostokąt z pionowym gradientem (cała ikona = tło)
  background(radius, top, bottom) {
    const t = hex(top), b = hex(bottom), { w, h } = this;
    for (let y = 0; y < h; y++) {
      const k = y / (h - 1), r = t[0] + (b[0] - t[0]) * k, g = t[1] + (b[1] - t[1]) * k, bl = t[2] + (b[2] - t[2]) * k;
      for (let x = 0; x < w; x++) {
        const cx = x < radius ? radius : x > w - 1 - radius ? w - 1 - radius : x;
        const cy = y < radius ? radius : y > h - 1 - radius ? h - 1 - radius : y;
        const d = Math.hypot(x - cx, y - cy);
        this.blend(x, y, r, g, bl, clamp(radius + 0.5 - d, 0, 1));
      }
    }
  }

  // miękka poświata (radialny gradient)
  glow(cx, cy, radius, color, strength) {
    const c = hex(color);
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(this.h, cy + radius); y++)
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(this.w, cx + radius); x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d < 1) this.blendInside(x, y, c, strength * Math.pow(1 - d, 2));
      }
  }
  blendInside(x, y, c, a) { const i = (y * this.w + x) * 4; if (this.px[i + 3] > 0) this.blend(x, y, c[0], c[1], c[2], a * this.px[i + 3]); }

  // maska alfa (mw x mh) przeskalowana do prostokąta (x,y,w,h), w kolorze
  mask(m, mw, mh, x0, y0, w, h, color, opacity = 1) {
    const c = typeof color === "string" ? hex(color) : color, sxk = mw / w, syk = mh / h;
    const S = 3;
    const at = (sx, sy) => {
      if (sx < 0 || sy < 0 || sx > mw - 1 || sy > mh - 1) {
        sx = clamp(sx, 0, mw - 1); sy = clamp(sy, 0, mh - 1);
      }
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const ix1 = Math.min(ix + 1, mw - 1), iy1 = Math.min(iy + 1, mh - 1);
      return (m[iy * mw + ix] * (1 - fx) + m[iy * mw + ix1] * fx) * (1 - fy) + (m[iy1 * mw + ix] * (1 - fx) + m[iy1 * mw + ix1] * fx) * fy;
    };
    const X0 = Math.floor(x0), Y0 = Math.floor(y0);
    for (let dy = 0; dy <= h + 1; dy++)
      for (let dx = 0; dx <= w + 1; dx++) {
        let acc = 0;
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
          const px = X0 + dx + (i + 0.5) / S - x0, py = Y0 + dy + (j + 0.5) / S - y0;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          acc += at(px * sxk - 0.5, py * syk - 0.5);
        }
        acc /= S * S * 255;
        if (acc > 0.002) this.blendInside(X0 + dx, Y0 + dy, c, acc * opacity);
      }
  }

  toPNG() {
    const { w, h, px } = this, raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 4 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, o = y * (w * 4 + 1) + 1 + x * 4;
        raw[o] = clamp(Math.round(px[i]), 0, 255); raw[o + 1] = clamp(Math.round(px[i + 1]), 0, 255);
        raw[o + 2] = clamp(Math.round(px[i + 2]), 0, 255); raw[o + 3] = clamp(Math.round(px[i + 3] * 255), 0, 255);
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
  }
}

module.exports = { Canvas, hex };
