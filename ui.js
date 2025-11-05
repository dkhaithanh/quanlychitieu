// --- FILE QUẢN LÝ GIAO DIỆN NGƯỜI DÙNG (UI) ---

// SỬA LỖI (Vòng lặp): Không import từ wallet.js
// import { getCurrentWallet } from './wallet.js';
import { getCurrentUser, getCurrentUserProfile } from './main.js';

// --- BIẾN TOÀN CỤC CHO BIỂU ĐỒ ---
let incomeExpenseChart = null;
let categoryPieChart = null;

// SỬA LỖI (Vòng lặp): Lấy wallet từ window.app
function getLocalCurrentWallet() {
    if (window.app && window.app.getCurrentWallet) {
        return window.app.getCurrentWallet();
    }
    return null;
}

// Định dạng tiền tệ
const formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
});

// --- CÁC HÀM TIỆN ÍCH UI CƠ BẢN ---

/**
 * Hiển thị một "view" (div con) trong một "container" (div cha)
 * @param {string} viewId
 * @param {string} [containerId='main-app-content']
 */
export function showView(viewId, containerId = 'main-app-content') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Không tìm thấy container: #${containerId}`);
        return;
    }

    container.querySelectorAll('.main-view').forEach(view => {
        view.classList.add('hidden');
    });

    const viewToShow = document.getElementById(viewId);
    if (viewToShow) {
        viewToShow.classList.remove('hidden');
    } else {
        console.error(`Không tìm thấy view: #${viewId}`);
    }

    if (containerId === 'main-app-content') {
        updateNavActiveState(viewId);
    }
}

/**
 * Cập nhật trạng thái active cho thanh điều hướng
 * @param {string} viewId
 */
function updateNavActiveState(viewId) {
    const navButtons = {
        'dashboard-view': 'nav-dashboard',
        'add-view': 'nav-add',
        'reports-view': 'nav-reports',
        'ai-view': 'nav-ai', 
        'settings-view': 'nav-settings'
    };
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'font-semibold');
        btn.classList.add('text-gray-500');
    });

    const activeBtnId = navButtons[viewId];
    if (activeBtnId) {
        const activeBtn = document.getElementById(activeBtnId);
        if(activeBtn) {
            activeBtn.classList.add('text-blue-600', 'font-semibold');
            activeBtn.classList.remove('text-gray-500');
        }
    }
}

/**
 * Hiển thị hoặc ẩn loading overlay TOÀN MÀN HÌNH
 * @param {boolean} isLoading
 */
export function showGlobalLoading(isLoading) {
    const loadingOverlay = document.getElementById('global-loading-overlay');
    if (!loadingOverlay) return;
    
    if (isLoading) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Hiển thị thông báo (toast)
 * @param {string} message
 * @param {string} [type='info']
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    if (!toast || !toastMessage) return;

    toast.classList.remove('bg-green-500', 'bg-red-500', 'bg-blue-500');

    if (type === 'success') {
        toast.classList.add('bg-green-500');
    } else if (type === 'error') {
        toast.classList.add('bg-red-500');
    } else {
        toast.classList.add('bg-blue-500');
    }

    toastMessage.textContent = message;
    toast.classList.remove('hidden', 'opacity-0', '-translate-y-5');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-5');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

/**
 * Hiển thị modal xác nhận
 * @param {string} title
 * @param {string} message
 * @param {function} onConfirm
 */
export function showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    if (!modal) return;
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;

    const confirmBtn = document.getElementById('modal-confirm-btn');
    // SỬA LỖI 1: Nút Hủy
    const cancelBtn = document.getElementById('modal-cancel-btn'); 

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.textContent = "Xác nhận";

    newConfirmBtn.onclick = () => {
        onConfirm();
        modal.classList.add('hidden');
    };

    // SỬA LỖI 1: Gắn listener cho nút Hủy (nếu có)
    if(cancelBtn) {
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }

    modal.classList.remove('hidden');
}

/**
 * Đóng tất cả các modal
 */
