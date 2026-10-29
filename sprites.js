// ドット絵スプライト。1文字が1ドットで、"." は透明。
// data-sprite="名前" を付けた要素に SVG として描画する（data-scale は1ドットのpx数）。
const PIXEL_PALETTE = {
  k: "#24123f", // 輪郭
  p: "#ff2fb3", // ネオンピンク
  c: "#00e5ff", // ネオンシアン
  l: "#a6ff00", // ネオンライム
  y: "#ffe600", // ネオンイエロー
  v: "#8a3dff", // パープル
  w: "#ffffff",
};

const PHONE_BODY_ROWS = 14;

const SPRITES = {
  crystal: [
    ".....kk.....",
    "....kcck....",
    "...kcwcck...",
    "..kcwcccck..",
    ".kcwcccccck.",
    ".kccccccvck.",
    "..kcccccvk..",
    "...kcccvk...",
    "....kcvk....",
    ".....kk.....",
  ],
  camera: [
    "..kkkkk.....",
    ".kkpppkkkkk.",
    "kppppppppppk",
    "kppkkkkppwpk",
    "kpkcccckpppk",
    "kpkcwcckpppk",
    "kpkcccckpppk",
    "kppkkkkppppk",
    "kppppppppppk",
    ".kkkkkkkkkk.",
  ],
  bubble: [
    ".kkkkkkkkk.",
    "klllllllllk",
    "klllllllllk",
    "kllklklkllk",
    "klllllllllk",
    "klllllllllk",
    ".kkkllkkkk.",
    "...klk.....",
    "...kk......",
    "...k.......",
  ],
  browser: [
    "kkkkkkkkkkkk",
    "kvpvyvlvvvvk",
    "kkkkkkkkkkkk",
    "kwwwwwwwwwwk",
    "kwcccccccwwk",
    "kwwwwwwwwwwk",
    "kwcccccwwwwk",
    "kwwwwwwwwwwk",
    "kwppppwwwwwk",
    "kkkkkkkkkkkk",
  ],
  tag: [
    "...kkkk...",
    "..k....k..",
    "..k....k..",
    "...kkkk...",
    ".kkkkkkkk.",
    "kppppppppk",
    "kpppkkpppk",
    "kppkyykppk",
    "kpppkkpppk",
    "kppppppppk",
    ".kkkkkkkk.",
  ],
  download: [
    "...kkkk...",
    "...kllk...",
    "...kllk...",
    "kkkkllkkkk",
    ".kllllllk.",
    "..kllllk..",
    "...kllk...",
    "....kk....",
    "k........k",
    "kkkkkkkkkk",
  ],
  phone: [
    ".kkkkkkkkkkkk.",
    "kvvvvvvvvvvvvk",
    "kvkkkvvvvvvvvk",
    "kvkckvvvvvvvvk",
    "kvkkkvvvvvvvvk",
    ...Array.from({ length: PHONE_BODY_ROWS }, (_, i) =>
      i < 6 ? "kvwvvvvvvvvvvk" : "kvvvvvvvvvvvvk"
    ),
    "kvvvvvvvvvvvvk",
    ".kkkkkkkkkkkk.",
  ],
  sparkle: [
    "..y..",
    "..y..",
    "yyyyy",
    "..y..",
    "..y..",
  ],
  star: [
    "....k....",
    "...kyk...",
    "kkkyyykkk",
    "kyyyyyyyk",
    ".kyyyyyk.",
    "..kyyyk..",
    ".kyykyyk.",
    ".kyk.kyk.",
    ".kk...kk.",
  ],
  miss: [
    "kk.....kk",
    "kpk...kpk",
    ".kpk.kpk.",
    "..kpkpk..",
    "...kpk...",
    "..kpkpk..",
    ".kpk.kpk.",
    "kpk...kpk",
    "kk.....kk",
  ],
};

function pixelSvg(name, scale) {
  const rows = SPRITES[name];
  const width = rows[0].length;
  const height = rows.length;
  let rects = "";
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PIXEL_PALETTE[ch];
      if (color) {
        rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${color}"/>`;
      }
    });
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

function renderSprite(el, name, scale) {
  el.innerHTML = pixelSvg(name, scale || Number(el.dataset.scale) || 4);
}

document.querySelectorAll("[data-sprite]").forEach((el) => {
  renderSprite(el, el.dataset.sprite);
});
