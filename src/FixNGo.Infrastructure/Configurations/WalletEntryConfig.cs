using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class WalletEntryConfig : IEntityTypeConfiguration<WalletEntry>
{
    public void Configure(EntityTypeBuilder<WalletEntry> e) { e.ToTable("WalletEntries"); e.HasKey(x => x.Id); }
}
