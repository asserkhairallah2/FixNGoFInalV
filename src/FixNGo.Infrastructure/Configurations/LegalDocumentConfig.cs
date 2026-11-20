using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class LegalDocumentConfig : IEntityTypeConfiguration<LegalDocument>
{
    public void Configure(EntityTypeBuilder<LegalDocument> e)
    {
        e.ToTable("LegalDocuments"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.Key, x.Version }).IsUnique();
    }
}
