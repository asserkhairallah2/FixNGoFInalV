namespace FixNGo.Domain.Entities;

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
