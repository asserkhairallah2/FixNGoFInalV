using AutoMapper;
using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Domain.Entities;

namespace FixNGo.Application.Mapping;

/// <summary>
/// Central AutoMapper profile mapping Domain entities to Application DTOs so Domain entities
/// never cross the Application boundary into Controllers or Razor Views.
/// </summary>
public sealed class FixNGoMappingProfile : Profile
{
    public FixNGoMappingProfile()
    {
        CreateMap<User, UserDto>()
            .ConstructUsing(u => UserDtoMapper.ToDto(u));

        CreateMap<Vehicle, VehicleDto>()
            .ConstructUsing(v => Mappings.Vehicle(v));

        CreateMap<ServiceRequest, RequestDto>()
            .ConstructUsing(r => Mappings.Request(r));

        CreateMap<RequestEvent, RequestEventDto>()
            .ConstructUsing(e => Mappings.Event(e));

        CreateMap<Offer, OfferDto>()
            .ConstructUsing(o => Mappings.Offer(o));

        CreateMap<Quote, QuoteDto>()
            .ConstructUsing(q => Mappings.Quote(q));

        CreateMap<PaymentMethod, PaymentMethodDto>()
            .ConstructUsing(p => Mappings.PaymentMethod(p));

        CreateMap<Payment, PaymentDto>()
            .ConstructUsing(p => Mappings.Payment(p));

        CreateMap<Invoice, InvoiceDto>()
            .ConstructUsing(i => Mappings.Invoice(i));

        CreateMap<WalletEntry, WalletEntryDto>()
            .ConstructUsing(e => Mappings.WalletEntry(e));

        CreateMap<BankAccount, BankAccountDto>()
            .ConstructUsing(b => Mappings.BankAccount(b));

        CreateMap<Withdrawal, WithdrawalDto>()
            .ConstructUsing(w => Mappings.Withdrawal(w));

        CreateMap<Domain.Entities.ServiceCenter, CenterDto>()
            .ConstructUsing(c => Mappings.Center(c));

        CreateMap<Domain.Entities.CenterService, CenterServiceDto>()
            .ConstructUsing(s => Mappings.CenterService(s));

        CreateMap<Booking, BookingDto>()
            .ConstructUsing(b => Mappings.Booking(b));

        CreateMap<WorkOrder, WorkOrderDto>()
            .ConstructUsing(w => Mappings.WorkOrder(w));

        CreateMap<Dispute, DisputeDto>()
            .ConstructUsing(d => Mappings.Dispute(d));

        CreateMap<KycDocument, KycDocumentDto>()
            .ConstructUsing(d => new KycDocumentDto(d.Id, d.DocumentType, d.FileId, d.Status.ToString(), d.ReviewNote, d.CreatedAt));

        CreateMap<KycApplication, KycApplicationDto>()
            .ConstructUsing(a => Mappings.Kyc(a));

        CreateMap<Notification, NotificationDto>()
            .ConstructUsing(n => Mappings.Notification(n));

        CreateMap<ChatMessage, ChatMessageDto>()
            .ConstructUsing(m => Mappings.ChatMessage(m));

        CreateMap<Review, ReviewDto>()
            .ConstructUsing(r => Mappings.Review(r));

        CreateMap<SupportTicket, TicketDto>()
            .ConstructUsing(t => Mappings.Ticket(t));

        CreateMap<AuditLog, AuditLogDto>()
            .ConstructUsing(a => Mappings.Audit(a));

        CreateMap<Faq, FaqDto>()
            .ConstructUsing(f => new FaqDto(f.Id, f.QuestionEn, f.QuestionAr, f.AnswerEn, f.AnswerAr));

        CreateMap<LegalDocument, LegalDto>()
            .ConstructUsing(l => new LegalDto(l.Key, l.Version, l.TitleEn, l.TitleAr, l.BodyEn, l.BodyAr, l.UpdatedAt));
    }
}
