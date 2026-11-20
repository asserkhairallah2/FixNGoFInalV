using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SafetyReportConfig : IEntityTypeConfiguration<SafetyReport>
{
    public void Configure(EntityTypeBuilder<SafetyReport> e)
    {
        e.ToTable("SafetyReports"); e.HasKey(x => x.Id);
        e.HasMany(x => x.Attachments).WithMany().UsingEntity("SafetyReportAttachments");
    }
}
