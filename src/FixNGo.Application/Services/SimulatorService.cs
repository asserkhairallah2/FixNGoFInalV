using System.Security.Cryptography;
using System.Text;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FixNGo.Application.Services;

/// <summary>
/// Functional simulator dock. All state lives in the real SQLite database: SimMessage,
/// SimPaymentTransaction, SimPush, OtpCode, Payment, PaymentMethod, User and ProviderProfile rows.
/// The fake IOtpSender / IPaymentGateway / INotifier ports are used for the writes they own.
/// </summary>
public sealed class SimulatorService(
    IAppDbContext db,
    IClock clock,
    IOtpSender otpSender,
    IPaymentGateway gateway,
    INotifier notifier,
    ILogger<SimulatorService> logger) : ISimulatorService
{
    private const int MaxOtpAttempts = 5;
    private static readonly TimeSpan OtpTtl = TimeSpan.FromMinutes(2);

    // ---------------- Notifications ----------------

    public async Task<IReadOnlyList<SimPushDto>> ListPushesAsync(Guid callerId, bool all, CancellationToken ct = default)
    {
        var pushes = await db.SimPushes.Where(p => all || p.UserId == callerId)
            .OrderByDescending(p => p.CreatedAt).Take(200).ToListAsync(ct);
        var inApp = await db.Notifications.Where(n => all || n.UserId == callerId)
            .OrderByDescending(n => n.CreatedAt).Take(200).ToListAsync(ct);
        return pushes.Select(FromPush).Concat(inApp.Select(FromNotification))
            .OrderByDescending(d => d.CreatedAt).Take(200).ToList();
    }

    public async Task<SimActionResult> SendPushAsync(Guid callerId, SimSendPushRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) throw new DomainException("sim.title_required", "A title is required.");
        var userId = req.UserId ?? callerId;
        if (!await db.Users.AnyAsync(u => u.Id == userId, ct))
            throw new DomainException("user.not_found", "User not found.");
        await notifier.PushAsync(userId, req.Title.Trim(), req.Body, req.DeepLink, ct);
        logger.LogInformation("Simulator push recorded for {UserId}", userId);
        return new SimActionResult(true);
    }

    public async Task<SimMarkReadResult> MarkPushesReadAsync(SimMarkReadRequest req, CancellationToken ct = default)
    {
        var updated = 0;
        var source = req.Source;
        foreach (var id in req.Ids.Distinct())
        {
            var changed = false;
            if (!string.Equals(source, "notification", StringComparison.OrdinalIgnoreCase))
            {
                var push = await db.SimPushes.FirstOrDefaultAsync(p => p.Id == id, ct);
                if (push is not null && !push.IsRead) { push.IsRead = true; changed = true; updated++; }
            }
            if (!changed && !string.Equals(source, "push", StringComparison.OrdinalIgnoreCase))
            {
                var note = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id, ct);
                if (note is not null && !note.IsRead) { note.IsRead = true; note.ReadAt = clock.UtcNow; updated++; }
            }
        }
        if (updated > 0) await db.SaveChangesAsync(ct);
        return new SimMarkReadResult(updated);
    }

    public async Task<SimMarkReadResult> MarkAllPushesReadAsync(Guid callerId, CancellationToken ct = default)
    {
        var updated = 0;
        foreach (var p in db.SimPushes.Where(p => p.UserId == callerId && !p.IsRead)) { p.IsRead = true; updated++; }
        foreach (var n in db.Notifications.Where(n => n.UserId == callerId && !n.IsRead))
        { n.IsRead = true; n.ReadAt = clock.UtcNow; updated++; }
        if (updated > 0) await db.SaveChangesAsync(ct);
        return new SimMarkReadResult(updated);
    }

    // ---------------- Fake payment gateway ----------------

    public async Task<IReadOnlyList<SimPaymentDto>> ListPaymentsAsync(CancellationToken ct = default) =>
        await db.SimPaymentTransactions.OrderByDescending(t => t.CreatedAt).Take(300)
            .Select(t => new SimPaymentDto(t.Id, t.Reference, t.Payer, t.Method.ToString(),
                t.AmountMinor, t.Status, t.FailureReason, t.RequiresApproval, t.PaymentId, t.CreatedAt))
            .ToListAsync(ct);

    public async Task<SimCardTokenDto> TokeniseCardAsync(Guid userId, SimTokeniseRequest req, CancellationToken ct = default)
    {
        var digits = new string(req.Number.Where(char.IsDigit).ToArray());
        if (!Rules.Luhn(digits)) throw new DomainException("payment.card_invalid", "Invalid card number.");
        if (req.ExpMonth < 1 || req.ExpMonth > 12 || req.ExpYear < clock.UtcNow.Year)
            throw new DomainException("payment.expiry_invalid", "Invalid expiry date.");

        // The raw PAN is never persisted: only a provider-shaped token and the last four digits.
        var token = "tok_fake_" + RandomLetters(16);
        var method = new PaymentMethod
        {
            UserId = userId, Type = PaymentMethodType.Card, Last4 = digits[^4..],
            ExpMonth = req.ExpMonth, ExpYear = req.ExpYear, Token = token,
            Label = req.Label, IsDefault = !await db.PaymentMethods.AnyAsync(p => p.UserId == userId, ct)
        };
        db.PaymentMethods.Add(method);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Simulator tokenised a card for {UserId}", userId);
        return new SimCardTokenDto(token, method.Last4!, method.Id);
    }

    public async Task<SimChargeResult> ChargeAsync(Guid userId, SimChargeRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Token)) throw new DomainException("payment.method_required", "A token is required.");
        if (req.AmountMinor <= 0) throw new DomainException("payment.amount_invalid", "Amount must be positive.");
        var token = req.Token.Trim();
        var reference = string.IsNullOrWhiteSpace(req.Reference) ? Guid.NewGuid().ToString("N") : req.Reference.Trim();

        var existingPayment = await db.Payments.FirstOrDefaultAsync(p => p.IdempotencyKey == reference, ct);
        if (existingPayment is not null)
        {
            var existingTx = await db.SimPaymentTransactions.FirstOrDefaultAsync(t => t.Reference == reference, ct);
            return new SimChargeResult(existingTx?.Id ?? Guid.Empty, reference, existingPayment.Id,
                existingPayment.Status.ToString(), existingPayment.FailureReason);
        }

        var method = await db.PaymentMethods.FirstOrDefaultAsync(p => p.UserId == userId && p.Token == token, ct)
            ?? throw new DomainException("payment.method_not_found", "Tokenised card not found.");

        var (success, txn, reason) = await gateway.ChargeAsync(token, req.AmountMinor, reference, ct);
        var tx = await db.SimPaymentTransactions.FirstOrDefaultAsync(t => t.Reference == reference, ct)
            ?? throw new DomainException("sim.transaction_missing", "Gateway did not record the transaction.");
        tx.Payer = method.Last4 is null ? "Card" : $"Card ••{method.Last4}";
        tx.RequiresApproval = req.RequiresApproval;
        if (req.RequiresApproval) { tx.Status = "Pending"; success = false; }

        var payment = new Payment
        {
            PayerId = userId, Method = method.Type, MethodReference = method.Id.ToString(),
            AmountMinor = req.AmountMinor,
            Status = req.RequiresApproval ? PaymentStatus.Pending
                : success ? PaymentStatus.Succeeded : PaymentStatus.Failed,
            FailureReason = req.RequiresApproval ? null : reason,
            GatewayTransactionId = txn ?? reference, IdempotencyKey = reference,
            SettledAt = success && !req.RequiresApproval ? clock.UtcNow : null
        };
        db.Payments.Add(payment);
        tx.PaymentId = payment.Id;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Simulator charge {Reference} status {Status}", reference, tx.Status);
        return new SimChargeResult(tx.Id, reference, payment.Id, tx.Status, tx.FailureReason);
    }

    public async Task<SimPaymentDto> SetPaymentStatusAsync(Guid transactionId, string status, CancellationToken ct = default)
    {
        var canonical = status.Trim().ToLowerInvariant() switch
        {
            "succeeded" or "approved" => "Succeeded",
            "failed" or "declined" => "Failed",
            "refunded" => "Refunded",
            _ => throw new DomainException("sim.invalid_status", "Unknown simulator payment status.")
        };
        var tx = await db.SimPaymentTransactions.FirstOrDefaultAsync(t => t.Id == transactionId, ct)
            ?? throw new DomainException("sim.transaction_not_found", "Transaction not found.");
        tx.Status = canonical;
        if (canonical == "Failed") tx.FailureReason ??= "simulator_declined";
        if (tx.PaymentId is { } paymentId)
        {
            var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId, ct);
            if (payment is not null)
            {
                payment.Status = canonical switch
                {
                    "Succeeded" => PaymentStatus.Succeeded,
                    "Failed" => PaymentStatus.Failed,
                    _ => PaymentStatus.Refunded
                };
                if (canonical == "Succeeded") payment.SettledAt = clock.UtcNow;
            }
        }
        await db.SaveChangesAsync(ct);
        return new SimPaymentDto(tx.Id, tx.Reference, tx.Payer, tx.Method.ToString(), tx.AmountMinor,
            tx.Status, tx.FailureReason, tx.RequiresApproval, tx.PaymentId, tx.CreatedAt);
    }

    public async Task<IReadOnlyList<SimWithdrawalDto>> ListWithdrawalsAsync(CancellationToken ct = default)
    {
        var rows = await db.Withdrawals.OrderByDescending(w => w.CreatedAt).Take(200).ToListAsync(ct);
        var names = await db.Users.ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        return rows.Select(w => new SimWithdrawalDto(w.Id, w.Code, w.UserId,
            names.GetValueOrDefault(w.UserId), w.AmountMinor, w.NetMinor, w.Status.ToString(),
            w.FailureReason, w.CreatedAt)).ToList();
    }

    public async Task<SimWithdrawalDto> AdvanceWithdrawalAsync(Guid id, CancellationToken ct = default)
    {
        var w = await db.Withdrawals.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("withdrawal.not_found", "Withdrawal not found.");
        var next = w.Status switch
        {
            WithdrawalStatus.Requested => WithdrawalStatus.Processing,
            WithdrawalStatus.Processing => WithdrawalStatus.Sent,
            WithdrawalStatus.Sent => WithdrawalStatus.Confirmed,
            WithdrawalStatus.Failed => throw new DomainException("withdrawal.finished", "Withdrawal already failed."),
            _ => w.Status
        };
        if (next != w.Status)
        {
            w.Status = next;
            db.WithdrawalEvents.Add(new WithdrawalEvent { WithdrawalId = w.Id, Status = next, At = clock.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        return new SimWithdrawalDto(w.Id, w.Code, w.UserId, null, w.AmountMinor, w.NetMinor,
            w.Status.ToString(), w.FailureReason, w.CreatedAt);
    }

    public async Task<SimWithdrawalDto> FailWithdrawalAsync(Guid id, string? reason, CancellationToken ct = default)
    {
        var w = await db.Withdrawals.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException("withdrawal.not_found", "Withdrawal not found.");
        w.Status = WithdrawalStatus.Failed;
        w.FailureReason = string.IsNullOrWhiteSpace(reason) ? "simulator_failed" : reason.Trim();
        db.WithdrawalEvents.Add(new WithdrawalEvent
        {
            WithdrawalId = w.Id, Status = WithdrawalStatus.Failed, At = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return new SimWithdrawalDto(w.Id, w.Code, w.UserId, null, w.AmountMinor, w.NetMinor,
            w.Status.ToString(), w.FailureReason, w.CreatedAt);
    }

    // ---------------- Fake SMS / email inbox ----------------

    public async Task<IReadOnlyList<SimMessageDto>> ListMessagesAsync(SimChannel? channel, CancellationToken ct = default)
    {
        var q = db.SimMessages.AsQueryable();
        if (channel.HasValue) q = q.Where(m => m.Channel == channel.Value);
        var rows = await q.OrderByDescending(m => m.CreatedAt).Take(300).ToListAsync(ct);
        return rows.Select(FromMessage).ToList();
    }

    public async Task<SimMessageDto> SendMessageAsync(SimSendMessageRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Recipient)) throw new DomainException("sim.recipient_required", "A recipient is required.");
        if (string.IsNullOrWhiteSpace(req.Body)) throw new DomainException("sim.body_required", "A body is required.");
        var message = new SimMessage
        {
            Channel = req.Channel, Recipient = req.Recipient.Trim(), RecipientName = req.RecipientName,
            Body = req.Body.Trim(), OtpCode = req.OtpCode, Purpose = req.Purpose
        };
        db.SimMessages.Add(message);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Simulator {Channel} message recorded for {Recipient}", req.Channel, message.Recipient);
        return FromMessage(message);
    }

    public async Task<SimMarkReadResult> MarkMessagesReadAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        var updated = 0;
        foreach (var m in db.SimMessages.Where(m => ids.Contains(m.Id) && !m.IsRead)) { m.IsRead = true; updated++; }
        if (updated > 0) await db.SaveChangesAsync(ct);
        return new SimMarkReadResult(updated);
    }

    // ---------------- OTP panel ----------------

    public async Task<IReadOnlyList<SimOtpDto>> ListOtpsAsync(CancellationToken ct = default)
    {
        var codes = await db.OtpCodes.OrderByDescending(o => o.CreatedAt).Take(100).ToListAsync(ct);
        var messages = await db.SimMessages.Where(m => m.OtpCode != null)
            .OrderByDescending(m => m.CreatedAt).Take(300).ToListAsync(ct);
        var now = clock.UtcNow;
        return codes.Select(o =>
        {
            var candidates = messages.Where(m => m.OtpCode is not null
                && FixedEquals(Hash(m.OtpCode), o.CodeHash)
                && string.Equals(m.Recipient, o.Target, StringComparison.OrdinalIgnoreCase)).ToList();
            var message = candidates.FirstOrDefault(m => string.Equals(m.Purpose, o.Purpose.ToString(),
                StringComparison.OrdinalIgnoreCase)) ?? candidates.FirstOrDefault();
            var seconds = (int)Math.Max(0, (o.ExpiresAt - now).TotalSeconds);
            return new SimOtpDto(o.Id, o.Target, message?.RecipientName, o.Purpose.ToString(),
                message?.OtpCode ?? string.Empty, (message?.Channel ?? SimChannel.Sms).ToString(),
                o.ExpiresAt, seconds, Math.Max(0, MaxOtpAttempts - o.Attempts), o.ResendCount, o.Consumed);
        }).ToList();
    }

    public async Task<SimOtpDto> GenerateOtpAsync(SimOtpGenerateRequest req, CancellationToken ct = default)
    {
        var target = req.Target?.Trim();
        if (string.IsNullOrWhiteSpace(target)) throw new DomainException("sim.target_required", "A target is required.");
        var code = RandomDigits(6);
        var now = clock.UtcNow;
        var otp = new OtpCode
        {
            Target = target!, Purpose = req.Purpose, CodeHash = Hash(code), ExpiresAt = now.Add(OtpTtl)
        };
        db.OtpCodes.Add(otp);
        await otpSender.SendAsync(target!, req.RecipientName, req.Channel, code, req.Purpose.ToString(), ct);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Simulator OTP generated for {Target} purpose {Purpose}", target, req.Purpose);
        return new SimOtpDto(otp.Id, otp.Target, req.RecipientName, otp.Purpose.ToString(), code,
            req.Channel.ToString(), otp.ExpiresAt, (int)OtpTtl.TotalSeconds, MaxOtpAttempts, 0, false);
    }

    public async Task<SimOtpVerifyResult> VerifyOtpAsync(SimOtpVerifyRequest req, CancellationToken ct = default)
    {
        var target = req.Target?.Trim();
        if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(req.Code))
            return new SimOtpVerifyResult(false, "invalid");
        var otp = await db.OtpCodes
            .Where(o => o.Target == target && o.Purpose == req.Purpose && !o.Consumed)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct);
        if (otp is null) return new SimOtpVerifyResult(false, "not_found");
        if (!Rules.OtpAllowed(otp.ExpiresAt, otp.Attempts, otp.Consumed, clock.UtcNow))
            return new SimOtpVerifyResult(false, "expired");
        if (!FixedEquals(Hash(req.Code.Trim()), otp.CodeHash))
        {
            otp.Attempts++;
            await db.SaveChangesAsync(ct);
            return new SimOtpVerifyResult(false, "invalid");
        }
        otp.Consumed = true;
        await db.SaveChangesAsync(ct);
        return new SimOtpVerifyResult(true);
    }

    // ---------------- GPS / maps panel ----------------

    public async Task<IReadOnlyList<SimGpsDto>> ListGpsAsync(Guid callerId, Guid? userId, bool all, CancellationToken ct = default)
    {
        if (userId.HasValue)
        {
            var one = await db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value, ct)
                ?? throw new DomainException("user.not_found", "User not found.");
            var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == one.Id, ct);
            return [FromUser(one, profile)];
        }
        var users = all
            ? await db.Users.Where(u => u.Latitude != null || u.Longitude != null).ToListAsync(ct)
            : await db.Users.Where(u => u.Id == callerId).ToListAsync(ct);
        var ids = users.Select(u => u.Id).ToList();
        var profiles = await db.ProviderProfiles.Where(p => ids.Contains(p.UserId)).ToListAsync(ct);
        var result = new List<SimGpsDto>();
        foreach (var u in users)
            result.Add(FromUser(u, profiles.FirstOrDefault(p => p.UserId == u.Id)));
        return result.OrderBy(d => d.FullName, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<SimGpsDto> SetGpsAsync(Guid callerId, SimGpsSetRequest req, CancellationToken ct = default)
    {
        ValidateCoordinates(req.Latitude, req.Longitude);
        var target = req.UserId ?? callerId;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == target, ct)
            ?? throw new DomainException("user.not_found", "User not found.");
        user.Latitude = req.Latitude;
        user.Longitude = req.Longitude;
        var inferredLabel = req.AreaLabel ?? InferCairoDistrict(req.Latitude, req.Longitude);
        if (!string.IsNullOrWhiteSpace(inferredLabel)) user.AreaLabel = inferredLabel;
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == target, ct);
        if (profile is not null)
        {
            profile.Latitude = req.Latitude;
            profile.Longitude = req.Longitude;
            if (!string.IsNullOrWhiteSpace(inferredLabel)) profile.CoverageArea = inferredLabel;
            profile.LastHeartbeatAt = clock.UtcNow;
            var activeRequests = await db.ServiceRequests
                .Where(r => r.AssignedProviderId == target && r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled)
                .ToListAsync(ct);
            await db.SaveChangesAsync(ct);
            foreach (var r in activeRequests)
            {
                await notifier.NotifyLocationAsync(r.CustomerId, r.Id, req.Latitude, req.Longitude, ct);
                await notifier.NotifyLocationAsync(target, r.Id, req.Latitude, req.Longitude, ct);
            }
            return FromUser(user, profile);
        }
        await db.SaveChangesAsync(ct);
        await notifier.NotifyLocationAsync(target, null, req.Latitude, req.Longitude, ct);
        return FromUser(user, profile);
    }

    public async Task<SimDriveResult> DriveAsync(SimDriveRequest req, CancellationToken ct = default)
    {
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == req.ProviderId, ct)
            ?? throw new DomainException("provider.profile_not_found", "Provider profile not found.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == req.ProviderId, ct);

        double? toLat = req.TargetLatitude;
        double? toLon = req.TargetLongitude;
        if (req.TargetUserId.HasValue)
        {
            var target = await db.Users.FirstOrDefaultAsync(u => u.Id == req.TargetUserId.Value, ct)
                ?? throw new DomainException("user.not_found", "Target user not found.");
            toLat = target.Latitude;
            toLon = target.Longitude;
        }
        if (toLat is null || toLon is null)
        {
            var activeReq = await db.ServiceRequests
                .Where(r => r.AssignedProviderId == req.ProviderId && r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (activeReq is not null)
            {
                toLat = activeReq.PickupLatitude;
                toLon = activeReq.PickupLongitude;
            }
            else
            {
                toLat ??= 30.0444;
                toLon ??= 31.2357;
            }
        }
        var fromLat = profile.Latitude ?? user?.Latitude ?? (toLat.Value - 0.015);
        var fromLon = profile.Longitude ?? user?.Longitude ?? (toLon.Value - 0.015);
        ValidateCoordinates(toLat.Value, toLon.Value);

        var route = BuildRoute(fromLat, fromLon, toLat.Value, toLon.Value, req.Steps, req.SpeedKmh);
        var last = route.Points[^1];
        var inferredLabel = InferCairoDistrict(last.Latitude, last.Longitude);
        profile.Latitude = last.Latitude;
        profile.Longitude = last.Longitude;
        if (!string.IsNullOrWhiteSpace(inferredLabel)) profile.CoverageArea = inferredLabel;
        profile.LastHeartbeatAt = clock.UtcNow;
        if (user is not null)
        {
            user.Latitude = last.Latitude;
            user.Longitude = last.Longitude;
            if (!string.IsNullOrWhiteSpace(inferredLabel)) user.AreaLabel = inferredLabel;
        }
        var activeRequests = await db.ServiceRequests
            .Where(r => r.AssignedProviderId == req.ProviderId && r.Status != RequestStatus.Completed && r.Status != RequestStatus.Cancelled)
            .ToListAsync(ct);
        await db.SaveChangesAsync(ct);
        foreach (var r in activeRequests)
        {
            await notifier.NotifyLocationAsync(r.CustomerId, r.Id, last.Latitude, last.Longitude, ct);
            await notifier.NotifyLocationAsync(req.ProviderId, r.Id, last.Latitude, last.Longitude, ct);
        }
        var gps = FromUser(user ?? new User { Id = req.ProviderId }, profile);
        logger.LogInformation("Simulator moved provider {ProviderId} over {DistanceKm} km", req.ProviderId, route.DistanceKm);
        return new SimDriveResult(req.ProviderId, gps, route);
    }

    public async Task<SimActionResult> GoStaleAsync(Guid providerId, CancellationToken ct = default)
    {
        var profile = await db.ProviderProfiles.FirstOrDefaultAsync(p => p.UserId == providerId, ct)
            ?? throw new DomainException("provider.profile_not_found", "Provider profile not found.");
        profile.LastHeartbeatAt = clock.UtcNow.AddMinutes(-10);
        await db.SaveChangesAsync(ct);
        return new SimActionResult(true, "Heartbeat stopped.");
    }

    // ---------------- Helpers ----------------

    private static SimMessageDto FromMessage(SimMessage m) => new(m.Id, m.Channel.ToString(), m.Recipient,
        m.RecipientName, m.Body, m.OtpCode, m.Purpose, m.IsRead, m.CreatedAt);

    private static SimPushDto FromPush(SimPush p) => new(p.Id, "push", p.UserId, p.UserName,
        p.Title, p.Body, p.DeepLink, p.IsRead, p.CreatedAt);

    private static SimPushDto FromNotification(Notification n) => new(n.Id, "notification", n.UserId, null,
        n.Title, n.Body, n.DeepLink, n.IsRead, n.CreatedAt);

    private static SimGpsDto FromUser(User u, ProviderProfile? p) => new(u.Id, u.FullName,
        p?.Latitude ?? u.Latitude ?? 0, p?.Longitude ?? u.Longitude ?? 0,
        p?.CoverageArea ?? u.AreaLabel, p?.IsOnline ?? false, p?.LastHeartbeatAt,
        p is null ? "user" : "provider");

    private static string InferCairoDistrict(double lat, double lon)
    {
        (string Name, double Lat, double Lon)[] districts =
        [
            ("Tahrir · Downtown Cairo", 30.0444, 31.2357),
            ("Nasr City · Cairo", 30.0561, 31.3301),
            ("Heliopolis · Cairo", 30.0875, 31.3242),
            ("Maadi · Cairo", 29.9602, 31.2569),
            ("New Cairo · 5th Settlement", 30.0074, 31.4913),
            ("Mohandessin · Giza", 30.0566, 31.2001),
            ("Dokki · Giza", 30.0385, 31.2122),
            ("6th of October · Giza", 29.9723, 30.9435),
            ("Zamalek · Cairo", 30.0609, 31.2197)
        ];
        var closest = districts.OrderBy(d => HaversineKm(lat, lon, d.Lat, d.Lon)).First();
        return closest.Name;
    }

    private static void ValidateCoordinates(double lat, double lon)
    {
        if (lat is < -90 or > 90 || lon is < -180 or > 180)
            throw new DomainException("sim.gps_invalid", "Coordinates are out of range.");
    }

    private static SimRouteDto BuildRoute(double fromLat, double fromLon, double toLat, double toLon,
        int steps, double speedKmh)
    {
        var count = Math.Clamp(steps, 2, 6);
        var directKm = HaversineKm(fromLat, fromLon, toLat, toLon);
        var distanceKm = directKm * 1.3;
        var speed = speedKmh <= 0 ? 30d : speedKmh;
        var etaMinutes = (int)Math.Ceiling(distanceKm / speed * 60);
        var points = Enumerable.Range(0, count).Select(i =>
        {
            var t = i / (double)(count - 1);
            return new SimGpsPoint(
                Math.Round(fromLat + (toLat - fromLat) * t, 6),
                Math.Round(fromLon + (toLon - fromLon) * t, 6),
                i, (int)Math.Round(etaMinutes * 60 * (1 - t)));
        }).ToList();
        return new SimRouteDto(Math.Round(distanceKm, 3), etaMinutes, points);
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radiusKm = 6371d;
        static double Rad(double degrees) => degrees * Math.PI / 180d;
        var dLat = Rad(lat2 - lat1);
        var dLon = Rad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * radiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static string RandomDigits(int count)
    {
        var bytes = RandomNumberGenerator.GetBytes(count);
        return string.Concat(bytes.Select(b => (char)('0' + (b % 10))));
    }

    private static string RandomLetters(int count)
    {
        const string alphabet = "abcdefghijklmnopqrstuvwxyz";
        var bytes = RandomNumberGenerator.GetBytes(count);
        return string.Concat(bytes.Select(b => alphabet[b % alphabet.Length]));
    }

    private static string Hash(string value) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static bool FixedEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}
