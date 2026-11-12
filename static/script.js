const suggestions = [
    "Apa itu PMB?",
    "Bagaimana cara pendaftaran?",
    "Berapa biaya kuliah di Gunadarma?",
    "Apa saja jurusan di Gunadarma?",
    "Apakah ada beasiswa?"
];

/* ── THEME ──────────────────────────────── */
function initTheme() {
    let saved = localStorage.getItem("theme") || "dark";
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    const icon = document.getElementById("theme-icon");
    const label = document.getElementById("theme-label");
    const toggle = document.getElementById("theme-toggle");
    if (theme === "light") {
        if (icon) icon.innerText = "☀️";
        if (label) label.innerText = "Light Mode";
        if (toggle) toggle.classList.add("active");
    } else {
        if (icon) icon.innerText = "🌙";
        if (label) label.innerText = "Dark Mode";
        if (toggle) toggle.classList.remove("active");
    }
}

function toggleTheme() {
    let current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
}

/* ── INFO PENYIMPANAN CHAT ──────────────── */
// Perkiraan kuota localStorage per domain (umumnya 5 MB, tergantung browser)
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function updateStorageInfo() {
    const textEl = document.getElementById("storage-text");
    if (!textEl) return;

    const raw = localStorage.getItem("chat_history") || "";
    const used = raw ? new Blob([raw]).size : 0;

    let count = 0;
    try { count = raw ? JSON.parse(raw).length : 0; } catch (e) {}

    const percent = (used / STORAGE_LIMIT_BYTES) * 100;
    const fill = document.getElementById("storage-fill");

    textEl.innerText = formatBytes(used) + " dari 5 MB";
    document.getElementById("storage-percent").innerText = percent.toFixed(2) + "%";
    document.getElementById("storage-meta").innerText = count + " pesan tersimpan di perangkat ini";

    fill.style.width = Math.min(100, Math.max(percent, used > 0 ? 2 : 0)) + "%";
    fill.classList.remove("warn", "danger");
    if (percent >= 90) fill.classList.add("danger");
    else if (percent >= 70) fill.classList.add("warn");
}

function clearHistory() {
    if (confirm("Hapus seluruh riwayat chat di perangkat ini?")) {
        localStorage.removeItem("chat_history");
        location.reload();
    }
}

/* ── NAMA USER ──────────────────────────── */
function getInitials(name) {
    return name.trim().split(" ").map(w => w[0].toUpperCase()).slice(0, 2).join("");
}

function loadUserName() {
    let name = localStorage.getItem("user_name");
    if (!name) {
        document.getElementById("name-overlay").classList.remove("hidden");
        setTimeout(() => document.getElementById("name-input").focus(), 300);
    } else {
        applyUserName(name);
    }
}

function applyUserName(name) {
    let initials = getInitials(name);
    document.getElementById("sidebar-avatar").innerText = initials;
    document.getElementById("sidebar-name").innerText = name;
    let welcome = document.getElementById("welcome-msg");
    if (welcome) {
        welcome.innerHTML = `Halo, <b>${name}!</b> 👋 Selamat datang di Chatbot PMB Universitas Gunadarma 2026.<br><br>
        Saya siap membantu menjawab pertanyaan kamu seputar pendaftaran, biaya kuliah, jurusan, dan beasiswa. Silakan mulai bertanya!
        <div class="suggestion-chips">
            <div class="chip" onclick="quickAsk('Bagaimana cara mendaftar PMB?')">Cara daftar</div>
            <div class="chip" onclick="quickAsk('Berapa biaya kuliah di Gunadarma?')">Biaya kuliah</div>
            <div class="chip" onclick="quickAsk('Apa saja beasiswa di Gunadarma?')">Beasiswa</div>
            <div class="chip" onclick="quickAsk('Apa saja jurusan di Gunadarma?')">Jurusan</div>
        </div>`;
    }
    document.getElementById("name-overlay").classList.add("hidden");
}

function saveName() {
    let input = document.getElementById("name-input");
    let name = input.value.trim();
    if (!name) {
        input.style.borderColor = "rgba(239,68,68,0.6)";
        input.placeholder = "Nama tidak boleh kosong!";
        setTimeout(() => {
            input.style.borderColor = "";
            input.placeholder = "Masukkan nama kamu...";
        }, 2000);
        return;
    }
    localStorage.setItem("user_name", name);
    applyUserName(name);
}

function editName() {
    let currentName = localStorage.getItem("user_name") || "";
    document.getElementById("name-input").value = currentName;
    document.getElementById("name-overlay").classList.remove("hidden");
    setTimeout(() => document.getElementById("name-input").focus(), 100);
}

function handleNameKey(e) {
    if (e.key === "Enter") saveName();
}