export function closeAllModals() {
    document.querySelectorAll('.modal-container').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// --- CÁC HÀM RENDER UI CHÍNH ---

/**
 * Cập nhật view Tổng quan (Dashboard)
 * @param {Array} transactions
 */
export function renderDashboard(transactions) {
    const recentTransactionsList = document.getElementById('recent-transactions-list');
    const totalBalanceEl = document.getElementById('total-balance');
    const monthIncomeEl = document.getElementById('month-income');
    const monthExpenseEl = document.getElementById('month-expense');

    if (!recentTransactionsList || !totalBalanceEl || !monthIncomeEl || !monthExpenseEl) {
        console.error("Thiếu các phần tử UI của Dashboard.");
        return;
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    recentTransactionsList.innerHTML = ''; 

    if (transactions.length === 0) {
        recentTransactionsList.innerHTML = `<li class="text-gray-500 text-center py-4 px-4">Chưa có giao dịch nào.</li>`;
    }

    transactions.forEach((trans, index) => {
        const transDate = trans.timestamp?.toDate ? trans.timestamp.toDate() : new Date();

        if (trans.type === 'income') {
            totalIncome += trans.amount;
            if (transDate >= firstDayOfMonth) {
                monthIncome += trans.amount;
            }
        } else {
            totalExpense += trans.amount;
            if (transDate >= firstDayOfMonth) {
                monthExpense += trans.amount;
            }
        }

        // Chỉ hiển thị 10 giao dịch gần nhất
        if (index < 10) {
            const li = document.createElement('li');
            // SỬA LỖI 2: Thêm padding
            li.className = 'flex items-center justify-between py-4 px-4';
            
            // SỬA LỖI 2: Icon cho danh mục
            const iconMap = {
                'Ăn uống': 'utensils',
                'Di chuyển': 'car',
                'Mua sắm': 'shopping-bag',
                'Hóa đơn': 'receipt',
                'Giải trí': 'gamepad-2',
                'Sức khỏe': 'heart-pulse',
                'Giáo dục': 'book',
                'Nhà cửa': 'home',
                'Lương': 'landmark',
                'Thưởng': 'award',
                'Thu nhập phụ': 'dollar-sign',
                'Quà tặng': 'gift',
                'Khác': 'shapes'
            };
            const iconName = iconMap[trans.category] || 'shapes';
            
            li.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="p-2 rounded-full ${trans.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                        <i data-lucide="${iconName}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="font-medium text-gray-800">${trans.category}</p>
                        <p class="text-sm text-gray-500">${trans.description || '...'} | ${transDate.toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                     <p class="font-semibold ${trans.type === 'income' ? 'text-green-600' : 'text-red-600'}">
                        ${trans.type === 'income' ? '+' : '-'}${formatter.format(trans.amount)}
                    </p>
                    <!-- SỬA LỖI 2: Thiết kế lại nút -->
                    <div class="text-xs space-x-2 mt-1">
                        <button class="list-action-btn list-action-btn-edit edit-btn" data-id="${trans.id}">Sửa</button>
                        <button class="list-action-btn list-action-btn-delete delete-btn" data-id="${trans.id}">Xóa</button>
                    </div>
                </div>
            `;
            recentTransactionsList.appendChild(li);
        }
    });

    const totalBalance = totalIncome - totalExpense;
    totalBalanceEl.textContent = formatter.format(totalBalance);
    // SỬA LỖI 2: Bỏ class text-gray-800
    totalBalanceEl.classList.toggle('text-red-600', totalBalance < 0); 
    
    monthIncomeEl.textContent = formatter.format(monthIncome);
    monthExpenseEl.textContent = formatter.format(monthExpense);

    recentTransactionsList.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = (e) => {
            const docId = e.currentTarget.dataset.id;
            if(window.app && window.app.deleteTransaction) {
                window.app.deleteTransaction(docId);
            }
        };
    });
    
    recentTransactionsList.querySelectorAll('.edit-btn').forEach(button => {
        button.onclick = (e) => {
            const docId = e.currentTarget.dataset.id;
            const trans = transactions.find(t => t.id === docId);
            if(trans) {
                showEditTransactionModal(trans);
            }
        };
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Cập nhật view Báo cáo (Reports)
 * @param {Array} transactions
 */
export function renderReports(transactions) {
    const filterEl = document.getElementById('reports-filter');
    if (!filterEl) return; 

    const filter = filterEl.value;
    let startDate, endDate;
    const now = new Date();
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (filter === 'this-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (filter === 'this-year') {
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const filteredTransactions = transactions.filter(t => {
        const transDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date();
        return transDate >= startDate && transDate <= endDate;
    });

    renderIncomeExpenseChart(filteredTransactions, filter);
    renderCategoryPieChart(filteredTransactions);
    renderReportTransactionList(filteredTransactions);
}

/**
 * Vẽ biểu đồ Thu vs Chi
 */
function renderIncomeExpenseChart(data, filter) {
    const ctx = document.getElementById('incomeExpenseChart')?.getContext('2d');
    if (!ctx) return;
    
    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let groupedData = {};

    data.forEach(t => {
        const date = t.timestamp?.toDate ? t.timestamp.toDate() : null;
        if (!date) return; 

        let key;
        if (filter === 'this-year') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            key = date.toISOString().split('T')[0];
        }

        if (!groupedData[key]) {
            groupedData[key] = { income: 0, expense: 0 };
        }

        if (t.type === 'income') {
            groupedData[key].income += t.amount;
        } else {
            groupedData[key].expense += t.amount;
        }
    });

    const sortedKeys = Object.keys(groupedData).sort();

    sortedKeys.forEach(key => {
        if (filter === 'this-year') {
            const parts = key.split('-');
            labels.push(`T${parts[1]}`);
        } else {
            const parts = key.split('-');
            labels.push(`${parts[2]}/${parts[1]}`);
        }
        incomeData.push(groupedData[key].income);
        expenseData.push(groupedData[key].expense);
    });

    if (incomeExpenseChart) {
        incomeExpenseChart.destroy();
    }
    incomeExpenseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Thu nhập',
                    data: incomeData,
                    backgroundColor: 'rgba(74, 222, 128, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Chi tiêu',
                    data: expenseData,
                    backgroundColor: 'rgba(248, 113, 113, 0.7)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            if (value >= 1000000) {
                                return `${value / 1000000} tr`;
                            }
                            if (value >= 1000) {
                                return `${value / 1000}k`;
                            }
                            return value;
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => formatter.format(context.raw)
                    }
                }
            }
        }
    });
}

/**
 * Vẽ biểu đồ tròn Cơ cấu chi tiêu
 */
function renderCategoryPieChart(data) {
    const ctx = document.getElementById('categoryPieChart')?.getContext('2d');
    if (!ctx) return;
    
    const expenses = data.filter(t => t.type === 'expense');
    let categoryData = {};

    expenses.forEach(t => {
        const category = t.category || 'Khác';
        if (!categoryData[category]) {
            categoryData[category] = 0;
        }
        categoryData[category] += t.amount;
    });

    const labels = Object.keys(categoryData);
    const values = Object.values(categoryData);

    const bgColors = [
        'rgba(59, 130, 246, 0.7)',
        'rgba(239, 68, 68, 0.7)',
        'rgba(245, 158, 11, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(168, 85, 247, 0.7)',
        'rgba(236, 72, 153, 0.7)',
        'rgba(20, 184, 166, 0.7)',
        'rgba(107, 114, 128, 0.7)'
    ];

    if (categoryPieChart) {
        categoryPieChart.destroy();
    }
    categoryPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Chi tiêu theo danh mục',
                data: values,
                backgroundColor: bgColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${formatter.format(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Hiển thị danh sách giao dịch trong báo cáo
 */
function renderReportTransactionList(data) {
    const listEl = document.getElementById('report-transaction-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    if (data.length === 0) {
        listEl.innerHTML = `<li class="text-gray-500 text-center py-4">Không có dữ liệu cho khoảng thời gian này.</li>`;
        return;
    }

    data.forEach(trans => {
        const transDate = trans.timestamp?.toDate ? trans.timestamp.toDate() : new Date();
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between py-3 border-b border-gray-100';
        li.innerHTML = `
            <div>
                <p class="font-medium text-gray-800">${trans.category}</p>
                <p class="text-sm text-gray-500">${trans.description || '...'} | ${transDate.toLocaleDateString('vi-VN')}</p>
            </div>
            <p class="font-semibold ${trans.type === 'income' ? 'text-green-600' : 'text-red-600'}">
                ${trans.type === 'income' ? '+' : '-'}${formatter.format(trans.amount)}
            </p>
        `;
        listEl.appendChild(li);
    });
}

/**
 * Hiển thị modal Sửa Giao dịch
 * @param {object} trans
 */
export function showEditTransactionModal(trans) {
    const modal = document.getElementById('edit-transaction-modal');
    if (!modal) return;
    
    document.getElementById('edit-trans-id').value = trans.id;
    document.getElementById('edit-trans-type').value = trans.type;
    
    populateCategoryDropdown(trans.type, 'edit-trans-category');
    document.getElementById('edit-trans-category').value = trans.category;
    
    document.getElementById('edit-trans-amount').value = trans.amount;
    document.getElementById('edit-trans-description').value = trans.description;
    
    modal.classList.remove('hidden');
}

/**
 * Cập nhật danh sách danh mục (cho form Thêm/Sửa)
 * @param {string} type
 * @param {string} selectId
 */
export function populateCategoryDropdown(type, selectId) {
    const categorySelect = document.getElementById(selectId);
    if (!categorySelect) return;
    
    const incomeOptions = `
        <option value="Lương">Lương</option>
        <option value="Thưởng">Thưởng</option>
        <option value="Thu nhập phụ">Thu nhập phụ</option>
        <option value="Quà tặng">Quà tặng</option>
        <option value="Khác">Khác</option>
    `;
    const expenseOptions = `
        <option value="Ăn uống">Ăn uống</option>
        <option value="Di chuyển">Di chuyển</option>
        <option value="Mua sắm">Mua sắm</option>
        <option value="Hóa đơn">Hóa đơn</option>
        <option value="Giải trí">Giải trí</option>
        <option value="Sức khỏe">Sức khỏe</option>
        <option value="Giáo dục">Giáo dục</option>
        <option value="Nhà cửa">Nhà cửa</option>
        <option value="Khác">Khác</option>
    `;

    if (type === 'income') {
        categorySelect.innerHTML = incomeOptions;
    } else {
        categorySelect.innerHTML = expenseOptions;
    }
}

/**
 * Hiển thị modal Chuyển đổi Ví
 */
export function showWalletSwitcherModal() {
    const modal = document.getElementById('wallet-switcher-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // SỬA LỖI 1: Tự động tải lại
        const refreshBtn = document.getElementById('refresh-wallet-list-btn');
        if(refreshBtn) {
            refreshBtn.click();
        }
    }
}

/**
 * Cập nhật nội dung modal Chuyển đổi Ví
 * @param {Array} wallets
 * @param {function} onSwitch
 */
export function updateWalletListModal(wallets, onSwitch) {
    const listEl = document.getElementById('wallet-list-modal');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    const currentWallet = getLocalCurrentWallet();
    
    wallets.forEach(wallet => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg';
        
        let content = `
            <div>
                <p class="font-medium">${wallet.name}</p>
                <span class="text-xs ${wallet.type === 'group' ? 'text-blue-600' : 'text-gray-500'}">
                    ${wallet.type === 'group' ? 'Ví nhóm' : 'Ví cá nhân'}
                </span>
            </div>
        `;
        
        if (currentWallet && currentWallet.id === wallet.id) {
            content += `<span class="text-sm font-medium text-green-600">Đang chọn</span>`;
        } else {
            content += `<button class="switch-wallet-btn text-sm text-blue-600 font-medium" data-id="${wallet.id}">Chuyển</button>`;
        }
        
        li.innerHTML = content;
        listEl.appendChild(li);
    });
    
    listEl.querySelectorAll('.switch-wallet-btn').forEach(btn => {
        btn.onclick = (e) => {
            const walletId = e.currentTarget.dataset.id;
            onSwitch(walletId);
            closeAllModals();
        };
    });
}

/**
 * Cập nhật view Cài đặt (Settings)
 * @param {object} wallet
 */
export function renderWalletManagement(wallet) {
    const container = document.getElementById('wallet-management-section');
    const inviteContainer = document.getElementById('invite-form');
    const memberList = document.getElementById('member-list');
    const memberListSection = document.getElementById('member-list-section');
    const logSection = document.getElementById('log-view-section');
    
    if (!container || !inviteContainer || !memberList || !memberListSection || !logSection) return;
    
    logSection.classList.remove('hidden');

    if (wallet.type === 'group') {
        inviteContainer.classList.remove('hidden');
        memberListSection.classList.remove('hidden');
        
        memberList.innerHTML = '';
        const members = wallet.members || {};
        const user = getCurrentUser();
        
        // SỬA KẾ HOẠCH 2: Kiểm tra xem user hiện tại có phải owner
        const amIOwner = members[user.uid]?.role === 'owner';
        
        Object.keys(members).forEach(uid => {
            const member = members[uid];
            const li = document.createElement('li');
            // SỬA LỖI 1: Thêm padding
            li.className = 'flex justify-between items-center p-3';
            
            let html = `
                <div>
                    <p class="font-medium">${member.name || '...'} ${uid === user.uid ? '<span class="text-xs text-blue-600">(Bạn)</span>' : ''}</p>
                    <p class="text-sm text-gray-500">${member.email}</p>
                    <p class="text-xs text-gray-400 italic">${member.role}</p>
                </div>
            `;
            
            // SỬA KẾ HOẠCH 2: Thêm nút Quản lý
            html += '<div class="flex space-x-2">';
            if (uid === user.uid && member.role !== 'owner') {
                // Tự rời ví (nếu không phải owner)
                html += `<button data-action="leave-wallet" data-uid="${uid}" class="text-sm font-medium text-red-600 hover:text-red-800">Rời khỏi ví</button>`;
            } else if (amIOwner && uid !== user.uid) {
                // Owner quản lý người khác
                html += `<button data-action="make-owner" data-uid="${uid}" data-name="${member.name || ''}" class="text-sm font-medium text-blue-600 hover:text-blue-800">Chuyển quyền</button>`;
                html += `<button data-action="remove-member" data-uid="${uid}" data-name="${member.name || ''}" class="text-sm font-medium text-red-600 hover:text-red-800">Xóa</button>`;
            }
            html += '</div>';
            
            li.innerHTML = html;
            memberList.appendChild(li);
        });
        
    } else {
        inviteContainer.classList.add('hidden');
        memberListSection.classList.add('hidden');
        memberList.innerHTML = '';
    }
}

/**
 * Hiển thị Modal Log
 */
export function showActivityLogModal() {
    const modal = document.getElementById('activity-log-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Render danh sách Log
 * @param {Array} logs
 */
export function renderActivityLog(logs) {
    const listEl = document.getElementById('log-list-ul');
    if (!listEl) return;
    
    listEl.innerHTML = ''; 
    
    if (logs.length === 0) {
        listEl.innerHTML = `<li class="text-gray-500 text-center text-sm py-2">Chưa có hoạt động nào.</li>`;
        return;
    }
    
    logs.forEach(log => {
        const li = document.createElement('li');
        li.className = 'border-b border-gray-100 pb-2';
        
        const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
        const timeString = `${timestamp.toLocaleDateString('vi-VN')} ${timestamp.toLocaleTimeString('vi-VN')}`;
        
        li.innerHTML = `
            <p class="font-medium text-gray-800">${log.details}</p>
            <p class="text-xs text-gray-500">${log.user?.email || 'Hệ thống'} - ${timeString}</p>
        `;
        listEl.appendChild(li);
    });
}

// --- SỬA KẾ HOẠCH 1: CÁC HÀM CHO LỜI MỜI ---

/**
 * Cập nhật huy hiệu (badge)
 * @param {boolean} show
 */
export function updateInvitationBadge(show) {
    const badge = document.getElementById('invitation-badge');
    if(badge) {
        badge.classList.toggle('hidden', !show);
    }
}

/**
 * Hiển thị modal danh sách lời mời
 */
export function showInvitationsListModal() {
    const modal = document.getElementById('invitations-list-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Render danh sách lời mời
 * @param {Array} invitations
 * @param {function} onAccept
 * @param {function} onDecline
 */
export function renderInvitationsList(invitations, onAccept, onDecline) {
    const listEl = document.getElementById('invitations-list-ul');
    const noMsg = document.getElementById('no-invitations-msg');
    if (!listEl || !noMsg) return;
    
    listEl.innerHTML = ''; 
    noMsg.classList.toggle('hidden', invitations.length > 0);
    
    invitations.forEach(invite => {
        const li = document.createElement('li');
        li.className = 'p-3 rounded-lg bg-gray-50 border';
        
        li.innerHTML = `
            <p class="font-medium text-gray-800">
                <span class="font-bold">${invite.inviterName}</span> đã mời bạn tham gia ví 
                <span class="font-bold">${invite.walletName}</span>.
            </p>
            <div class="mt-3 flex space-x-2">
                <button class="accept-invite-btn text-sm font-medium bg-blue-600 text-white px-3 py-1 rounded-lg" data-id="${invite.id}" data-wallet="${invite.walletId}">Chấp nhận</button>
                <button class="decline-invite-btn text-sm font-medium bg-gray-200 text-gray-700 px-3 py-1 rounded-lg" data-id="${invite.id}">Từ chối</button>
            </div>
        `;
        listEl.appendChild(li);
    });

    // Gắn listener
    listEl.querySelectorAll('.accept-invite-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.dataset.id;
            const walletId = e.currentTarget.dataset.wallet;
            onAccept(id, walletId);
        };
    });
    listEl.querySelectorAll('.decline-invite-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.dataset.id;
            onDecline(id);
        };
    });
}

