// =============================================================
// modal.js —— 主页弹窗统一控制器
//
// 不改变任何现有 openXxx / closeXxx 的用法，
// 只在外面补三件它们一直缺的事：
//   1. Esc 关闭（全部弹窗，不只邮箱）
//   2. 焦点管理（打开时聚焦、Tab 不跑出去、关闭后焦点归位）
//   3. aria-hidden 与滚动锁同步
//
// 另外顺带修正：遮罩点击关闭、以及 closeAllModals 的兜底实现。
// =============================================================

(function () {
    'use strict';

    // 每个弹窗对应的关闭方式（优先调用项目里已有的函数）
    const MODALS = [
        { id: 'signinModal',      closer: 'closeSigninModal'   },
        { id: 'logoutModal',      closer: 'closeLogoutModal'   },
        { id: 'ownerMessageModal', closer: 'closeOwnerMessage'  },
        { id: 'easterEggModal',   closer: 'closeEasterEggModal' },
        { id: 'email-modal',      closer: 'closeEmailModal'    },
        { id: 'changelog-modal',  closer: 'closeChangelogModal' }
    ];

    const FOCUSABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])', 'iframe'
    ].join(',');

    let lastFocused = null;
    let currentOpen = null;

    // ---------- 判定"现在是不是开着" ----------
    function isOpen(root) {
        if (!root) return false;
        if (root.classList.contains('active')) return true;
        if (root.classList.contains('show')) return true;
        // 更新日志用的是内联 display
        if (root.style.display === 'flex' || root.style.display === 'block') return true;
        return false;
    }

    function getRoot(id) {
        return document.getElementById(id);
    }

    // ---------- 通用关闭（没有 closer 时的兜底） ----------
    function genericClose(root) {
        if (!root) return;
        root.classList.remove('active', 'show');
        if (root.id === 'changelog-modal' || root.id === 'email-modal') {
            root.classList.add('closing');
            setTimeout(() => {
                root.style.display = 'none';
                root.classList.remove('closing');
            }, 300);
        } else {
            root.style.display = '';
        }
    }

    function closeById(id) {
        const root = getRoot(id);
        if (!root) return;

        const cfg = MODALS.find(m => m.id === id);
        const fn = cfg && cfg.closer && window[cfg.closer];

        if (typeof fn === 'function') {
            try { fn(); } catch (e) { genericClose(root); }
        } else {
            genericClose(root);
        }
    }

    // ---------- 关闭全部 ----------
    function closeAllModals() {
        MODALS.forEach(m => {
            const root = getRoot(m.id);
            if (root && isOpen(root)) closeById(m.id);
        });
    }

    // 只在项目里没有同名实现时补上（避免覆盖你自己的版本）
    if (typeof window.closeAllModals !== 'function') {
        window.closeAllModals = closeAllModals;
    }

    // ---------- 打开时：聚焦 + 上锁 ----------
    function onOpened(root) {
        if (currentOpen === root) return;
        currentOpen = root;

        lastFocused = document.activeElement;

        const panel = root.querySelector('.modal-container, .modal-content') || root;
        const first = panel.querySelector(FOCUSABLE);

        // 用 setTimeout 等动画帧，避免 focus 被 transition 打断
        setTimeout(() => {
            if (first && typeof first.focus === 'function') {
                first.focus({ preventScroll: true });
            } else if (panel.setAttribute) {
                panel.setAttribute('tabindex', '-1');
                panel.focus({ preventScroll: true });
            }
        }, 60);

        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
    }

    // ---------- 关闭后：解锁 + 焦点归位 ----------
    function onClosed() {
        currentOpen = null;
        const stillOpen = MODALS.some(m => isOpen(getRoot(m.id)));
        if (!stillOpen) {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
        }
        if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
        lastFocused = null;
    }

    // ---------- 同步一个弹窗的状态 ----------
    function sync(root) {
        if (!root) return;
        const open = isOpen(root);
        root.setAttribute('aria-hidden', open ? 'false' : 'true');
        root.dataset.open = open ? '1' : '0';

        if (open) onOpened(root);
        else if (currentOpen === root) onClosed();
        else if (!MODALS.some(m => isOpen(getRoot(m.id)))) onClosed();
    }

    // ---------- Tab 焦点循环 ----------
    function trapFocus(e) {
        if (e.key !== 'Tab' || !currentOpen) return;

        const panel = currentOpen.querySelector('.modal-container, .modal-content') || currentOpen;
        const nodes = Array.from(panel.querySelectorAll(FOCUSABLE))
            .filter(el => el.offsetParent !== null || el.tagName === 'IFRAME');

        if (nodes.length === 0) return;

        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // ---------- 初始化 ----------
    function init() {
        MODALS.forEach(m => {
            const root = getRoot(m.id);
            if (!root) return;

            if (!root.hasAttribute('role')) root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.setAttribute('aria-hidden', isOpen(root) ? 'false' : 'true');

            // 点遮罩关闭（只认"点在根容器上"）
            root.addEventListener('mousedown', (e) => {
                if (e.target === root) closeById(m.id);
            });
            root.addEventListener('click', (e) => {
                if (e.target === root) closeById(m.id);
            });

            // [data-close] 通用关闭按钮
            root.querySelectorAll('[data-close]').forEach(btn => {
                btn.addEventListener('click', () => closeById(m.id));
            });

            // 监听 class / style 变化，同步状态
            const obs = new MutationObserver(() => sync(root));
            obs.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });

            sync(root);
        });

        // 全局按键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openOne = MODALS.map(m => getRoot(m.id)).find(r => r && isOpen(r));
                if (openOne) {
                    e.preventDefault();
                    closeById(openOne.id);
                }
                return;
            }
            trapFocus(e);
        });
    }

    // ---------- 对外暴露 ----------
    window.DSModal = {
        open(id) {
            const root = getRoot(id);
            if (!root) return;
            root.classList.add('active');
            if (root.id === 'changelog-modal' || root.id === 'email-modal') {
                root.style.display = 'flex';
            }
            sync(root);
        },
        close(id) { closeById(id); },
        closeAll: closeAllModals,
        isOpen(id) { return isOpen(getRoot(id)); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();