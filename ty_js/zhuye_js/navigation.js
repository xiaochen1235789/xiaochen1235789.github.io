// ==================== 导航 ====================
let isMenuOpen = false;

function initializeNavigation() {
    const backToTopBtn = document.querySelector('.back-to-top');
    window.addEventListener('scroll', function() {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
    });
}

// ==================== 侧滑菜单控制 ====================
function openMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    sideMenu.classList.add('open');
    overlay.classList.add('active');
    isMenuOpen = true;
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    sideMenu.classList.remove('open');
    overlay.classList.remove('active');
    isMenuOpen = false;
    document.body.style.overflow = '';
}

function switchContent(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + 'Section').classList.add('active');
    document.querySelectorAll('.menu-item[data-section]').forEach(item => {
        if (item.dataset.section === sectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    closeMenu();
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    }
    const emptyResult = document.querySelector('.empty-result');
    if (emptyResult) emptyResult.style.display = 'none';

    if (sectionId === 'lightcone' && !isLoadingLazy['lightconeSection']) {
        isLoadingLazy['lightconeSection'] = true;
        loadTableData('light_cones', 'lightcone-container', '光锥', 'lightcone-card', false);
    } else if (sectionId === 'material' && !isLoadingLazy['materialSection']) {
        isLoadingLazy['materialSection'] = true;
        loadTableData('materials', 'material-container', '材料', null, true);
    } else if (sectionId === 'item' && !isLoadingLazy['itemSection']) {
        isLoadingLazy['itemSection'] = true;
        loadTableData('items', 'item-container', '道具', null, true);
    }
}