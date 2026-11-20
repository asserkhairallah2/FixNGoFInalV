using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class WorkOrderConfig : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> e)
    {
        e.ToTable("WorkOrders"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.HasOne(x => x.Bay).WithMany().HasForeignKey(x => x.BayId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Technician).WithMany().HasForeignKey(x => x.TechnicianId).OnDelete(DeleteBehavior.Restrict);
    }
}
