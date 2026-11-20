using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class BankConfig : IEntityTypeConfiguration<Bank>
{
    public void Configure(EntityTypeBuilder<Bank> e)
    {
        e.ToTable("Banks"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
    }
}
