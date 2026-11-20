using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class RejectReasonConfig : IEntityTypeConfiguration<RejectReason>
{
    public void Configure(EntityTypeBuilder<RejectReason> e)
    {
        e.ToTable("RejectReasons"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Key).IsUnique();
    }
}
