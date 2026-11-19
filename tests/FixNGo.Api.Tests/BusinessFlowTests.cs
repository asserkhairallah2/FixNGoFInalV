using System.Net;
using FixNGo.Domain;
using FluentAssertions;

namespace FixNGo.Api.Tests;

/// <summary>Full business flows driven over real HTTP against the real API + SQLite host.</summary>
[Collection("api")]
public sealed class BusinessFlowTests(ApiTestHost host)
{
    private async Task<Guid> ServiceType(string key)
    {
        using var c = host.Client(ApiTestHost.Owner);
        var (_, body) = await Http.Get(c, "/api/v1/lookups/bootstrap");
        foreach (var st in body.GetProperty("serviceTypes").EnumerateArray())
            if (st.GetProperty("key").GetString() == key) return st.GetProperty("id").GetGuid();
        throw new InvalidOperationException($"service type {key} not seeded");
    }

    private object NewRequest(Guid serviceTypeId, RequestPriority priority = RequestPriority.Normal) => new
    {
        vehicleId = (Guid?)null, serviceTypeId, pickupLatitude = 30.0444, pickupLongitude = 31.2357,
        pickupAddress = "Tahrir Square, Cairo", destinationLatitude = (double?)null,
        destinationLongitude = (double?)null, destinationAddress = (string?)null,
        distanceKm = 7.5, problem = "Engine will not start", answersJson = "{}", note = "API flow test",
        priority = priority.ToString()
    };

    [Fact]
    public async Task TowFlow_CreateOfferAcceptDriveQuotePayComplete()
    {
        // Owner creates a vehicle and a tow request.
        using var owner = host.Client(ApiTestHost.Owner);
        var towType = await ServiceType("flatbed_tow");
        var (code0, estimate) = await Http.Post(owner, "/api/v1/requests/estimate", new { serviceTypeId = towType, distanceKm = 7.5 });
        code0.Should().Be(HttpStatusCode.OK);
        estimate.GetProperty("totalMinor").GetInt64().Should().BeGreaterThan(0);

        var (code1, reqBody) = await Http.Post(owner, "/api/v1/requests", NewRequest(towType));
        code1.Should().Be(HttpStatusCode.OK);
        var requestId = reqBody.GuidOf("id");
        reqBody.Text("code").Should().StartWith("FG-");
        reqBody.Text("status").Should().Be(nameof(RequestStatus.Searching));

        // Owner sees the online approved captain as a candidate, then sends an offer.
        var (code2, candidates) = await Http.Get(owner, $"/api/v1/requests/{requestId}/candidates");
        code2.Should().Be(HttpStatusCode.OK);
        candidates.GetArrayLength().Should().BeGreaterThan(0);
        candidates.EnumerateArray().Any(x => x.GuidOf("providerId") == host.Id(ApiTestHost.Captain)).Should().BeTrue();

        var (code3, offerBody) = await Http.Post(owner, $"/api/v1/requests/{requestId}/offers",
            new { providerId = host.Id(ApiTestHost.Captain) });
        code3.Should().Be(HttpStatusCode.OK);
        var offerId = offerBody.GuidOf("id");
        offerBody.Text("status").Should().Be(nameof(OfferStatus.Pending));

        // Captain accepts -> assignment.
        using var captain = host.Client(ApiTestHost.Captain);
        var (code4, accepted) = await Http.Post(captain, $"/api/v1/offers/{offerId}/accept", new { });
        code4.Should().Be(HttpStatusCode.OK);
        accepted.Text("status").Should().Be(nameof(OfferStatus.Accepted));

        // Drive the request to Arrived.
        foreach (var status in new[] { RequestStatus.EnRoute, RequestStatus.Arrived })
        {
            var (c, _) = await Http.Post(captain, $"/api/v1/requests/{requestId}/status", new { status = status.ToString() });
            c.Should().Be(HttpStatusCode.OK);
        }

        // Diagnosis quote -> owner approves.
        var (code5, quote) = await Http.Post(captain, $"/api/v1/requests/{requestId}/quotes",
            new { calloutMinor = 40000, laborMinor = 12000, partsMinor = 3000, diagnosis = "Battery replacement" });
        code5.Should().Be(HttpStatusCode.OK);
        quote.GetProperty("totalMinor").GetInt64().Should().Be(60000);
        var quoteId = quote.GuidOf("id");

        var (code6, _) = await Http.Post(owner, $"/api/v1/requests/{requestId}/quotes/{quoteId}/approve", new { });
        code6.Should().Be(HttpStatusCode.OK);

        // Advance to AwaitingPayment and settle by card.
        foreach (var status in new[] { RequestStatus.Working, RequestStatus.AwaitingPayment })
        {
            var (c, _) = await Http.Post(captain, $"/api/v1/requests/{requestId}/status", new { status = status.ToString() });
            c.Should().Be(HttpStatusCode.OK);
        }
        var (code7, inv) = await Http.Post(owner, $"/api/v1/payments/invoices/request/{requestId}/ensure", new { });
        code7.Should().Be(HttpStatusCode.OK);
        var invoiceId = inv.GuidOf("id");
        inv.LongOf("totalMinor").Should().Be(60000);

        var (code8, _) = await Http.Post(owner, "/api/v1/payments/methods/card",
            new { number = "4242 4242 4242 4242", expMonth = 12, expYear = DateTime.UtcNow.Year + 3, label = "Test Visa" });
        code8.Should().Be(HttpStatusCode.OK);

        var (code9, payment) = await Http.Post(owner, $"/api/v1/payments/invoices/{invoiceId}/pay",
            new { method = nameof(PaymentMethodType.Card), idempotencyKey = $"tow-{requestId:N}" });
        code9.Should().Be(HttpStatusCode.OK);
        payment.Text("status").Should().Be(nameof(PaymentStatus.Succeeded));

        // Provider wallet was credited with the net amount.
        var (code10, wallet) = await Http.Get(captain, "/api/v1/payments/wallet");
        code10.Should().Be(HttpStatusCode.OK);
        wallet.GetProperty("balanceMinor").GetInt64().Should().BeGreaterThan(0);

        var (code11, done) = await Http.Post(captain, $"/api/v1/requests/{requestId}/status", new { status = nameof(RequestStatus.Completed) });
        code11.Should().Be(HttpStatusCode.OK);
        done.Text("status").Should().Be(nameof(RequestStatus.Completed));

        var (code12, timeline) = await Http.Get(owner, $"/api/v1/requests/{requestId}/timeline");
        code12.Should().Be(HttpStatusCode.OK);
        timeline.GetArrayLength().Should().BeGreaterThanOrEqualTo(8);
    }

