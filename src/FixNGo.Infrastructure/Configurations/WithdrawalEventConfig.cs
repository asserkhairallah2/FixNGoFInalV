using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class WithdrawalEventConfig : IEntityTypeConfiguration<WithdrawalEvent>
{
    public void Configure(EntityTypeBuilder<WithdrawalEvent> e) { e.ToTable("WithdrawalEvents"); e.HasKey(x => x.Id); }
}
