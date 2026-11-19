namespace FixNGo.Domain.Entities;

/// <summary>Bilingual service type (Flatbed Tow, Mechanic, Battery, Tire, Fuel, Other).</summary>
public class ServiceType : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public RequestKind Kind { get; set; }
    public int SortOrder { get; set; }
    public ICollection<FollowUpQuestion> Questions { get; set; } = [];
}

/// <summary>Dynamic follow-up question for a service type.</summary>
public class FollowUpQuestion : BaseEntity
{
    public Guid ServiceTypeId { get; set; }
    public ServiceType ServiceType { get; set; } = null!;
    public string Key { get; set; } = string.Empty;
    public string QuestionEn { get; set; } = string.Empty;
    public string QuestionAr { get; set; } = string.Empty;
    public string AnswerType { get; set; } = "boolean"; // boolean | number | text | choice
    public string? ChoicesJson { get; set; }
    public bool EscalatesToP0WhenYes { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>Bilingual problem type catalog.</summary>
public class ProblemType : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string RecommendedServiceKey { get; set; } = "mechanic";
}

/// <summary>Cancellation reason catalog.</summary>
public class CancellationReason : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public string LabelAr { get; set; } = string.Empty;
}

/// <summary>Appointment rejection reason catalog.</summary>
public class RejectReason : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public string LabelAr { get; set; } = string.Empty;
}

/// <summary>Egyptian bank catalog with IBAN validation metadata.</summary>
public class Bank : BaseEntity
{
    public string NameEn { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

/// <summary>Vehicle make lookup.</summary>
public class VehicleMake : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public ICollection<VehicleModel> Models { get; set; } = [];
}

/// <summary>Vehicle model lookup belonging to a make.</summary>
public class VehicleModel : BaseEntity
{
    public Guid MakeId { get; set; }
    public VehicleMake Make { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
}

/// <summary>Checklist template used by provider and center workflows.</summary>
public class ChecklistTemplate : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string ItemEn { get; set; } = string.Empty;
    public string ItemAr { get; set; } = string.Empty;
    public string Workflow { get; set; } = string.Empty; // tow-load | repair | center-complete
    public int SortOrder { get; set; }
}
