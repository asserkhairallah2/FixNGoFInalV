using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure;
using FixNGo.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Cli;

/// <summary>One credential row printed in dummy-db.md (brief 04 §4b).</summary>
public sealed record DummyAccount(
    int Number, string Name, string Email, string Phone, Role Role,
    UserStatus Status, KycStatus Kyc, string Password, string Notes);

/// <summary>Deterministic dummy-data generator. Produces a fresh, internally consistent database.</summary>
public static class DummyGenerator
{
    public const int DefaultSeed = 20261119;
    private const string Domain = "@dummy.fixngo.test";

    private static readonly string[] EnFirstNames =
    [
        "Ahmed", "Mohamed", "Mahmoud", "Omar", "Karim", "Hassan", "Ali", "Hany", "Tarek", "Samir",
        "Nour", "Salma", "Mona", "Dina", "Rania", "Yasmine", "Mostafa", "Amr", "Walid", "Fady"
    ];

    private static readonly string[] EnLastNames =
    [
        "Hassan", "Abdelaziz", "El-Sayed", "Mostafa", "Naguib", "Fathy", "Aly", "Sabry", "Mohamed"
    ];

    private static readonly string[] ArFirstNames =
    [
        "محمد", "أحمد", "محمود", "عمر", "كريم", "حسن", "نور", "سلمى", "منى", "ديانا"
    ];

    private static readonly string[] ArLastNames =
    [
        "عبد العزيز", "السيد", "مصطفى", "فتحى", "على", "صبرى"
    ];

    private static readonly string[] Areas =
    ["Nasr City, Cairo", "Maadi, Cairo", "Heliopolis, Cairo", "Dokki, Giza", "6th of October, Giza", "Smouha, Alexandria"];

    /// <summary>Replace the live database with a fresh dummy database and return every credential.</summary>
    public static async Task<List<DummyAccount>> GenerateAsync(RuntimePaths paths, int seed)
    {
        SqliteConnection.ClearAllPools();
        foreach (var p in new[] { paths.DbPath, paths.DbPath + "-wal", paths.DbPath + "-shm" })
            if (File.Exists(p)) File.Delete(p);
        if (Directory.Exists(paths.UploadsDir)) Directory.Delete(paths.UploadsDir, true);
        Directory.CreateDirectory(paths.UploadsDir);
        await DatabaseSetup.EnsureAsync(paths);

        var pngTemplates = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["NationalId"] = BuildCredentialPng(24, 58, 90),
            ["DrivingLicense"] = BuildCredentialPng(16, 110, 78),
            ["TruckRegistration"] = BuildCredentialPng(146, 64, 14),
            ["CommercialLicense"] = BuildCredentialPng(49, 46, 129),
            ["CenterPhoto"] = BuildCredentialPng(153, 27, 27)
        };

        var rng = new Random(seed);
        var hasher = new PasswordHasherService();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(DependencyInjection.ConnectionString(paths)).Options;
        await using var db = new AppDbContext(options);

        var accounts = new List<DummyAccount>(201);
        var owners = new List<User>(120);
        var providers = new List<User>(65);
        var centers = new List<ServiceCenter>(14);
        var vehicles = new List<Vehicle>();
        int n = 0;

