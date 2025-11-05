// --- LOGIC GỌI API GEMINI ---

import { showToast } from './ui.js';

// --- CẤU HÌNH CỦA BẠN ---
const GEMINI_API_KEY = "DÁN_KEY_GEMINI_CỦA_BẠN_VÀO_ĐÂY"; // Đã thêm key của bạn
const API_URL_NLP = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
const API_URL_ANALYSIS = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Hàm gọi API Gemini với backoff (thử lại khi lỗi)
 * @param {string} apiUrl - URL của API
 * @param {object} payload - Payload gửi đi
 * @param {number} maxRetries - Số lần thử lại
 */
async function fetchGeminiWithBackoff(apiUrl, payload, maxRetries = 3) {
    let attempt = 0;
    let delay = 1000;
    
    while (attempt < maxRetries) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429) { // Lỗi quota
                    throw new Error('Rate limit exceeded');
                }
                const errorData = await response.json();
                console.error("Lỗi API Gemini: ", errorData);
                return { error: `Lỗi máy chủ: ${errorData.error?.message || response.statusText}` };
            }
            const result = await response.json();
            return { data: result };
        } catch (error) {
            if (error.message === 'Rate limit exceeded' && attempt < maxRetries - 1) {
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                attempt++;
            } else {
                console.error("Lỗi fetch hoặc hết số lần thử: ", error);
                return { error: `Lỗi kết nối: ${error.message}` };
            }
        }
    }
    return { error: 'Hết số lần thử lại API.' };
}

/**
 * Gọi Gemini để phân tích NLP từ chat
 * @param {string} textInput - Văn bản người dùng nhập
 */
