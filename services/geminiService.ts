import { GoogleGenAI, Type } from "@google/genai";
import { ResultData } from "../types";

const getApiKey = () => {
  // In Vite, process.env is usually not available unless defined in vite.config.ts
  // or using import.meta.env.
  // We mapped process.env.GEMINI_API_KEY in vite.config.ts
  return process.env.GEMINI_API_KEY || "";
};

export const suggestFromContent = async (
  topic: string,
  subject: string,
  grade: string,
  fileData?: { data: string, mimeType: string },
  isIntegration: boolean = false
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "Lỗi: Chưa cấu hình GEMINI_API_KEY. Vui lòng kiểm tra lại môi trường.";
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let prompt = `Bạn là trợ lý giảng dạy AI. 
  NHIỆM VỤ: ${isIntegration ? 'Trích xuất CHÍNH XÁC và TOÀN BỘ nội dung giáo án từ tài liệu đã tải lên.' : 'Phân tích tài liệu và đề xuất nội dung chi tiết cho bài dạy:'}
  Môn: ${subject}
  Lớp: ${grade}
  Chủ đề: ${topic}
  
  Yêu cầu: 
  ${isIntegration 
    ? 'HÃY TRÍCH XUẤT 100% VĂN BẢN (TUYỆT ĐỐI KHÔNG TÓM TẮT, KHÔNG LƯỢC BỚT, KHÔNG THAY ĐỔI TỪ NGỮ) có trong file giáo án của giáo viên. Mục tiêu là lấy lại nguyên bản nội dung để sau đó AI sẽ thực hiện tích hợp NLS/AI vào chính nội dung này. Giữ nguyên cấu trúc các mục (Mục tiêu, Thiết bị, Hoạt động GV-HS...). Nếu file là hình ảnh, hãy OCR thật kỹ từng câu chữ.' 
    : 'Trích xuất các kiến thức cốt lõi, ví dụ và bài tập thực hành từ tài liệu. Nếu không có tài liệu, hãy tự soạn nội dung chuẩn theo chương trình GDPT 2018.'}`;

    const parts: any[] = [{ text: prompt }];
    if (fileData) {
      parts.push({
        inlineData: {
          data: fileData.data,
          mimeType: fileData.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }]
    });
    
    return response.text || "Không có nội dung phản hồi.";
  } catch (err: any) {
    console.error("Ai Suggest Error:", err);
    return "Không thể trích xuất nội dung từ tài liệu. Vui lòng kiểm tra API Key.";
  }
};

