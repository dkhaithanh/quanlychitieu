// --- FILE QUẢN LÝ VÍ & THÀNH VIÊN ---

import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    doc, 
    getDoc,
    getDocs,
    writeBatch,
    where,
    serverTimestamp, 
    limit,
    orderBy,
    updateDoc,
    deleteField 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './firebase.js';
// SỬA LỖI (Vòng lặp): Không import từ main.js nữa
// import { getCurrentUser } from './main.js'; 
import { showToast, showGlobalLoading, updateWalletListModal } from './ui.js';

let walletListener = null;
let allWallets = []; 
let currentWallet = null;

// SỬA LỖI: PHẢI EXPORT HÀM NÀY
export function getCurrentWallet() {
    return currentWallet;
}

// SỬA LỖI (Vòng lặp): Lấy user/wallet từ window.app
function getLocalCurrentUser() {
    if (window.app && window.app.getCurrentUser) {
        return window.app.getCurrentUser();
    }
    console.error("Lỗi nghiêm trọng: không tìm thấy window.app.getCurrentUser");
    return null;
}
function getLocalCurrentUserProfile() {
    if (window.app && window.app.getCurrentUserProfile) {
        return window.app.getCurrentUserProfile();
    }
    return {};
}

/**
 * Ghi lại một hành động vào Lịch sử (log) của ví
 * @param {string} walletId 
 * @param {string} action
 * @param {string} details
 */
export async function addWalletLog(walletId, action, details) {
    if (!walletId) return;
    
    try {
        const user = getLocalCurrentUser(); 
        if (!user) {
             console.warn("Chưa tải được user, tạm dừng ghi log");
             return;
        }
        
        const logData = {
            action: action,
            details: details,
            timestamp: serverTimestamp(),
            user: {
                uid: user?.uid || 'system',
                email: user?.email || 'system'
            }
        };
        const logCol = collection(db, `wallets/${walletId}/logs`);
        await addDoc(logCol, logData);
        
    } catch (error) {
        console.error("Lỗi ghi log: ", error);
    }
}

/**
 * Lấy danh sách Log của ví (1 lần)
 * @param {string} walletId 
 * @returns {Array} - Mảng các log
 */
export async function getWalletLogs(walletId) {
    if (!walletId) return [];
    
    try {
        const logCol = collection(db, `wallets/${walletId}/logs`);
        const q = query(logCol, orderBy('timestamp', 'desc'), limit(50));
        
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return logs;
        
    } catch (error) {
        console.error("Lỗi lấy log: ", error);
        showToast(`Lỗi: Không thể tải log. ${error.message}`, 'error');
        return [];
    }
}


/**
 * Thiết lập listener theo dõi DANH SÁCH VÍ của người dùng
 * @param {string} userId
 * @param {function} callback
 */
export function setupWalletListener(userId, callback) {
    if (walletListener) {
        walletListener();
    }
    
    if (!userId) return;

    getWalletsOnce(userId, callback);
}

/**
 * Lấy danh sách ví 1 lần
 */
export async function getWalletsOnce(userId, callback) {
    if (!userId) return;

    const q = query(
        collection(db, "walletMembers"),
        where(`members.${userId}.role`, "in", ["owner", "editor", "viewer"])
    );
    
    try {
        const snapshot = await getDocs(q);
        const walletMemberDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log("Đã nhận danh sách walletMembers: ", walletMemberDocs);
        
        if (walletMemberDocs.length === 0) {
            allWallets = [];
            callback(allWallets); 
            return;
        }

        const walletIds = walletMemberDocs.map(wm => wm.id);
        
        if(walletIds.length > 10) {
             console.warn("User có nhiều hơn 10 ví, chỉ tải 10 ví đầu.");
             walletIds.splice(10);
        }
        
        const walletDetailsQuery = query(
            collection(db, "wallets"),
            where("__name__", "in", walletIds)
        );
        
        const walletDetailsSnapshot = await getDocs(walletDetailsQuery);
        const walletDetailsMap = {};
        walletDetailsSnapshot.docs.forEach(doc => {
            walletDetailsMap[doc.id] = doc.data();
        });

        allWallets = walletMemberDocs.map(wm => {
            const details = walletDetailsMap[wm.id] || {};
            return {
                id: wm.id,
                name: details.name,
                type: details.type,
                ...wm 
            };
        });

        updateWalletListModal(allWallets, switchWallet); 
        callback(allWallets);

    } catch (error) {
        console.error("Lỗi lắng nghe ví: ", error);
        showToast(`Lỗi: Không thể tải danh sách ví. ${error.message}`, "error");
    }
}


