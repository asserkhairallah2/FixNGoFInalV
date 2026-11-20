using FixNGo.Application.DTOs;
using FluentValidation;

namespace FixNGo.Application.Validators;

public sealed class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(x => x.Stars).InclusiveBetween(1, 5);
        RuleFor(x => x.Text).MaximumLength(1000);
    }
}

public sealed class CreateTicketRequestValidator : AbstractValidator<CreateTicketRequest>
{
    public CreateTicketRequestValidator()
    {
        RuleFor(x => x.Category).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
    }
}

public sealed class TicketReplyRequestValidator : AbstractValidator<TicketReplyRequest>
{
    public TicketReplyRequestValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(2000);
    }
}

public sealed class SafetyReportRequestValidator : AbstractValidator<SafetyReportRequest>
{
    public SafetyReportRequestValidator()
    {
        RuleFor(x => x.Category).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
    }
}

public sealed class ReviewKycRequestValidator : AbstractValidator<ReviewKycRequest>
{
    public ReviewKycRequestValidator()
    {
        RuleFor(x => x.Decision).IsInEnum();
        RuleFor(x => x.Note).MaximumLength(1000);
    }
}

public sealed class SuspendRequestValidator : AbstractValidator<SuspendRequest>
{
    public SuspendRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}