export const generateLessonPlan = async (
  mode: 'creation' | 'integration', 
  formData: any,
  extractedContent?: string,
  frameworkContent?: string
): Promise<ResultData> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY. Vui lòng kiểm tra lại môi trường.");
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Bạn là chuyên gia giáo dục cao cấp, am hiểu sâu sắc về chuyển đổi số giáo dục tại Việt Nam và các khung năng lực mới nhất.
    NHIỆM VỤ: Tích hợp Năng lực số (NLS) và Trí tuệ nhân tạo (AI) vào giáo án cũ theo nguyên tắc "BẢO TỒN TUYỆT ĐỐI".

    NGUYÊN TẮC BẮT BUỘC:
    1. GIỮ NGUYÊN GIÁO ÁN GỐC: Tuyệt đối không viết lại, không sửa câu chữ, không đổi tên hoạt động, không thay đổi mục tiêu, thiết bị, tiến trình, sản phẩm, đánh giá có sẵn. Không tự ý thêm hoạt động mới làm lệch giáo án. Mọi nội dung cũ phải được giữ nguyên 100%.
    2. CHỈ CHÈN THÊM NỘI DUNG TÍCH HỢP: Bạn chỉ được chèn thêm các nội dung tích hợp Năng lực số và AI vào đúng vị trí phù hợp trong giáo án. Không gom tất cả ở cuối bài.
    3. ĐỊNH DẠNG CHỮ MÀU ĐỎ: Toàn bộ nội dung tích hợp và tiêu đề của nó PHẢI hiển thị bằng chữ màu đỏ (nằm trong thẻ <span style="color:red">...</span>).
    4. KHÔNG GÂY LÃNG PHÍ: Nếu một hoạt động không phù hợp để tích hợp, hãy bỏ qua. Chỉ tích hợp AI khi thực sự cần thiết và phù hợp với bài học.

    MẪU TÍCH HỢP NĂNG LỰC SỐ:
    <span style="color:red">[TÍCH HỢP NĂNG LỰC SỐ]
    Mã chỉ báo: [Ghi rõ mã NLS phù hợp theo TT 02]
    Nội dung tích hợp: [Viết ngắn gọn, cụ thể, bám sát hoạt động gốc]
    Hướng dẫn triển khai: [Nêu rõ GV làm gì, HS làm gì, dùng công cụ số nào]</span>

    MẪU TÍCH HỢP AI (Theo QĐ 3439):
    <span style="color:red">[TÍCH HỢP AI THEO QĐ 3439]
    Yêu cầu cần đạt: [Ghi rõ yêu cầu phù hợp theo QĐ 3439]
    Mã năng lực AI: [Mã phù hợp]
    Hướng dẫn triển khai: [Nêu cụ thể cách GV và HS dùng AI]
    Sản phẩm học tập: [Sản phẩm HS tạo ra hoặc hoàn thiện]
    Lưu ý sư phạm: [Hướng dẫn HS kiểm tra, phản biện, không sao chép máy móc]</span>

    ĐỊNH DẠNG ĐẦU RA: JSON.
    JSON Schema (BẮT BUỘC):
    {
      "lessonPlan": {
        "topic": "string", "subject": "string", "grade": "string", "duration": "string",
        "objectives": { "knowledge": ["string"], "competency": ["string"], "quality": ["string"] },
        "materials": ["string"],
        "activities": [
          {
            "name": "string", "objective": "string", "content": "string", "product": "string",
            "steps": [{ "stepName": "string", "teacherAction": "string", "output": "string" }],
            "digitalIntegration": { "code": "string", "requirement": "string", "description": "string" }
          }
        ]
      },
      "digitalPack": { "summary": "string", "mapping": [{ "activity": "string", "competencyCode": "string", "competency": "string", "tool": "string", "action": "string" }] }
    }`;

    const userPrompt = `Dưới đây là nội dung giáo án cần xử lý:
    Môn: ${formData.subject}, Lớp: ${formData.grade}, Chủ đề: ${formData.topic}
    
    NỘI DUNG GỐC:
    ${extractedContent || formData.originalText}
    
    YÊU CẦU CỤ THỂ:
    1. Giữ nguyên TOÀN BỘ văn bản trong "NỘI DUNG GỐC". Tuyệt đối không xóa hay sửa bất kỳ phần nào.
    2. Chèn trực tiếp các khối [TÍCH HỢP NĂNG LỰC SỐ] và [TÍCH HỢP AI THEO QĐ 3439] vào các phần: Mục tiêu, Thiết bị, Hoạt động ngay sau nội dung phù hợp.
    3. Mọi nội dung chèn thêm PHẢI nằm trong thẻ <span style="color:red">...</span>.
    4. Không được viết lại giáo án. Xuất kết quả dưới dạng JSON theo Schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "";
    // Clean up potential markdown formatting if any
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error. Raw text:", responseText);
      throw new Error("AI trả về định dạng không hợp lệ. Vui lòng thử lại.");
    }
    
    // Validate and fix structure
    if (!parsedResult.lessonPlan) {
      throw new Error("AI không trả về cấu trúc lessonPlan hợp lệ.");
    }
    
    const lp = parsedResult.lessonPlan;
    if (!lp.objectives) lp.objectives = { knowledge: [], competency: [], quality: [] };
    if (!lp.materials) lp.materials = [];
    if (!lp.activities) lp.activities = [];
    
    lp.activities = lp.activities.map((act: any) => ({
      name: act.name || "Hoạt động",
      objective: act.objective || "",
      content: act.content || "",
      product: act.product || "",
      steps: Array.isArray(act.steps) ? act.steps.map((s: any) => ({
        stepName: s.stepName || "Bước",
        teacherAction: s.teacherAction || "",
        output: s.output || ""
      })) : [],
      digitalIntegration: act.digitalIntegration ? {
        code: act.digitalIntegration.code || "",
        requirement: act.digitalIntegration.requirement || "",
        description: act.digitalIntegration.description || ""
      } : undefined
    }));

    if (!parsedResult.digitalPack) parsedResult.digitalPack = { summary: "", mapping: [] };
    
    return {
      lessonPlan: lp,
      digitalPack: parsedResult.digitalPack,
      mode: mode
    };
  } catch (err: any) {
    console.error("Generate Error:", err);
    throw new Error("Lỗi khi tạo giáo án: " + (err.message || "Lỗi không xác định"));
  }
};

export const transformActivity = async (
  activity: any,
  methodType: string,
  subject: string,
  grade: string
): Promise<any> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Bạn là chuyên gia sư phạm. Hãy chuyển đổi hoạt động giáo dục sau đây sang phương pháp: ${methodType}.
  Môn: ${subject}, Lớp: ${grade}
  Hoạt động gốc: ${JSON.stringify(activity)}
  
  YÊU CẦU:
  - Giữ nguyên cấu trúc JSON của hoạt động.
  - Thay đổi 'content', 'teacherAction', 'output' để phản ánh phương pháp mới.
  - ${methodType === 'gamification' ? 'Sử dụng các yếu tố trò chơi, luật chơi, điểm số.' : 'Sử dụng mô hình học tập ở nhà trước, đến lớp thực hành.'}
  - Trả về DUY NHẤT đối tượng JSON của hoạt động đã sửa.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  const responseText = response.text || "";
  const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
};

export const elaborateSection = async (
  sectionContent: string,
  userPrompt: string,
  sectionName: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Bạn là trợ lý soạn bài. Hãy viết chi tiết hơn/mở rộng nội dung sau đây dựa trên yêu cầu của giáo viên.
  Phần: ${sectionName}
  Nội dung hiện tại: ${sectionContent}
  Yêu cầu mở rộng: ${userPrompt}
  
  LƯU Ý: 
  - Trả về văn bản đã mở rộng, trình bày rõ ràng.
  - Sử dụng ngôn ngữ sư phạm chuẩn xác.
  - Có thể sử dụng thẻ <span style="color:red">...</span> cho các nội dung AI bổ sung.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });
  return response.text || "";
};