/* ── HELPER ─────────────────────────────── */
function getCleanHistory() {
    let data = localStorage.getItem("chat_history");
    if (!data) return [];
    let messages = JSON.parse(data);
    return messages.slice(-6).map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text.replace(/<[^>]*>/g, "")
    }));
}

function getUserInitials() {
    let name = localStorage.getItem("user_name") || "T";
    return getInitials(name);
}

function getUserName() {
    return localStorage.getItem("user_name") || "Kamu";
}

function getTime() {
    let now = new Date();
    return now.getHours().toString().padStart(2, "0") + ":" +
           now.getMinutes().toString().padStart(2, "0");
}

function handleKey(e) {
    if (e.key === "Enter") sendMessage();
}

/* ── HANDOFF ────────────────────────────── */
function buildHandoffBox(type) {
    let div = document.createElement("div");
    div.className = "handoff-box";

    if (type === "human") {
        div.innerHTML = `
            <div class="handoff-title">👤 Hubungi Tim PMB Gunadarma</div>
            <div class="handoff-links">
                <a class="handoff-link" href="https://wa.me/6287788119999" target="_blank">📱 WhatsApp Karawaci</a>
                <a class="handoff-link" href="tel:02178881112" target="_blank">📞 Telepon PMB</a>
                <a class="handoff-link" href="mailto:ppmb-ol@gunadarma.ac.id" target="_blank">✉️ Email PMB</a>
            </div>`;
    } else if (type === "website") {
        div.innerHTML = `
            <div class="handoff-title">🌐 Kunjungi Website Resmi</div>
            <div class="handoff-links">
                <a class="handoff-link" href="https://pendaftaran.gunadarma.ac.id/2026/" target="_blank">📝 Daftar Online</a>
                <a class="handoff-link" href="https://www.gunadarma.ac.id" target="_blank">🏫 Website Gunadarma</a>
                <a class="handoff-link" href="https://pmb-beasiswa.gunadarma.ac.id" target="_blank">🎓 Info Beasiswa</a>
            </div>`;
    } else if (type === "ikn") {
        div.innerHTML = `
            <div class="handoff-title">🏛️ Informasi Kampus IKN</div>
            <div class="handoff-links">
                <a class="handoff-link" href="https://www.gunadarma.ac.id" target="_blank">🌐 Website Resmi</a>
                <a class="handoff-link" href="https://wa.me/6287788119999" target="_blank">📱 Tanya via WhatsApp</a>
                <a class="handoff-link" href="mailto:ppmb-ol@gunadarma.ac.id" target="_blank">✉️ Email PMB</a>
            </div>`;
    }
    return div;
}

function detectHandoff(text, userInput) {
    const lower = userInput.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lower.includes("ikn") || lower.includes("ibu kota") || lower.includes("nusantara") ||
        lower.includes("kalimantan") || lower.includes("penajam")) {
        return "ikn";
    }

    if (lower.includes("hubungi") || lower.includes("kontak") || lower.includes("cs") ||
        lower.includes("admin") || lower.includes("petugas") || lower.includes("staf") ||
        lower.includes("manusia") || lower.includes("operator") || lower.includes("whatsapp") ||
        lower.includes("telepon") || lower.includes("telpon") || lower.includes("call")) {
        return "human";
    }

    if (lowerText.includes("belum memiliki informasi") || lowerText.includes("tidak dapat") ||
        lowerText.includes("silakan kunjungi") || lowerText.includes("website resmi")) {
        return "website";
    }

    return null;
}

/* ── INIT ───────────────────────────────── */
window.onload = () => {
    initTheme();
    loadUserName();
    loadChat();
    updateStorageInfo();
    setTimeout(() => {
        const chat = document.getElementById("chatbox");
        chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
    }, 150);
};

/* ── SAVE & LOAD CHAT ───────────────────── */
function saveChat(data) {
    try {
        let json = JSON.stringify(data);
        // Pengaman: jika lebih dari 90% kuota, buang pesan terlama (2 pesan sekaligus)
        while (new Blob([json]).size > STORAGE_LIMIT_BYTES * 0.9 && data.length > 2) {
            data.splice(0, 2);
            json = JSON.stringify(data);
        }
        localStorage.setItem("chat_history", json);
    } catch (e) {
        console.warn("Penyimpanan chat penuh:", e);
    }
    updateStorageInfo();
}

