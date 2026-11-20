using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FixNGo.Infrastructure.Configurations;

public sealed class PaymentReviewConfig : IEntityTypeConfiguration<PaymentReview>
{
    public void Configure(EntityTypeBuilder<PaymentReview> e)
    {
        e.ToTable("PaymentReviews"); e.HasKey(x => x.Id);
        e.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Dispute).WithMany().HasForeignKey(x => x.DisputeId).OnDelete(DeleteBehavior.Restrict);
    }
}
