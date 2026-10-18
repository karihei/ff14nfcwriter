const LODESTONE_BASE = "https://jp.finalfantasyxiv.com/lodestone/character/";

const form = document.getElementById("nfc-form");
const idInput = document.getElementById("character-id");
const urlPreview = document.getElementById("url-preview");
const writeBtn = document.getElementById("write-btn");
const statusEl = document.getElementById("status");
const unsupportedEl = document.getElementById("unsupported");

const isSupported = "NDEFReader" in window;

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
}

if (!isSupported) {
  unsupportedEl.hidden = false;
  setStatus("", "");
}

idInput.addEventListener("input", updatePreview);
updatePreview();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = idInput.value.trim();
  if (!/^[0-9]+$/.test(id)) {
    setStatus("キャラクターIDは数字で入力してください。", "error");
    return;
  }

  const url = buildUrl(id);

  writeBtn.disabled = true;
  setStatus("NFCタグをスマートフォンの背面にかざしてください…", "info");

  try {
    const ndef = new NDEFReader();
    await ndef.write({
      records: [{ recordType: "url", data: url }],
    });
    setStatus(`書き込みに成功しました: ${url}`, "success");
  } catch (err) {
    setStatus(`書き込みに失敗しました: ${describeError(err)}`, "error");
  } finally {
    writeBtn.disabled = false;
  }
});

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