function loadChat() {
    let chatbox = document.getElementById("chatbox");
    let data = localStorage.getItem("chat_history");
    if (!data) return;

    let messages = JSON.parse(data);
    let initials = getUserInitials();
    let userName = getUserName();

    chatbox.innerHTML = '<div class="date-divider">Riwayat percakapan</div>';

    messages.forEach(msg => {
        let row = document.createElement("div");
        row.className = "chat-row " + (msg.sender === "user" ? "user-row" : "bot-row");

        if (msg.sender === "user") {
            row.innerHTML = `
                <div class="msg-wrap">
                    <div class="msg-name" style="text-align:right">${userName}</div>
                    <div class="message user-message">${msg.text}</div>
                    <div class="msg-time" style="text-align:right">${msg.time || ""}</div>
                </div>
                <div class="avatar user-av">${initials}</div>`;
        } else {
            row.innerHTML = `
                <div class="avatar bot-av">🤖</div>
                <div class="msg-wrap">
                    <div class="msg-name">Gunadarma AI</div>
                    <div class="message bot-message">${msg.text}</div>
                    <div class="msg-time">${msg.time || ""}</div>
                </div>`;
        }
        chatbox.appendChild(row);
    });

    setTimeout(() => {
        chatbox.scrollTo({ top: chatbox.scrollHeight, behavior: 'smooth' });
    }, 100);
}

function newChat() {
    localStorage.removeItem("chat_history");
    location.reload();
}

function quickAsk(text) {
    document.getElementById("message").value = text;
    sendMessage();
}

function showSuggestions(container) {
    let div = document.createElement("div");
    div.className = "suggestion-chips";
    suggestions.forEach(s => {
        let btn = document.createElement("div");
        btn.className = "chip";
        btn.innerText = s;
        btn.onclick = () => {
            document.getElementById("message").value = s;
            sendMessage();
        };
        div.appendChild(btn);
    });
    container.appendChild(div);
}

/* ── SEND MESSAGE ───────────────────────── */
async function sendMessage() {
    let input = document.getElementById("message");
    let message = input.value.trim();
    if (!message) return;

    let chat = document.getElementById("chatbox");
    let history = JSON.parse(localStorage.getItem("chat_history")) || [];
    let time = getTime();
    let initials = getUserInitials();
    let userName = getUserName();

    /* USER MESSAGE */
    let userRow = document.createElement("div");
    userRow.className = "chat-row user-row";
    userRow.innerHTML = `
        <div class="msg-wrap">
            <div class="msg-name" style="text-align:right">${userName}</div>
            <div class="message user-message">${message}</div>
            <div class="msg-time" style="text-align:right">${time}</div>
        </div>
        <div class="avatar user-av">${initials}</div>`;
    chat.appendChild(userRow);
    history.push({ sender: "user", text: message, time });
    input.value = "";
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });

    /* TYPING INDICATOR */
    let typingRow = document.createElement("div");
    typingRow.className = "chat-row bot-row";
    typingRow.id = "typing-indicator";
    typingRow.innerHTML = `
        <div class="avatar bot-av">🤖</div>
        <div class="msg-wrap">
            <div class="msg-name">Gunadarma AI</div>
            <div class="typing-bubble">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>`;
    chat.appendChild(typingRow);
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });

    let botRow = document.createElement("div");
    botRow.className = "chat-row bot-row";
    let botBubble = document.createElement("div");
    botBubble.className = "message bot-message";
    botBubble.innerHTML = `<span class="typing-cursor">▍</span>`;
    let fullText = "";

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history: getCleanHistory() })
        });

        let indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();

        botRow.innerHTML = `
            <div class="avatar bot-av">🤖</div>
            <div class="msg-wrap">
                <div class="msg-name">Gunadarma AI</div>
            </div>`;
        botRow.querySelector(".msg-wrap").appendChild(botBubble);
        chat.appendChild(botRow);
        chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            botBubble.innerHTML =
                fullText.replace(/\n/g, "<br>") +
                `<span class="typing-cursor">▍</span>`;
            chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
        }

    } catch (err) {
        let indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();
        botRow.innerHTML = `
            <div class="avatar bot-av">🤖</div>
            <div class="msg-wrap">
                <div class="msg-name">Gunadarma AI</div>
            </div>`;
        botRow.querySelector(".msg-wrap").appendChild(botBubble);
        chat.appendChild(botRow);
        fullText = "Terjadi kesalahan koneksi. Silakan coba lagi.";
    }

    /* Selesai streaming */
    botBubble.innerHTML = fullText.replace(/\n/g, "<br>");

    let timeDiv = document.createElement("div");
    timeDiv.className = "msg-time";
    timeDiv.innerText = time;
    botRow.querySelector(".msg-wrap").appendChild(timeDiv);

    /* HANDOFF DETECTION */
    let handoffType = detectHandoff(fullText, message);
    if (handoffType) {
        botRow.querySelector(".msg-wrap").appendChild(buildHandoffBox(handoffType));
    } else if (fullText.toLowerCase().includes("belum memiliki informasi")) {
        showSuggestions(botBubble);
        botRow.querySelector(".msg-wrap").appendChild(buildHandoffBox("website"));
    }

    history.push({ sender: "bot", text: fullText, time });
    saveChat(history);
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
}