/**
 * Chuyển sang một ví khác
 * @param {string} walletId - ID của ví
 */
export function switchWallet(walletId) {
    const wallet = allWallets.find(w => w.id === walletId);
    if (wallet) {
        currentWallet = wallet;
        console.log("Đã chuyển sang ví:", wallet.name);
        
        if (window.app && typeof window.app.reloadDataForWallet === 'function') {
            window.app.reloadDataForWallet(wallet);
        } else {
            console.error("Lỗi nghiêm trọng: không tìm thấy hàm reloadDataForWallet");
        }
        
    } else {
        console.error("Không tìm thấy ví với ID:", walletId);
    }
}

/**
 * Tạo ví mới (Cá nhân hoặc Nhóm)
 * @param {string} type
 * @param {string} name
 * @param {object} user
 * @returns {object}
 */
export async function handleCreateWallet(type, name, user) {
    if (!user) {
        showToast("Lỗi: Người dùng chưa xác thực.", "error");
        return null;
    }
    
    let walletName = (type === 'personal') ? `Ví cá nhân của ${user.displayName || user.email}` : name;
    
    if (type === 'group' && !walletName.trim()) {
        showToast("Vui lòng nhập tên ví.", "error");
        return null;
    }
    
    showGlobalLoading(true);
    try {
        const batch = writeBatch(db);

        const walletRef = doc(collection(db, "wallets"));
        batch.set(walletRef, {
            name: walletName,
            type: type,
            createdAt: serverTimestamp(),
            ownerId: user.uid
        });

        const memberRef = doc(db, "walletMembers", walletRef.id);
        batch.set(memberRef, {
            members: {
                [user.uid]: {
                    role: "owner",
                    email: user.email,
                    name: user.displayName
                }
            },
            logsEnabled: false 
        });

        await batch.commit();
        showToast("Tạo ví mới thành công!", "success");
        
        addWalletLog(walletRef.id, 'CREATE_WALLET', `Đã tạo ví mới: ${walletName}`);
        
        const newWallet = {
            id: walletRef.id,
            name: walletName,
            type: type,
            members: { [user.uid]: { role: "owner", email: user.email, name: user.displayName } },
            logsEnabled: false
        };
        
        allWallets.push(newWallet);
        
        return newWallet;

    } catch (error) {
        console.error("Lỗi tạo ví: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
        return null;
    } finally {
        showGlobalLoading(false);
    }
}


// --- KẾ HOẠCH 1: HỆ THỐNG LỜI MỜI ---

/**
 * Mời người dùng (Tạo lời mời 'pending')
 * @param {object} wallet
 * @param {string} email
 */
export async function handleInviteUser(wallet, email) {
    if (!email || !wallet || wallet.type !== 'group') {
        showToast("Thông tin không hợp lệ.", "error");
        return;
    }
    
    const user = getLocalCurrentUser();
    if (!user) {
        showToast("Lỗi: Không thể xác thực người mời.", "error");
        return;
    }

    showGlobalLoading(true);
    try {
        const usersRef = collection(db, "users");
        const qUser = query(usersRef, where("email", "==", email), limit(1));
        const userSnapshot = await getDocs(qUser);
        
        if (userSnapshot.empty) {
            showToast("Lỗi: Không tìm thấy người dùng với email này.", "error");
            return;
        }
        
        const invitationsRef = collection(db, "invitations");
        const qPending = query(invitationsRef,
            where("walletId", "==", wallet.id),
            where("invitedEmail", "==", email),
            where("status", "==", "pending")
        );
        const pendingSnapshot = await getDocs(qPending);
        if (!pendingSnapshot.empty) {
            showToast("Người này đã được mời và đang chờ xác nhận.", "info");
            return;
        }
        
        const memberRef = doc(db, "walletMembers", wallet.id);
        const memberDoc = await getDoc(memberRef);
        const members = memberDoc.data()?.members || {};
        
        const targetUserId = userSnapshot.docs[0].id;
        if (members[targetUserId]) {
            showToast("Người này đã là thành viên của ví.", "info");
            return;
        }

        await addDoc(invitationsRef, {
            walletId: wallet.id,
            walletName: wallet.name,
            invitedEmail: email,
            inviterId: user.uid,
            inviterName: getLocalCurrentUserProfile().displayName || user.email, // Sửa: Lấy profile
            status: "pending",
            createdAt: serverTimestamp()
        });
        
        addWalletLog(wallet.id, 'INVITE_MEMBER', `Đã mời ${email} vào ví (đang chờ).`);
        
        showToast("Đã gửi lời mời thành công!", "success");
        
    } catch (error) {
        console.error("Lỗi mời thành viên: ", error);
        if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
             showToast("Lỗi: Không có quyền. Vui lòng kiểm tra Security Rules.", "error");
        } else if (error.message.includes("indexes")) {
            showToast("Lỗi: Cần tạo Index cho 'invitations'. Vui lòng kiểm tra Firebase Console.", "error");
        }
        else {
             showToast(`Lỗi: ${error.message}`, "error");
        }
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Lấy danh sách lời mời đang chờ
 * @param {string} userEmail
 * @returns {Array}
 */
export async function getPendingInvitations(userEmail) {
    if (!userEmail) return [];
    
    try {
        const invitationsCol = collection(db, "invitations");
        const q = query(invitationsCol, 
            where("invitedEmail", "==", userEmail),
            where("status", "==", "pending"),
            orderBy("createdAt", "desc")
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
    } catch (error) {
        console.error("Lỗi lấy lời mời: ", error);
         if (error.message.includes("indexes")) {
            showToast("Lỗi: Cần tạo Index cho 'invitations' (để đọc). Vui lòng kiểm tra Firebase Console.", "error");
        }
        return [];
    }
}


/**
 * Người dùng chấp nhận lời mời
 * @param {string} invitationId
 * @returns {boolean}
 */
export async function acceptInvitation(invitationId) {
    const user = getLocalCurrentUser();
    const userProfile = getLocalCurrentUserProfile();

    if (!user || !invitationId) {
        showToast("Lỗi: Người dùng hoặc lời mời không hợp lệ.", "error");
        return false;
    }
    
    showGlobalLoading(true);
    try {
        const inviteRef = doc(db, "invitations", invitationId);
        const inviteDoc = await getDoc(inviteRef);
        
        if (!inviteDoc.exists() || inviteDoc.data().status !== 'pending') {
            showToast("Lỗi: Lời mời không còn hợp lệ.", "error");
            return false;
        }
        
        const invitation = inviteDoc.data();
        const walletId = invitation.walletId;
        
        const memberRef = doc(db, "walletMembers", walletId);
        
        const batch = writeBatch(db);
        
        batch.update(memberRef, {
            [`members.${user.uid}`]: {
                role: "editor", 
                email: user.email,
                name: userProfile.displayName || user.email
            }
        });
        
        batch.update(inviteRef, {
            status: "accepted"
        });
        
        await batch.commit();
        
        addWalletLog(walletId, 'ACCEPT_INVITE', `${user.email} đã tham gia ví.`);
        
        showToast(`Bạn đã tham gia ví "${invitation.walletName}"!`, "success");
        return true;
        
    } catch (error) {
        console.error("Lỗi chấp nhận lời mời: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
        return false;
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Người dùng từ chối lời mời
 * @param {string} invitationId
 */
export async function declineInvitation(invitationId) {
    if (!invitationId) return;
    
    showGlobalLoading(true);
    try {
        const inviteRef = doc(db, "invitations", invitationId);
        await updateDoc(inviteRef, {
            status: "declined"
        });
        showToast("Đã từ chối lời mời.", "info");
    } catch (error)
    {
        console.error("Lỗi từ chối lời mời: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}


// --- KẾ HOẠCH 2: QUẢN LÝ THÀNH VIÊN ---

/**
 * Rời khỏi ví (Ghi log trước)
 * @param {string} walletId 
 * @param {string} userId
 */
export async function handleLeaveWallet(walletId, userId) {
    if (!walletId || !userId) {
        showToast("Lỗi: Thiếu thông tin ví hoặc người dùng.", "error");
        return;
    }

    const authUid = getLocalCurrentUser()?.uid;
    if (authUid !== userId) {
        showToast("Lỗi: Không thể rời ví thay cho người khác.", "error");
        return;
    }
    
    showGlobalLoading(true);
    try {
        // 1. Ghi log TRƯỚC KHI RỜI
        const userEmail = getLocalCurrentUser()?.email || 'Người dùng';
        await addWalletLog(walletId, 'LEAVE_WALLET', `${userEmail} đã rời khỏi ví.`);

        // 2. Xóa chính mình
        const memberRef = doc(db, "walletMembers", walletId);
        await updateDoc(memberRef, {
            [`members.${authUid}`]: deleteField()
        });

        showToast("Bạn đã rời khỏi ví.", "success");

        // 3. Tải lại danh sách ví và chuyển ví
        if (window.app?.getCurrentUser) {
            getWalletsOnce(window.app.getCurrentUser().uid, (wallets) => {
                if (wallets.length > 0) {
                    switchWallet(wallets[0].id);
                } else {
                    if(window.app?.showOnboardingScreen) {
                         window.app.showOnboardingScreen();
                    }
                }
            });
        }

    } catch (error) {
        console.error("Lỗi rời ví: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Xóa thành viên (Chỉ Owner)
 * @param {string} walletId 
 * @param {string} targetUserId
 */
export async function handleRemoveMember(walletId, targetUserId) {
    if (!walletId || !targetUserId) {
        showToast("Lỗi: Thiếu thông tin.", "error");
        return;
    }
    
    const authUid = getLocalCurrentUser()?.uid;
    if (authUid === targetUserId) {
        showToast("Lỗi: Bạn không thể tự xóa mình bằng nút này.", "error");
        return;
    }
    
    showGlobalLoading(true);
    try {
        const memberRef = doc(db, "walletMembers", walletId);
        
        const memberDoc = await getDoc(memberRef);
        const targetEmail = memberDoc.data()?.members[targetUserId]?.email || 'thành viên';
        
        await addWalletLog(walletId, 'REMOVE_MEMBER', `Đã xóa ${targetEmail} khỏi ví.`);
        
        await updateDoc(memberRef, {
            [`members.${targetUserId}`]: deleteField()
        });
        
        showToast("Đã xóa thành viên.", "success");
        
        const updatedWalletDoc = await getDoc(memberRef);
        // SỬA LỖI (Vòng lặp): Dùng getLocalCurrentWallet
        const updatedWallet = { ...getLocalCurrentWallet(), ...updatedWalletDoc.data() }; 
        if (window.app && window.app.reloadDataForWallet) {
            window.app.reloadDataForWallet(updatedWallet);
        }
        
    } catch (error) {
        console.error("Lỗi xóa thành viên: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}

/**
 * Chuyển quyền Owner (Chỉ Owner)
 * @param {string} walletId 
 * @param {string} newOwnerUserId
 */
export async function handleChangeOwner(walletId, newOwnerUserId) {
    if (!walletId || !newOwnerUserId) {
        showToast("Lỗi: Thiếu thông tin.", "error");
        return;
    }
    
    const oldOwnerId = getLocalCurrentUser()?.uid;
    if (oldOwnerId === newOwnerUserId) {
        showToast("Bạn đã là trưởng nhóm.", "info");
        return;
    }
    
    showGlobalLoading(true);
    try {
        const memberRef = doc(db, "walletMembers", walletId);
        
        const memberDoc = await getDoc(memberRef);
        const members = memberDoc.data()?.members || {};
        const newOwnerEmail = members[newOwnerUserId]?.email || 'thành viên mới';
        const oldOwnerEmail = members[oldOwnerId]?.email || 'trưởng nhóm cũ';
        
        await addWalletLog(walletId, 'CHANGE_OWNER', `${oldOwnerEmail} đã chuyển quyền cho ${newOwnerEmail}.`);

        const batch = writeBatch(db);
        batch.update(memberRef, {
            [`members.${newOwnerUserId}.role`]: "owner",
            [`members.${oldOwnerId}.role`]: "editor"
        });
        await batch.commit();
        
        showToast("Đã chuyển quyền trưởng nhóm!", "success");

        const updatedWalletDoc = await getDoc(memberRef);
        // SỬA LỖI (Vòng lặp): Dùng getLocalCurrentWallet
        const updatedWallet = { ...getLocalCurrentWallet(), ...updatedWalletDoc.data() };
        if (window.app && window.app.reloadDataForWallet) {
            window.app.reloadDataForWallet(updatedWallet);
        }
        
    } catch (error) {
        console.error("Lỗi chuyển quyền: ", error);
        showToast(`Lỗi: ${error.message}`, "error");
    } finally {
        showGlobalLoading(false);
    }
}

