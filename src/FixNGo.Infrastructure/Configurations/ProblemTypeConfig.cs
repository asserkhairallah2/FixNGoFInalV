using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class ProblemTypeConfig : IEntityTypeConfiguration<ProblemType>
{
    public void Configure(EntityTypeBuilder<ProblemType> e)
    {
        e.ToTable("ProblemTypes"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}
