// ========== 侧栏菜单控制与面板切换 ==========

// ----- 侧栏开关 -----
export function setupSidebar() {
    const hamburger = document.getElementById('hamburgerBtn');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const menu = document.getElementById('sidebarMenu');

    function openSidebar() {
        menu.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        menu.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (hamburger) hamburger.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // 菜单项点击：切换面板 + 关闭侧栏
    document.querySelectorAll('.sidebar-menu ul li').forEach(li => {
        li.addEventListener('click', function () {
            const tab = this.dataset.tab;
            if (tab) {
                document.querySelectorAll('.sidebar-menu ul li').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                switchTab(tab);
                closeSidebar();
            }
        });
    });
}

// ----- 面板切换（由 main.js 注册具体业务回调） -----
export function switchTab(tabId) {
    // 1. 切换面板显示
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-panel'));
    const panel = document.getElementById(tabId + '-panel');
    if (panel) panel.classList.add('active-panel');

    // 2. 触发注册的回调（由 main.js 注入）
    if (window._switchTabCallbacks && typeof window._switchTabCallbacks[tabId] === 'function') {
        window._switchTabCallbacks[tabId]();
    }
}