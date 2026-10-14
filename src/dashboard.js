// Dashboard Script - Interfaz principal

let config = {
    fanPageUrls: [],
    mentionedPages: [],
    commentText: "❌️wao que buenos son los videos de esta pagina💯\n@𝗣𝗢𝗡𝗨𝗦 𝗨𝗦𝗢𝗥𝗡𝗦𝗧𝗦 𝗠𝗦𝗨𝗢",
    postsPerPage: 5,
    delayBetweenPosts: 3000,
    delayBetweenPages: 5000,
    backupFanPageUrl: null
};

const DEFAULT_COMMENT_TEXT = "❗️wao que buenos son los videos de esta pagina👇\n@𝗩𝗶𝗱𝗲𝗼 𝗰𝗼𝗺𝗽𝗹𝗲𝘁𝗼 𝗮𝗾𝘂𝗶";

// Elementos del DOM
const fanPageUrlInput = document.getElementById("fanPageUrl");
const addPageBtn = document.getElementById("addPageBtn");
const fanPagesList = document.getElementById("fanPagesList");

const mentionPageNameInput = document.getElementById("mentionPageName");
const addMentionBtn = document.getElementById("addMentionBtn");
const mentionPagesList = document.getElementById("mentionPagesList");

const commentTextarea = document.getElementById("commentText");
const resetCommentBtn = document.getElementById("resetCommentBtn");

const postsPerPageInput = document.getElementById("postsPerPage");
const delayBetweenPostsInput = document.getElementById("delayBetweenPosts");
const delayBetweenPagesInput = document.getElementById("delayBetweenPages");

const saveConfigBtn = document.getElementById("saveConfigBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const statusRunning = document.getElementById("statusRunning");
const statusCommented = document.getElementById("statusCommented");
const statusLastUpdate = document.getElementById("statusLastUpdate");

const backupFanPageUrlInput = document.getElementById("backupFanPageUrl");
const setBackupBtn = document.getElementById("setBackupBtn");
const backupPageDisplay = document.getElementById("backupPageDisplay");

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔧 Inicializando dashboard...");
    loadConfig();
    setupEventListeners();
    updateStatus();
    
    // Actualizar estado cada 2 segundos
    setInterval(updateStatus, 2000);
});

function setupEventListeners() {
    // Mini tabs para fan pages
    document.querySelectorAll(".tab-mini").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.getAttribute("data-tab");
            switchMiniTab(tabName);
        });
    });
    
    // Fan Pages
    addPageBtn.addEventListener("click", addFanPage);
    fanPageUrlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addFanPage();
    });
    
    // Multiple URLs
    document.getElementById("addMultipleBtn").addEventListener("click", addMultipleFanPages);

    // Mentioned Pages
    addMentionBtn.addEventListener("click", addMentionedPage);
    mentionPageNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addMentionedPage();
    });

    // Comment Text
    resetCommentBtn.addEventListener("click", resetCommentText);

    // Config
    saveConfigBtn.addEventListener("click", saveConfig);

    // Backup Fan Page
    setBackupBtn.addEventListener("click", setBackupFanPage);
    backupFanPageUrlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") setBackupFanPage();
    });

    // Automation
    startBtn.addEventListener("click", startAutomation);
    stopBtn.addEventListener("click", stopAutomation);
    document.getElementById("skipPageBtn").addEventListener("click", skipCurrentPage);
}

function switchMiniTab(tabName) {
    // Desactivar todos los tabs
    document.querySelectorAll(".tab-mini").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tab-mini-content").forEach(content => content.classList.remove("active"));
    
    // Activar el tab seleccionado
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
}

function addFanPage() {
    const url = fanPageUrlInput.value.trim();
    
    if (!url) {
        showNotification("Por favor ingresa una URL", "warning");
        return;
    }

    if (!isValidUrl(url)) {
        showNotification("Por favor ingresa una URL válida de Facebook", "error");
        return;
    }

    if (config.fanPageUrls.includes(url)) {
        showNotification("Esta URL ya está en la lista", "warning");
        return;
    }

    config.fanPageUrls.push(url);
    fanPageUrlInput.value = "";
    renderFanPagesList();
    showNotification("✅ Fan page agregada", "success");
}

