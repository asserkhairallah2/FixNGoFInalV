using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure;

/// <summary>Seeds only bilingual system reference data (allowed on first run — no users/requests).</summary>
public static class ReferenceSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.ServiceTypes.AnyAsync(ct)) return;

        db.ServiceTypes.AddRange(
            new ServiceType { Key = "flatbed_tow", NameEn = "Flatbed Tow", NameAr = "نقل مسطّح", Kind = RequestKind.Tow, SortOrder = 1 },
            new ServiceType { Key = "wheel_lift", NameEn = "Wheel Lift Tow", NameAr = "نقل برفع العجلات", Kind = RequestKind.Tow, SortOrder = 2 },
            new ServiceType { Key = "mechanic", NameEn = "Mobile Mechanic", NameAr = "ميكانيكا متنقلة", Kind = RequestKind.Mechanic, SortOrder = 3 },
            new ServiceType { Key = "battery", NameEn = "Battery Replacement", NameAr = "تبديل بطارية", Kind = RequestKind.Mechanic, SortOrder = 4 },
            new ServiceType { Key = "tire", NameEn = "Tire Change", NameAr = "تغيير إطار", Kind = RequestKind.Mechanic, SortOrder = 5 },
            new ServiceType { Key = "fuel", NameEn = "Fuel Delivery", NameAr = "توصيل وقود", Kind = RequestKind.Mechanic, SortOrder = 6 },
            new ServiceType { Key = "other", NameEn = "Other", NameAr = "أخرى", Kind = RequestKind.Mechanic, SortOrder = 7 });

        var mechanic = db.ServiceTypes.Local.First(x => x.Key == "mechanic");
        var tow = db.ServiceTypes.Local.First(x => x.Key == "flatbed_tow");
        db.FollowUpQuestions.AddRange(
            new FollowUpQuestion { ServiceTypeId = mechanic.Id, Key = "injury", QuestionEn = "Is anyone injured?", QuestionAr = "هل هناك أي مصاب؟", AnswerType = "boolean", EscalatesToP0WhenYes = true, SortOrder = 1 },
            new FollowUpQuestion { ServiceTypeId = mechanic.Id, Key = "can_drive", QuestionEn = "Can the car be driven?", QuestionAr = "هل يمكن قيادة السيارة؟", AnswerType = "boolean", SortOrder = 2 },
            new FollowUpQuestion { ServiceTypeId = tow.Id, Key = "accident", QuestionEn = "Was this an accident?", QuestionAr = "هل هذا حادث؟", AnswerType = "boolean", EscalatesToP0WhenYes = true, SortOrder = 1 },
            new FollowUpQuestion { ServiceTypeId = tow.Id, Key = "vehicle_type", QuestionEn = "Vehicle type?", QuestionAr = "نوع المركبة؟", AnswerType = "choice", ChoicesJson = "[\"sedan\",\"suv\",\"van\",\"motorcycle\"]", SortOrder = 2 });

        db.ProblemTypes.AddRange(
            new ProblemType { Key = "engine", NameEn = "Engine won't start", NameAr = "المحرك لا يعمل", RecommendedServiceKey = "mechanic" },
            new ProblemType { Key = "battery_dead", NameEn = "Dead battery", NameAr = "بطارية ميتة", RecommendedServiceKey = "battery" },
            new ProblemType { Key = "flat_tire", NameEn = "Flat tire", NameAr = "إطار مثقوب", RecommendedServiceKey = "tire" },
            new ProblemType { Key = "out_of_fuel", NameEn = "Out of fuel", NameAr = "نفد الوقود", RecommendedServiceKey = "fuel" },
            new ProblemType { Key = "accident", NameEn = "Accident", NameAr = "حادث", RecommendedServiceKey = "flatbed_tow" },
            new ProblemType { Key = "other", NameEn = "Other problem", NameAr = "مشكلة أخرى", RecommendedServiceKey = "other" });

        db.CancellationReasons.AddRange(
            new CancellationReason { Key = "changed_mind", LabelEn = "Changed my mind", LabelAr = "غيّرت رأيي" },
            new CancellationReason { Key = "found_help", LabelEn = "Found help elsewhere", LabelAr = "وجدت مساعدة من مكان آخر" },
            new CancellationReason { Key = "too_long", LabelEn = "Wait too long", LabelAr = "الانتظار طويل" },
            new CancellationReason { Key = "other", LabelEn = "Other", LabelAr = "أخرى" });

        db.RejectReasons.AddRange(
            new RejectReason { Key = "full", LabelEn = "Fully booked", LabelAr = "الجدول ممتلئ" },
            new RejectReason { Key = "unavailable", LabelEn = "Service unavailable", LabelAr = "الخدمة غير متاحة" },
            new RejectReason { Key = "other", LabelEn = "Other", LabelAr = "أخرى" });

        db.Banks.AddRange(
            new Bank { NameEn = "National Bank of Egypt", NameAr = "البنك الأهلي المصري", Code = "NBE" },
            new Bank { NameEn = "Banque Misr", NameAr = "بنك مصر", Code = "BM" },
            new Bank { NameEn = "CIB", NameAr = "بنك القاهرة", Code = "CIB" },
            new Bank { NameEn = "AlexBank", NameAr = "بنك الإسكندرية", Code = "ALEX" },
            new Bank { NameEn = "QNB", NameAr = "بنك قطر الوطني", Code = "QNB" });

        var toyota = new VehicleMake { Name = "Toyota" };
        var hyundai = new VehicleMake { Name = "Hyundai" };
        var mercedes = new VehicleMake { Name = "Mercedes-Benz" };
        var bmw = new VehicleMake { Name = "BMW" };
        var nissan = new VehicleMake { Name = "Nissan" };
        db.VehicleMakes.AddRange(toyota, hyundai, mercedes, bmw, nissan);
        db.VehicleModels.AddRange(
            new VehicleModel { MakeId = toyota.Id, Name = "Corolla" }, new VehicleModel { MakeId = toyota.Id, Name = "Camry" },
            new VehicleModel { MakeId = hyundai.Id, Name = "Elantra" }, new VehicleModel { MakeId = hyundai.Id, Name = "Tucson" },
            new VehicleModel { MakeId = mercedes.Id, Name = "C200" }, new VehicleModel { MakeId = bmw.Id, Name = "320i" },
            new VehicleModel { MakeId = nissan.Id, Name = "Sentra" });

        string[] checklist = ["Secure the vehicle", "Check hazard lights", " photograph damage", "Confirm destination", "Hand over keys"];
        foreach (var (key, workflow) in new[] { ("tow-load", "tow-load"), ("repair", "repair"), ("center-complete", "center-complete") })
            for (var i = 0; i < checklist.Length; i++)
                db.ChecklistTemplates.Add(new ChecklistTemplate { Key = key, Workflow = workflow, ItemEn = checklist[i].Trim(), ItemAr = checklist[i].Trim(), SortOrder = i });

        db.Faqs.AddRange(
            new Faq { QuestionEn = "How do I request help?", QuestionAr = "كيف أطلب المساعدة؟", AnswerEn = "Choose a service, confirm your location and a nearby provider will be matched.", AnswerAr = "اختر خدمة، أكّد موقعك وسيتم مطابقتك مع مقدم خدمة قريب.", SortOrder = 1 },
            new Faq { QuestionEn = "What payment methods are accepted?", QuestionAr = "ما وسائل الدفع المقبولة؟", AnswerEn = "Cash, card and Apple Pay.", AnswerAr = "نقداً وبطاقة وApple Pay.", SortOrder = 2 },
            new Faq { QuestionEn = "How do I become a provider?", QuestionAr = "كيف أصبح مقدم خدمة؟", AnswerEn = "Register as a mechanic, captain or center and complete verification.", AnswerAr = "سجل كميكانيكا أو كابتن أو مركز وأكمل التحقق.", SortOrder = 3 });

        db.LegalDocuments.AddRange(
            new LegalDocument { Key = "privacy", Version = 1, TitleEn = "Privacy Policy", TitleAr = "سياسة الخصوصية", BodyEn = "FixNGo collects only the data needed to deliver roadside assistance. Location is shared with a provider only after you accept an offer.", BodyAr = "تجمع FixNGo البيانات اللازمة لتقديم المساعدة فقط. يتم مشاركة الموقع مع مقدم الخدمة بعد قبول العرض." },
            new LegalDocument { Key = "terms", Version = 1, TitleEn = "Terms of Service", TitleAr = "شروط الخدمة", BodyEn = "By using FixNGo you agree to the platform terms. Providers are independent contractors.", BodyAr = "باستخدامك لـ FixNGo فإنك توافق على شروط المنصة. مقدمو الخدمة متعاقدون مستقلون." });

        var settings = new PricingSettings();
        db.PlatformSettingsVersions.Add(new PlatformSettingsVersion
        {
            Version = 1, IsCurrent = true, EffectiveAt = DateTime.UtcNow,
            SettingsJson = System.Text.Json.JsonSerializer.Serialize(settings)
        });

        db.Sequences.AddRange(
            new Sequence { Prefix = "FG-" }, new Sequence { Prefix = "MR-" }, new Sequence { Prefix = "BK-" },
            new Sequence { Prefix = "WO-" }, new Sequence { Prefix = "KYC-" }, new Sequence { Prefix = "SR-" },
            new Sequence { Prefix = "SUP-" }, new Sequence { Prefix = "WD-" });

        await db.SaveChangesAsync(ct);
    }
}
