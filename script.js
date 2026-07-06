/* ================= CONFIG ================= */
const BASE_URL = "https://final-depi.runasp.net";

/* ================= AUTH ================= */

async function loginUser(email, password) {
    try {
        const response = await fetch(`${BASE_URL}/api/Auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: password })
        });

        if (response.ok) {
            const data = await response.json();
            const idToSave = data.id || data.patientId || data.userId;
            if (idToSave) {
                localStorage.setItem("patientId", idToSave);
            }
            return { success: true, message: "تم تسجيل الدخول بنجاح" };
        } else {
            let errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {}
            return { success: false, message: errorMessage };
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        return { success: false, message: "خطأ في الاتصال بالسيرفر" };
    }
}

async function signupUser(username, email, password, confirmPassword, phone) {
    if (password !== confirmPassword) {
        return { success: false, message: "كلمة المرور غير متطابقة" };
    }
    try {
        const response = await fetch(`${BASE_URL}/api/Auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, phone })
        });
        if (response.ok) {
            return { success: true, message: "تم إنشاء الحساب بنجاح" };
        } else {
            const data = await response.json();
            return { success: false, message: data.message || "فشل التسجيل" };
        }
    } catch (error) {
        return { success: false, message: "فشل الاتصال بالسيرفر" };
    }
}

/* ================= PROFILE & HISTORY ================= */

