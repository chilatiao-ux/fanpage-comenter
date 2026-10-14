// Service Worker - Maneja la navegación y orquesta la automatización

console.log("✅ Background service worker cargado");

let automationState = {
    isRunning: false,
    config: null,
    currentPageIndex: 0,
    currentPhotoIndex: 0,
    commentedCount: 0,
    tabId: null,
    pageLoadTimeout: null,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 1,
    lastActivityTime: null,
    watchdogInterval: null
};

// Abrir dashboard al instalar
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
        console.log("📖 Abriendo dashboard...");
        chrome.tabs.create({
            url: chrome.runtime.getURL("src/dashboard.html")
        });
    }
});

// Abrir dashboard cuando se hace clic en el icono
chrome.action.onClicked.addListener((tab) => {
    console.log("🖱️ Icono clickeado, abriendo dashboard...");
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/dashboard.html")
    });
});

// Escuchar cambios en tabs para detectar cuando carga una página de fotos
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!automationState.isRunning || tabId !== automationState.tabId) return;
    
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("/photos/")) {
        console.log("✅ Página de fotos cargada");
        automationState.lastActivityTime = Date.now();
        
        // Esperar un poco para que el DOM esté listo
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
                action: "commentOnCurrentPhoto",
                config: automationState.config
            }, (response) => {
                automationState.lastActivityTime = Date.now();
                
                if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError.message);
                    // Reintentar
                    setTimeout(() => {
                        navigateToNextPhoto();
                    }, 2000);
                } else if (response && response.success) {
                    automationState.commentedCount++;
                    console.log(`✅ Comentario ${automationState.commentedCount}`);
                    
                    // Navegar a siguiente foto o página
                    automationState.currentPhotoIndex++;
                    
                    if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                        // Siguiente foto en la misma página
                        setTimeout(() => {
                            navigateToNextPhoto();
                        }, automationState.config.delayBetweenPosts);
                    } else {
                        // Siguiente página
                        automationState.currentPageIndex++;
                        automationState.currentPhotoIndex = 0;
                        
                        setTimeout(() => {
                            navigateToNextPage();
                        }, automationState.config.delayBetweenPages);
                    }
                } else if (response && !response.success) {
                    console.log("⚠️ Contenido no disponible, saltando a siguiente página...");
                    automationState.currentPageIndex++;
                    automationState.currentPhotoIndex = 0;
                    
                    setTimeout(() => {
                        navigateToNextPage();
                    }, automationState.config.delayBetweenPages);
                }
            });
        }, 2000);
    }
});