function addMultipleFanPages() {
    const text = document.getElementById("fanPageUrls").value.trim();
    
    if (!text) {
        showNotification("Por favor pega las URLs", "warning");
        return;
    }
    
    const urls = text.split("\n").map(url => url.trim()).filter(url => url.length > 0);
    let added = 0;
    let duplicates = 0;
    let invalid = 0;
    
    urls.forEach(url => {
        if (!isValidUrl(url)) {
            invalid++;
            return;
        }
        
        if (config.fanPageUrls.includes(url)) {
            duplicates++;
            return;
        }
        
        config.fanPageUrls.push(url);
        added++;
    });
    
    document.getElementById("fanPageUrls").value = "";
    renderFanPagesList();
    
    let message = `✅ ${added} agregadas`;
    if (duplicates > 0) message += ` (${duplicates} duplicadas)`;
    if (invalid > 0) message += ` (${invalid} inválidas)`;
    
    showNotification(message, "success");
}

function removeFanPage(index) {
    const removed = config.fanPageUrls[index];
    config.fanPageUrls.splice(index, 1);
    renderFanPagesList();
    showNotification("✅ Fan page eliminada", "success");
    console.log("Eliminada:", removed);
}

function renderFanPagesList() {
    fanPagesList.innerHTML = "";
    
    if (config.fanPageUrls.length === 0) {
        fanPagesList.innerHTML = '<p class="empty-message">No hay fan pages agregadas</p>';
        return;
    }

    config.fanPageUrls.forEach((url, index) => {
        const item = document.createElement("div");
        item.className = "list-item";
        
        const textSpan = document.createElement("span");
        textSpan.className = "list-item-text";
        textSpan.textContent = url;
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "list-item-delete";
        deleteBtn.textContent = "✕ Eliminar";
        deleteBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeFanPage(index);
        });
        
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        fanPagesList.appendChild(item);
    });
}

function addMentionedPage() {
    const name = mentionPageNameInput.value.trim();
    
    if (!name) {
        showNotification("Por favor ingresa un nombre", "warning");
        return;
    }

    if (config.mentionedPages.includes(name)) {
        showNotification("Esta fan page ya está en la lista", "warning");
        return;
    }

    config.mentionedPages.push(name);
    mentionPageNameInput.value = "";
    renderMentionedPagesList();
    showNotification("✅ Fan page a mencionar agregada", "success");
}

function removeMentionedPage(index) {
    const removed = config.mentionedPages[index];
    config.mentionedPages.splice(index, 1);
    renderMentionedPagesList();
    showNotification("✅ Fan page eliminada", "success");
    console.log("Eliminada:", removed);
}

function renderMentionedPagesList() {
    mentionPagesList.innerHTML = "";
    
    if (config.mentionedPages.length === 0) {
        mentionPagesList.innerHTML = '<p class="empty-message">No hay fan pages para mencionar</p>';
        return;
    }

    config.mentionedPages.forEach((name, index) => {
        const item = document.createElement("div");
        item.className = "list-item";
        
        const textSpan = document.createElement("span");
        textSpan.className = "list-item-text";
        textSpan.textContent = "@" + name;
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "list-item-delete";
        deleteBtn.textContent = "✕ Eliminar";
        deleteBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeMentionedPage(index);
        });
        
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        mentionPagesList.appendChild(item);
    });
}

function resetCommentText() {
    commentTextarea.value = DEFAULT_COMMENT_TEXT;
    config.commentText = DEFAULT_COMMENT_TEXT;
    showNotification("✅ Texto restaurado", "success");
}

function loadConfig() {
    chrome.storage.local.get(["config"], (result) => {
        if (result.config) {
            config = result.config;
            console.log("📥 Configuración cargada:", config);
        }
        updateUI();
    });
}

function updateUI() {
    commentTextarea.value = config.commentText;
    postsPerPageInput.value = config.postsPerPage;
    delayBetweenPostsInput.value = config.delayBetweenPosts;
    delayBetweenPagesInput.value = config.delayBetweenPages;
    
    renderFanPagesList();
    renderMentionedPagesList();
    updateBackupPageDisplay();
}

function saveConfig() {
    config.commentText = commentTextarea.value;
    config.postsPerPage = parseInt(postsPerPageInput.value);
    config.delayBetweenPosts = parseInt(delayBetweenPostsInput.value);
    config.delayBetweenPages = parseInt(delayBetweenPagesInput.value);

    console.log("💾 Guardando configuración:", config);

    chrome.storage.local.set({ config: config }, () => {
        console.log("✅ Configuración guardada");
        showNotification("✅ Configuración guardada correctamente", "success");
    });
}

