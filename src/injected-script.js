// Script inyectado directamente en la página
// Comunica con el content script usando postMessage

console.log("✅ Injected script cargado");

let config = null;
let automationRunning = false;

// Escuchar cuando la automatización inicia o se detiene
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'AUTOMATION_STATE') {
        automationRunning = event.data.running;
        console.log(`📄 Estado de automatización: ${automationRunning ? '🚀 Corriendo' : '⏸️ Parada'}`);
    }
});

// Interceptar intentos de navegación y hacer clic en "Leave" SOLO cuando la automatización está corriendo
window.addEventListener('beforeunload', (event) => {
    if (!automationRunning) return;
    
    // No mostrar el diálogo de confirmación
    event.preventDefault();
    event.returnValue = '';
    
    // Buscar y hacer clic en el botón Leave después de un pequeño delay
    setTimeout(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
            const text = btn.textContent || btn.innerText || '';
            if (text.toLowerCase().trim() === 'leave') {
                console.log("🚺 Modal 'Leave site?' detectado, haciendo clic en Leave...");
                btn.click();
                break;
            }
        }
    }, 100);
});

// Escuchar mensajes del content script
window.addEventListener('message', (event) => {
    // Solo aceptar mensajes de nuestra página
    if (event.source !== window) return;
    
    if (event.data.type && event.data.type === 'FROM_CONTENT_SCRIPT') {
        console.log("📨 Mensaje recibido:", event.data.action);
        
        if (event.data.action === 'commentOnCurrentPhoto') {
            config = event.data.config;
            console.log("💬 Comentando en foto actual");
            
            commentOnCurrentPhoto().then(success => {
                console.log(`📔 Enviando respuesta: ${success}`);
                // Notificar al content script
                window.postMessage({
                    type: 'FROM_INJECTED',
                    action: 'photoCommented',
                    success: success
                }, '*');
            }).catch(error => {
                console.error(`❌ Error en commentOnCurrentPhoto: ${error.message}`);
                // Enviar respuesta de error
                window.postMessage({
                    type: 'FROM_INJECTED',
                    action: 'photoCommented',
                    success: false
                }, '*');
            });
            
        } else if (event.data.action === 'nextPhoto') {
            console.log("➡️ Haciendo clic en botón de siguiente foto");
            clickNextPhotoButton();
            
            // Notificar que se presionó siguiente foto
            window.postMessage({
                type: 'FROM_INJECTED',
                action: 'nextPhotoPressed'
            }, '*');
        }
    }
});