// Manejar mensajes del dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📨 Mensaje en background:", request.action);
    
    if (request.action === "startAutomation") {
        console.log("🚀 Iniciando automatización");
        
        automationState.isRunning = true;
        automationState.config = request.config;
        automationState.tabId = request.tabId || sender.tab.id;
        automationState.lastActivityTime = Date.now();
        
        // Si es modo "new", resetear índices y mezclar URLs
        if (request.mode === 'new') {
            console.log("🔄 Modo: Nuevo (Resetear)");
            automationState.currentPageIndex = 0;
            automationState.currentPhotoIndex = 0;
            automationState.commentedCount = 0;
            
            // Mezclar las URLs de forma aleatoria (Fisher-Yates shuffle)
            const shuffled = [...request.config.fanPageUrls];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            automationState.config.fanPageUrls = shuffled;
            console.log("🔀 URLs mezcladas aleatoriamente");
        } else {
            console.log("➡️ Modo: Reanudar");
            // Los índices se mantienen del estado anterior
            console.log(`Reanudando desde página ${automationState.currentPageIndex + 1}, foto ${automationState.currentPhotoIndex + 1}`);
        }
        
        console.log(`📄 Total de páginas: ${request.config.fanPageUrls.length}`);
        
        // Guardar configuración y estado
        chrome.storage.local.set({ 
            automationConfig: request.config,
            status: {
                isRunning: true,
                commentedCount: automationState.commentedCount,
                lastUpdate: new Date().toLocaleTimeString()
            }
        }, () => {
            console.log("✅ Configuración y estado guardados");
        });
        
        // Iniciar watchdog para detectar bloqueos
        startWatchdog();
        
        // Responder inmediatamente
        sendResponse({ success: true });
        
        // Comenzar automatización después
        setTimeout(() => {
            navigateToNextPage();
        }, 500);
        
        return false;
        
    } else if (request.action === "stopAutomation") {
        console.log("⏹️ Deteniendo automatización");
        automationState.isRunning = false;
        
        if (automationState.pageLoadTimeout) {
            clearTimeout(automationState.pageLoadTimeout);
        }
        
        if (automationState.watchdogInterval) {
            clearInterval(automationState.watchdogInterval);
            automationState.watchdogInterval = null;
        }
        
        chrome.storage.local.set({
            status: {
                isRunning: false,
                commentedCount: automationState.commentedCount,
                lastUpdate: new Date().toLocaleTimeString()
            }
        });
        
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "skipCurrentPage") {
        console.log("⏭️ Saltando a siguiente fan page");
        console.log(`Página actual: ${automationState.currentPageIndex}, Total: ${automationState.config.fanPageUrls.length}`);
        
        if (!automationState.isRunning) {
            console.log("❌ Automatización no está corriendo");
            sendResponse({ success: false });
            return false;
        }
        
        automationState.currentPageIndex++;
        automationState.currentPhotoIndex = 0;
        automationState.consecutiveFailures = 0;
        
        console.log(`✅ Nueva página: ${automationState.currentPageIndex}`);
        
        sendResponse({ success: true });
        
        setTimeout(() => {
            console.log("Llamando navigateToNextPage desde skipCurrentPage");
            navigateToNextPage();
        }, 500);
        
        return false;
        
    } else if (request.action === "photoCommented") {
        console.log("📸 Foto comentada (desde content script)");
        
        if (request.success) {
            automationState.commentedCount++;
            automationState.consecutiveFailures = 0;
            console.log(`✅ Comentario ${automationState.commentedCount}`);
            
            chrome.storage.local.set({
                status: {
                    isRunning: true,
                    commentedCount: automationState.commentedCount,
                    lastUpdate: new Date().toLocaleTimeString()
                }
            });
            
            // Navegar a siguiente foto o página
            automationState.currentPhotoIndex++;
            
            if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                // Siguiente foto en la misma página
                setTimeout(() => {
                    navigateToNextPhoto();
                }, automationState.config.delayBetweenPosts);
            } else {
                // Siguiente página
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                
                setTimeout(() => {
                    navigateToNextPage();
                }, automationState.config.delayBetweenPages);
            }
        } else {
            console.log("❌ Error comentando foto");
            automationState.consecutiveFailures++;
            console.log(`⚠️ Fallos consecutivos: ${automationState.consecutiveFailures}/${automationState.maxConsecutiveFailures}`);
            
            // Si hay 3 fallos consecutivos, saltar a siguiente página
            if (automationState.consecutiveFailures >= automationState.maxConsecutiveFailures) {
                console.log("🚫 Demasiados fallos en esta página, saltando a la siguiente...");
                automationState.consecutiveFailures = 0;
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                
                setTimeout(() => {
                    navigateToNextPage();
                }, automationState.config.delayBetweenPages);
            } else {
                // Intentar siguiente foto
                automationState.currentPhotoIndex++;
                
                if (automationState.currentPhotoIndex < automationState.config.postsPerPage) {
                    // Intentar siguiente foto en la misma página
                    setTimeout(() => {
                        navigateToNextPhoto();
                    }, automationState.config.delayBetweenPosts);
                } else {
                    // Si llega al límite de fotos, ir a siguiente página
                    console.log(`⚠️ Alcanzadas ${automationState.config.postsPerPage} fotos, continuando con la siguiente página...`);
                    automationState.consecutiveFailures = 0;
                    automationState.currentPageIndex++;
                    automationState.currentPhotoIndex = 0;
                    
                    setTimeout(() => {
                        navigateToNextPage();
                    }, automationState.config.delayBetweenPages);
                }
            }
        }
        
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "facebookLimitationDetected") {
        console.log("🚨 LIMITACIÓN DE FACEBOOK DETECTADA");
        console.log("🌐 Redirigiendo a Google para limpiar cookies...");
        
        // Redirigir a Google
        chrome.tabs.update(automationState.tabId, { url: "https://www.google.com/#clear" }, () => {
            console.log("✅ Redirigido a Google");
            
            // Detener la automatización
            automationState.isRunning = false;
            if (automationState.watchdogInterval) {
                clearInterval(automationState.watchdogInterval);
                automationState.watchdogInterval = null;
            }
            
            chrome.storage.local.set({
                status: {
                    isRunning: false,
                    commentedCount: automationState.commentedCount,
                    lastUpdate: new Date().toLocaleTimeString(),
                    reason: "Limitación de Facebook detectada"
                }
            });
        });
        
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "anotherProfileDetected") {
        console.log("👤 OTRO PERFIL DETECTADO");
        
        if (!automationState.config?.backupFanPageUrl) {
            console.log("❌ No hay fan page de respaldo configurada");
            automationState.isRunning = false;
            sendResponse({ success: false });
            return false;
        }
        
        console.log("🔄 Navegando a fan page de respaldo:", automationState.config.backupFanPageUrl);
        
        // Convertir URL a fotos
        const backupPhotosUrl = convertToPhotosUrl(automationState.config.backupFanPageUrl);
        
        // Navegar a la fan page de respaldo
        chrome.tabs.update(automationState.tabId, { url: backupPhotosUrl }, () => {
            console.log("✅ Navegado a fan page de respaldo");
            
            // Esperar a que cargue y luego seguir la fan page
            setTimeout(() => {
                console.log("📌 Siguiendo la fan page de respaldo...");
                
                // Enviar mensaje al content script para seguir la fan page
                chrome.tabs.sendMessage(automationState.tabId, {
                    action: "followFanPage"
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error siguiendo fan page:", chrome.runtime.lastError.message);
                    } else {
                        console.log("✅ Fan page seguida, continuando con automatización");
                        automationState.lastActivityTime = Date.now();
                    }
                });
            }, 3000);
        });
        
        sendResponse({ success: true });
        return false;
        
    } else if (request.action === "getStatus") {
        sendResponse({
            isRunning: automationState.isRunning,
            commentedCount: automationState.commentedCount,
            currentPage: automationState.currentPageIndex + 1,
            totalPages: automationState.config?.fanPageUrls?.length || 0
        });
        return false;
    }
    
    return false;
});

