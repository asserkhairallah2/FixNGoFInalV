using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class UploadedFileConfig : IEntityTypeConfiguration<UploadedFile>
{
    public void Configure(EntityTypeBuilder<UploadedFile> e)
    {
        e.ToTable("UploadedFiles"); e.HasKey(x => x.Id);
        e.HasIndex(x => x.StoredName).IsUnique();
    }
}
