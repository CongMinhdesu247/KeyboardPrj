import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Minh họa SVG gốc, không phụ thuộc hình ảnh tải từ bên ngoài.
const rows = [
  ["esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "−", "=", "⌫"],
  ["tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "del"],
  ["caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "enter"],
  ["shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "↑", "fn"],
  ["ctrl", "win", "alt", "", "alt", "fn", "←", "↓", "→"],
];
let keys = "";
rows.forEach((row, y) => {
  let x = 49;
  row.forEach((label, index) => {
    const wide =
      y === 4 && index === 3
        ? 287
        : y === 2 && index === 12
          ? 86
          : y === 3 && index === 0
            ? 86
            : 42;
    const amber = label === "esc" || label === "enter" || label === "";
    const grey = [
      "tab",
      "caps",
      "shift",
      "ctrl",
      "win",
      "alt",
      "fn",
      "del",
      "⌫",
    ].includes(label);
    const fill = amber ? "#f5b534" : grey ? "#8b99a6" : "#e9e8e1";
    keys += `<g transform="translate(${x} ${102 + y * 49})"><rect y="4" width="${wide}" height="42" rx="6" fill="${amber ? "#9c6610" : grey ? "#4e5d6a" : "#9fa39f"}"/><rect width="${wide}" height="39" rx="6" fill="${fill}"/><rect x="4" y="3" width="${wide - 8}" height="30" rx="5" fill="white" opacity=".13"/><text x="${wide / 2}" y="23" text-anchor="middle" fill="#25313b" font-family="Arial,sans-serif" font-size="${label.length > 2 ? 10 : 12}">${label}</text></g>`;
    x += wide + 5;
  });
});
const keyboard = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="480" viewBox="0 0 760 480"><defs><filter id="s"><feDropShadow dx="0" dy="22" stdDeviation="14" flood-opacity=".4"/></filter></defs><g filter="url(#s)"><rect x="26" y="85" width="706" height="282" rx="18" fill="#101820"/><rect x="26" y="77" width="706" height="280" rx="18" fill="#5b6875"/><rect x="33" y="80" width="692" height="267" rx="14" fill="#303d49"/><rect x="38" y="86" width="681" height="255" rx="11" fill="#1b2630"/>${keys}<circle cx="705" cy="122" r="12" fill="#ecaf37"/><circle cx="705" cy="122" r="8" fill="#c78c22"/><path d="M705 112v9" stroke="#5b4219" stroke-width="2"/></g></svg>`;
await writeFile("public/keyboard.svg", keyboard);
await mkdir("public/icons", { recursive: true });
const icon = "public/brand/logo-source.png";
await sharp(icon).resize(96,96,{fit:'contain',background:'#f5b43b'}).webp({quality:85}).toFile('public/brand/logo-header.webp');
await Promise.all(
  [
    [192, "icon-192.png"],
    [512, "icon-512.png"],
    [512, "icon-maskable-512.png"],
    [180, "apple-touch-icon.png"],
  ].map(([size, name]) =>
    sharp(icon)
      .resize(Math.round(size * 0.78), Math.round(size * 0.78), {
        fit: "contain",
        background: "#f5b43b",
      })
      .extend({
        top: Math.floor(size * 0.11),
        bottom: size - Math.round(size * 0.78) - Math.floor(size * 0.11),
        left: Math.floor(size * 0.11),
        right: size - Math.round(size * 0.78) - Math.floor(size * 0.11),
        background: "#f5b43b",
      })
      .png()
      .toFile(`public/icons/${name}`),
  ),
);
console.log("Generated keyboard illustration and PWA icons.");