// 1. تحميل بيانات الملف الشخصي
async function updateProfile() {
    const patientId = localStorage.getItem("patientId");
    if (!patientId) return alert("الرجاء تسجيل الدخول");

    // 1. البيانات النصية
    const bodyData = {
        patientId: patientId,
        name: document.getElementById("eName").value,
        age: parseInt(document.getElementById("eAge").value) || 0,
        gender: document.getElementById("eGender").value,
        chronicDisease: document.getElementById("eDisease").value,
        nearestHospital: document.getElementById("eHospital").value
    };

    try {
        // تحديث النصوص (الطلب ده أخف بكتير على السيرفر)
        const response = await fetch(`${BASE_URL}/api/Patient/update-profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData)
        });

        if (response.status === 503) {
            throw new Error("السيرفر حالياً تحت ضغط كبير، جرب كمان دقيقتين.");
        }

        if (response.ok) {
            alert("✅ تم حفظ البيانات النصية بنجاح.");
            
            // 2. محاولة رفع الصورة "بشكل منفصل تماماً" عشان لو وقعت ما تبوظش الدنيا
            const imageInput = document.getElementById("editImageUpload");
            if (imageInput && imageInput.files.length > 0) {
                uploadImageSilently(imageInput.files[0], patientId);
            }
            
            toggleEdit(false);
            await loadProfile();
        }
    } catch (error) {
        console.error(error);
        alert("⚠️ " + error.message);
    }
}

// دالة رفع الصورة في "صمت" عشان ما تطلعش Alert لو السيرفر فصل
function uploadImageSilently(file, patientId) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);

    fetch(`${BASE_URL}/api/Patient/upload-profile-picture`, {
        method: "POST",
        body: formData
    }).then(res => {
        if(res.ok) console.log("✅ الصورة اتحدثت");
    }).catch(err => console.warn("❌ السيرفر رفض الصورة بسبب الضغط"));
}
/* ================= LOAD PROFILE ================= */

async function loadProfile() {
    const patientId = localStorage.getItem("patientId");
    if (!patientId) return;

    try {
        const response = await fetch(`${BASE_URL}/api/Patient/get-profile/${patientId}`);
        if (!response.ok) throw new Error("فشل جلب بيانات الملف الشخصي");
        
        const data = await response.json();

        // تحديث النصوص في شاشة العرض
        if(document.getElementById("vName")) document.getElementById("vName").innerText = data.name || "غير محدد";
        if(document.getElementById("vAge")) document.getElementById("vAge").innerText = data.age || "--";
        if(document.getElementById("vGender")) document.getElementById("vGender").innerText = data.gender || "--";
        if(document.getElementById("vDisease")) document.getElementById("vDisease").innerText = data.chronicDisease || "--";
        if(document.getElementById("vHospital")) document.getElementById("vHospital").innerText = data.nearestHospital || "--";

        // --- الجزء الذي تم تنقيحه لتحديث الصورة ---
        const viewImage = document.getElementById("profileImage");
        const editImage = document.getElementById("editProfileImage");
        const defaultAvatar = "images/Profile-Page.png";

        if (data.profilePicture && data.profilePicture.trim() !== "") {
            // تنظيف المسار للتأكد من عدم وجود "//" عند الدمج مع BASE_URL
            let imagePath = data.profilePicture.replace(/\\/g, '/'); // تحويل الـ backslashes لـ forward slashes لو كانت من الويندوز سيرفر
            if (!imagePath.startsWith('/')) imagePath = '/' + imagePath;
            
            // إضافة التيمبستامب ?t= لإجبار المتصفح على جلب الصورة الجديدة فوراً
            const finalUrl = `${BASE_URL}${imagePath}?t=${new Date().getTime()}`;
            
            console.log("Loading image from:", finalUrl); // لمتابعة الرابط في الـ Console

            if (viewImage) {
                viewImage.src = finalUrl;
                viewImage.onerror = () => { viewImage.src = defaultAvatar; };
            }
            if (editImage) {
                editImage.src = finalUrl;
                editImage.onerror = () => { editImage.src = defaultAvatar; };
            }
        } else {
            // في حال عدم وجود صورة، نعود للصورة الافتراضية
            if (viewImage) viewImage.src = defaultAvatar;
            if (editImage) editImage.src = defaultAvatar;
        }
    } catch (error) {
        console.error("خطأ في تحميل الملف الشخصي:", error);
    }
}
// 2. تحميل سجل المريض (الجدول)
async function loadPatientHistory() {
    const patientId = localStorage.getItem("patientId");
    const tableBody = document.getElementById("patientHistoryBody");

    if (!patientId || !tableBody) return;

    try {
        const response = await fetch(`${BASE_URL}/api/Patient/appointments-history/${patientId}`);
        if (!response.ok) throw new Error("فشل جلب السجل");
        
        const historyData = await response.json();
        tableBody.innerHTML = ""; // مسح جملة "جاري التحميل"

        if (!historyData || historyData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3">لا يوجد سجل متاح لهذا المريض</td></tr>`;
            return;
        }

        historyData.forEach(item => {
            const row = document.createElement("tr");
            // استخدام camelCase لضمان القراءة من السيرفر
            row.innerHTML = `
                <td>${item.medicineName || "---"}</td>
                <td>${item.date ? new Date(item.date).toLocaleDateString('ar-EG') : "---"}</td>
                <td>${item.hospitalName || "---"}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("History Error:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="color:red;">خطأ في الاتصال بالسيرفر</td></tr>`;
    }
}

/* ================= HOSPITALS & MEDICINES ================= */

async function loadHospitals() {
    try {
        const response = await fetch(`${BASE_URL}/api/Hospitals`);
        const hospitals = await response.json();
        const select = document.getElementById("hospitalSelect");
        if (!select) return;

        select.innerHTML = `<option value="">اختر مستشفى</option>`;
        hospitals.forEach(h => {
            const option = document.createElement("option");
            option.value = h.id;
            option.text = h.name;
            select.appendChild(option);
        });

        select.addEventListener("change", (e) => {
            const hospitalId = e.target.value;
            const medSelect = document.getElementById("medicineSelect");
            if (hospitalId) {
                loadMedicinesByHospital(hospitalId);
            } else if (medSelect) {
                medSelect.innerHTML = `<option value="">اختر الدواء</option>`;
                medSelect.disabled = true;
            }
        });
    } catch (error) { console.error("Error loading hospitals:", error); }
}

async function loadMedicinesByHospital(hospitalId) {
    const medSelect = document.getElementById("medicineSelect");
    if (!medSelect) return;

    try {
        medSelect.innerHTML = `<option value="">جاري التحميل...</option>`;
        medSelect.disabled = true;

        const response = await fetch(`${BASE_URL}/api/Medicines/by-hospital/${hospitalId}`);
        const medicines = await response.json();
        medSelect.innerHTML = `<option value="">اختر الدواء</option>`;
        
        if (medicines.length === 0) {
            medSelect.innerHTML = `<option value="">لا توجد أدوية متوفرة</option>`;
        } else {
            medicines.forEach(m => {
                const option = document.createElement("option");
                option.value = m.id;
                option.text = m.name;
                medSelect.appendChild(option);
            });
            medSelect.disabled = false;
        }
    } catch (error) { console.error("Error loading medicines:", error); }
}

/* ================= BOOK APPOINTMENT ================= */

async function bookAppointment() {
    const patientId = localStorage.getItem("patientId");
    const hospitalId = document.getElementById("hospitalSelect").value;
    const medicineId = document.getElementById("medicineSelect").value;
    const dateVal = document.getElementById("reservationDate").value;
    const timeVal = document.getElementById("reservationTime").value;

    if (!hospitalId || !medicineId || !dateVal || !timeVal) {
        alert("برجاء إكمال جميع البيانات ⚠️");
        return false;
    }

    const payload = {
        patientId: patientId,
        hospitalId: parseInt(hospitalId),
        medicineId: parseInt(medicineId),
        appointmentDate: `${dateVal}T${timeVal}:00`
    };

    try {
        const response = await fetch(`${BASE_URL}/api/Appointments/book`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("تم الحجز بنجاح ✅");
            window.location.href = "my appointments page.html";
            return true;
        } else {
            const errorText = await response.text();
            alert(errorText || "فشل الحجز");
            return false;
        }
    } catch (error) { alert("خطأ في الاتصال بالسيرفر"); }
}
/* ================= CANCEL APPOINTMENT (FINAL VERSION) ================= */

async function cancelAppointment(appointmentId) {
    // 1. طلب تأكيد من المستخدم قبل الحذف
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء هذا الموعد؟")) return;

    try {
        // 2. إرسال طلب DELETE للرابط الصحيح (بناءً على توثيق الباك إيند)
        const response = await fetch(`${BASE_URL}/api/Appointments/cancel/${appointmentId}`, {
            method: "DELETE",
            mode: "cors", // يحل مشاكل الحظر في بعض المتصفحات عند التعامل مع سيرفر خارجي
            headers: { 
                "Content-Type": "application/json",
                "Accept": "*/*"
            }
        });

        // 3. التحقق من نجاح العملية
        if (response.ok) {
            alert("تم إلغاء الموعد بنجاح ✅");
            
            // 4. تحديث الصفحة أو المواعيد تلقائياً
            if (typeof displayUserAppointments === "function") {
                // إذا كانت دالة عرض المواعيد موجودة في الصفحة، يتم استدعاؤها لتحديث القائمة فوراً
                displayUserAppointments();
            } else {
                // إذا لم تكن موجودة، يتم إعادة تحميل الصفحة بالكامل
                location.reload();
            }
        } else {
            // 5. في حالة رفض السيرفر (مثلاً الموعد غير موجود أو مشكلة صلاحيات)
            const errorText = await response.text();
            console.error("Server Response:", errorText);
            alert("فشل الإلغاء: " + (errorText || "حدث خطأ غير معروف"));
        }
    } catch (error) {
        // 6. في حالة وجود مشكلة في الاتصال (مثل الـ CORS أو انقطاع الإنترنت)
        console.error("Critical Connection Error:", error);
        alert("فشل الاتصال بالسيرفر. تأكدي من إعدادات الـ CORS أو جربي استخدام إضافة Allow CORS في المتصفح مؤقتاً.");
    }
}
