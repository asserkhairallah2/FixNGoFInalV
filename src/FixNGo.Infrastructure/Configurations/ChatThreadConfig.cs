using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class ChatThreadConfig : IEntityTypeConfiguration<ChatThread>
{
    public void Configure(EntityTypeBuilder<ChatThread> e)
    {
        e.ToTable("ChatThreads"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Booking).WithMany().HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.Messages).WithOne(x => x.Thread).HasForeignKey(x => x.ThreadId).OnDelete(DeleteBehavior.Cascade);
    }
}
