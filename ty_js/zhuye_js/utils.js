// ==================== 辅助函数 ====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
    });
}

// ★ 稀有度标准化：兼容 integer / "5" / "五星" / "SSR" / "gold" 等格式
function normalizeRarity(raw) {
    if (raw === null || raw === undefined) return 0;
    const s = String(raw).trim();
    if (!s) return 0;
    if (/^[1-5]$/.test(s)) return parseInt(s, 10);
    if (/[五六5]/.test(s) && /星|★/.test(s)) return 5;
    if (/[四4]/.test(s) && /星|★/.test(s)) return 4;
    if (/[三3]/.test(s) && /星|★/.test(s)) return 3;
    if (/[二2]/.test(s) && /星|★/.test(s)) return 2;
    if (/[一1]/.test(s) && /星|★/.test(s)) return 1;
    const u = s.toLowerCase();
    if (u === 'ssr' || u === 'r5' || u === 'gold' || u === 'orange') return 5;
    if (u === 'sr'  || u === 'r4' || u === 'purple') return 4;
    if (u === 'r'   || u === 'r3' || u === 'blue')   return 3;
    if (u === 'r2'  || u === 'green')                return 2;
    if (u === 'r1'  || u === 'gray' || u === 'grey') return 1;
    return 0;
}

function showNotification(message, type = 'info', extraClass = '') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    if (globalNotificationTimer) { clearTimeout(globalNotificationTimer); globalNotificationTimer = null; }
    if (autoSignNotificationTimer) { clearTimeout(autoSignNotificationTimer); autoSignNotificationTimer = null; }
    let content = message;
    if (type === 'auto-sign') content = `<span class="auto-sign-icon">🃏</span> ${message}`;
    notification.innerHTML = content;
    notification.className = `notification ${type} ${extraClass}`;
    if (type === 'auto-sign') {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'auto-sign-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', '关闭通知');
        closeBtn.onclick = function(e) {
            e.stopPropagation();
            notification.classList.remove('show');
            if (autoSignNotificationTimer) { clearTimeout(autoSignNotificationTimer); autoSignNotificationTimer = null; }
        };
        notification.appendChild(closeBtn);
        autoSignNotificationTimer = setTimeout(() => {
            notification.classList.remove('show');
            autoSignNotificationTimer = null;
        }, 6000);
    } else {
        globalNotificationTimer = setTimeout(() => {
            notification.classList.remove('show');
            globalNotificationTimer = null;
        }, 3000);
    }
    setTimeout(() => notification.classList.add('show'), 10);
}

function imageLoaded(img) {
    img.classList.add('loaded');
    const parent = img.closest('.skeleton');
    if (parent) parent.classList.remove('skeleton');
}

function imageError(img) {
    const parent = img.closest('.card-img');
    if (parent) {
        const placeholder = document.createElement('div');
        placeholder.className = 'img-placeholder';
        placeholder.textContent = '🖼️';
        placeholder.style.cssText = 'display:flex; align-items:center; justify-content:center; width:100%; height:100%; background:rgba(124,155,255,.08); color:var(--text-secondary); font-size:2rem;';
        img.style.display = 'none';
        parent.appendChild(placeholder);
    }
    const skeleton = img.closest('.skeleton');
    if (skeleton) skeleton.classList.remove('skeleton');
}

function jumpToDetail(targetUrl, charName) {
    if (isJumping) return;
    if (!targetUrl || targetUrl === '#' || targetUrl === '') {
        showNotification(`「${charName}」的详情页暂未开放`, 'error');
        return;
    }
    isJumping = true;
    window.open(targetUrl, '_blank');
    setTimeout(() => { isJumping = false; }, 500);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ==================== 日期工具 ====================
function getLocalDateString(date = new Date()) {
    return date.toLocaleDateString('sv-SE');
}

// ==================== 带容错的网络请求执行器 ====================
async function safeExecute(fn, maxRetries = 2) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await fn();
        } catch (e) {
            attempts++;
            if (attempts >= maxRetries) throw e;
            console.warn(`网络请求失败，${attempts} 秒后重试...`);
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}