async function commentOnCurrentPhoto() {
    try {
        console.log("🔎 Buscando foto en la galería...");
        
        let photoImg = null;
        
        // Estrategia 1: Buscar dentro de <A> tags que contengan photo.php
        console.log("📍 Estrategia 1: Buscando <A> con photo.php...");
        const photoLinks = document.querySelectorAll('a[href*="photo.php"]');
        console.log(`  - Encontrados ${photoLinks.length} links de fotos`);
        
        if (photoLinks.length > 0) {
            const firstLink = photoLinks[0];
            const img = firstLink.querySelector('img');
            if (img && img.offsetParent !== null) {
                console.log(`✓ Foto encontrada en primer link de photo.php (${img.offsetWidth}x${img.offsetHeight}px)`);
                photoImg = img;
            }
        }
        
        // Estrategia 2: Buscar imágenes dentro de <A> tags (galería)
        if (!photoImg) {
            console.log("📍 Estrategia 2: Buscando imágenes dentro de <A> tags...");
            const allLinks = document.querySelectorAll('a');
            
            for (let i = 0; i < allLinks.length; i++) {
                const link = allLinks[i];
                const img = link.querySelector('img');
                
                if (img && img.offsetParent !== null) {
                    const height = img.offsetHeight;
                    const width = img.offsetWidth;
                    
                    // Buscar imágenes cuadradas o casi cuadradas (miniaturas de galería)
                    if (height >= 100 && width >= 100 && Math.abs(height - width) < 50) {
                        console.log(`✓ Foto de galería encontrada (${width}x${height}px en <A>)`);
                        photoImg = img;
                        break;
                    }
                }
            }
        }
        
        // Estrategia 3: Buscar cualquier imagen grande visible
        if (!photoImg) {
            console.log("📍 Estrategia 3: Buscando cualquier imagen grande...");
            const allImages = document.querySelectorAll('img');
            console.log(`  - Total de imágenes en la página: ${allImages.length}`);
            
            for (let i = 0; i < allImages.length; i++) {
                const img = allImages[i];
                const height = img.offsetHeight;
                const width = img.offsetWidth;
                const visible = img.offsetParent !== null;
                
                // Saltar imágenes muy pequeñas (iconos, logos)
                if (height > 100 && width > 100 && visible) {
                    console.log(`✓ Foto encontrada (índice ${i}, ${width}x${height}px)`);
                    photoImg = img;
                    break;
                }
            }
        }
        
        if (!photoImg) {
            console.log("✗ Foto no encontrada en ninguna estrategia");
            return false;
        }
        
        // Hacer clic en la imagen
        console.log("🖱️ Haciendo clic en la foto...");
        photoImg.click();
        
        // Esperar a que se abra el modal
        console.log("⏳ Esperando modal de foto...");
        await sleep(1500);
        
        // Buscar el campo de comentario
        console.log("🔎 Buscando campo de comentario...");
        
        let commentInput = await findCommentField(10);
        
        if (!commentInput) {
            console.log("✗ Campo de comentario no encontrado");
            console.log("⚠️ Esta fan page no tiene foto cargada o estructura diferente, saltando...");
            return false;
        }
        
        console.log("✓ Campo de comentario encontrado");
        
        // Escribir el comentario
        const text = buildCommentText();
        console.log("✏️ Escribiendo comentario");
        console.log(`📝 Texto: ${text.substring(0, 50)}...`);
        
        commentInput.focus();
        await sleep(300);
        
        // Usar paste event para que Facebook lo detecte correctamente
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            bubbles: true,
            cancelable: true
        });
        
        // Agregar el texto al clipboard del evento
        pasteEvent.clipboardData.setData('text/plain', text);
        
        // Disparar el evento de paste
        commentInput.dispatchEvent(pasteEvent);
        
        // Disparar input para que Facebook lo detecte
        commentInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Esperar a que Facebook procese el texto y sugiera menciones
        console.log("⏳ Esperando sugerencias de menciones...");
        await sleep(2500);
        
        // Hacer clic en las sugerencias de menciones
        if (config.mentionedPages && config.mentionedPages.length > 0) {
            console.log("📌 Buscando y haciendo clic en sugerencias de menciones...");
            for (let i = 0; i < config.mentionedPages.length; i++) {
                const pageName = config.mentionedPages[i];
                console.log(`  - Buscando sugerencia para: ${pageName}`);
                
                // Presionar TAB para navegar a la sugerencia
                console.log(`  ↹ Presionando TAB para navegar a sugerencia...`);
                const tabEvent = new KeyboardEvent('keydown', {
                    key: 'Tab',
                    code: 'Tab',
                    bubbles: true,
                    cancelable: true
                });
                commentInput.dispatchEvent(tabEvent);
                await sleep(500);
                
                // Buscar la sugerencia en el dropdown
                const suggestion = await findMentionSuggestion(pageName, 5);
                
                if (suggestion) {
                    console.log(`  ✓ Sugerencia encontrada para ${pageName}, haciendo clic...`);
                    suggestion.click();
                    await sleep(800);
                } else {
                    console.log(`  ✗ Sugerencia no encontrada para ${pageName}`);
                }
            }
        }
        
        // Esperar a que aparezca el botón de envío
        console.log("⏳ Esperando botón de envío...");
        await sleep(1500);
        
        // Buscar y hacer clic en el botón de envío
        let sendBtn = await findSendButton(5);
        
        if (!sendBtn) {
            console.log("✗ Botón de envío no encontrado");
            return false;
        }
        
        console.log("📤 Enviando comentario");
        sendBtn.click();
        
        // Esperar a que se envíe
        await sleep(2000);
        
        console.log("✅ Comentario enviado");
        return true;
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        console.error(`📍 Stack: ${error.stack}`);
        return false;
    }
}