function navigateToNextPage() {
    if (!automationState.isRunning) {
        console.log("⏹️ Automatización detenida");
        return;
    }
    
    if (automationState.currentPageIndex >= automationState.config.fanPageUrls.length) {
        console.log(`✅ Completado: ${automationState.commentedCount} comentarios`);
        automationState.isRunning = false;
        return;
    }
    
    const pageUrl = automationState.config.fanPageUrls[automationState.currentPageIndex];
    const photosUrl = convertToPhotosUrl(pageUrl);
    
    console.log(`\n📄 [${automationState.currentPageIndex + 1}/${automationState.config.fanPageUrls.length}]`);
    console.log(`🌐 Navegando a: ${photosUrl}`);
    
    // Navegar a la URL de fotos
    chrome.tabs.update(automationState.tabId, { url: photosUrl }, (tab) => {
        console.log("⏳ Esperando carga de página...");
    });
}

function navigateToNextPhoto() {
    if (!automationState.isRunning) return;
    
    console.log("➡️ Navegando a siguiente foto");
    
    chrome.tabs.sendMessage(automationState.tabId, {
        action: "nextPhoto",
        config: automationState.config
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error al navegar:", chrome.runtime.lastError.message);
        }
    });
}

function convertToPhotosUrl(url) {
    url = url.replace(/\/$/, '');
    
    if (url.includes('/photos/')) {
        return url + '/';
    }
    
    const profileMatch = url.match(/id=(\d+)/);
    if (profileMatch) {
        return `https://www.facebook.com/${profileMatch[1]}/photos/`;
    }
    
    return url + '/photos/';
}

console.log("✅ Background service worker completamente cargado");

// Watchdog para detectar bloqueos y recuperarse automaticamente
function startWatchdog() {
    if (automationState.watchdogInterval) {
        clearInterval(automationState.watchdogInterval);
    }
    
    console.log("🐛 Iniciando watchdog de recuperacion...");
    
    automationState.watchdogInterval = setInterval(() => {
        if (!automationState.isRunning) {
            clearInterval(automationState.watchdogInterval);
            automationState.watchdogInterval = null;
            return;
        }
        
        const timeSinceLastActivity = Date.now() - (automationState.lastActivityTime || Date.now());
        const TIMEOUT_THRESHOLD = 60000; // 60 segundos sin actividad
        
        console.log(`⚠️ Watchdog: ${(timeSinceLastActivity / 1000).toFixed(1)}s sin actividad`);
        
        if (timeSinceLastActivity > TIMEOUT_THRESHOLD) {
            console.log("🚨 ALERTA: Automatizacion bloqueada, intentando recuperacion...");
            automationState.lastActivityTime = Date.now();
            
            // Intentar navegar a la siguiente pagina
            if (automationState.currentPageIndex < automationState.config.fanPageUrls.length) {
                console.log("🔄 Recuperando: Saltando a siguiente pagina...");
                automationState.currentPageIndex++;
                automationState.currentPhotoIndex = 0;
                navigateToNextPage();
            } else {
                console.log("✅ Automatizacion completada");
                automationState.isRunning = false;
                clearInterval(automationState.watchdogInterval);
                automationState.watchdogInterval = null;
            }
        }
    }, 10000); // Verificar cada 10 segundos
}

console.log("✅ Background service worker completamente cargado");
