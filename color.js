// --- カラー変換 ---
const s2l = c => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
const l2s = c => c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;

const rgbToOklab = (r, g, b) => {
    const l = s2l(r/255)*0.4122+s2l(g/255)*0.5363+s2l(b/255)*0.0514;
    const m = s2l(r/255)*0.2119+s2l(g/255)*0.6806+s2l(b/255)*0.1073;
    const s = s2l(r/255)*0.0883+s2l(g/255)*0.2817+s2l(b/255)*0.6300;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [0.2104*l_ + 0.7936*m_ - 0.0040*s_, 1.9779*l_ - 2.4285*m_ + 0.4505*s_, 0.0259*l_ + 0.7827*m_ - 0.8086*s_];
};

const oklabToRgb = (L, a, b) => {
    const l_=L+0.3963*a+0.2158*b, m_=L-0.1055*a-0.0638*b, s_=L-0.0894*a-1.2914*b;
    const l=l_**3, m=m_**3, s=s_**3;
    const f = v => Math.round(Math.max(0, Math.min(1, l2s(v))) * 255);
    return [f(4.0767*l - 3.3077*m + 0.2309*s), f(-1.2684*l + 2.6097*m - 0.3413*s), f(-0.0041*l - 0.7034*m + 1.7068*s)];
};

const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
    }
    return [h * 360, s, l];
};

const hslToRgb = (h, s, l) => {
    h /= 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
};

const rgbToHsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
    }
    return [h * 360, s, v];
};

const hsvToRgb = (h, s, v) => {
    h /= 360;
    let r, g, b, i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// --- モデル定義 ---
const buildGradient = (params, idx, steps, min, max, toCss) => 
    `linear-gradient(to right, ${Array.from({length: steps+1}, (_, i) => {
        const p = [...params];
        p[idx] = min + (max - min) * (i / steps);
        return toCss(...p);
    }).join(', ')})`;

const fp = v => (v * 100).toFixed(1) + '%';
const fd = v => Math.round(v) + '°';
const f3 = v => v.toFixed(3);
const f0 = v => Math.round(v);

const models = {
    rgb: {
        labels: ['R', 'G', 'B'], descs: ['(Red)', '(Green)', '(Blue)'], dots: ['bg-red-500', 'bg-green-500', 'bg-blue-500'],
        sliders: [{ min: 0, max: 255, step: 1, format: f0 }, { min: 0, max: 255, step: 1, format: f0 }, { min: 0, max: 255, step: 1, format: f0 }],
        hueIndex: -1, fromRgb: (r,g,b)=>[r,g,b], toRgb: (r,g,b)=>[r,g,b], toCss: (r,g,b)=>`rgb(${r},${g},${b})`,
        sliderBg: p => p.map((_,i) => buildGradient(p, i, 2, 0, 255, models.rgb.toCss))
    },
    hsv: {
        labels: ['H', 'S', 'V'], descs: ['(Hue)', '(Saturation)', '(Value)'], dots: ['bg-red-400', 'bg-sky-400', 'bg-slate-800'],
        sliders: [{ min: 0, max: 360, step: 1, format: fd }, { min: 0, max: 1, step: 0.005, format: fp }, { min: 0, max: 1, step: 0.005, format: fp }],
        hueIndex: 0, fromRgb: rgbToHsv, toRgb: hsvToRgb, toCss: (h,s,v) => `rgb(${hsvToRgb(h,s,v).join(',')})`,
        sliderBg: p => [buildGradient(p, 0, 10, 0, 360, models.hsv.toCss), buildGradient(p, 1, 2, 0, 1, models.hsv.toCss), buildGradient(p, 2, 2, 0, 1, models.hsv.toCss)]
    },
    hsl: {
        labels: ['H', 'S', 'L'], descs: ['(Hue)', '(Saturation)', '(Lightness)'], dots: ['bg-red-400', 'bg-sky-400', 'bg-slate-400'],
        sliders: [{ min: 0, max: 360, step: 1, format: fd }, { min: 0, max: 1, step: 0.005, format: fp }, { min: 0, max: 1, step: 0.005, format: fp }],
        hueIndex: 0, fromRgb: rgbToHsl, toRgb: hslToRgb, toCss: (h,s,l) => `hsl(${h}, ${s*100}%, ${l*100}%)`,
        sliderBg: p => [buildGradient(p, 0, 10, 0, 360, models.hsl.toCss), buildGradient(p, 1, 2, 0, 1, models.hsl.toCss), buildGradient(p, 2, 2, 0, 1, models.hsl.toCss)]
    },
    oklab: {
        labels: ['L', 'a', 'b'], descs: ['(Lightness)', '(Green-Red)', '(Blue-Yellow)'], dots: ['bg-slate-400', 'bg-rose-400', 'bg-amber-400'],
        sliders: [{ min: 0, max: 1, step: 0.002, format: fp }, { min: -0.4, max: 0.4, step: 0.005, format: f3 }, { min: -0.4, max: 0.4, step: 0.005, format: f3 }],
        hueIndex: -1, fromRgb: rgbToOklab, toRgb: oklabToRgb, toCss: (L,a,b) => `oklab(${L} ${a} ${b})`,
        sliderBg: p => [buildGradient(p, 0, 2, 0, 1, models.oklab.toCss), buildGradient(p, 1, 2, -0.4, 0.4, models.oklab.toCss), buildGradient(p, 2, 2, -0.4, 0.4, models.oklab.toCss)]
    },
    oklch: {
        labels: ['L', 'C', 'H'], descs: ['(Lightness)', '(Chroma)', '(Hue)'], dots: ['bg-slate-400', 'bg-pink-500', 'bg-violet-500'],
        sliders: [{ min: 0, max: 1, step: 0.005, format: fp }, { min: 0, max: 0.4, step: 0.002, format: f3 }, { min: 0, max: 360, step: 1, format: fd }],
        hueIndex: 2,
        fromRgb: (r, g, b) => {
            const [L, a, b_] = rgbToOklab(r, g, b);
            const C = Math.sqrt(a * a + b_ * b_);
            let H = Math.atan2(b_, a) * (180 / Math.PI);
            if (H < 0) H += 360;
            return [L, C, isNaN(H) ? 0 : H];
        },
        toRgb: (L, C, H) => oklabToRgb(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)),
        toCss: (L, C, H) => `oklch(${L} ${C} ${H})`,
        sliderBg: p => [buildGradient(p, 0, 2, 0, 1, models.oklch.toCss), buildGradient(p, 1, 2, 0, 0.4, models.oklch.toCss), buildGradient(p, 2, 10, 0, 360, models.oklch.toCss)]
    }
};