async function findMentionSuggestion(pageName, maxAttempts = 5) {
    // Buscar en los elementos visibles del dropdown de sugerencias
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Buscar el primer elemento con role="option" (la sugerencia)
        const suggestion = document.querySelector('[role="option"]');
        
        if (suggestion && suggestion.offsetParent !== null) {
            const text = suggestion.textContent || '';
            console.log(`    ✓ Sugerencia encontrada: "${text}"`);
            return suggestion;
        }
        
        await sleep(300);
    }
    
    return null;
}

function clickNextPhotoButton() {
    // Buscar el botón de siguiente foto (flecha derecha)
    // Puede estar con aria-label="Foto seguinte" o similar
    
    let nextBtn = document.querySelector('[aria-label*="seguinte"], [aria-label*="siguiente"], [aria-label*="next"]');
    
    if (!nextBtn) {
        // Buscar por role="button" que contenga una flecha
        const buttons = document.querySelectorAll('[role="button"]');
        for (const btn of buttons) {
            const ariaLabel = btn.getAttribute('aria-label');
            if (ariaLabel && (ariaLabel.toLowerCase().includes('siguiente') || ariaLabel.toLowerCase().includes('seguinte') || ariaLabel.toLowerCase().includes('next'))) {
                nextBtn = btn;
                break;
            }
        }
    }
    
    if (nextBtn) {
        console.log("✓ Botón de siguiente foto encontrado");
        nextBtn.click();
    } else {
        console.log("✗ Botón de siguiente foto no encontrado, usando flecha derecha");
        pressArrowRight();
    }
}

async function findCommentField(maxAttempts = 2) {
    // Intento 1: Selector directo contenteditable
    let field = document.querySelector('div[contenteditable="true"]');
    if (field) {
        console.log("✓ Campo encontrado: div[contenteditable='true']");
        return field;
    }
    
    // Intento 2: Buscar por role="textbox"
    const textboxes = document.querySelectorAll('[role="textbox"]');
    if (textboxes.length > 0) {
        field = textboxes[0];
        console.log(`✓ Campo encontrado: [role="textbox"] (${textboxes.length} encontrados)`);
        return field;
    }
    
    // Intento 3: Buscar por aria-label que contenga "Comentar"
    const allDivs = document.querySelectorAll('div[contenteditable]');
    for (const div of allDivs) {
        const ariaLabel = div.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.toLowerCase().includes('comentar')) {
            console.log(`✓ Campo encontrado por aria-label: "${ariaLabel}"`);
            return div;
        }
    }
    
    // Intento 4: Esperar a que aparezca el campo con esperas cortas
    console.log(`⏳ Campo no encontrado inmediatamente, esperando (${maxAttempts} intentos)...`);
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(300);
        
        field = document.querySelector('div[contenteditable="true"]');
        if (field) {
            console.log(`✓ Campo encontrado después de ${(i + 1) * 300}ms`);
            return field;
        }
        
        const tb = document.querySelectorAll('[role="textbox"]');
        if (tb.length > 0) {
            console.log(`✓ Campo encontrado (textbox) después de ${(i + 1) * 300}ms`);
            return tb[0];
        }
    }
    
    return null;
}

