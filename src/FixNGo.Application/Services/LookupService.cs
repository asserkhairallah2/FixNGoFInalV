using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Read-only bilingual reference data used to bootstrap every client screen.</summary>
public sealed class LookupService(IAppDbContext db, SettingsService settings)
{
    public async Task<LookupsDto> BootstrapAsync(CancellationToken ct = default)
    {
        var types = await db.ServiceTypes.OrderBy(s => s.SortOrder)
            .Select(s => new ServiceTypeDto(s.Id, s.Key, s.NameEn, s.NameAr, s.Kind,
                s.Questions.OrderBy(q => q.SortOrder).Select(q => new FollowUpQuestionDto(q.Id, q.Key,
                    q.QuestionEn, q.QuestionAr, q.AnswerType, q.ChoicesJson, q.EscalatesToP0WhenYes)).ToList()))
            .ToListAsync(ct);
        var problems = await db.ProblemTypes.OrderBy(p => p.Key)
            .Select(p => new ProblemDto(p.Id, p.Key, p.NameEn, p.NameAr, p.RecommendedServiceKey)).ToListAsync(ct);
        var cancels = await db.CancellationReasons.OrderBy(r => r.Key)
            .Select(r => new ReasonDto(r.Id, r.Key, r.LabelEn, r.LabelAr)).ToListAsync(ct);
        var rejects = await db.RejectReasons.OrderBy(r => r.Key)
            .Select(r => new ReasonDto(r.Id, r.Key, r.LabelEn, r.LabelAr)).ToListAsync(ct);
        var banks = await db.Banks.OrderBy(b => b.NameEn)
            .Select(b => new BankDto(b.Id, b.NameEn, b.NameAr, b.Code)).ToListAsync(ct);
        var makes = await db.VehicleMakes.OrderBy(m => m.Name)
            .Select(m => new VehicleMakeDto(m.Id, m.Name, m.Models.OrderBy(x => x.Name)
                .Select(x => new VehicleModelDto(x.Id, x.MakeId, x.Name)).ToList())).ToListAsync(ct);
        var checks = await db.ChecklistTemplates.OrderBy(c => c.Workflow).ThenBy(c => c.SortOrder)
            .Select(c => new ChecklistDto(c.Id, c.Key, c.ItemEn, c.ItemAr, c.Workflow)).ToListAsync(ct);
        var faqs = await db.Faqs.OrderBy(f => f.SortOrder)
            .Select(f => new FaqDto(f.Id, f.QuestionEn, f.QuestionAr, f.AnswerEn, f.AnswerAr)).ToListAsync(ct);
        var legal = await db.LegalDocuments.OrderBy(l => l.Key).ThenByDescending(l => l.Version)
            .Select(l => new LegalDto(l.Key, l.Version, l.TitleEn, l.TitleAr, l.BodyEn, l.BodyAr, l.UpdatedAt)).ToListAsync(ct);
        var (pricing, _) = await settings.CurrentAsync(ct);
        return new LookupsDto(types, problems, cancels, rejects, banks, makes, checks, faqs, pricing, legal);
    }
}