export async function getNlpTransaction(textInput) {
    const chatMessages = document.getElementById('chat-messages');
    
    // Hiển thị tin nhắn của người dùng
    chatMessages.innerHTML += `
        <div class="flex justify-end mb-3">
            <div class="bg-blue-600 text-white rounded-lg py-2 px-4 max-w-[70%]">
                ${textInput}
            </div>
        </div>`;
    
    // Hiển thị "Đang nghĩ..."
    const thinkingBubbleId = `thinking-${Date.now()}`;
    chatMessages.innerHTML += `
        <div id="${thinkingBubbleId}" class="flex justify-start mb-3">
            <div class="bg-gray-200 text-gray-700 rounded-lg py-2 px-4">
                <span class="italic">Đang nghĩ...</span>
            </div>
        </div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // SỬA LỖI 2: Thêm "date" vào schema
    const schema = {
        type: "OBJECT",
        properties: {
            "type": { "type": "STRING", "enum": ["income", "expense"] },
            "category": { "type": "STRING" },
            "amount": { "type": "NUMBER" },
            "description": { "type": "STRING" },
            "date": { 
                "type": "STRING", 
                "description": "Ngày của giao dịch. Nếu không nói gì, là hôm nay. Định dạng YYYY-MM-DD."
            }
        },
        required: ["type", "category", "amount", "description", "date"]
    };

    // --- SỬA LỖI THỜI GIAN (Múi giờ Hà Nội) ---
    function getHanoiDateParts() {
        const now = new Date();
        // Lấy ngày/tháng/năm theo múi giờ Hà Nội
        const options = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric' };
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
        let year, month, day;
        parts.forEach(part => {
            if (part.type === 'year') year = part.value;
            if (part.type === 'month') month = part.value;
            if (part.type === 'day') day = part.value;
        });
        // Tạo một đối tượng Date "sạch" (không có time/timezone) tại đầu ngày ở Hà Nội
        // Dùng Date.UTC để tránh
        const hanoiDateObj = new Date(Date.UTC(year, month - 1, day));
        return hanoiDateObj;
    }

    const hanoiTodayObj = getHanoiDateParts();
    
    // Hàm helper để format YYYY-MM-DD từ Date object (bỏ qua timezone)
    const toYYYYMMDD = (dateObj) => {
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const hanoiToday = toYYYYMMDD(hanoiTodayObj);
    
    // Tính hôm qua, hôm kia dựa trên ngày Hà Nội (tính bằng mili giây)
    const hanoiYesterdayObj = new Date(hanoiTodayObj.getTime() - 86400000);
    const hanoiDayBeforeObj = new Date(hanoiTodayObj.getTime() - 2 * 86400000);
    
    const hanoiYesterday = toYYYYMMDD(hanoiYesterdayObj);
    const hanoiDayBefore = toYYYYMMDD(hanoiDayBeforeObj);
    // --- KẾT THÚC SỬA LỖI THỜI GIAN ---


    // SỬA LỖI THỜI GIAN: Cập nhật systemPrompt
    const systemPrompt = `Bạn là trợ lý tài chính. Trích xuất thông tin giao dịch từ văn bản và trả về JSON theo schema.
    Hôm nay là: ${hanoiToday} (Múi giờ Hà Nội GMT+7)
    Quy tắc:
    1. 'k' = 1000. 'tr' = 1,000,000.
    2. 'type': 'income' (lương, thưởng, bán) hoặc 'expense' (ăn, mua, xăng).
    3. 'category' (chi tiêu): [Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Giáo dục, Nhà cửa, Khác]
    4. 'category' (thu nhập): [Lương, Thưởng, Thu nhập phụ, Quà tặng, Khác]
    5. 'description' là văn bản gốc, NHƯNG phải loại bỏ số tiền, đơn vị tiền (k, tr) và thông tin ngày tháng đã được trích xuất.
    Ví dụ: 'ăn tối 200k hôm qua' -> 'description': 'ăn tối'.
    6. 'date':
       - "hôm nay" -> ${hanoiToday}
       - "hôm qua" -> ${hanoiYesterday}
       - "hôm kia" -> ${hanoiDayBefore}
       - Nếu không nói gì, dùng ngày hôm nay (${hanoiToday}).
       - Nếu có ngày cụ thể (vd: 31/10), dùng ngày đó (vd: ${hanoiTodayObj.getUTCFullYear()}-10-31).
    `;

    const payload = {
        contents: [{ parts: [{ text: textInput }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    };
    
    const response = await fetchGeminiWithBackoff(API_URL_NLP, payload);
    
    document.getElementById(thinkingBubbleId)?.remove();

    if (response.error || !response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("Lỗi phân tích NLP: ", response.error, response.data);
        chatMessages.innerHTML += `
            <div class="flex justify-start mb-3">
                <div class="bg-gray-200 text-gray-700 rounded-lg py-2 px-4 max-w-[70%]">
                    Xin lỗi, tôi chưa hiểu rõ ý bạn. Vui lòng thử lại.
                </div>
            </div>`;
    } else {
        try {
            const jsonText = response.data.candidates[0].content.parts[0].text;
            const parsedData = JSON.parse(jsonText);
            
            // SỬA LỖI 2 (onclick of null)
            // 1. Tạo một element div mới cho tin nhắn
            const messageBubble = document.createElement('div');
            messageBubble.className = 'flex justify-start mb-3';
            
            // SỬA LỖI THỜI GIAN: Hiển thị ngày đã phân tích (cần +T00:00:00 để JS hiểu là ngày local)
            const formattedDate = new Date(parsedData.date + 'T00:00:00').toLocaleDateString('vi-VN');
            
            messageBubble.innerHTML = `
                <div class="bg-gray-200 text-gray-700 rounded-lg py-2 px-4 max-w-[70%]">
                    <p>Tôi hiểu rồi:</p>
                    <p class="font-medium">${parsedData.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}: ${parsedData.category}</p>
                    <p class="font-medium">Số tiền: ${parsedData.amount.toLocaleString('vi-VN')} ₫</p>
                    <p class="font-medium">Mô tả: ${parsedData.description}</p>
                    <p class="font-medium">Ngày: ${formattedDate}</p>
                    <p class="mt-2">Bạn có muốn lưu giao dịch này không?</p>
                    <div class="mt-2 space-x-2">
                        <button class="confirm-ai-add bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Lưu</button>
                        <button class="cancel-ai-add bg-gray-300 text-gray-800 px-3 py-1 rounded-lg text-sm">Hủy</button>
                    </div>
                </div>`;
                
            // 2. Gắn listener vào các nút BÊN TRONG element vừa tạo
            messageBubble.querySelector('.confirm-ai-add').onclick = (e) => {
                // SỬA LỖI 2: Truyền full parsedData (có cả ngày)
                window.app.addTransactionFromAi(parsedData);
                e.target.parentElement.innerHTML = `<span class="text-green-700 text-sm">Đã lưu!</span>`;
            };
            messageBubble.querySelector('.cancel-ai-add').onclick = (e) => {
                e.target.parentElement.innerHTML = `<span class="text-gray-600 text-sm">Đã hủy.</span>`;
            };
            
            // 3. Thêm element đã gắn listener vào DOM
            chatMessages.appendChild(messageBubble);

        } catch (parseError) {
            console.error("Lỗi parse JSON từ AI: ", parseError);
             chatMessages.innerHTML += `... (Lỗi parse JSON) ...`;
        }
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
        
/**
 * Gọi Gemini để phân tích tổng quan
 */
export async function getAiAnalysis(transactions) {
    const aiResultEl = document.getElementById('ai-analysis-result');
    if (transactions.length < 3) { // Giảm xuống 3
        aiResultEl.innerHTML = `<p class="text-gray-600">Bạn cần ít nhất 3 giao dịch để AI có thể phân tích.</p>`;
        return;
    }
    
    // SỬA: Không loading toàn màn hình
    const spinner = `<div class="spinner !border-blue-600 !border-l-transparent mx-auto"></div><p class="text-gray-600 italic text-center mt-2">Đang phân tích...</p>`;
    aiResultEl.innerHTML = spinner;
    
    const dataForPrompt = transactions.map(t => {
        const date = t.timestamp?.toDate ? t.timestamp.toDate().toLocaleDateString('vi-VN') : 'N/A';
        return `${date} | ${t.type === 'income' ? 'Thu' : 'Chi'} | ${t.category} | ${t.amount}đ | ${t.description || ''}`;
    }).join('\n');
    
    const systemPrompt = "Bạn là chuyên gia tài chính. Phân tích danh sách giao dịch và đưa ra 3-4 câu nhận xét và 2-3 lời khuyên cụ thể, dễ thực hiện. Tập trung vào các khoản chi lớn nhất. Dùng ngôn ngữ động viên, tích cực. Định dạng Markdown.";
    const userQuery = `Đây là giao dịch của tôi:\n${dataForPrompt}\n\nHãy phân tích và cho tôi lời khuyên.`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    
    const response = await fetchGeminiWithBackoff(API_URL_ANALYSIS, payload);
    
    if (response.error || !response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("Lỗi phân tích AI: ", response.error, response.data);
        aiResultEl.innerHTML = `<p class="text-red-500">Đã xảy ra lỗi khi phân tích. Vui lòng thử lại sau.</p>`;
    } else {
        const analysisText = response.data.candidates[0].content.parts[0].text;
        // Chuyển Markdown đơn giản sang HTML
        let html = analysisText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\n/g, '<br>'); // Newlines
        aiResultEl.innerHTML = `<div class="prose prose-sm max-w-none">${html}</div>`;
    }
}
