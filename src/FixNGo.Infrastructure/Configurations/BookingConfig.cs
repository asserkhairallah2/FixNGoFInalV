using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class BookingConfig : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> e)
    {
        e.ToTable("Bookings"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.Code).IsUnique();
        e.Property(x => x.RowVersion).IsRowVersion().HasDefaultValue(new byte[8]);
        e.HasOne(x => x.Center).WithMany().HasForeignKey(x => x.CenterId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        e.HasMany(x => x.WorkOrders).WithOne(x => x.Booking).HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Cascade);
    }
}
