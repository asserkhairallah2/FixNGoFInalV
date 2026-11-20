namespace FixNGo.Domain.Entities;

/// <summary>Frequently asked question, bilingual.</summary>
public class Faq : BaseEntity
{
    public string QuestionEn { get; set; } = string.Empty;
    public string QuestionAr { get; set; } = string.Empty;
    public string AnswerEn { get; set; } = string.Empty;
    public string AnswerAr { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}
