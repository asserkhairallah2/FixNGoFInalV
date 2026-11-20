using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class FollowUpQuestionConfig : IEntityTypeConfiguration<FollowUpQuestion>
{
    public void Configure(EntityTypeBuilder<FollowUpQuestion> e) { e.ToTable("FollowUpQuestions"); e.HasKey(x => x.Id); }
}
