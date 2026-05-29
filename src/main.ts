import './style.css';

// 取得 DOM 元素
const fgColorInput = document.getElementById('fg-color') as HTMLInputElement;
const fgTextInput = document.getElementById('fg-text') as HTMLInputElement;
const fgDropperBtn = document.getElementById('fg-dropper') as HTMLButtonElement;

const bgColorInput = document.getElementById('bg-color') as HTMLInputElement;
const bgTextInput = document.getElementById('bg-text') as HTMLInputElement;
const bgDropperBtn = document.getElementById('bg-dropper') as HTMLButtonElement;

const contrastRatioSpan = document.getElementById('contrast-ratio') as HTMLSpanElement;
const previewBox = document.getElementById('preview-box') as HTMLDivElement;
const progressBar = document.getElementById('contrast-progress-bar') as HTMLDivElement;

// 復原與重做按鈕
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;

const badges = {
  aaNormal: document.getElementById('wcag-aa-normal') as HTMLDivElement,
  aaLarge: document.getElementById('wcag-aa-large') as HTMLDivElement,
  aaaNormal: document.getElementById('wcag-aaa-normal') as HTMLDivElement,
  aaaLarge: document.getElementById('wcag-aaa-large') as HTMLDivElement,
};

// --- 歷史紀錄狀態管理 ---
interface ColorState {
  fg: string;
  bg: string;
}

let historyStack: ColorState[] = [];
let redoStack: ColorState[] = [];

// 儲存當前狀態到歷史紀錄中
function saveStateToHistory() {
  const currentState: ColorState = {
    fg: fgColorInput.value,
    bg: bgColorInput.value
  };

  if (historyStack.length > 0) {
    const lastState = historyStack[historyStack.length - 1];
    if (lastState.fg === currentState.fg && lastState.bg === currentState.bg) {
      return;
    }
  }

  historyStack.push(currentState);

  if (historyStack.length > 50) {
    historyStack.shift();
  }

  redoStack = [];
  updateToolbarButtons();
}

// 執行復原 (Undo)
function handleUndo() {
  if (historyStack.length === 0) return;

  const currentState: ColorState = {
    fg: fgColorInput.value,
    bg: bgColorInput.value
  };
  redoStack.push(currentState);

  const previousState = historyStack.pop();

  if (previousState) {
    fgColorInput.value = previousState.fg;
    bgColorInput.value = previousState.bg;
    updateUI(); // 修正：移除參數
  }

  updateToolbarButtons();
}

// 執行重做 (Redo)
function handleRedo() {
  if (redoStack.length === 0) return;

  const currentState: ColorState = {
    fg: fgColorInput.value,
    bg: bgColorInput.value
  };
  historyStack.push(currentState);

  const nextState = redoStack.pop();

  if (nextState) {
    fgColorInput.value = nextState.fg;
    bgColorInput.value = nextState.bg;
    updateUI(); // 修正：移除參數
  }

  updateToolbarButtons();
}

// 更新工具列按鈕的可點擊狀態
function updateToolbarButtons() {
  undoBtn.disabled = historyStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

// --- 數學公式計算區 ---
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function calculateContrast(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// --- UI 更新邏輯 ---
function updateUI() {
  const fg = fgColorInput.value;
  const bg = bgColorInput.value;

  fgTextInput.value = fg.toUpperCase();
  bgTextInput.value = bg.toUpperCase();

  previewBox.style.color = fg;
  previewBox.style.backgroundColor = bg;

  const ratio = calculateContrast(fg, bg);
  contrastRatioSpan.innerText = `${ratio.toFixed(2)} : 1`;

  const percentage = (ratio / 21) * 100;
  progressBar.style.width = `${percentage}%`;

  if (ratio < 3.0) progressBar.style.backgroundColor = '#dc3545';
  else if (ratio < 4.5) progressBar.style.backgroundColor = '#ffc107';
  else if (ratio < 7.0) progressBar.style.backgroundColor = '#155724';
  else progressBar.style.backgroundColor = '#28a745';

  updateBadge(badges.aaNormal, ratio >= 4.5);
  updateBadge(badges.aaLarge, ratio >= 3.0);
  updateBadge(badges.aaaNormal, ratio >= 7.0);
  updateBadge(badges.aaaLarge, ratio >= 4.5);
}

function updateBadge(element: HTMLDivElement, isPass: boolean) {
  const span = element.querySelector('span');
  if (!span) return;
  if (isPass) {
    element.classList.add('pass');
    span.innerText = '通過';
  } else {
    element.classList.remove('pass');
    span.innerText = '失敗';
  }
}

// --- 滴管工具 EyeDropper API ---
function setupDropper(button: HTMLButtonElement, colorInput: HTMLInputElement) {
  if (!('EyeDropper' in window)) {
    button.style.display = 'none';
    return;
  }

  const eyeDropper = new (window as any).EyeDropper();

  button.addEventListener('click', async () => {
    try {
      saveStateToHistory();
      const result = await eyeDropper.open();
      colorInput.value = result.sRGBHex;
      updateUI(); // 修正：移除參數
    } catch (error) {
      console.log('使用者取消選色或發生錯誤:', error);
    }
  });
}

// --- 事件監聽綁定 ---
setupDropper(fgDropperBtn, fgColorInput);
setupDropper(bgDropperBtn, bgColorInput);

fgColorInput.addEventListener('pointerdown', saveStateToHistory);
bgColorInput.addEventListener('pointerdown', saveStateToHistory);

fgColorInput.addEventListener('input', () => updateUI()); // 修正：移除參數
bgColorInput.addEventListener('input', () => updateUI()); // 修正：移除參數

fgTextInput.addEventListener('change', () => {
  if (/^#[0-9A-F]{6}$/i.test(fgTextInput.value)) {
    saveStateToHistory();
    fgColorInput.value = fgTextInput.value;
    updateUI(); // 修正：移除參數
  }
});
bgTextInput.addEventListener('change', () => {
  if (/^#[0-9A-F]{6}$/i.test(bgTextInput.value)) {
    saveStateToHistory();
    bgColorInput.value = bgTextInput.value;
    updateUI(); // 修正：移除參數
  }
});

// 綁定 Undo 與 Redo 點擊事件
undoBtn.addEventListener('click', handleUndo);
redoBtn.addEventListener('click', handleRedo);

// 鍵盤快捷鍵監聽
window.addEventListener('keydown', (event) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (isCtrlOrCmd) {
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    }
    if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      handleRedo();
    }
  }
});

// 初始化第一次畫面
updateUI(); // 修正：移除參數