// Content Script - Comunica con el injected script y el background

console.log("✅ Content script cargado");

// Inyectar el script en la página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/injected-script.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

console.log("✅ Script inyectado en la página");

// Notificar al background que el content script está listo
setTimeout(() => {
    chrome.runtime.sendMessage({
        action: "contentScriptReady"
    }).catch(err => {
        console.log("⚠️ No se pudo notificar al background:", err.message);
    });
}, 1000);

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📨 Mensaje del background:", request.action);
    
    if (request.action === "commentOnCurrentPhoto") {
        // Notificar al injected script que la automatización está corriendo
        window.postMessage({
            type: 'AUTOMATION_STATE',
            running: true
        }, '*');
        
        // Usar una función async para manejar el await
        (async () => {
        console.log("💬 Comentando en foto actual");
        
        // Detectar limitación de Facebook y otro perfil
        const allElements = document.querySelectorAll('div, span, p, h1, h2');
        let limitationDetected = false;
        let anotherProfileDetected = false;
        
        for (const el of allElements) {
            const text = el.innerText || el.textContent;
            if (!text) continue;
            
            // Detectar limitación de comentarios (múltiples variantes)
            if (text.includes("No podes utilizar esta funcionalidad en este momento") ||
                text.includes("No puedes usar esta función en este momento") ||
                text.includes("Limitamos a frecuencia") ||
                text.includes("You can't use this feature right now")) {
                limitationDetected = true;
                console.log("🚨 LIMITACIÓN DETECTADA: Facebook limitó la función de comentar");
                
                // Intentar cerrar el modal primero
                console.log("🔍 Buscando botón para cerrar modal...");
                const closeButtons = document.querySelectorAll('button, [role="button"]');
                for (const btn of closeButtons) {
                    const btnText = btn.textContent || btn.innerText || '';
                    // Buscar botón de Aceptar, OK, o X
                    if (btnText.toLowerCase().includes('aceptar') || 
                        btnText.toLowerCase().includes('ok') ||
                        btnText.toLowerCase().includes('accept') ||
                        btnText.trim() === 'X' ||
                        btn.getAttribute('aria-label') === 'Cerrar') {
                        console.log("✅ Botón encontrado:", btnText);
                        btn.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        break;
                    }
                }
                break;
            }
            
            // Detectar otro perfil iniciado
            if (text.includes("Parece que iniciaste sesión con otra cuenta") ||
                text.includes("It looks like you signed in with a different account") ||
                text.includes("otro perfil")) {
                anotherProfileDetected = true;
                console.log("👤 OTRO PERFIL DETECTADO: Se inició sesión con otra cuenta");
                break;
            }
        }
        
        if (limitationDetected) {
            console.log("⚠️ Limitación de Facebook detectada, redirigiendo a Google...");
            chrome.runtime.sendMessage({
                action: "facebookLimitationDetected"
            }).catch(err => {
                console.log("⚠️ Error notificando limitación:", err.message);
            });
            sendResponse({ success: false });
            return true;
        }
        
        if (anotherProfileDetected) {
            console.log("⚠️ Otro perfil detectado, ir a fan page de respaldo...");
            chrome.runtime.sendMessage({
                action: "anotherProfileDetected"
            }).catch(err => {
                console.log("⚠️ Error notificando otro perfil:", err.message);
            });
            sendResponse({ success: false });
            return true;
        }
        
        // Detectar si el contenido no está disponible
        let isUnavailable = false;
        for (const el of allElements) {
            const text = el.innerText || el.textContent;
            if (text && (text.includes("Este contenido no está disponible") || 
                text.includes("This content isn't available") ||
                text.includes("contenido no está disponible"))) {
                isUnavailable = true;
                break;
            }
        }
        
        if (isUnavailable) {
            console.log("⚠️ Contenido no disponible, saltando...");
            sendResponse({ success: false });
            return true;
        }
        
        // Enviar al injected script
        window.postMessage({
            type: 'FROM_CONTENT_SCRIPT',
            action: 'commentOnCurrentPhoto',
            config: request.config
        }, '*');
        
        // Esperar respuesta del injected script
        const handleResponse = (event) => {
            if (event.source !== window) return;
            
            if (event.data.type === 'FROM_INJECTED' && event.data.action === 'photoCommented') {
                window.removeEventListener('message', handleResponse);
                sendResponse({ success: event.data.success });
            }
        };
        
        window.addEventListener('message', handleResponse);
        
        // Timeout de 15 segundos
        setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            sendResponse({ success: false });
        }, 15000);
        
        return true;
        })(); // Cerrar la función async
        return true;
        
    } else if (request.action === "stopAutomation") {
        // Notificar al injected script que la automatización se detuvo
        window.postMessage({
            type: 'AUTOMATION_STATE',
            running: false
        }, '*');
        
        sendResponse({ success: true });
        return true;
        
    } else if (request.action === "followFanPage") {
        console.log("📌 Siguiendo la fan page...");
        
        // Buscar y hacer clic en el botón de seguir
        const followButtons = document.querySelectorAll('button, [role="button"]');
        let followBtn = null;
        
        for (const btn of followButtons) {
            const text = btn.textContent || btn.innerText || '';
            if (text.toLowerCase().includes('seguir') || 
                text.toLowerCase().includes('follow') ||
                text.toLowerCase().includes('seguindo')) {
                followBtn = btn;
                break;
            }
        }
        
        if (followBtn) {
            console.log("✅ Botón de seguir encontrado, haciendo clic...");
            followBtn.click();
            sendResponse({ success: true });
        } else {
            console.log("⚠️ Botón de seguir no encontrado");
            sendResponse({ success: false });
        }
        
        return true;
        
    } else if (request.action === "nextPhoto") {
        console.log("➡️ Presionando flecha derecha");
        
        window.postMessage({
            type: 'FROM_CONTENT_SCRIPT',
            action: 'nextPhoto'
        }, '*');
        
        // Esperar a que el injected script notifique que presionó siguiente foto
        console.log("⏳ Esperando a que injected script presione siguiente foto...");
        
        const handleNextPhotoPressed = (event) => {
            if (event.source !== window) return;
            
            if (event.data.type === 'FROM_INJECTED' && event.data.action === 'nextPhotoPressed') {
                window.removeEventListener('message', handleNextPhotoPressed);
                console.log("✅ Siguiente foto presionada, esperando a que cargue...");
                
                // Esperar a que la foto cargue (5 segundos)
                setTimeout(() => {
                    console.log("✅ Foto cargada, enviando comando de comentar");
                    
                    // Enviar comando de comentar en la siguiente foto
                    window.postMessage({
                        type: 'FROM_CONTENT_SCRIPT',
                        action: 'commentOnCurrentPhoto',
                        config: request.config
                    }, '*');
                    
                    // Esperar respuesta del injected script
                    const handleResponse = (event) => {
                        if (event.source !== window) return;
                        
                        if (event.data.type === 'FROM_INJECTED' && event.data.action === 'photoCommented') {
                            window.removeEventListener('message', handleResponse);
                            console.log("✅ Foto comentada, notificando al background");
                            
                            // Notificar al background que la foto fue comentada
                            chrome.runtime.sendMessage({
                                action: "photoCommented",
                                success: event.data.success
                            }).catch(err => {
                                console.log("⚠️ Error notificando al background:", err.message);
                            });
                        }
                    };
                    
                    window.addEventListener('message', handleResponse);
                    
                    // Timeout de 75 segundos (tiempo suficiente para más comentarios)
                    setTimeout(() => {
                        window.removeEventListener('message', handleResponse);
                        console.log("❌ Timeout esperando respuesta del injected script");
                        
                        chrome.runtime.sendMessage({
                            action: "photoCommented",
                            success: false
                        }).catch(err => {
                            console.log("⚠️ Error notificando timeout al background:", err.message);
                        });
                    }, 75000);
                }, 5000);
            }
        };
        
        window.addEventListener('message', handleNextPhotoPressed);
        
        // Timeout si no recibe notificación
        setTimeout(() => {
            window.removeEventListener('message', handleNextPhotoPressed);
            console.log("❌ Timeout esperando que injected script presione siguiente foto");
        }, 10000);
        
        sendResponse({ success: true });
    }
    
    return true;
});

console.log("✅ Content script completamente cargado");