        foreach (var (role, count, prefix) in new[]
        {
            (Role.Admin, 2, "Admin"), (Role.CarOwner, 120, "Owner"), (Role.Mechanic, 40, "Mech"),
            (Role.TowCaptain, 25, "Tow"), (Role.ServiceCenter, 14, "Center")
        })
        {
            for (var i = 1; i <= count; i++)
            {
                n++;
                var useArabicName = n > 2 && (n - 1) % 4 == 3;
                var first = useArabicName
                    ? ArFirstNames[(n - 1) % ArFirstNames.Length]
                    : EnFirstNames[(n - 1) % EnFirstNames.Length];
                var last = useArabicName
                    ? ArLastNames[(n - 1) % ArLastNames.Length]
                    : EnLastNames[(n - 1) % EnLastNames.Length];
                var name = $"{first} {last}";
                var email = $"{Translit(first)}.{Translit(last)}{n:D4}{Domain}".ToLowerInvariant();
                var phone = "+2010" + (10_000_000 + n * 37).ToString("D8");
                var password = $"{prefix}@{i:D4}";
                var status = role == Role.Admin ? UserStatus.Active
                    : n % 67 == 0 ? UserStatus.DeletionRequested
                    : n % 31 == 0 ? UserStatus.Suspended
                    : n % 17 == 0 ? UserStatus.PendingVerification
                    : UserStatus.Active;
                var kyc = role switch
                {
                    Role.CarOwner or Role.Admin => KycStatus.None,
                    _ => (i % 9) switch
                    {
                        1 => KycStatus.Submitted, 2 => KycStatus.UnderReview, 3 => KycStatus.ChangesNeeded,
                        4 => KycStatus.Rejected, _ => KycStatus.Approved
                    }
                };
                var area = Areas[n % Areas.Length];

                var user = new User
                {
                    FullName = name, Email = email, Phone = Rules.NormalisePhone(phone),
                    PasswordHash = hasher.Hash(password), Role = role, Status = status, KycStatus = kyc,
                    EmailVerified = true, PhoneVerified = true, IsSuperAdmin = role == Role.Admin && i == 1,
                    Language = "en", Theme = n % 2 == 0 ? "dark" : "light",
                    Latitude = 30.0 + (n % 40) / 100.0, Longitude = 31.0 + (n % 50) / 100.0, AreaLabel = area,
                    LastActiveAt = DateTime.UtcNow.AddHours(-rng.Next(1, 240))
                };
                db.Users.Add(user);
                db.NotificationPreferences.Add(new NotificationPreference { User = user, UserId = user.Id });

                var wallet = new Wallet { User = user, UserId = user.Id };
                if (role is Role.Mechanic or Role.TowCaptain or Role.ServiceCenter)
                {
                    var earned = 100_000L * (1 + rng.Next(1, 24));
                    wallet.Entries.Add(new WalletEntry
                    {
                        Wallet = wallet, WalletId = wallet.Id, Type = WalletEntryType.JobEarning,
                        AmountMinor = earned, Reference = $"DUMMY-EARN-{n:D4}",
                        At = DateTime.UtcNow.AddDays(-rng.Next(1, 30))
                    });
                }
                db.Wallets.Add(wallet);

                var notes = new StringBuilder();
                if (status == UserStatus.Suspended) notes.Append("suspended account; ");
                if (status == UserStatus.DeletionRequested) notes.Append("account deletion requested; ");
                if (status == UserStatus.PendingVerification) notes.Append("pending verification; ");
                if (kyc is KycStatus.Submitted or KycStatus.UnderReview) notes.Append("KYC in queue; ");
                if (kyc == KycStatus.ChangesNeeded) notes.Append("KYC changes needed; ");
                if (kyc == KycStatus.Rejected) notes.Append("KYC rejected; ");

                switch (role)
                {
                    case Role.CarOwner:
                        var vcount = 1 + rng.Next(3);
                        for (var v = 0; v < vcount; v++)
                        {
                            var vehicle = new Vehicle
                            {
                                Owner = user, OwnerId = user.Id, Make = v % 2 == 0 ? "Toyota" : "Hyundai",
                                Model = v % 2 == 0 ? "Corolla" : "Elantra", Year = 2015 + rng.Next(10),
                                Plate = $"{n:D3}-{rng.Next(1000, 9999)}-{v + 1}", Color = v % 2 == 0 ? "White" : "Silver",
                                Fuel = FuelType.Petrol, IsPrimary = v == 0
                            };
                            db.Vehicles.Add(vehicle);
                            vehicles.Add(vehicle);
                        }
                        owners.Add(user);
                        notes.Append($"{vcount} vehicle(s)");
                        break;
                    case Role.Mechanic:
                    case Role.TowCaptain:
                        var profile = new ProviderProfile
                        {
                            User = user, UserId = user.Id, YearsExperience = 1 + rng.Next(15),
                            ExpertiseJson = "[\"general\"]", CoverageArea = area, CoverageRadiusKm = 5 + rng.Next(15),
                            IsOnline = n % 3 != 0, Latitude = user.Latitude, Longitude = user.Longitude,
                            CompletedJobs = rng.Next(3, 90),
                            TruckType = role == Role.TowCaptain ? TruckType.Flatbed : null,
                            TruckPlate = role == Role.TowCaptain ? $"T{n:D3}-{rng.Next(1000, 9999)}" : null
                        };
                        db.ProviderProfiles.Add(profile);
                        providers.Add(user);
                        {
                            var kycApp = new KycApplication
                            {
                                User = user, UserId = user.Id, Code = $"KYC-{n:D4}", Status = kyc,
                                ApplicantType = role.ToString(), Address = area,
                                Latitude = user.Latitude, Longitude = user.Longitude,
                                ServicesJson = "[\"general\"]",
                                ReviewerNote = kyc == KycStatus.ChangesNeeded ? "Driving license photo is unclear."
                                    : kyc == KycStatus.Rejected ? "Expired identification documents." : null
                            };
                            var docTypes = role == Role.TowCaptain
                                ? new[] { "NationalId", "DrivingLicense", "TruckRegistration" }
                                : new[] { "NationalId", "DrivingLicense" };
                            AttachKycDocuments(db, paths, pngTemplates, user, kycApp, n, docTypes);
                            db.KycApplications.Add(kycApp);
                        }
                        notes.Append($"online={profile.IsOnline}, jobs={profile.CompletedJobs}");
                        break;
                    case Role.ServiceCenter:
                        var center = new ServiceCenter
                        {
                            Owner = user, OwnerId = user.Id, Name = $"{TranslitCap(first)} Auto Center",
                            Address = area, Phone = user.Phone!, Latitude = user.Latitude, Longitude = user.Longitude,
                            RecommendPercent = 70 + rng.Next(30)
                        };
                        for (var d = 0; d < 7; d++)
                            center.WorkingHours.Add(new WorkingHours
                            { Center = center, CenterId = center.Id, DayOfWeek = d, IsClosed = d == 5, OpenTime = new TimeSpan(8, 0, 0), CloseTime = new TimeSpan(18, 0, 0) });
                        for (var s = 0; s < 3; s++)
                            center.Services.Add(new CenterService
                            { Center = center, CenterId = center.Id, Name = s switch { 0 => "Full inspection", 1 => "Oil change", _ => "AC service" }, PriceMinor = 15_000L * (s + 1), DurationMinutes = 30 + s * 15 });
                        for (var b = 0; b < 2; b++)
                            center.Bays.Add(new Bay { Center = center, CenterId = center.Id, Name = $"Bay {b + 1}" });
                        center.Technicians.Add(new Technician { Center = center, CenterId = center.Id, Name = $"{first} Senior", Phone = user.Phone! });
                        db.ServiceCenters.Add(center);
                        centers.Add(center);
                        {
                            var kycApp = new KycApplication
                            {
                                User = user, UserId = user.Id, Code = $"KYC-{n:D4}", Status = kyc,
                                ApplicantType = role.ToString(), BusinessName = center.Name,
                                Address = area, Latitude = user.Latitude, Longitude = user.Longitude,
                                ServicesJson = "[\"inspection\",\"oil\"]",
                                ReviewerNote = kyc == KycStatus.ChangesNeeded ? "Please re-upload commercial registration." : null
                            };
                            AttachKycDocuments(db, paths, pngTemplates, user, kycApp, n, ["CommercialLicense", "CenterPhoto"]);
                            db.KycApplications.Add(kycApp);
                        }
                        notes.Append("full service catalog");
                        break;
                }
                accounts.Add(new DummyAccount(n, name, email, user.Phone!, role, status, kyc, password, notes.ToString().TrimEnd(' ', ';')));
            }
        }

