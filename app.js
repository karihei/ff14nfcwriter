const LODESTONE_BASE = "https://jp.finalfantasyxiv.com/lodestone/character/";

// 書き込み対象ごとの入力画面の設定。
// normalize は入力値の整形（@や貼り付けられたプロフィールURLから値を取り出す）、
// buildUrl は整形済みの値が不正なら null を返す。
const TYPES = {
  lodestone: {
    heading: "Lodestone",
    sprite: "crystal",
    label: "キャラクターID",
    placeholder: "例: 4813522",
    inputMode: "numeric",
    hintsHtml: `
      <p class="hint">
        LodestoneのURL <code>https://jp.finalfantasyxiv.com/lodestone/character/<strong>4813522</strong>/</code>
        の数字部分です。
      </p>
      <p class="hint">
        <a href="https://jp.finalfantasyxiv.com/lodestone/account/login/" target="_blank" rel="noopener">自分のキャラクターIDはこちらで確認ができます</a>
      </p>`,
    normalize: (v) => {
      const m = v.match(/\/lodestone\/character\/(\d+)/);
      return m ? m[1] : v;
    },
    buildUrl: (v) => (/^[0-9]+$/.test(v) ? `${LODESTONE_BASE}${v}/` : null),
    invalidMessage: "キャラクターIDは数字で入力してください。",
  },
  instagram: {
    heading: "Instagram",
    sprite: "camera",
    label: "ユーザーネーム",
    placeholder: "例: your_name",
    inputMode: "text",
    hintsHtml: `
      <p class="hint">
        プロフィールURL <code>https://www.instagram.com/<strong>your_name</strong>/</code>
        の太字部分です。先頭の@は省略できます。
      </p>`,
    normalize: (v) => {
      const m = v.match(/instagram\.com\/([^/?#]+)/i);
      return (m ? m[1] : v).replace(/^@/, "");
    },
    buildUrl: (v) =>
      /^[A-Za-z0-9._]{1,30}$/.test(v) ? `https://www.instagram.com/${v}/` : null,
    invalidMessage: "ユーザーネームは英数字・ピリオド・アンダーバー（30文字以内）で入力してください。",
  },
  x: {
    heading: "X（旧Twitter）",
    sprite: "bubble",
    label: "ユーザー名（@以降）",
    placeholder: "例: your_name",
    inputMode: "text",
    hintsHtml: `
      <p class="hint">
        プロフィールURL <code>https://x.com/<strong>your_name</strong></code>
        の太字部分です。先頭の@は省略できます。
      </p>`,
    normalize: (v) => {
      const m = v.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
      return (m ? m[1] : v).replace(/^@/, "");
    },
    buildUrl: (v) => (/^[A-Za-z0-9_]{1,15}$/.test(v) ? `https://x.com/${v}` : null),
    invalidMessage: "ユーザー名は英数字・アンダーバー（15文字以内）で入力してください。",
  },
  url: {
    heading: "好きなURL",
    sprite: "browser",
    label: "URL",
    placeholder: "例: https://example.com/",
    inputMode: "url",
    hintsHtml: `
      <p class="hint">
        http:// または https:// から始まるURLを入力してください。省略した場合は https:// を補います。
      </p>`,
    normalize: (v) => v,
    buildUrl: (v) => {
      if (!v) return null;
      const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
      try {
        const url = new URL(withScheme);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (!url.hostname.includes(".")) return null;
        return url.href;
      } catch (_) {
        return null;
      }
    },
    invalidMessage: "正しいURLを入力してください。",
  },
};

const stepbar = document.getElementById("stepbar");
const screenUnsupported = document.getElementById("screen-unsupported");
const screenSelect = document.getElementById("screen-select");
const screenInput = document.getElementById("screen-input");
const backBtn = document.getElementById("back-btn");
const inputIcon = document.getElementById("input-icon");
const inputHeading = document.getElementById("input-heading");
const valueLabel = document.getElementById("value-label");
const inputHints = document.getElementById("input-hints");

const form = document.getElementById("nfc-form");
const valueInput = document.getElementById("value-input");
const urlPreview = document.getElementById("url-preview");
const writeBtn = document.getElementById("write-btn");
const statusEl = document.getElementById("status");
const characterPreview = document.getElementById("character-preview");
const characterImage = document.getElementById("character-image");
const characterName = document.getElementById("character-name");

const modalOverlay = document.getElementById("nfc-modal");
const modalStateConfirm = document.getElementById("modal-state-confirm");
const modalStateWaiting = document.getElementById("modal-state-waiting");
const modalStateResult = document.getElementById("modal-state-result");
const modalCharacter = document.getElementById("modal-character");
const modalCharacterImage = document.getElementById("modal-character-image");
const modalCharacterName = document.getElementById("modal-character-name");
const modalUrl = document.getElementById("modal-url");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalWaitingCancelBtn = document.getElementById("modal-waiting-cancel-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalResultArt = document.getElementById("modal-result-art");
const modalResultMessage = document.getElementById("modal-result-message");

const isSupported = "NDEFReader" in window;

let currentType = null;
let navigatedInApp = false;
let latestCharacterInfo = null;
let pendingUrl = null;
let activeWriteController = null;

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status${type ? " " + type : ""}`;
}

// ---- 画面遷移（URLのハッシュで管理し、ブラウザの戻るでも戻れるようにする） ----

function showScreen(screen) {
  [screenUnsupported, screenSelect, screenInput].forEach((s) => {
    s.hidden = s !== screen;
  });
}

// 画面上部の「えらぶ → いれる → タッチ」の進行状況を更新する
function setStep(step) {
  stepbar.hidden = false;
  stepbar.querySelectorAll("li").forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle("active", n === step);
    li.classList.toggle("done", n < step);
  });
}

function render() {
  if (!isSupported) {
    stepbar.hidden = true;
    showScreen(screenUnsupported);
    return;
  }

  const type = location.hash.slice(1);
  if (TYPES[type]) {
    openInputScreen(type);
  } else {
    currentType = null;
    scheduleCharacterLookup(null);
    setStep(1);
    showScreen(screenSelect);
  }
}

function openInputScreen(type) {
  const config = TYPES[type];
  if (currentType !== type) {
    currentType = type;
    renderSprite(inputIcon, config.sprite, 3);
    inputHeading.textContent = config.heading;
    valueLabel.textContent = config.label;
    valueInput.placeholder = config.placeholder;
    valueInput.inputMode = config.inputMode;
    inputHints.innerHTML = config.hintsHtml;
    valueInput.value = "";
    setStatus("", "");
    updatePreview();
  }
  setStep(2);
  showScreen(screenInput);
  window.scrollTo(0, 0);
}

document.querySelectorAll(".type-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    navigatedInApp = true;
    location.hash = btn.dataset.type;
  });
});

backBtn.addEventListener("click", () => {
  if (navigatedInApp) {
    history.back();
  } else {
    // 入力画面のURLを直接開いた場合は、履歴を戻るとサイト外に出てしまうため置き換える
    history.replaceState(null, "", location.pathname + location.search);
    render();
  }
});

window.addEventListener("hashchange", render);

// ---- 入力とプレビュー ----

function currentUrl() {
  if (!currentType) return null;
  const config = TYPES[currentType];
  return config.buildUrl(config.normalize(valueInput.value.trim()));
}

function updatePreview() {
  const url = currentUrl();

  urlPreview.textContent = url || "—";
  writeBtn.disabled = !url;

  if (currentType === "lodestone" && url) {
    scheduleCharacterLookup(TYPES.lodestone.normalize(valueInput.value.trim()));
  } else {
    scheduleCharacterLookup(null);
  }
}

let lookupController = null;
let debounceTimer = null;

function resetCharacterPreview() {
  characterPreview.hidden = true;
  characterPreview.classList.remove("loading", "not-found");
  characterImage.src = "";
  characterName.textContent = "";
  latestCharacterInfo = null;
}

function scheduleCharacterLookup(id) {
  clearTimeout(debounceTimer);
  if (lookupController) {
    lookupController.abort();
  }

  if (!id) {
    resetCharacterPreview();
    return;
  }

  debounceTimer = setTimeout(() => lookupCharacter(id), 500);
}

async function lookupCharacter(id) {
  lookupController = new AbortController();
  const { signal } = lookupController;

  characterPreview.hidden = false;
  characterPreview.classList.add("loading");
  characterPreview.classList.remove("not-found");
  characterImage.src = "";
  characterName.textContent = "読み込み中…";
  latestCharacterInfo = null;

  try {
    const res = await fetch(`/api/character/${id}`, { signal });
    const data = await res.json();
    if (signal.aborted) return;

    characterPreview.classList.remove("loading");

    if (!data.found) {
      characterPreview.classList.add("not-found");
      characterName.textContent = "キャラクターが見つかりません";
      latestCharacterInfo = { found: false };
      return;
    }

    characterName.textContent = data.name;
    characterImage.alt = data.name;
    characterImage.src = data.imageUrl || "";
    latestCharacterInfo = { found: true, name: data.name, imageUrl: data.imageUrl };
  } catch (err) {
    if (signal.aborted || err.name === "AbortError") return;
    characterPreview.classList.remove("loading");
    characterPreview.classList.add("not-found");
    characterName.textContent = "プレビューを取得できませんでした";
    latestCharacterInfo = null;
  }
}

valueInput.addEventListener("input", () => {
  setStatus("", "");
  updatePreview();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = currentUrl();
  if (!url) {
    setStatus(TYPES[currentType].invalidMessage, "error");
    return;
  }

  pendingUrl = url;
  openConfirmModal();
});

// ---- 書き込み確認・実行モーダル ----

function openConfirmModal() {
  modalUrl.textContent = pendingUrl;

  if (currentType === "lodestone") {
    modalCharacter.hidden = false;
    if (latestCharacterInfo && latestCharacterInfo.found) {
      modalCharacterImage.hidden = false;
      modalCharacterImage.src = latestCharacterInfo.imageUrl || "";
      modalCharacterImage.alt = latestCharacterInfo.name;
      modalCharacterName.textContent = latestCharacterInfo.name;
    } else {
      modalCharacterImage.hidden = true;
      modalCharacterImage.src = "";
      modalCharacterName.textContent = "（キャラクター名を取得できませんでした）";
    }
  } else {
    modalCharacter.hidden = true;
  }

  showModalPanel(modalStateConfirm);
  modalOverlay.hidden = false;
}

function showModalPanel(panel) {
  [modalStateConfirm, modalStateWaiting, modalStateResult].forEach((p) => {
    p.hidden = p !== panel;
  });
}

function closeModal() {
  modalOverlay.hidden = true;
  pendingUrl = null;
  setStep(2);
}

modalCancelBtn.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);

modalWaitingCancelBtn.addEventListener("click", () => {
  if (activeWriteController) {
    activeWriteController.abort();
  }
  closeModal();
});

modalConfirmBtn.addEventListener("click", async () => {
  const url = pendingUrl;
  if (!url) return;

  showModalPanel(modalStateWaiting);
  setStep(3);
  writeBtn.disabled = true;
  activeWriteController = new AbortController();

  try {
    const ndef = new NDEFReader();
    await ndef.write(
      { records: [{ recordType: "url", data: url }] },
      { signal: activeWriteController.signal }
    );
    showModalResult(
      `✅ 書き込み完了！\n今すぐタグをスマホから離してください。\n${url}`,
      "success"
    );
    if (navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }
    holdNfcBriefly();
  } catch (err) {
    if (err.name === "AbortError") {
      closeModal();
    } else {
      showModalResult(`書き込みに失敗しました: ${describeError(err)}`, "error");
    }
  } finally {
    writeBtn.disabled = !currentUrl();
    activeWriteController = null;
  }
});

function showModalResult(message, type) {
  renderSprite(modalResultArt, type === "success" ? "star" : "miss", 6);
  modalResultMessage.textContent = message;
  modalResultMessage.className = `modal-result-message ${type}`;
  showModalPanel(modalStateResult);
}

// 書き込み直後もしばらくNFCの読み取りを保持し、Androidの標準タグ検出
// （ブラウザが自動でURLを開く挙動）が割り込む隙を減らす。
// これは軽減策であり、完全な防止は保証できない。
function holdNfcBriefly(durationMs = 2500) {
  if (!isSupported) return;
  try {
    const guard = new NDEFReader();
    const controller = new AbortController();
    guard.scan({ signal: controller.signal }).catch(() => {});
    setTimeout(() => controller.abort(), durationMs);
  } catch (_) {
    // ベストエフォートのため失敗は無視する
  }
}

function describeError(err) {
  if (!err) return "不明なエラー";
  switch (err.name) {
    case "NotAllowedError":
      return "NFCの使用が許可されていません（権限を確認してください）。";
    case "NotSupportedError":
      return "この端末またはブラウザはNFC書き込みに対応していません。";
    case "NetworkError":
      return "タグとの通信に失敗しました。タグを近づけ直して再試行してください。";
    case "AbortError":
      return "書き込みがキャンセルされました。";
    default:
      return err.message || err.name || String(err);
  }
}

render();
