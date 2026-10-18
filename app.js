const LODESTONE_BASE = "https://jp.finalfantasyxiv.com/lodestone/character/";

const form = document.getElementById("nfc-form");
const idInput = document.getElementById("character-id");
const urlPreview = document.getElementById("url-preview");
const writeBtn = document.getElementById("write-btn");
const statusEl = document.getElementById("status");
const unsupportedEl = document.getElementById("unsupported");
const characterPreview = document.getElementById("character-preview");
const characterImage = document.getElementById("character-image");
const characterName = document.getElementById("character-name");

const modalOverlay = document.getElementById("nfc-modal");
const modalStateConfirm = document.getElementById("modal-state-confirm");
const modalStateWaiting = document.getElementById("modal-state-waiting");
const modalStateResult = document.getElementById("modal-state-result");
const modalCharacterImage = document.getElementById("modal-character-image");
const modalCharacterName = document.getElementById("modal-character-name");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalWaitingCancelBtn = document.getElementById("modal-waiting-cancel-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalResultMessage = document.getElementById("modal-result-message");

const isSupported = "NDEFReader" in window;

let latestCharacterInfo = null;
let pendingUrl = null;
let activeWriteController = null;

function buildUrl(id) {
  return `${LODESTONE_BASE}${id}/`;
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status${type ? " " + type : ""}`;
}

function updatePreview() {
  const id = idInput.value.trim();
  const valid = /^[0-9]+$/.test(id);

  urlPreview.textContent = valid ? buildUrl(id) : "—";
  writeBtn.disabled = !valid || !isSupported;
  scheduleCharacterLookup(valid ? id : null);
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

if (!isSupported) {
  unsupportedEl.hidden = false;
  setStatus("", "");
}

idInput.addEventListener("input", updatePreview);
updatePreview();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = idInput.value.trim();
  if (!/^[0-9]+$/.test(id)) {
    setStatus("キャラクターIDは数字で入力してください。", "error");
    return;
  }

  pendingUrl = buildUrl(id);
  openConfirmModal();
});

function openConfirmModal() {
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
    writeBtn.disabled = false;
    activeWriteController = null;
  }
});

function showModalResult(message, type) {
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
