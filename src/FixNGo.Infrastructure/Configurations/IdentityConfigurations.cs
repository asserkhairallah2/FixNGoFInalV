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

public sealed class OtpCodeConfig : IEntityTypeConfiguration<OtpCode>
{
    public void Configure(EntityTypeBuilder<OtpCode> e)
    {
        e.ToTable("OtpCodes");
        e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.Target, x.Purpose, x.CreatedAt });
    }
}

public sealed class PasswordResetTokenConfig : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> e)
    {
        e.ToTable("PasswordResetTokens");
        e.HasKey(x => x.Id);
        e.HasIndex(x => x.TokenHash);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class NotificationPreferenceConfig : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> e)
    {
        e.ToTable("NotificationPreferences");
        e.HasKey(x => x.Id);
        e.HasIndex(x => x.UserId).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class DeviceTokenConfig : IEntityTypeConfiguration<DeviceToken>
{
    public void Configure(EntityTypeBuilder<DeviceToken> e)
    {
        e.ToTable("DeviceTokens");
        e.HasKey(x => x.Id);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AccountDeletionRequestConfig : IEntityTypeConfiguration<AccountDeletionRequest>
{
    public void Configure(EntityTypeBuilder<AccountDeletionRequest> e)
    {
        e.ToTable("AccountDeletionRequests");
        e.HasKey(x => x.Id);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