        AddActivity(db, rng, accounts, owners, providers, centers, vehicles);
        await db.SaveChangesAsync();

        for (var i = 0; i < accounts.Count; i += 97)
            foreach (var a in accounts.Skip(i).Take(97))
                db.Notifications.Add(new Notification
                {
                    UserId = db.Users.First(u => u.Email == a.Email).Id,
                    Type = NotificationType.StatusCompleted, Title = "Welcome to FixNGo",
                    Body = "Your dummy account is ready.", IsRead = i % 2 == 0
                });
        await db.SaveChangesAsync();
        await FixNGo.Infrastructure.Persistence.DummyDataConsistencySync.SynchronizeIfDummyAsync(db);
        return accounts;
    }

    private static void AddActivity(AppDbContext db, Random rng, List<DummyAccount> accounts,
        List<User> owners, List<User> providers, List<ServiceCenter> centers, List<Vehicle> vehicles)
    {
        var admin = accounts.First(a => a.Role == Role.Admin).Email;
        var adminUser = db.Users.Local.First(u => u.Email == admin);

        var activeStatuses = new[]
        {
            RequestStatus.Searching, RequestStatus.Offered, RequestStatus.Accepted,
            RequestStatus.EnRoute, RequestStatus.Arrived, RequestStatus.QuotePending,
            RequestStatus.QuoteApproved, RequestStatus.Working, RequestStatus.AwaitingPayment,
            RequestStatus.Disputed
        };

        for (var i = 0; i < 140; i++)
        {
            var owner = owners[i % owners.Count];
            var provider = providers.Count > 0 ? providers[(i * 7) % providers.Count] : null;
            var kind = i % 2 == 0 ? RequestKind.Tow : RequestKind.Mechanic;
            var status = i < activeStatuses.Length ? activeStatuses[i]
                : i % 17 == 0 ? RequestStatus.NoProviders
                : i % 10 == 0 ? RequestStatus.Cancelled
                : RequestStatus.Completed;
            var created = DateTime.UtcNow.AddDays(-rng.Next(0, 30)).AddHours(-rng.Next(0, 12));
            var request = new ServiceRequest
            {
                Code = $"{(kind == RequestKind.Tow ? "FG" : "MR")}-{20260000 + i}", CustomerId = owner.Id,
                VehicleId = vehicles.Count > 0 ? vehicles[(i * 3) % vehicles.Count].Id : null,
                Kind = kind, Status = status, Priority = i == 19 ? RequestPriority.P0 : RequestPriority.Normal,
                AssignedProviderId = status is RequestStatus.Searching or RequestStatus.NoProviders ? null : provider?.Id,
                PickupLatitude = 30.04 + i % 30 / 1000.0,
                PickupLongitude = 31.23 + i % 40 / 1000.0, PickupAddress = Areas[i % Areas.Length],
                DestinationAddress = kind == RequestKind.Tow ? Areas[(i + 1) % Areas.Length] : null,
                DistanceKm = 2 + rng.Next(18), RadiusKm = 5, SettingsVersion = 1,
                EstimateMinor = 20_000L + rng.Next(80) * 1000L, CreatedAt = created
            };
            request.Events.Add(new RequestEvent { Request = request, RequestId = request.Id, Status = RequestStatus.Searching, At = created });
            if (status == RequestStatus.Disputed)
            {
                db.Disputes.Add(new Dispute
                {
                    Request = request, RequestId = request.Id,
                    Reason = "Estimate labor charge higher than expected",
                    ProposedResolution = "Adjust labor to standard rate"
                });
            }
            if (status == RequestStatus.Completed)
            {
                request.AcceptedAt = created.AddMinutes(8);
                request.CompletedAt = created.AddHours(1);
                request.Events.Add(new RequestEvent { Request = request, RequestId = request.Id, Status = RequestStatus.Completed, At = request.CompletedAt.Value });
                var method = i % 3 == 0 ? PaymentMethodType.Cash : i % 5 == 0 ? PaymentMethodType.ApplePay : PaymentMethodType.Card;
                db.Invoices.Add(new Invoice
                {
                    Number = $"INV-2026-{i:D4}", RequestId = request.Id, CustomerId = owner.Id,
                    SubtotalMinor = request.EstimateMinor ?? 25_000L, ServiceFeeMinor = 5_000L,
                    TotalMinor = (request.EstimateMinor ?? 25_000L) + 5_000L, Status = InvoiceStatus.Paid,
                    Method = method, IssuedAt = request.CompletedAt.Value
                });
                var payment = new Payment
                {
                    RequestId = request.Id, PayerId = owner.Id, AmountMinor = (request.EstimateMinor ?? 25_000L) + 5_000L,
                    Method = method,
                    Status = i == 25 ? PaymentStatus.Failed : PaymentStatus.Succeeded,
                    FailureReason = i == 25 ? "card_declined" : null,
                    SettledAt = request.CompletedAt.Value,
                    IdempotencyKey = $"DUMMY-PAY-{i:D4}"
                };
                db.Payments.Add(payment);
                if (method == PaymentMethodType.Cash && i < 30)
                {
                    db.PaymentReviews.Add(new PaymentReview
                    {
                        Payment = payment, PaymentId = payment.Id, RequestId = request.Id,
                        RecordedMinor = payment.AmountMinor, CustomerConfirmedMinor = payment.AmountMinor,
                        ProviderCollectedMinor = payment.AmountMinor,
                        Status = i % 2 == 0 ? PaymentReviewStatus.Pending : PaymentReviewStatus.Resolved,
                        Note = i % 2 == 0 ? null : "Verified cash reconciliation"
                    });
                }
                if (provider is not null && i % 4 == 0)
                    db.Reviews.Add(new Review
                    {
                        TargetType = ReviewTargetType.Provider, ProviderId = provider.Id, RequestId = request.Id,
                        AuthorId = owner.Id, Stars = 4 + (i % 2), Text = "Prompt and professional roadside service.", Recommend = true
                    });
                if (provider is not null && i < 20)
                {
                    var thread = new ChatThread { Request = request, RequestId = request.Id, CustomerId = owner.Id, CounterpartId = provider.Id };
                    thread.Messages.Add(new ChatMessage { Thread = thread, ThreadId = thread.Id, SenderId = provider.Id, Text = "I am heading to your pickup pin now." });
                    thread.Messages.Add(new ChatMessage { Thread = thread, ThreadId = thread.Id, SenderId = owner.Id, Text = "Thank you, hazard lights are on." });
                    db.ChatThreads.Add(thread);
                }
            }
            db.ServiceRequests.Add(request);
        }

        var bookingStatuses = new[]
        {
            BookingStatus.Pending, BookingStatus.Confirmed, BookingStatus.InProgress,
            BookingStatus.Completed, BookingStatus.Rejected, BookingStatus.Cancelled, BookingStatus.Expired
        };
        var woStatuses = new[]
        {
            WorkOrderStatus.Assigned, WorkOrderStatus.InProgress, WorkOrderStatus.ReadyForReview, WorkOrderStatus.Closed
        };

        for (var i = 0; i < 45 && centers.Count > 0; i++)
        {
            var center = centers[i % centers.Count];
            var service = center.Services.ElementAt(i % center.Services.Count);
            var customer = owners[(i * 11) % owners.Count];
            var slot = DateTime.UtcNow.AddDays(-rng.Next(0, 25)).AddHours(9 + i % 8);
            var bStatus = i < bookingStatuses.Length ? bookingStatuses[i]
                : i % 9 == 0 ? BookingStatus.Cancelled
                : i % 7 == 0 ? BookingStatus.Pending
                : BookingStatus.Completed;
            var booking = new Booking
            {
                Code = $"BK-{20260000 + i}", CenterId = center.Id, Center = center, CustomerId = customer.Id,
                Customer = customer, ServiceId = service.Id, Service = service,
                SlotStart = slot, SlotEnd = slot.AddMinutes(service.DurationMinutes), PriceMinor = service.PriceMinor,
                Status = bStatus
            };
            if (bStatus is BookingStatus.Confirmed or BookingStatus.InProgress or BookingStatus.Completed)
            {
                var woStatus = bStatus == BookingStatus.Completed ? WorkOrderStatus.Closed : woStatuses[i % woStatuses.Length];
                booking.WorkOrders.Add(new WorkOrder
                {
                    Booking = booking, BookingId = booking.Id, Center = center, CenterId = center.Id,
                    BayId = center.Bays.Count > 0 ? center.Bays.First().Id : null,
                    Code = $"WO-{20260000 + i}", Status = woStatus
                });
            }
            if (booking.Status == BookingStatus.Completed)
            {
                db.Invoices.Add(new Invoice
                {
                    Number = $"INV-SC-{i:D4}", BookingId = booking.Id, CustomerId = customer.Id,
                    SubtotalMinor = service.PriceMinor, TotalMinor = service.PriceMinor,
                    Status = InvoiceStatus.Paid, Method = PaymentMethodType.Card, IssuedAt = slot
                });
            }
            db.Bookings.Add(booking);
        }

        var wdStatuses = Enum.GetValues<WithdrawalStatus>();
        for (var i = 0; i < Math.Min(10, providers.Count); i++)
        {
            var prov = providers[i];
            var bank = new BankAccount
            {
                User = prov, UserId = prov.Id, HolderName = prov.FullName,
                BankName = "National Bank of Egypt", IbanLast4 = (1000 + i).ToString("D4"),
                IbanEncrypted = "RUcyOTA...", IsDefault = true, IsVerified = true
            };
            db.BankAccounts.Add(bank);
            db.Withdrawals.Add(new Withdrawal
            {
                Code = $"WD-2611-{i + 1:D3}", User = prov, UserId = prov.Id,
                BankAccount = bank, BankAccountId = bank.Id,
                AmountMinor = 50_000L, FeeMinor = 0, NetMinor = 50_000L,
                Status = wdStatuses[i % wdStatuses.Length],
                FailureReason = wdStatuses[i % wdStatuses.Length] == WithdrawalStatus.Failed ? "Bank rejected transfer" : null
            });
        }

        var safetyStatuses = Enum.GetValues<SafetyReportStatus>();
        for (var i = 0; i < 6; i++)
        {
            var reporter = owners[i % owners.Count];
            db.SafetyReports.Add(new SafetyReport
            {
                Category = i % 2 == 0 ? "Driver conduct" : "Pricing dispute",
                ReporterId = reporter.Id,
                ReportedUserId = providers.Count > 0 ? providers[i % providers.Count].Id : null,
                Description = $"Dummy safety report #{i + 1} for review queue.",
                Status = safetyStatuses[i % safetyStatuses.Length],
                ReviewNote = safetyStatuses[i % safetyStatuses.Length] == SafetyReportStatus.Open ? null : "Reviewed by trust & safety."
            });
        }

        var ticketStatuses = Enum.GetValues<TicketStatus>();
        for (var i = 0; i < 18; i++)
        {
            var owner = owners[(i * 5) % owners.Count];
            var tStatus = ticketStatuses[i % ticketStatuses.Length];
            var ticket = new SupportTicket
            {
                Code = $"SUP-{20260000 + i}", UserId = owner.Id, User = owner,
                Category = i % 2 == 0 ? "Payment" : "Account", Subject = $"Dummy support case {i + 1}",
                Description = "Generated for the realistic dummy dataset.",
                Status = tStatus
            };
            ticket.Messages.Add(new SupportMessage { Ticket = ticket, TicketId = ticket.Id, FromSupport = false, Text = "I need help with my account." });
            if (ticket.Status is TicketStatus.Answered or TicketStatus.Closed)
                ticket.Messages.Add(new SupportMessage { Ticket = ticket, TicketId = ticket.Id, FromSupport = true, AuthorName = "FixNGo Support", Text = "We have looked into this for you." });
            db.SupportTickets.Add(ticket);
        }

        for (var i = 0; i < 20; i++)
            db.AuditLogs.Add(new AuditLog
            {
                ActorId = adminUser.Id, Action = "DummyData.AdminAction", EntityType = "User",
                EntityId = accounts[(i * 13) % accounts.Count].Email, Note = "Generated dummy audit entry"
            });
    }

    /// <summary>Write root dummy-db.md listing every generated credential (brief 04 §4b).</summary>
    public static string WriteCredentialsMarkdown(RuntimePaths paths, IReadOnlyList<DummyAccount> accounts, int seed)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Dummy database credentials");
        sb.AppendLine();
        sb.AppendLine($"- Generated: {DateTime.UtcNow:o}");
        sb.AppendLine($"- Seed: {seed}");
        sb.AppendLine("- **DUMMY DATA — NOT REAL — run `restore-db.bat` to return to your real data**");
        sb.AppendLine($"- Total accounts: {accounts.Count}");
        sb.AppendLine();
        sb.AppendLine("## Counts by role and status");
        sb.AppendLine("| Role | Total | Active | Suspended | PendingVerification | DeletionRequested |");
        sb.AppendLine("|---|---:|---:|---:|---:|---:|");
        foreach (var role in Enum.GetValues<Role>())
        {
            var rAcc = accounts.Where(a => a.Role == role).ToList();
            sb.AppendLine($"| {role} | {rAcc.Count} | {rAcc.Count(a => a.Status == UserStatus.Active)} | {rAcc.Count(a => a.Status == UserStatus.Suspended)} | {rAcc.Count(a => a.Status == UserStatus.PendingVerification)} | {rAcc.Count(a => a.Status == UserStatus.DeletionRequested)} |");
        }
        sb.AppendLine();

        sb.AppendLine("## Provider KYC status counts");
        sb.AppendLine("| KYC Status | Count |");
        sb.AppendLine("|---|---:|");
        foreach (var kyc in Enum.GetValues<KycStatus>())
            sb.AppendLine($"| {kyc} | {accounts.Count(a => a.Kyc == kyc)} |");
        sb.AppendLine();

        foreach (var role in Enum.GetValues<Role>())
        {
            sb.AppendLine($"## {RoleHeading(role)}");
            sb.AppendLine("| # | Name | Email | Phone | Role | Account status | KYC status | Password | Notes |");
            sb.AppendLine("|---:|---|---|---|---|---|---|---|---|");
            foreach (var a in accounts.Where(a => a.Role == role))
                sb.AppendLine($"| {a.Number} | {a.Name} | {a.Email} | {a.Phone} | {a.Role} | {a.Status} | {a.Kyc} | `{a.Password}` | {a.Notes} |");
            sb.AppendLine();
        }

        var admin1 = accounts.FirstOrDefault(a => a.Role == Role.Admin);
        var suspendedUser = accounts.FirstOrDefault(a => a.Status == UserStatus.Suspended);
        var pendingKyc = accounts.FirstOrDefault(a => a.Kyc == KycStatus.Submitted);
        var changesKyc = accounts.FirstOrDefault(a => a.Kyc == KycStatus.ChangesNeeded);

        sb.AppendLine("## Suggested test scenarios");
        sb.AppendLine($"- **Admin dashboard & queues:** Log in as `{admin1?.Email}` (`{admin1?.Password}`) to see non-zero counters, KYC queue, payment reviews, and safety reports.");
        sb.AppendLine("- **Active roadside request & tracking:** Log in as the first CarOwner account to view active and completed requests.");
        if (pendingKyc is not null)
            sb.AppendLine($"- **Pending KYC application:** Log in as `{pendingKyc.Email}` (`{pendingKyc.Password}`) to see A11 `Submitted` state.");
        if (changesKyc is not null)
            sb.AppendLine($"- **Changes-needed KYC application:** Log in as `{changesKyc.Email}` (`{changesKyc.Password}`) to test document replacement on A11/SH18.");
        if (suspendedUser is not null)
            sb.AppendLine($"- **Suspended account:** Attempt login as `{suspendedUser.Email}` (`{suspendedUser.Password}`) to verify suspended-account blocking (HTTP 403).");
        sb.AppendLine();
        sb.AppendLine("Every active credential above logs in with `POST /api/v1/auth/login` using its email and password.");

        var path = Path.Combine(paths.Root, "dummy-db.md");
        File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
        return path;
    }

    private static string RoleHeading(Role role) => role switch
    {
        Role.Admin => "Admins", Role.CarOwner => "Car owners", Role.Mechanic => "Mechanics",
        Role.TowCaptain => "Tow captains", Role.ServiceCenter => "Service centers", _ => role.ToString()
    };

    private static readonly Dictionary<string, string> KnownArabicNames = new(StringComparer.Ordinal)
    {
        ["محمد"] = "mohamed", ["أحمد"] = "ahmed", ["محمود"] = "mahmoud", ["عمر"] = "omar",
        ["كريم"] = "karim", ["حسن"] = "hassan", ["نور"] = "nour", ["سلمى"] = "salma",
        ["منى"] = "mona", ["ديانا"] = "diana", ["عبد العزيز"] = "abdelaziz", ["السيد"] = "elsayed",
        ["مصطفى"] = "mostafa", ["فتحى"] = "fathy", ["على"] = "aly", ["صبرى"] = "sabry"
    };

    private static string Translit(string value)
    {
        if (KnownArabicNames.TryGetValue(value.Trim(), out var mapped)) return mapped;
        var sb = new StringBuilder();
        foreach (var c in value)
        {
            if (c < 128)
            {
                if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
                continue;
            }
            sb.Append(c switch
            {
                'ا' or 'أ' or 'إ' or 'آ' or 'ى' or 'ة' or 'ع' => "a",
                'ب' => "b", 'ت' or 'ط' => "t", 'ث' => "th", 'ج' => "g",
                'ح' or 'ه' => "h", 'خ' => "kh", 'د' or 'ض' => "d",
                'ذ' or 'ز' or 'ظ' => "z", 'ر' => "r", 'س' or 'ص' => "s",
                'ش' => "sh", 'غ' => "gh", 'ف' => "f", 'ق' or 'ك' => "k",
                'ل' => "l", 'م' => "m", 'ن' => "n", 'و' => "w", 'ي' or 'ئ' => "y",
                _ => ""
            });
        }
        return sb.Length > 0 ? sb.ToString() : "user";
    }

    private static string TranslitCap(string value)
    {
        var t = Translit(value);
        return char.ToUpperInvariant(t[0]) + t[1..];
    }

    private static void AttachKycDocuments(
        AppDbContext db,
        RuntimePaths paths,
        IReadOnlyDictionary<string, byte[]> pngTemplates,
        User user,
        KycApplication kycApp,
        int accountNum,
        string[] docTypes)
    {
        for (var idx = 0; idx < docTypes.Length; idx++)
        {
            var docType = docTypes[idx];
            var png = pngTemplates[docType];
            var slug = docType.ToLowerInvariant();
            var storedName = $"dummy-kyc-{accountNum:D4}-{slug}.png";
            File.WriteAllBytes(Path.Combine(paths.UploadsDir, storedName), png);

            var file = new UploadedFile
            {
                FileName = $"{slug}-{accountNum:D4}.png",
                StoredName = storedName,
                ContentType = "image/png",
                SizeBytes = png.Length,
                OwnerId = user.Id,
                Purpose = "kyc"
            };
            db.UploadedFiles.Add(file);

            var docStatus = kycApp.Status switch
            {
                KycStatus.Approved => DocumentStatus.Approved,
                KycStatus.Rejected => DocumentStatus.Rejected,
                KycStatus.ChangesNeeded => idx == docTypes.Length - 1 ? DocumentStatus.Rejected : DocumentStatus.Approved,
                _ => DocumentStatus.Pending
            };

            kycApp.Documents.Add(new KycDocument
            {
                Application = kycApp,
                ApplicationId = kycApp.Id,
                DocumentType = docType,
                File = file,
                FileId = file.Id,
                Status = docStatus,
                ReviewNote = docStatus == DocumentStatus.Rejected ? kycApp.ReviewerNote : null,
                ReviewedAt = docStatus == DocumentStatus.Pending ? null : DateTime.UtcNow.AddDays(-2)
            });
        }
    }

    private static byte[] BuildCredentialPng(byte hdrR, byte hdrG, byte hdrB)
    {
        const int width = 320;
        const int height = 200;
        var raw = new byte[height * (1 + width * 3)];
        var pos = 0;

        for (var y = 0; y < height; y++)
        {
            raw[pos++] = 0; // filter: None
            for (var x = 0; x < width; x++)
            {
                byte r = 246, g = 248, b = 252;
                var border = x == 0 || x == width - 1 || y == 0 || y == height - 1;
                if (border)
                {
                    r = 203; g = 213; b = 225;
                }
                else if (y < 38)
                {
                    r = hdrR; g = hdrG; b = hdrB;
                    if (y is >= 14 and <= 23 && x is >= 20 and <= 150) { r = 255; g = 255; b = 255; }
                }
                else if (x is >= 22 and <= 102 && y is >= 58 and <= 154)
                {
                    r = 226; g = 232; b = 240;
                    var dx = x - 62;
                    var dyHead = y - 88;
                    if (dx * dx + dyHead * dyHead <= 196 || (y >= 116 && Math.Abs(dx) <= 26))
                    {
                        r = 148; g = 163; b = 184;
                    }
                }
                else if (x is >= 122 and <= 268 && y is >= 62 and <= 71)
                {
                    r = 30; g = 41; b = 59;
                }
                else if (x is >= 122 and <= 236 && y is >= 84 and <= 91)
                {
                    r = 100; g = 116; b = 139;
                }
                else if (x is >= 122 and <= 284 && y is >= 104 and <= 111)
                {
                    r = 148; g = 163; b = 184;
                }
                else if (x is >= 122 and <= 214 && y is >= 124 and <= 131)
                {
                    r = 148; g = 163; b = 184;
                }
                else if (x is >= 246 and <= 296 && y is >= 158 and <= 176)
                {
                    r = 16; g = 185; b = 129;
                }

                raw[pos++] = r;
                raw[pos++] = g;
                raw[pos++] = b;
            }
        }

        using var idat = new MemoryStream();
        using (var zlib = new ZLibStream(idat, CompressionLevel.Fastest, leaveOpen: true))
        {
            zlib.Write(raw, 0, raw.Length);
        }

        using var png = new MemoryStream();
        png.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        Span<byte> ihdr = stackalloc byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(ihdr[..4], width);
        BinaryPrimitives.WriteUInt32BigEndian(ihdr.Slice(4, 4), height);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 2; // RGB
        WritePngChunk(png, "IHDR"u8, ihdr);
        WritePngChunk(png, "IDAT"u8, idat.ToArray());
        WritePngChunk(png, "IEND"u8, ReadOnlySpan<byte>.Empty);
        return png.ToArray();
    }

    private static void WritePngChunk(Stream output, ReadOnlySpan<byte> type, ReadOnlySpan<byte> data)
    {
        Span<byte> lenBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(lenBytes, (uint)data.Length);
        output.Write(lenBytes);
        output.Write(type);
        if (!data.IsEmpty) output.Write(data);

        var crc = 0xFFFFFFFFu;
        crc = UpdateCrc32(crc, type);
        crc = UpdateCrc32(crc, data);
        Span<byte> crcBytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crcBytes, ~crc);
        output.Write(crcBytes);
    }

    private static uint UpdateCrc32(uint crc, ReadOnlySpan<byte> bytes)
    {
        foreach (var b in bytes)
        {
            crc ^= b;
            for (var k = 0; k < 8; k++)
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
        }
        return crc;
    }
}