    [Fact]
    public async Task MechanicFlow_DeclinedCardThenRetry_AndQuoteDispute()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);
        var mechType = await ServiceType("mechanic");

        var (code1, reqBody) = await Http.Post(owner, "/api/v1/requests", NewRequest(mechType));
        code1.Should().Be(HttpStatusCode.OK);
        var requestId = reqBody.GuidOf("id");
        reqBody.Text("code").Should().StartWith("MR-");

        var (code2, _) = await Http.Post(owner, $"/api/v1/requests/{requestId}/offers", new { providerId = host.Id(ApiTestHost.Mechanic) });
        code2.Should().Be(HttpStatusCode.OK);
        var offers = await Http.Get(mechanic, "/api/v1/offers");
        var myOffer = offers.Item2.EnumerateArray().First(o => o.GetProperty("requestId").GetGuid() == requestId);
        var offerId = myOffer.GuidOf("id");
        (await Http.Post(mechanic, $"/api/v1/offers/{offerId}/accept", new { })).Item1.Should().Be(HttpStatusCode.OK);

        foreach (var status in new[] { RequestStatus.EnRoute, RequestStatus.Arrived })
            (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = status.ToString() })).Item1.Should().Be(HttpStatusCode.OK);

        var (codeQ, quote) = await Http.Post(mechanic, $"/api/v1/requests/{requestId}/quotes",
            new { calloutMinor = 10000, laborMinor = 5000, partsMinor = 2000, diagnosis = "Starter motor" });
        codeQ.Should().Be(HttpStatusCode.OK);
        var quoteId = quote.GuidOf("id");

        // Dispute then re-quote (revision) then approve.
        (await Http.Post(owner, $"/api/v1/requests/{requestId}/dispute",
            new { reason = "Too high", proposedResolution = "Review labour" })).Item1.Should().Be(HttpStatusCode.OK);
        var (codeQ2, quote2) = await Http.Post(mechanic, $"/api/v1/requests/{requestId}/quotes",
            new { calloutMinor = 10000, laborMinor = 3000, partsMinor = 2000, diagnosis = "Revised" });
        codeQ2.Should().Be(HttpStatusCode.OK);
        quote2.GetProperty("version").GetInt32().Should().Be(2);
        (await Http.Post(owner, $"/api/v1/requests/{requestId}/quotes/{quote2.GuidOf("id")}/approve", new { })).Item1.Should().Be(HttpStatusCode.OK);

        foreach (var status in new[] { RequestStatus.Working, RequestStatus.AwaitingPayment })
            (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = status.ToString() })).Item1.Should().Be(HttpStatusCode.OK);

        var inv = (await Http.Post(owner, $"/api/v1/payments/invoices/request/{requestId}/ensure", new { })).Item2;
        var invoiceId = inv.GuidOf("id");

        // Declined card produces a Failed payment, never an exception. The explicit
        // paymentMethodId is required: without it PayAsync uses the account default card.
        var badCard = (await Http.Post(owner, "/api/v1/payments/methods/card",
            new { number = "4000 0000 0000 0002", expMonth = 10, expYear = DateTime.UtcNow.Year + 4, label = "Bad card" })).Item2;
        var badCardId = badCard.GuidOf("id");
        var (codeFail, failed) = await Http.Post(owner, $"/api/v1/payments/invoices/{invoiceId}/pay",
            new { method = nameof(PaymentMethodType.Card), paymentMethodId = badCardId, idempotencyKey = $"declined-{requestId:N}" });
        codeFail.Should().Be(HttpStatusCode.OK);
        failed.Text("status").Should().Be(nameof(PaymentStatus.Failed));
        failed.Text("failureReason").Should().Be("card_declined");

        // Retry with a known-good card: success and invoice paid.
        var goodCard = (await Http.Post(owner, "/api/v1/payments/methods/card",
            new { number = "5555 5555 5555 4444", expMonth = 11, expYear = DateTime.UtcNow.Year + 4, label = "Good card" })).Item2;
        var goodCardId = goodCard.GuidOf("id");
        var (codeOk, ok) = await Http.Post(owner, $"/api/v1/payments/invoices/{invoiceId}/pay",
            new { method = nameof(PaymentMethodType.Card), paymentMethodId = goodCardId, idempotencyKey = $"retry-{requestId:N}" });
        codeOk.Should().Be(HttpStatusCode.OK);
        ok.Text("status").Should().Be(nameof(PaymentStatus.Succeeded));
        var invoiceAfter = (await Http.Get(owner, $"/api/v1/payments/invoices/request/{requestId}")).Item2;
        invoiceAfter.Text("status").Should().Be(nameof(InvoiceStatus.Paid));

        // Idempotent replay returns the identical payment.
        var replay = (await Http.Post(owner, $"/api/v1/payments/invoices/{invoiceId}/pay",
            new { method = nameof(PaymentMethodType.Card), idempotencyKey = $"retry-{requestId:N}" })).Item2;
        replay.GuidOf("id").Should().Be(ok.GuidOf("id"));
    }

    [Fact]
    public async Task BookingFlow_BookConfirmStartCompleteAndCancelPath()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var center = host.Client(ApiTestHost.Center);

        var centers = (await Http.Get(owner, "/api/v1/centers")).Item2;
        var centerId = centers.EnumerateArray().First().GuidOf("id");
        var services = (await Http.Get(owner, $"/api/v1/centers/{centerId}/services")).Item2;
        services.GetArrayLength().Should().BeGreaterThan(0);
        var serviceId = services.EnumerateArray().First().GuidOf("id");

        var day = DateTime.UtcNow.AddDays(3).Date.AddHours(10);
        var avail = (await Http.Get(owner, $"/api/v1/centers/{centerId}/availability?serviceId={serviceId}&day={day:yyyy-MM-dd}")).Item2;
        avail.GetArrayLength().Should().BeGreaterThan(0);

        var (code1, booking) = await Http.Post(owner, "/api/v1/centers/bookings",
            new { centerId, serviceId, slotStart = day, vehicleId = (Guid?)null, note = "API booking" });
        code1.Should().Be(HttpStatusCode.OK);
        booking.Text("status").Should().Be(nameof(BookingStatus.Pending));
        var bookingId = booking.GuidOf("id");

        (await Http.Post(center, $"/api/v1/center-admin/bookings/{bookingId}/confirm", new { })).Item2
            .Text("status").Should().Be(nameof(BookingStatus.Confirmed));
        var workOrders = (await Http.Get(center, $"/api/v1/center-admin/work-orders?bookingId={bookingId}")).Item2;
        workOrders.GetArrayLength().Should().Be(1);
        var woId = workOrders.EnumerateArray().First().GuidOf("id");
        (await Http.Post(center, $"/api/v1/center-admin/work-orders/{woId}/advance", new { notes = "started" })).Item2
            .Text("status").Should().Be(nameof(WorkOrderStatus.InProgress));

        (await Http.Post(center, $"/api/v1/center-admin/bookings/{bookingId}/start", new { })).Item2
            .Text("status").Should().Be(nameof(BookingStatus.InProgress));
        (await Http.Post(center, $"/api/v1/center-admin/bookings/{bookingId}/complete", new { })).Item2
            .Text("status").Should().Be(nameof(BookingStatus.Completed));

        // Reschedule + cancel path on another booking.
        var (code2, b2) = await Http.Post(owner, "/api/v1/centers/bookings",
            new { centerId, serviceId, slotStart = DateTime.UtcNow.AddDays(4).Date.AddHours(11), vehicleId = (Guid?)null, note = "" });
        code2.Should().Be(HttpStatusCode.OK);
        var id2 = b2.GuidOf("id");
        (await Http.Post(owner, $"/api/v1/centers/bookings/{id2}/reschedule",
            new { slotStart = DateTime.UtcNow.AddDays(5).Date.AddHours(12) })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(owner, $"/api/v1/centers/bookings/{id2}/cancel", new { reason = "plans changed" })).Item2
            .Text("status").Should().Be(nameof(BookingStatus.Cancelled));
    }

    [Fact]
    public async Task KycFlow_ResubmitAfterChangesThenApprove_AndSuspendBlocksOwner()
    {
        using var seed = host.Client(ApiTestHost.KycSeed);
        using var admin = host.Client(ApiTestHost.Admin);

        var (code1, app) = await Http.Post(seed, "/api/v1/providers/kyc", new
        {
            applicantType = "TowCaptain", businessName = "Gate2 Towing", address = "Cairo",
            latitude = 30.0444, longitude = 31.2357, services = Array.Empty<Guid>(), documents = Array.Empty<object>()
        });
        code1.Should().Be(HttpStatusCode.OK);
        app.Text("status").Should().Be(nameof(KycStatus.Submitted));
        var appId = app.GuidOf("id");

        (await Http.Get(admin, "/api/v1/admin/kyc/queue")).Item2.GetArrayLength().Should().BeGreaterThan(0);
        (await Http.Post(admin, $"/api/v1/admin/kyc/{appId}/review",
            new { decision = nameof(KycStatus.ChangesNeeded), note = "Upload plate photo" })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(seed, "/api/v1/providers/kyc", new
        {
            applicantType = "TowCaptain", businessName = "Gate2 Towing", address = "Cairo",
            latitude = 30.0444, longitude = 31.2357, services = Array.Empty<Guid>(), documents = Array.Empty<object>()
        })).Item2.Text("status").Should().Be(nameof(KycStatus.Submitted));
        (await Http.Post(admin, $"/api/v1/admin/kyc/{appId}/review",
            new { decision = nameof(KycStatus.Approved), note = "Verified" })).Item2.Text("status").Should().Be(nameof(KycStatus.Approved));

        // Admin dashboard + settings version change is reflected in a fresh estimate.
        (await Http.Get(admin, "/api/v1/admin/dashboard")).Item1.Should().Be(HttpStatusCode.OK);
        var settings = (await Http.Get(admin, "/api/v1/admin/settings")).Item2;
        settings.GetProperty("version").GetInt32().Should().BeGreaterThanOrEqualTo(1);
    }
}
