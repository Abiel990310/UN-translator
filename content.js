// content.js
let isTranslating = false;
let observer = null;
let keysPressed = {}; 

// --- THE KEYBOARD MAP ---
const keyMap = {
    // Initials (声母)
    "b": "1", "p": "q", "m": "a", "f": "z",
    "d": "2", "t": "w", "n": "s", "l": "x",
    "g": "e", "k": "d", "h": "c",
    "j": "r", "q": "f", "x": "v",
    "zh": "5", "ch": "t", "sh": "g", "r": "b",
    "z": "y", "c": "h", "s": "n",
    
    // Finals (韵母)
    "a": "8", "o": "i", "e": "k", "er": "-", 
    "ai": "9", "ei": "o", "ao": "l", "ou": ".",
    "an": "0", "en": "p", "ang": ";", "eng": "/",
    "i": "u", "u": "j", "ü": "m",
    
    // Combo Finals
    "ia": "u8", "iao": "ul", "ian": "u0", "iang": "u;", "iong": "m/", "ie": "u,",
    "ua": "j8", "uai": "j9", "uan": "j0", "uang": "j;", "uo": "ji", "ui": "jo", "un": "jp", "ue": "m,",
    "ong": "j/", "iu": "u.", "in": "up", "ing": "u/",
    
    // --- TONES (Updated Logic) ---
    "1": " ",  // 1st Tone = Spacebar
    "2": "6",  // 2nd Tone = 6 (ˊ)
    "3": "3",  // 3rd Tone = 3 (ˇ)
    "4": "4",  // 4th Tone = 4 (ˋ)
    "5": "7",  // Neutral = 7 (˙)
    "0": "7"   // Just in case library uses 0 for neutral
};

// Special syllable overrides
const specialSyllables = {
    "yi": "u", "ya": "u8", "yo": "ui", "ye": "u,", "yai": "u9", "yao": "ul", "you": "u.", "yan": "u0", "yin": "up", "yang": "u;", "ying": "u/",
    "wu": "j", "wa": "j8", "wo": "ji", "wai": "j9", "wei": "jo", "wan": "j0", "wen": "jp", "wang": "j;", "weng": "j/",
    "yu": "m", "yue": "m,", "yuan": "m0", "yun": "mp", "yong": "m/",
    "zi": "y", "ci": "h", "si": "n",
    "zhi": "5", "chi": "t", "shi": "g", "ri": "b",
    "ju": "rm", "qu": "fm", "xu": "vm",
    "jue": "rm,", "que": "fm,", "xue": "vm,",
    "juan": "rm0", "quan": "fm0", "xuan": "vm0",
    "jun": "rmp", "qun": "fmp", "xun": "vmp"
};

function initTranslator() {
    if (typeof pinyinPro === 'undefined') {
        console.error("pinyin-pro.js not found!");
        return;
    }

    function pinyinToKeys(pinyinStr) {
        // 1. Extract Tone (Default to 5/Neutral if missing)
        let toneMatch = pinyinStr.match(/\d/); 
        let tone = toneMatch ? toneMatch[0] : "5"; 
        
        // 2. Remove tone number to get base pinyin (e.g., "bang")
        let base = pinyinStr.replace(/\d/, "").toLowerCase();
        
        let toneKey = keyMap[tone] || "";

        // 3. Check Special Syllables
        if (specialSyllables[base]) {
            return specialSyllables[base] + toneKey;
        }

        // 4. Regular Parsing
        let match = base.match(/^([zcs]h|[bpmfdtnlgkhjqxrzcsyw])(.*)$/);
        if (match) {
            let initial = match[1];
            let final = match[2];
            let k1 = keyMap[initial] || "";
            let k2 = keyMap[final] || "";
            return k1 + k2 + toneKey;
        }
        return base;
    }

    function translateText(text) {
        let pinyinArray = pinyinPro.pinyin(text, { 
            toneType: 'num', 
            type: 'array', 
            nonZh: 'consecutive' 
        });

        if (!pinyinArray) return text;

        return pinyinArray.map(item => {
            if (/[a-zA-Z]+\d/.test(item)) {
                return pinyinToKeys(item);
            } else {
                return item;
            }
        }).join(""); // <--- CHANGED: No spaces between words! Only space if Tone 1 adds it.
    }

    function processNode(node) {
        if (node.nodeType !== 3) return;
        const text = node.nodeValue;
        if (!text.trim()) return;

        const parentTag = node.parentElement ? node.parentElement.tagName : "";
        if (["SCRIPT", "STYLE", "CODE", "TEXTAREA", "NOSCRIPT", "INPUT"].includes(parentTag)) return;
        
        if (!isTranslating) return;

        if (!node._original) {
            node._original = text;
        }

        if (node.nodeValue === node._original) {
            if (/[\u4e00-\u9fa5]/.test(text)) {
                const newText = translateText(text);
                if (newText !== text) {
                    node.nodeValue = newText;
                }
            }
        }
    }

    function restoreNode(node) {
        if (node.nodeType === 3 && node._original) {
            node.nodeValue = node._original;
            delete node._original;
        }
    }

    function walkAndTranslate(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) processNode(node);
    }

    function walkAndRestore(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) restoreNode(node);
    }

    // --- UI ---
    const statusBox = document.createElement("div");
    statusBox.style.position = "fixed";
    statusBox.style.top = "10px";
    statusBox.style.right = "10px";
    statusBox.style.padding = "8px 12px";
    statusBox.style.background = "#333";
    statusBox.style.color = "white";
    statusBox.style.zIndex = "2147483647";
    statusBox.style.fontFamily = "monospace";
    statusBox.style.borderRadius = "6px";
    statusBox.style.display = "none";
    statusBox.innerText = "KEYBOARD: OFF";
    document.body.appendChild(statusBox);

    function startTranslation() {
        if (isTranslating) return;
        isTranslating = true;
        statusBox.style.display = "block";
        statusBox.style.background = "#e67e22"; 
        statusBox.innerText = "KEYBOARD MODE: ON";
        
        walkAndTranslate(document.body);

        if (!observer) {
            observer = new MutationObserver((mutations) => {
                if (!isTranslating) return;
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 3) processNode(node);
                        else if (node.nodeType === 1) walkAndTranslate(node);
                    });
                });
            });
        }
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopTranslation() {
        if (!isTranslating) return;
        isTranslating = false;
        statusBox.style.background = "#27ae60"; 
        statusBox.innerText = "RESTORED";
        
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        walkAndRestore(document.body);
        setTimeout(() => { if (!isTranslating) statusBox.style.display = "none"; }, 2000);
    }

    function toggleTranslator() {
        if (!isTranslating) startTranslation();
        else stopTranslation();
    }

    function isTyping() {
        const el = document.activeElement;
        const tag = el.tagName.toLowerCase();
        return (tag === 'input' && el.type !== 'checkbox') || tag === 'textarea' || el.isContentEditable;
    }

    document.addEventListener("keydown", (e) => {
        if (isTyping()) return;
        keysPressed[e.key.toLowerCase()] = true;
        if (keysPressed['t'] && keysPressed['r']) {
            toggleTranslator();
            keysPressed = {}; 
        }
    });

    document.addEventListener("keyup", (e) => {
        delete keysPressed[e.key.toLowerCase()];
    });

    console.log("Keyboard Converter Ready. Hold T + R to toggle.");
}

initTranslator();