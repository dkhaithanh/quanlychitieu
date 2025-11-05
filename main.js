// --- FILE CHÍNH ĐIỀU PHỐI ỨNG DỤNG ---

import {
    onAuthStateChanged,
    getAuth
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, query, collection, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { setupAuthListeners, logout } from './auth.js';
import { 
    // SỬA LỖI: getCurrentWallet được import từ đây
    getCurrentWallet, 
    setupWalletListener, 
    switchWallet, 
    handleCreateWallet, 
    handleInviteUser,
    getWalletsOnce,
    getWalletLogs,
    getPendingInvitations, // SỬA KẾ HOẠCH 1
    acceptInvitation, 
    declineInvitation, 
    handleLeaveWallet, 
    handleRemoveMember, 
    handleChangeOwner 
} from './wallet.js';
import { setupTransactionListener, handleAddTransaction, handleEditTransaction, getTransactions } from './transactions.js';
import { getAiAnalysis, getNlpTransaction } from './api.js';
import { 
    showView, 
    showGlobalLoading, 
    showToast, 
    renderDashboard, 
    renderReports, 
    populateCategoryDropdown, 
    closeAllModals,
    showWalletSwitcherModal,
    renderWalletManagement,
    updateWalletListModal,
    showActivityLogModal, 
    renderActivityLog,
    showConfirmationModal,
    updateInvitationBadge, // SỬA KẾ HOẠCH 1
    showInvitationsListModal, // SỬA KẾ HOẠCH 1
    renderInvitationsList // SỬA KẾ HOẠCH 1
} from './ui.js';

// --- BIẾN TOÀN CỤC CỦA ỨNG DỤNG ---
let currentUser = null;
let currentUserProfile = null;
let currentTransactions = [];
let currentTransactionListener = null;

// --- EXPORT HÀM ĐỂ CÁC MODULE KHÁC GỌI ---
export function getCurrentUser() {
    return currentUser;
}
export function getCurrentUserProfile() {
    return currentUserProfile;
}

/**
 * Tải lại toàn bộ dữ liệu (transactions, UI) khi chuyển ví
 * @param {object} wallet - Ví mới
 */
export function reloadDataForWallet(wallet) {
    console.log("Reloading data for wallet:", wallet.name);
    
    document.getElementById('current-wallet-name').textContent = wallet.name;
    document.getElementById('current-wallet-type').textContent = wallet.type === 'group' ? 'Ví nhóm' : 'Ví cá nhân';

    if (currentTransactionListener) {
        currentTransactionListener(); // Hủy listener cũ
    }
    currentTransactionListener = setupTransactionListener(wallet.id, (transactions) => {
        console.log("Nhận giao dịch mới: ", transactions.length);
        currentTransactions = transactions;
        renderDashboard(currentTransactions);
        renderReports(currentTransactions);
        renderWalletManagement(wallet);
    });
    
    checkLucide();
}

/**
 * SỬA KẾ HOẠCH 2: Tách hàm để wallet.js có thể gọi
 */
function showOnboardingScreenInternal() {
    closeAllModals();
    document.getElementById('main-app-content').classList.add('hidden');
    showScreen('onboarding-screen', setupOnboardingListeners, 'create-personal-wallet-btn');
}


// Gán hàm vào window.app để các module khác (wallet.js) có thể gọi
window.app = { 
    ...window.app,
    reloadDataForWallet,
    getCurrentUser,
    getCurrentUserProfile,
    showOnboardingScreen: showOnboardingScreenInternal,
    // SỬA LỖI (Vòng lặp): Cung cấp getCurrentWallet cho ui.js
    getCurrentWallet: getCurrentWallet 
};


// --- HÀM KHỞI CHẠY CHÍNH ---
function main() {
    console.log("Ứng dụng bắt đầu chạy... (main)");
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP ---
            console.log("Người dùng đã đăng nhập:", user.uid);
            currentUser = user;
            
            const emailEl = document.getElementById('user-email-display');
            if (emailEl) emailEl.textContent = user.email;
            
            loadUserProfile(user.uid, (profileExists) => {
                
                // Tải danh sách ví
                getWalletsOnce(user.uid, (wallets) => {
                    if (wallets.length === 0) {
                        // CHÍNH LÀ CHỖ NÀY:
                        console.log("Không tìm thấy ví, hiển thị onboarding.");
                        showScreen('onboarding-screen', setupOnboardingListeners, 'create-personal-wallet-btn');
                    } else {
                        // Đã có ví
                        console.log("Tìm thấy ví, tải ví đầu tiên.");
                        showScreen('main-app-content', () => {
                            setupMainAppListeners();
                            if (!getCurrentWallet()) {
                                switchWallet(wallets[0].id);
                            }
                        }, 'nav-dashboard');
                    }
                });
            });

        } else {
            // --- NGƯỜI DÙNG ĐÃ ĐĂNG XUẤT ---
            console.log("Người dùng đã đăng xuất.");
            currentUser = null;
            currentUserProfile = null;
            currentTransactions = [];
            if (currentTransactionListener) {
                currentTransactionListener();
            }
            
            showScreen('auth-container', () => {
                showView('login-form', 'auth-container');
                setupAuthListeners();
            }, 'login-form');
        }
    });
}

