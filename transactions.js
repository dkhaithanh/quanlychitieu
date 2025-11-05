// --- LOGIC QUẢN LÝ GIAO DỊCH (TRANSACTION) ---

import { 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    deleteDoc, 
    updateDoc, 
    serverTimestamp,
    getDocs,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase.js';
import { getCurrentUser } from './main.js';
import { 
    showGlobalLoading, 
    showToast, 
    showConfirmationModal, 
    showEditTransactionModal, 
    closeAllModals, 
    showView 
} from './ui.js';
import { getCurrentWallet, addWalletLog } from './wallet.js'; // SỬA LỖI 3: Import addWalletLog

let transactionListener = null;

/**
 * Thiết lập listener theo dõi giao dịch
 * @param {string} walletId - ID của ví
 * @param {function} callback - Hàm sẽ được gọi với danh sách giao dịch mới
 */
export function setupTransactionListener(walletId, callback) {
    if (transactionListener) {
        transactionListener();
    }
    if (!walletId) {
        console.warn("Không có walletId, không thể lắng nghe giao dịch.");
        return null;
    }

    const transactionsCol = collection(db, `wallets/${walletId}/transactions`);
    const q = query(transactionsCol, orderBy('timestamp', 'desc'));

    console.log(`Bắt đầu lắng nghe transactions cho ví: ${walletId}`);
    transactionListener = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(transactions);
    }, (error) => {
        console.error("Lỗi khi lắng nghe giao dịch: ", error);
        showToast(`Lỗi: Không thể tải giao dịch. ${error.message}`, "error");
    });
    
    return transactionListener;
}

/**
 * Thêm giao dịch mới
 * @param {string} walletId - ID của ví
 * @param {object} [transactionData=null] - Dữ liệu giao dịch (nếu có, từ AI)
 */
export async function handleAddTransaction(walletId, transactionData = null) {
    if (!walletId) {
        showToast("Lỗi: Không có ví nào được chọn.", "error");
        return;
    }
    
    let data;
    let transactionTimestamp; 
    
    if (transactionData) {
        data = {
            type: transactionData.type,
            category: transactionData.category,
            amount: transactionData.amount,
            description: transactionData.description
        };
        
        if (transactionData.date) {
            transactionTimestamp = Timestamp.fromDate(new Date(transactionData.date + 'T12:00:00'));
        } else {
            transactionTimestamp = serverTimestamp(); // Mặc định
        }
        
    } else {
        const type = document.getElementById('trans-type').value;
        const category = document.getElementById('trans-category').value;
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const description = document.getElementById('trans-description').value;

        if (!type || !category || !amount || amount <= 0) {
            showToast("Vui lòng nhập đầy đủ thông tin.", "error");
            return;
        }
        data = { type, category, amount, description };
        transactionTimestamp = serverTimestamp(); // Mặc định cho thủ công
    }

    const user = getCurrentUser();
    if (!user) {
        showToast("Lỗi: Người dùng chưa xác thực.", "error");
        return;
    }
    
    showGlobalLoading(true);
    try {
        const transCol = collection(db, `wallets/${walletId}/transactions`);
        const docRef = await addDoc(transCol, {
            ...data,
            createdBy: {
                uid: user.uid,
                email: user.email
            },
            timestamp: transactionTimestamp 
        });
        
        showToast("Đã thêm giao dịch!", "success");
        
        // SỬA LỖI 3: Ghi log
        const logDetails = `Đã thêm ${data.type === 'income' ? 'khoản thu' : 'khoản chi'} [${data.category}] ${data.amount.toLocaleString('vi-VN')}₫: ${data.description}`;
        addWalletLog(walletId, 'CREATE_TRANSACTION', logDetails);
        
        if (!transactionData) {
            document.getElementById('manual-add-form').reset();
            showView('dashboard-view'); // Quay về dashboard
        }
    } catch (error) {
        console.error("Lỗi thêm giao dịch: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Xóa giao dịch
 * @param {string} walletId - ID của ví
 * @param {string} docId - ID của giao dịch cần xóa
 */
export async function handleDeleteTransaction(walletId, docId) {
    if (!walletId || !docId) {
        showToast("Lỗi: Thông tin không hợp lệ.", "error");
        return;
    }
    
    showConfirmationModal(
        "Xác nhận xóa",
        "Bạn có chắc muốn xóa giao dịch này không?",
        async () => {
            showGlobalLoading(true);
            try {
                // SỬA LỖI 3: Lấy thông tin giao dịch trước khi xóa để ghi log
                const docRef = doc(db, `wallets/${walletId}/transactions`, docId);
                // const docSnap = await getDoc(docRef); // Tạm thời bỏ qua getDoc để tiết kiệm read
                
                await deleteDoc(docRef);
                showToast("Đã xóa giao dịch.", "success");
                
                // SỬA LỖI 3: Ghi log
                addWalletLog(walletId, 'DELETE_TRANSACTION', `Đã xóa giao dịch (ID: ${docId})`);
                
            } catch (error) {
                console.error("Lỗi xóa giao dịch: ", error);
                showToast(`Lỗi: ${error.message}`, "error");
            } finally {
                showGlobalLoading(false);
            }
        }
    );
}

/**
 * Sửa giao dịch
 * @param {string} walletId - ID của ví
 */
export async function handleEditTransaction(walletId) {
    if (!walletId) {
        showToast("Lỗi: Không có ví nào được chọn.", "error");
        return;
    }

    const docId = document.getElementById('edit-trans-id').value;
    const type = document.getElementById('edit-trans-type').value;
    const category = document.getElementById('edit-trans-category').value;
    const amount = parseFloat(document.getElementById('edit-trans-amount').value);
    const description = document.getElementById('edit-trans-description').value;
    
    if (!docId || !type || !category || !amount || amount <= 0) {
        showToast("Vui lòng nhập đầy đủ thông tin.", "error");
        return;
    }
    
    const data = { type, category, amount, description };
    
    showGlobalLoading(true);
    try {
        const docRef = doc(db, `wallets/${walletId}/transactions`, docId);
        await updateDoc(docRef, data);
        showToast("Cập nhật thành công!", "success");
        closeAllModals(); 
        
        // SỬA LỖI 3: Ghi log
        const logDetails = `Đã cập nhật giao dịch [${category}] ${amount.toLocaleString('vi-VN')}₫: ${description}`;
        addWalletLog(walletId, 'UPDATE_TRANSACTION', logDetails);
        
    } catch (error) {
        console.error("Lỗi cập nhật: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Lấy danh sách giao dịch (chỉ 1 lần, không lắng nghe)
 * @param {string} walletId 
 * @returns {Array} - Mảng các giao dịch
 */
export async function getTransactions(walletId) {
     if (!walletId) return [];
     try {
        const transCol = collection(db, `wallets/${walletId}/transactions`);
        const q = query(transCol, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     } catch (error) {
        console.error("Lỗi lấy giao dịch: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
        return [];
     }
}

// Giữ lại 'window.app' hack để tránh lỗi circular dependency với ui.js
// SỬA: Chuyển sang dùng hàm window.app.deleteTransaction trực tiếp
window.app = {
    ...window.app,
    deleteTransaction: (docId) => {
        const walletId = getCurrentWallet()?.id;
        if(walletId) {
            handleDeleteTransaction(walletId, docId);
        } else {
            showToast("Lỗi: Không tìm thấy ví hiện tại", "error");
        }
    }
};

