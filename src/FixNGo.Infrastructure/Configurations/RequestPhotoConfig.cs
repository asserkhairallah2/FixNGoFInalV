using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class RequestPhotoConfig : IEntityTypeConfiguration<RequestPhoto>
{
    public void Configure(EntityTypeBuilder<RequestPhoto> e)
    {
        e.ToTable("RequestPhotos"); e.HasKey(x => x.Id);
        e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId).OnDelete(DeleteBehavior.Restrict);
    }
}
