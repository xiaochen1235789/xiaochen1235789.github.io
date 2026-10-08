// ==================== 页面初始化 ====================
async function initializePage() {
    try {
        document.getElementById('year').textContent = new Date().getFullYear();

        const savedTheme = localStorage.getItem('wiki_theme');
        if (savedTheme === 'night') {
            document.body.classList.add('night-mode');
        }

        await safeExecute(() => initializeUserProfile());
        await safeExecute(() => initializeSiteAge());

        initializeSearch();
        setupLogoEasterEgg();   // ★ 绑定 LOGO 彩蛋
        initializeNavigation();
        setupCrossTabSync();
        setupLoginMessageListener();
        bindUserMenuActions();

        const menuToggle = document.getElementById('menuToggleBtn');
        const menuOverlay = document.getElementById('menuOverlay');
        menuToggle.addEventListener('click', openMenu);
        menuOverlay.addEventListener('click', closeMenu);
        document.querySelectorAll('.menu-item[data-section]').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section) switchContent(section);
            });
        });
        const gachaItem = document.getElementById('menuGacha');
        if (gachaItem) {
            gachaItem.addEventListener('click', () => {
                closeMenu();
                window.open('chouka.html', '_blank');
            });
        }
        const changelogItem = document.getElementById('menuChangelog');
        if (changelogItem) {
            changelogItem.addEventListener('click', () => {
                closeMenu();
                openChangelogModal();
            });
        }
        const friendItem = document.getElementById('menuFriend');
        if (friendItem) {
            friendItem.addEventListener('click', () => {
                closeMenu();
                window.open('friend.html', '_blank');
            });
        }

        const ownerMsgItem = document.getElementById('menuOwnerMessage');
        if (ownerMsgItem) {
            ownerMsgItem.addEventListener('click', function(e) {
                e.stopPropagation();
                closeMenu();
                openOwnerMessage();
            });
        }

        const menuNightToggle = document.getElementById('menuNightToggle');
        if (menuNightToggle) {
            const menuIcon = document.getElementById('menuNightIcon');
            const menuLabel = document.getElementById('menuNightLabel');

            if (document.body.classList.contains('night-mode')) {
                menuIcon.className = 'fas fa-sun';
                menuLabel.textContent = '白天模式';
            } else {
                menuIcon.className = 'fas fa-moon';
                menuLabel.textContent = '黑夜模式';
            }

            menuNightToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                document.body.classList.toggle('night-mode');
                const isNight = document.body.classList.contains('night-mode');

                if (isNight) {
                    menuIcon.className = 'fas fa-sun';
                    menuLabel.textContent = '白天模式';
                } else {
                    menuIcon.className = 'fas fa-moon';
                    menuLabel.textContent = '黑夜模式';
                }

                localStorage.setItem('wiki_theme', isNight ? 'night' : 'day');
            });
        }

        const defaultMenuItem = document.querySelector('.menu-item[data-section="character"]');
        if (defaultMenuItem) defaultMenuItem.classList.add('active');

        const banner = document.getElementById('disclaimerBanner');
        const closeBtn = document.getElementById('closeDisclaimer');
        if (banner && closeBtn) {
            if (localStorage.getItem('disclaimerClosed') === 'true') {
                banner.style.display = 'none';
            }
            closeBtn.addEventListener('click', function() {
                banner.style.display = 'none';
                localStorage.setItem('disclaimerClosed', 'true');
            });
        }

        const ownerModal = document.getElementById('ownerMessageModal');
        if (ownerModal) {
            ownerModal.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeOwnerMessage();
                }
            });
        }

        const navEmailBtn = document.getElementById('navEmailBtn');
        if (navEmailBtn) {
            navEmailBtn.addEventListener('click', openEmailModal);
        }
        const emailModalClose = document.getElementById('emailModalClose');
        const emailModalOverlay = document.getElementById('emailModalOverlay');
        if (emailModalClose) {
            emailModalClose.addEventListener('click', closeEmailModal);
        }
        if (emailModalOverlay) {
            emailModalOverlay.addEventListener('click', closeEmailModal);
        }

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'closeEmailModal') {
                closeEmailModal();
            }
            if (event.data && event.data.type === 'refreshEmailBadge') {
                updateEmailBadge();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const emailModal = document.getElementById('email-modal');
                if (emailModal && emailModal.classList.contains('active')) {
                    closeEmailModal();
                }
            }
        });

        // 1. 立即加载角色区
        await loadTableData('characters', 'character-container', '角色');

        // 2. 懒加载另外三个区域
        setupLazyLoading('lightconeSection', 'lightcone-container', 'light_cones', '光锥', 'lightcone-card', false);
        setupLazyLoading('materialSection', 'material-container', 'materials', '材料', null, true);
        setupLazyLoading('itemSection', 'item-container', 'items', '道具', null, true);
    } catch (e) {
        console.error('页面初始化失败:', e);
        showNotification('页面初始化出现异常', 'error');
    } finally {
        const loadingEl = document.getElementById('global-loading');
        if (loadingEl) {
            loadingEl.style.opacity = '0';
            setTimeout(() => { loadingEl.style.display = 'none'; }, 300);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

// ==================== 暴露函数给全局（供 HTML 内联 onclick 使用） ====================
window.scrollToTop = scrollToTop;
window.jumpToDetail = jumpToDetail;
window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
window.imageLoaded = imageLoaded;
window.imageError = imageError;
window.openEmailModal = openEmailModal;
window.closeEmailModal = closeEmailModal;
window.reloadEmailIframe = reloadEmailIframe;
window.updateEmailBadge = updateEmailBadge;