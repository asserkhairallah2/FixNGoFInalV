using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class ReviewConfig : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> e)
    {
        e.ToTable("Reviews"); e.HasKey(x => x.Id);
        e.HasIndex(x => new { x.RequestId, x.AuthorId }).IsUnique().HasFilter("[RequestId] IS NOT NULL");
    }
}
