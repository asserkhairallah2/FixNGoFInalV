using System.Text.Json;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Cards, charges, invoices, append-only wallet ledger, bank accounts and withdrawals.</summary>
public sealed class PaymentService(
    IAppDbContext db, IClock clock, IPaymentGateway gateway, INotifier notifier, SettingsService settings)
{
    // ---- Payment methods ----
    public async Task<IReadOnlyList<PaymentMethodDto>> MethodsAsync(Guid userId, CancellationToken ct = default) =>
        await db.PaymentMethods.Where(p => p.UserId == userId).OrderByDescending(p => p.IsDefault)
            .Select(p => Mappings.PaymentMethod(p)).ToListAsync(ct);

    public async Task<PaymentMethodDto> AddCardAsync(Guid userId, AddCardRequest req, CancellationToken ct = default)
    {
        var digits = new string(req.Number.Where(char.IsDigit).ToArray());
        if (!Rules.Luhn(digits)) throw new DomainException("payment.card_invalid", "Invalid card number.");
        if (req.ExpMonth < 1 || req.ExpMonth > 12 || req.ExpYear < DateTime.UtcNow.Year)
            throw new DomainException("payment.expiry_invalid", "Invalid expiry date.");
        var last4 = digits[^4..];
        if (await db.PaymentMethods.AnyAsync(p => p.UserId == userId && p.Type == PaymentMethodType.Card
                && p.Last4 == last4 && p.ExpMonth == req.ExpMonth && p.ExpYear == req.ExpYear, ct))
            throw new DomainException("payment.card_exists", "This card is already saved.");
        var pm = new PaymentMethod
        {
            UserId = userId, Type = PaymentMethodType.Card, Brand = BrandOf(digits), Last4 = digits[^4..],
            ExpMonth = req.ExpMonth, ExpYear = req.ExpYear, Token = digits, Label = req.Label,
            IsDefault = req.IsDefault || !await db.PaymentMethods.AnyAsync(p => p.UserId == userId, ct)
        };
        db.PaymentMethods.Add(pm);
        await db.SaveChangesAsync(ct);
        return Mappings.PaymentMethod(pm);
    }

    public async Task<PaymentMethodDto> AddApplePayAsync(Guid userId, string? label, CancellationToken ct = default)
    {
        var pm = new PaymentMethod
        {
            UserId = userId, Type = PaymentMethodType.ApplePay, Label = label, Last4 = "APPLE",
            IsDefault = !await db.PaymentMethods.AnyAsync(p => p.UserId == userId, ct)
        };
        db.PaymentMethods.Add(pm);
        await db.SaveChangesAsync(ct);
        return Mappings.PaymentMethod(pm);
    }

    public async Task RemoveMethodAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var pm = await db.PaymentMethods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct)
            ?? throw new DomainException("payment.method_not_found", "Payment method not found.");
        db.PaymentMethods.Remove(pm);
        if (pm.IsDefault)
        {
            var next = await db.PaymentMethods.FirstOrDefaultAsync(p => p.UserId == userId, ct);
            if (next is not null) next.IsDefault = true;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<PaymentMethodDto> SetDefaultAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var pm = await db.PaymentMethods.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct)
            ?? throw new DomainException("payment.method_not_found", "Payment method not found.");
        foreach (var other in db.PaymentMethods.Where(p => p.UserId == userId && p.IsDefault && p.Id != id)) other.IsDefault = false;
        pm.IsDefault = true;
        await db.SaveChangesAsync(ct);
        return Mappings.PaymentMethod(pm);
    }

    // ---- Invoices & charges ----
    public async Task<InvoiceDto> InvoiceForRequestAsync(Guid callerId, bool isAdmin, Guid requestId, CancellationToken ct = default)
    {
        var inv = await db.Invoices.FirstOrDefaultAsync(i => i.RequestId == requestId, ct)
            ?? throw new DomainException("payment.invoice_not_found", "Invoice not found.");
        if (!isAdmin && inv.CustomerId != callerId) throw new DomainException("auth.forbidden", "You cannot view this invoice.");
        return Mappings.Invoice(inv);
    }

    public async Task<IReadOnlyList<InvoiceDto>> InvoicesAsync(Guid userId, CancellationToken ct = default) =>
        await db.Invoices.Where(i => i.CustomerId == userId).OrderByDescending(i => i.IssuedAt)
            .Select(i => Mappings.Invoice(i)).ToListAsync(ct);

    /// <summary>Issue (idempotently) an invoice for a completed request using its approved quote or estimate.</summary>
    public async Task<InvoiceDto> EnsureInvoiceAsync(Guid requestId, CancellationToken ct = default)
    {
        var existing = await db.Invoices.FirstOrDefaultAsync(i => i.RequestId == requestId, ct);
        if (existing is not null) return Mappings.Invoice(existing);
        var r = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct)
            ?? throw new DomainException("request.not_found", "Request not found.");
        var subtotal = r.QuoteMinor ?? r.EstimateMinor ?? 0;
        var (s, _) = await settings.CurrentAsync(ct);
        var fee = subtotal >= s.ServiceFeeMinor ? s.ServiceFeeMinor : 0;
        var inv = new Invoice
        {
            Number = await Codes.NextAsync(db, "INV", ct), RequestId = requestId, CustomerId = r.CustomerId,
            SubtotalMinor = subtotal, ServiceFeeMinor = fee, TotalMinor = subtotal,
            LinesJson = JsonSerializer.Serialize(new[] { new { label = "service", amountMinor = subtotal } })
        };
        db.Invoices.Add(inv);
        await db.SaveChangesAsync(ct);
        return Mappings.Invoice(inv);
    }

    /// <summary>Charge an invoice. Idempotent by key; card failures are returned as Failed payments (never thrown away).</summary>
    public async Task<PaymentDto> PayAsync(Guid userId, Guid invoiceId, PayRequest req, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var dup = await db.Payments.FirstOrDefaultAsync(p => p.IdempotencyKey == req.IdempotencyKey, ct);
            if (dup is not null) return Mappings.Payment(dup);
        }
        var inv = await db.Invoices.FirstOrDefaultAsync(i => i.Id == invoiceId, ct)
            ?? throw new DomainException("payment.invoice_not_found", "Invoice not found.");
        if (inv.CustomerId != userId) throw new DomainException("auth.forbidden", "This invoice is not yours.");
        if (inv.Status == InvoiceStatus.Paid) throw new DomainException("payment.already_paid", "Invoice is already paid.");

        string token;
        string? reference = null;
        if (req.Method == PaymentMethodType.Card)
        {
            var pm = req.PaymentMethodId is not null
                ? await db.PaymentMethods.FirstOrDefaultAsync(p => p.Id == req.PaymentMethodId && p.UserId == userId, ct)
                : await db.PaymentMethods.FirstOrDefaultAsync(p => p.UserId == userId && p.IsDefault && p.Type == PaymentMethodType.Card, ct);
            token = req.CardToken ?? pm?.Token ?? throw new DomainException("payment.method_required", "A card is required.");
            reference = pm?.Id.ToString();
        }
        else if (req.Method == PaymentMethodType.ApplePay) token = "applepay";
        else token = "cash";

        var payment = new Payment
        {
            RequestId = inv.RequestId, BookingId = inv.BookingId, PayerId = userId, Method = req.Method,
            MethodReference = reference, AmountMinor = inv.TotalMinor, Status = PaymentStatus.Pending,
            IdempotencyKey = req.IdempotencyKey
        };
        db.Payments.Add(payment);

        if (req.Method == PaymentMethodType.Cash)
        {
            inv.Method = PaymentMethodType.Cash;
            db.PaymentReviews.Add(new PaymentReview
            {
                PaymentId = payment.Id, RequestId = inv.RequestId ?? Guid.Empty,
                RecordedMinor = inv.TotalMinor, CustomerConfirmedMinor = 0, ProviderCollectedMinor = 0
            });
            await db.SaveChangesAsync(ct);
            return Mappings.Payment(payment);
        }

        var (success, txn, reason) = await gateway.ChargeAsync(token, inv.TotalMinor,
            req.IdempotencyKey ?? payment.Id.ToString(), ct);
        payment.GatewayTransactionId = txn;
        if (success)
        {
            payment.Status = PaymentStatus.Succeeded;
            payment.SettledAt = clock.UtcNow;
            inv.Status = InvoiceStatus.Paid;
            inv.Method = req.Method;
            await CreditProviderAsync(inv, payment, ct);
            await notifier.NotifyUserAsync(userId, NotificationType.PaymentVerified, "Payment successful",
                $"Invoice {inv.Number} was paid.", $"invoice:{inv.Id}", ct);
        }
        else
        {
            payment.Status = PaymentStatus.Failed;
            payment.FailureReason = reason;
            await notifier.NotifyUserAsync(userId, NotificationType.PaymentFailed, "Payment failed",
                reason ?? "The payment was declined.", $"invoice:{inv.Id}", ct);
        }
        await db.SaveChangesAsync(ct);
        return Mappings.Payment(payment);
    }

    private async Task CreditProviderAsync(Invoice inv, Payment payment, CancellationToken ct)
    {
        var r = inv.RequestId is null ? null : await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == inv.RequestId, ct);
        if (r?.AssignedProviderId is null) return;
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == r.AssignedProviderId, ct);
        if (wallet is null) { wallet = new Wallet { UserId = r.AssignedProviderId.Value }; db.Wallets.Add(wallet); }
        var (s, _) = await settings.CurrentAsync(ct);
        var net = payment.AmountMinor - (payment.AmountMinor >= s.ServiceFeeMinor ? s.ServiceFeeMinor : 0);
        db.WalletEntries.Add(new WalletEntry
        {
            WalletId = wallet.Id, Type = WalletEntryType.JobEarning, AmountMinor = net,
            Reference = inv.Number, At = clock.UtcNow
        });
    }

    public async Task<InvoiceDto> ConfirmCashAsync(Guid customerId, Guid invoiceId, CancellationToken ct = default)
    {
        var inv = await db.Invoices.FirstOrDefaultAsync(i => i.Id == invoiceId, ct)
            ?? throw new DomainException("payment.invoice_not_found", "Invoice not found.");
        if (inv.CustomerId != customerId) throw new DomainException("auth.forbidden", "This invoice is not yours.");
        inv.CustomerCashConfirmed = true;
        var review = await db.PaymentReviews.FirstOrDefaultAsync(p => p.RequestId == inv.RequestId && p.Status == PaymentReviewStatus.Pending, ct);
        if (review is not null) review.CustomerConfirmedMinor = inv.TotalMinor;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyUserAsync(customerId, NotificationType.CashConfirmed, "Cash confirmed",
            $"You confirmed cash payment for {inv.Number}.", $"invoice:{inv.Id}", ct);
        return Mappings.Invoice(inv);
    }

    // ---- Wallet ----
    public async Task<WalletDto> WalletAsync(Guid userId, CancellationToken ct = default)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId, ct);
        if (wallet is null) return new WalletDto(Guid.Empty, 0, []);
        var entries = await db.WalletEntries.Where(e => e.WalletId == wallet.Id).OrderByDescending(e => e.At)
            .Select(e => Mappings.WalletEntry(e)).ToListAsync(ct);
        return new WalletDto(wallet.Id, entries.Sum(e => e.AmountMinor), entries);
    }

    public async Task<EarningsDto> EarningsAsync(Guid userId, CancellationToken ct = default)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId, ct);
        var entries = wallet is null ? [] : await db.WalletEntries.Where(e => e.WalletId == wallet.Id).ToListAsync(ct);
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var available = entries.Sum(e => e.AmountMinor);
        var lifetime = entries.Where(e => e.Type == WalletEntryType.JobEarning).Sum(e => e.AmountMinor);
        return new EarningsDto(available, lifetime, profile?.CompletedJobs ?? 0, profile?.Rating ?? 0, profile?.RatingCount ?? 0);
    }

    // ---- Bank accounts ----
    public async Task<IReadOnlyList<BankAccountDto>> BankAccountsAsync(Guid userId, CancellationToken ct = default) =>
        await db.BankAccounts.Where(b => b.UserId == userId).Select(b => Mappings.BankAccount(b)).ToListAsync(ct);

    public async Task<BankAccountDto> AddBankAccountAsync(Guid userId, AddBankAccountRequest req, CancellationToken ct = default)
    {
        var compact = new string(req.Iban.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (!Rules.IbanValid(compact)) throw new DomainException("payment.iban_invalid", "Invalid Egyptian IBAN.");
        var bank = await db.Banks.FirstOrDefaultAsync(b => b.Code == req.BankCode, ct)
            ?? throw new DomainException("payment.bank_invalid", "Unknown bank.");
        var account = new BankAccount
        {
            UserId = userId, HolderName = req.HolderName.Trim(), BankName = bank.NameEn,
            IbanLast4 = compact[^4..], IbanEncrypted = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(compact)),
            IsDefault = req.IsDefault || !await db.BankAccounts.AnyAsync(b => b.UserId == userId, ct)
        };
        db.BankAccounts.Add(account);
        await db.SaveChangesAsync(ct);
        return Mappings.BankAccount(account);
    }

    // ---- Withdrawals ----
    public async Task<WithdrawalDto> WithdrawAsync(Guid userId, WithdrawRequest req, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var dup = await db.Withdrawals.FirstOrDefaultAsync(w => w.IdempotencyKey == req.IdempotencyKey, ct);
            if (dup is not null) return Mappings.Withdrawal(dup);
        }
        var (s, _) = await settings.CurrentAsync(ct);
        if (req.AmountMinor < s.MinWithdrawalMinor)
            throw new DomainException("withdrawal.below_minimum", $"Minimum withdrawal is {s.MinWithdrawalMinor / 100m:0.00} EGP.");
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId, ct);
        var balance = wallet is null ? 0 : await db.WalletEntries.Where(e => e.WalletId == wallet.Id).SumAsync(e => e.AmountMinor, ct);
        if (balance < req.AmountMinor) throw new DomainException("withdrawal.insufficient", "Insufficient wallet balance.");
        var account = await db.BankAccounts.FirstOrDefaultAsync(b => b.UserId == userId && b.IsDefault && b.IsVerified, ct)
            ?? throw new DomainException("withdrawal.bank_required", "A verified default bank account is required.");
        var w = new Withdrawal
        {
            Code = await Codes.NextAsync(db, "WD", ct), UserId = userId, BankAccountId = account.Id,
            AmountMinor = req.AmountMinor, FeeMinor = s.WithdrawalFeeMinor, NetMinor = req.AmountMinor - s.WithdrawalFeeMinor,
            IdempotencyKey = req.IdempotencyKey
        };
        db.Withdrawals.Add(w);
        db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = w.Status, At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        return Mappings.Withdrawal(w);
    }

    public async Task<IReadOnlyList<WithdrawalDto>> WithdrawalsAsync(Guid userId, CancellationToken ct = default) =>
        await db.Withdrawals.Where(w => w.UserId == userId).OrderByDescending(w => w.CreatedAt)
            .Select(w => Mappings.Withdrawal(w)).ToListAsync(ct);

    private static string BrandOf(string digits) => digits.StartsWith('4') ? "Visa"
        : digits.StartsWith("5") ? "Mastercard" : digits.StartsWith("3") ? "Amex" : "Card";
}
