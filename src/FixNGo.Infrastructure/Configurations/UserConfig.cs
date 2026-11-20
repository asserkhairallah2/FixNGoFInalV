using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class UserConfig : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> e)
    {
        e.ToTable("Users");
        e.HasKey(x => x.Id);
        e.HasIndex(x => x.Email).IsUnique();
        e.HasIndex(x => x.Phone).IsUnique().HasFilter("[Phone] IS NOT NULL");
        e.Property(x => x.FullName).HasMaxLength(120).IsRequired();
        e.Property(x => x.Email).HasMaxLength(254).IsRequired();
        e.Property(x => x.PasswordHash).HasMaxLength(256).IsRequired();
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasMany(x => x.Sessions).WithOne(x => x.User).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasMany(x => x.Vehicles).WithOne(x => x.Owner).HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Notifications).WithOne(x => x.User).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