/**
 * SỬA: Hàm quản lý hiển thị màn hình với kỹ thuật Polling
 * @param {string} screenId
 * @param {function} [callback]
 * @param {string} [elementToPoll]
 */
function showScreen(screenId, callback, elementToPoll = null) {
    const screens = ['app-loading-screen', 'auth-container', 'onboarding-screen', 'main-app-content'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const screenToShow = document.getElementById(screenId);
    if (screenToShow) {
        screenToShow.classList.remove('hidden');
        
        if (!callback) return;

        if (!elementToPoll) {
            requestAnimationFrame(() => requestAnimationFrame(callback));
            return;
        }

        let interval;
        let timeout;

        const pollForElement = () => {
            const el = document.getElementById(elementToPoll);
            
            if (el) {
                clearInterval(interval);
                clearTimeout(timeout);
                console.log(`Callback cho màn hình #${screenId} (sau khi poll) đang chạy...`);
                callback();
            }
        };

        timeout = setTimeout(() => {
            clearInterval(interval);
            console.error(`KHÔNG THỂ TÌM THẤY: Phần tử #${elementToPoll} sau 2 giây.`);
        }, 2000);

        interval = setInterval(pollForElement, 50);
        
    } else {
        console.error(`Không tìm thấy màn hình: #${screenId}`);
    }
}


// --- HÀM HELPER GẮN LISTENER AN TOÀN ---
const safeClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) {
        el.onclick = handler;
    } else {
        console.error(`Không tìm thấy phần tử: #${id}`);
    }
};

/**
 * SỬA KẾ HOẠCH 1: Tải và hiển thị Lời mời
 */
async function loadAndShowInvitations() {
    if (!currentUser) {
        showToast("Lỗi: Chưa đăng nhập", "error");
        return;
    }
    showInvitationsListModal();
    renderInvitationsList([], () => {}, () => {}); // Hiển thị trạng thái "Đang tải..."
    
    const invitations = await getPendingInvitations(currentUser.email);
    updateInvitationBadge(invitations.length > 0);
    
    renderInvitationsList(
        invitations,
        // onAccept
        async (invitationId, walletId) => {
            const success = await acceptInvitation(invitationId);
            if (success) {
                showToast("Đã tham gia nhóm!", "success");
                getWalletsOnce(currentUser.uid, (wallets) => {
                     switchWallet(walletId); // Tự động chuyển ví
                });
                closeAllModals();
            }
        },
        // onDecline
        (invitationId) => {
            declineInvitation(invitationId);
            loadAndShowInvitations(); // Tải lại danh sách
        }
    );
}


/**
 * Tải và hiển thị log
 */
async function loadAndShowLogs() {
    const walletId = getCurrentWallet()?.id;
    if (!walletId) {
        showToast("Lỗi: Không tìm thấy ví", "error");
        return;
    }
    showActivityLogModal();
    renderActivityLog([]); 
    
    const logs = await getWalletLogs(walletId);
    renderActivityLog(logs);
}

// --- Quản lý Profile ---
async function loadUserProfile(userId, callback) {
    if (!userId) {
        callback(false);
        return;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            currentUserProfile = docSnap.data();
            console.log("Đã tải profile:", currentUserProfile);
            callback(true);
        } else {
            console.warn("Profile user không tồn tại, sẽ tạo mới.");
            // SỬA LỖI: Tự động tạo profile nếu chưa có
            const newUserProfile = { 
                uid: currentUser.uid,
                email: currentUser.email, 
                displayName: currentUser.displayName || "Người dùng mới", 
                dob: '',
                createdAt: new Date()
            };
            await setDoc(userDocRef, newUserProfile);
            currentUserProfile = newUserProfile;
            console.log("Đã tạo profile mới:", currentUserProfile);
            callback(true); // Đã tạo
        }
    } catch (error) {
        console.error("Lỗi tải profile:", error);
        callback(false);
    }
}

