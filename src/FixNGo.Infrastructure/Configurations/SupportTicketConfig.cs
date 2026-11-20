using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class SupportTicketConfig : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> e)
    {
        e.ToTable("SupportTickets"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasMany(x => x.Messages).WithOne(x => x.Ticket).HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
    }
}
