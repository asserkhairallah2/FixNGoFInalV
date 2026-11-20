using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class OtpCodeConfig : IEntityTypeConfiguration<OtpCode>
{
    public void Configure(EntityTypeBuilder<OtpCode> e)
    {
        e.ToTable("OtpCodes");
        e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.Target, x.Purpose, x.CreatedAt });
    }
}
