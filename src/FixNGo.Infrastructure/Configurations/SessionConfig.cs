using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SessionConfig : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> e)
    {
        e.ToTable("Sessions");
        e.HasKey(x => x.Id);
        e.HasIndex(x => x.RefreshTokenHash);
        e.Property(x => x.RefreshTokenHash).HasMaxLength(128).IsRequired();
    }
}