function showProfileModal() {
    if (!currentUserProfile) {
        showToast("Chưa tải được thông tin, vui lòng thử lại.", "error");
        return;
    }
    document.getElementById('profile-name').value = currentUserProfile.displayName || '';
    document.getElementById('profile-dob').value = currentUserProfile.dob || '';
    
    const modal = document.getElementById('profile-modal');
    if(modal) modal.classList.remove('hidden');
}

async function handleSaveProfile(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const newName = document.getElementById('profile-name').value;
    const newDob = document.getElementById('profile-dob').value;
    
    if (!newName) {
        showToast("Tên hiển thị không được để trống.", "error");
        return;
    }
    
    showGlobalLoading(true);
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
            displayName: newName,
            dob: newDob,
            email: currentUser.email
        }, { merge: true });
        
        currentUserProfile.displayName = newName;
        currentUserProfile.dob = newDob;
        
        showToast("Cập nhật thông tin thành công!", "success");
        closeAllModals();
    } catch (error) {
        console.error("Lỗi lưu profile:", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}


// --- TÁCH CÁC HÀM SETUP LISTENER ---

/**
 * Gắn listener cho Màn hình Onboarding (Tạo ví)
 * (HÀM NÀY GÂY LỖI NẾU KHÔNG ĐƯỢC ĐỊNH NGHĨA)
 */
function setupOnboardingListeners() {
    console.log("Gắn listener cho Onboarding...");
    
    safeClick('create-personal-wallet-btn', async () => {
        const newWallet = await handleCreateWallet('personal', '', currentUser);
        if (newWallet) {
            showScreen('main-app-content', () => {
                setupMainAppListeners();
                switchWallet(newWallet.id);
            }, 'nav-dashboard');
        }
    });
    
    safeClick('show-group-form-btn', () => {
        const groupForm = document.getElementById('group-wallet-form');
        if(groupForm) groupForm.classList.remove('hidden');
    });
    
    safeClick('create-group-wallet-btn', async () => {
        const nameInput = document.getElementById('group-wallet-name-input');
        const name = nameInput ? nameInput.value : '';
        const newWallet = await handleCreateWallet('group', name, currentUser);
        if (newWallet) {
            showScreen('main-app-content', () => {
                setupMainAppListeners();
                switchWallet(newWallet.id);
            }, 'nav-dashboard');
        }
    });
    
    safeClick('onboarding-cancel-btn', () => {
        showScreen('main-app-content', () => {
            showView('settings-view');
        });
    });
}

/**
 * Gắn listener cho Ứng dụng chính (Sau khi có ví)
 */
function setupMainAppListeners() {
    console.log("Gắn listener cho App chính...");
    checkLucide(); 

    // Kiểm tra lời mời (chỉ 1 lần khi setup)
    if(currentUser) {
        getPendingInvitations(currentUser.email).then(invitations => {
            updateInvitationBadge(invitations.length > 0);
        });
    }

    // Điều hướng
    safeClick('nav-dashboard', () => showView('dashboard-view'));
    safeClick('nav-add', () => showView('add-view'));
    safeClick('nav-reports', () => showView('reports-view'));
    safeClick('nav-settings', () => showView('settings-view'));

    // Thêm giao dịch (Thủ công)
    const manualForm = document.getElementById('manual-add-form');
    if (manualForm) {
        manualForm.onsubmit = (e) => {
            e.preventDefault();
            handleAddTransaction(getCurrentWallet()?.id, null);
        };
    } else { console.error("Không tìm thấy: #manual-add-form"); }
    
    const transTypeSelect = document.getElementById('trans-type');
    if(transTypeSelect) {
        transTypeSelect.onchange = (e) => {
            populateCategoryDropdown(e.target.value, 'trans-category');
        };
        populateCategoryDropdown(transTypeSelect.value, 'trans-category');
    }

    // Thêm giao dịch (AI)
    safeClick('chat-send-btn', () => {
        const input = document.getElementById('chat-input');
        if (input && input.value.trim()) {
            getNlpTransaction(input.value.trim());
            input.value = '';
        }
    });
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('chat-send-btn').click();
            }
        };
    }
    
    window.app = { ...window.app, 
        addTransactionFromAi: (data) => {
            handleAddTransaction(getCurrentWallet()?.id, data);
        }
    };

    // Sửa giao dịch
    const editForm = document.getElementById('edit-transaction-form');
    if (editForm) {
        editForm.onsubmit = (e) => {
            e.preventDefault();
            handleEditTransaction(getCurrentWallet()?.id);
        };
    } else { console.error("Không tìm thấy: #edit-transaction-form"); }
    
    const editTransTypeSelect = document.getElementById('edit-trans-type');
    if(editTransTypeSelect) {
        editTransTypeSelect.onchange = (e) => {
            populateCategoryDropdown(e.target.value, 'edit-trans-category');
        };
    }

    // Báo cáo
    const reportsFilter = document.getElementById('reports-filter');
    if(reportsFilter) {
        reportsFilter.onchange = () => {
            renderReports(currentTransactions);
        };
    }
    
    // Phân tích AI
    safeClick('run-ai-analysis-btn', () => {
        getAiAnalysis(currentTransactions);
    });
    
    // Cài đặt & Ví
    safeClick('wallet-switcher-btn', showWalletSwitcherModal); 
    safeClick('create-new-wallet-btn', showOnboardingScreenInternal);
    safeClick('settings-switch-wallet-btn', showWalletSwitcherModal);
    safeClick('settings-create-wallet-btn', showOnboardingScreenInternal);
    
    safeClick('refresh-wallet-list-btn', () => {
        if (currentUser) {
            showToast("Đang tải lại danh sách ví...", "info");
            getWalletsOnce(currentUser.uid, (wallets) => {
                showToast("Đã tải xong danh sách ví!", "success");
            });
        }
    });
    
    const inviteForm = document.getElementById('invite-form');
    if(inviteForm) {
        inviteForm.onsubmit = (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('invite-email-input');
            const email = emailInput ? emailInput.value : '';
            handleInviteUser(email, getCurrentWallet());
            emailInput.value = '';
        };
    } else { console.error("Không tìm thấy: #invite-form"); }
    
    // Cài đặt Log & Lời mời
    safeClick('show-log-btn', loadAndShowLogs);
    safeClick('refresh-log-btn', loadAndShowLogs);
    safeClick('show-invitations-btn', loadAndShowInvitations);
    safeClick('refresh-invitations-btn', loadAndShowInvitations);

    // Đăng xuất
    safeClick('logout-btn', logout);

    // Đóng Modal
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.onclick = closeAllModals;
    });
    
    // Profile
    safeClick('profile-btn', showProfileModal);
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.onsubmit = handleSaveProfile;
    }
    
    // Gắn listener cho Danh sách Thành viên
    const memberListEl = document.getElementById('member-list');
    if (memberListEl) {
        memberListEl.onclick = (e) => {
            const target = e.target.closest('button[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const targetUserId = target.dataset.uid;
            const targetName = target.dataset.name;
            
            const walletId = getCurrentWallet()?.id;
            if (!walletId) return;

            const auth = getAuth();
            const currentLoggedInUserId = auth.currentUser?.uid;

            if (!currentLoggedInUserId) {
                showToast("Bạn chưa đăng nhập.", "error");
                return;
            }

            switch (action) {
                case 'leave-wallet':
                    showConfirmationModal(
                        "Xác nhận Rời ví",
                        "Bạn có chắc muốn rời khỏi ví này không? Bạn sẽ cần được mời lại.",
                        () => handleLeaveWallet(walletId, currentLoggedInUserId) 
                    );
                    break;
                
                case 'remove-member':
                    if (!targetUserId || !targetName) return;
                    showConfirmationModal(
                        "Xác nhận Xóa",
                        `Bạn có chắc muốn xóa ${targetName} khỏi ví này không?`,
                        () => handleRemoveMember(walletId, targetUserId)
                    );
                    break;
                
                case 'make-owner':
                    if (!targetUserId || !targetName) return;
                     showConfirmationModal(
                        "Xác nhận Chuyển quyền",
                        `Bạn có chắc muốn chuyển quyền Trưởng nhóm cho ${targetName}? Bạn sẽ trở thành Editor.`,
                        () => handleChangeOwner(walletId, targetUserId)
                    );
                    break;
            }
        };
    }
}

/**
 * Hàm kiểm tra và vẽ icon Lucide
 */
function checkLucide(retries = 5) {
    try {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
            console.log("Vẽ icon thành công.");
        } else if (retries > 0) {
            console.warn("Lucide chưa được định nghĩa, thử lại sau 100ms...");
            setTimeout(() => checkLucide(retries - 1), 100);
        } else {
            console.error("Lucide không thể tải!");
        }
    } catch (e) {
        console.error("Lỗi vẽ icon: ", e);
    }
}

// Dùng window.onload để đảm bảo MỌI THỨ (kể cả file JS này) đã tải xong
window.onload = main;