async function findSendButton(maxAttempts = 5) {
    // Lista de aria-labels en diferentes idiomas para el botón de enviar
    const sendButtonLabels = [
        // Inglés
        'Post comment',
        'Send',
        'Comment',
        // Portugués
        'Publicar comentário',
        'Publicar comentária',
        'Comentar',
        // Español
        'Publicar comentario',
        'Enviar',
        // Francés
        'Publier le commentaire',
        'Commenter',
        'Envoyer',
        // Italiano
        'Pubblica commento',
        'Commenta',
        // Alemán
        'Kommentar veröffentlichen',
        'Kommentieren',
        // Ruso
        'Опубликовать комментарий',
        'Комментировать',
        // Chino (Simplificado)
        '发布评论',
        '评论',
        // Japonés
        'コメントを投稿',
        'コメント',
        // Árabe
        'نشر التعليق',
        'علق',
        // Holandés
        'Opmerking plaatsen',
        'Reageren',
        // Polaco
        'Opublikuj komentarz',
        'Skomentuj',
        // Sueco
        'Publicera kommentar',
        'Kommentera',
        // Turco
        'Yorumu Yayınla',
        'Yorum Yap'
    ];
    
    // Intento 1: Buscar por aria-label exacto
    for (const label of sendButtonLabels) {
        let btn = document.querySelector(`[aria-label="${label}"]`);
        if (btn) {
            console.log(`✓ Botón encontrado: aria-label='${label}'`);
            return btn;
        }
    }
    
    // Intento 2: Buscar por role="button" y aria-label que contenga palabras clave
    const keywordPatterns = ['publicar', 'comentar', 'post', 'comment', 'send', 'enviar', 'publier', 'commenter', 'envoyer', 'pubblica', 'kommentar', 'опубликовать', '发布', '评论', 'コメント', 'نشر', 'علق', 'plaatsen', 'reageren', 'opublikuj', 'skomentuj', 'publicera', 'yorum'];
    
    const buttons = document.querySelectorAll('[role="button"]');
    for (const button of buttons) {
        const ariaLabel = button.getAttribute('aria-label');
        if (ariaLabel) {
            const lowerLabel = ariaLabel.toLowerCase();
            for (const keyword of keywordPatterns) {
                if (lowerLabel.includes(keyword.toLowerCase())) {
                    console.log(`✓ Botón encontrado: "${ariaLabel}"`);
                    return button;
                }
            }
        }
    }
    
    // Intento 3: Buscar por texto que contenga palabras clave
    const allButtons = document.querySelectorAll('button, [role="button"], div[role="button"]');
    for (const button of allButtons) {
        if (button.textContent) {
            const lowerText = button.textContent.toLowerCase();
            for (const keyword of keywordPatterns) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    console.log(`✓ Botón encontrado por texto: "${button.textContent}"`);
                    return button;
                }
            }
        }
    }
    
    // Intento 4: Esperar a que aparezca el botón
    console.log(`⏳ Botón no encontrado inmediatamente, esperando (${maxAttempts} intentos)...`);
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(300);
        
        // Reintentar búsqueda exacta
        for (const label of sendButtonLabels) {
            let btn = document.querySelector(`[aria-label="${label}"]`);
            if (btn) {
                console.log(`✓ Botón encontrado después de ${(i + 1) * 300}ms: '${label}'`);
                return btn;
            }
        }
        
        // Reintentar búsqueda por palabras clave
        const allBtns = document.querySelectorAll('[role="button"]');
        for (const b of allBtns) {
            const ariaLabel = b.getAttribute('aria-label');
            if (ariaLabel) {
                const lowerLabel = ariaLabel.toLowerCase();
                for (const keyword of keywordPatterns) {
                    if (lowerLabel.includes(keyword.toLowerCase())) {
                        console.log(`✓ Botón encontrado después de ${(i + 1) * 300}ms: "${ariaLabel}"`);
                        return b;
                    }
                }
            }
        }
    }
    
    return null;
}

function buildCommentText() {
    let text = config.commentText || "";
    
    if (config.mentionedPages && config.mentionedPages.length > 0) {
        const mentions = config.mentionedPages.map(p => `@${p}`).join(" ");
        text = `${text}\n${mentions}`;
    }
    
    return text;
}

function pressArrowRight() {
    const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(event);
}

function pressTab() {
    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(event);
}

function pressEscape() {
    const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(event);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log("✅ Injected script completamente cargado");