function startAutomation() {
    console.log("🚀 Iniciando automatización...");
    
    if (config.fanPageUrls.length === 0) {
        showNotification("❌ Agrega al menos una fan page", "error");
        return;
    }

    if (config.mentionedPages.length === 0) {
        showNotification("❌ Agrega al menos una fan page a mencionar", "error");
        return;
    }

    // Guardar config
    config.commentText = commentTextarea.value;
    config.postsPerPage = parseInt(postsPerPageInput.value);
    config.delayBetweenPosts = parseInt(delayBetweenPostsInput.value);
    config.delayBetweenPages = parseInt(delayBetweenPagesInput.value);
    
    saveConfig();

    // Obtener la pestaña activa de Facebook
    chrome.tabs.query({ url: "*://www.facebook.com/*" }, (tabs) => {
        if (tabs.length === 0) {
            showNotification("❌ Abre Facebook en una pestaña", "error");
            return;
        }

        const facebookTab = tabs[0];
        console.log("📄 Pestaña de Facebook encontrada:", facebookTab.id);

        // Obtener el modo (new o resume)
        const startMode = document.getElementById('startMode').value;
        console.log("📌 Modo de inicio:", startMode);

        // Enviar mensaje al background
        chrome.runtime.sendMessage(
            { action: "startAutomation", config: config, tabId: facebookTab.id, mode: startMode },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Error de comunicación:", chrome.runtime.lastError.message);
                    showNotification("❌ Error: Recarga Facebook y intenta de nuevo", "error");
                    return;
                }
                
                console.log("📨 Respuesta:", response);
                if (response && response.success) {
                    showNotification("🚀 Automatización iniciada", "success");
                    startBtn.disabled = true;
                    stopBtn.disabled = false;
                } else {
                    const error = response?.error || "Error desconocido";
                    showNotification(`❌ Error: ${error}`, "error");
                }
            }
        );
    });
}

function stopAutomation() {
    console.log("⏹️ Deteniendo automatización...");
    
    chrome.runtime.sendMessage(
        { action: "stopAutomation" },
        (response) => {
            console.log("📨 Respuesta de detención:", response);
            if (response && response.success) {
                showNotification("⏹️ Automatización detenida", "success");
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
    );
}

function skipCurrentPage() {
    console.log("⏭️ Saltando a siguiente fan page...");
    
    chrome.runtime.sendMessage(
        { action: "skipCurrentPage" },
        (response) => {
            console.log("📨 Respuesta de salto:", response);
            if (response && response.success) {
                showNotification("⏭️ Saltando a siguiente fan page", "success");
            }
        }
    );
}

function updateStatus() {
    chrome.storage.local.get(["status"], (result) => {
        if (result.status && Object.keys(result.status).length > 0) {
            const status = result.status;
            statusRunning.textContent = status.isRunning ? "🟢 En ejecución" : "🔴 Detenido";
            statusCommented.textContent = status.commentedCount || 0;
            statusLastUpdate.textContent = status.lastUpdate || "-";
            
            startBtn.disabled = status.isRunning;
            stopBtn.disabled = !status.isRunning;
            document.getElementById("skipPageBtn").disabled = !status.isRunning;
        }
    });
}

function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function isValidUrl(string) {
    try {
        new URL(string);
        return string.includes("facebook.com");
    } catch (_) {
        return false;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

console.log("✅ Dashboard script cargado");

function setBackupFanPage() {
    const url = backupFanPageUrlInput.value.trim();
    
    if (!url) {
        showNotification("Por favor ingresa una URL", "warning");
        return;
    }
    
    if (!isValidUrl(url)) {
        showNotification("URL inválida. Debe ser una URL de Facebook", "error");
        return;
    }
    
    config.backupFanPageUrl = url;
    
    // Guardar en storage
    chrome.storage.local.set({ automationConfig: config }, () => {
        console.log("✅ Fan page de respaldo guardada:", url);
        showNotification("✅ Fan page de respaldo configurada", "success");
        
        // Actualizar display
        updateBackupPageDisplay();
        backupFanPageUrlInput.value = "";
    });
}

function updateBackupPageDisplay() {
    if (config.backupFanPageUrl) {
        backupPageDisplay.innerHTML = `
            <div class="list-item">
                <span>${escapeHtml(config.backupFanPageUrl)}</span>
                <button class="btn-remove" onclick="clearBackupFanPage()">✕</button>
            </div>
        `;
    } else {
        backupPageDisplay.innerHTML = '<p class="empty-message">No hay fan page de respaldo configurada</p>';
    }
}

function clearBackupFanPage() {
    config.backupFanPageUrl = null;
    chrome.storage.local.set({ automationConfig: config }, () => {
        console.log("✅ Fan page de respaldo eliminada");
        showNotification("✅ Fan page de respaldo eliminada", "success");
        updateBackupPageDisplay();
    });
}
