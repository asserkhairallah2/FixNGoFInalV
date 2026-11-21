using System.Net;
using FixNGo.Domain;
using FluentAssertions;

namespace FixNGo.Api.Tests;

[Collection("api")]
public sealed class Round6PlatformFixesTests(ApiTestHost host)
{
    private async Task<Guid> ServiceType(string key)
    {
        using var c = host.Client(ApiTestHost.Owner);
        var (_, body) = await Http.Get(c, "/api/v1/lookups/bootstrap");
        foreach (var st in body.GetProperty("serviceTypes").EnumerateArray())
            if (st.GetProperty("key").GetString() == key) return st.GetProperty("id").GetGuid();
        throw new InvalidOperationException($"service type {key} not seeded");
    }

    [Fact]
    public async Task SmallMechanicQuote_ProportionalFee_UpdatesEarlyInvoice_AndCashPaymentCreditsWallet()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);

        // Ensure mechanic is online with fresh heartbeat
        (await Http.Post(mechanic, "/api/v1/providers/online", new { isOnline = true, latitude = 30.0444, longitude = 31.2357 }))
            .Item1.Should().Be(HttpStatusCode.OK);

        var (_, walletBefore) = await Http.Get(mechanic, "/api/v1/payments/wallet");
        var balanceBefore = walletBefore.GetProperty("balanceMinor").GetInt64();

        var batteryType = await ServiceType("battery");
        var (codeReq, reqBody) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId = (Guid?)null,
            serviceTypeId = batteryType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Tahrir Square, Cairo",
            distanceKm = 0.0,
            problem = "Battery dead",
            answersJson = "{}"
        });
        codeReq.Should().Be(HttpStatusCode.OK);
        var requestId = reqBody.GuidOf("id");

        // Even if an invoice is ensured early (when EstimateMinor = 20000), a subsequent small quote MUST update it!
        var (_, earlyInv) = await Http.Post(owner, $"/api/v1/payments/invoices/request/{requestId}/ensure", new { });
        earlyInv.LongOf("totalMinor").Should().Be(20000);

        // Dispatch & accept
        var (_, offer) = await Http.Post(owner, $"/api/v1/requests/{requestId}/offers", new { providerId = host.Id(ApiTestHost.Mechanic) });
        (await Http.Post(mechanic, $"/api/v1/offers/{offer.GuidOf("id")}/accept", new { })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = nameof(RequestStatus.EnRoute) })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = nameof(RequestStatus.Arrived) })).Item1.Should().Be(HttpStatusCode.OK);

        // Mechanic submits a small 50 EGP (5000 minor) quote -> 10% fee = 500 minor (5 EGP) -> Total = 5500 minor (55 EGP)
        var (codeQ, quote) = await Http.Post(mechanic, $"/api/v1/requests/{requestId}/quotes",
            new { calloutMinor = 5000, laborMinor = 0, partsMinor = 0, diagnosis = "Quick terminal clean & jump" });
        codeQ.Should().Be(HttpStatusCode.OK);
        quote.LongOf("providerNetMinor").Should().Be(5000);
        quote.LongOf("serviceFeeMinor").Should().Be(500);
        quote.LongOf("totalMinor").Should().Be(5500);

        (await Http.Post(owner, $"/api/v1/requests/{requestId}/quotes/{quote.GuidOf("id")}/approve", new { })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = nameof(RequestStatus.Working) })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(mechanic, $"/api/v1/requests/{requestId}/status", new { status = nameof(RequestStatus.AwaitingPayment) })).Item1.Should().Be(HttpStatusCode.OK);

        // Fetching invoice now reflects 5500 minor (55 EGP), NEVER stuck on 20000 (200 EGP)!
        var (_, updatedInv) = await Http.Get(owner, $"/api/v1/payments/invoices/request/{requestId}");
        updatedInv.LongOf("totalMinor").Should().Be(5500);
        updatedInv.LongOf("subtotalMinor").Should().Be(5000);
        updatedInv.LongOf("serviceFeeMinor").Should().Be(500);

        // Customer pays by Cash -> immediately settles Paid AND credits Mechanic wallet by 5000 minor!
        var (codePay, payBody) = await Http.Post(owner, $"/api/v1/payments/invoices/{updatedInv.GuidOf("id")}/pay",
            new { method = nameof(PaymentMethodType.Cash), idempotencyKey = $"cash-{requestId:N}" });
        codePay.Should().Be(HttpStatusCode.OK);
        payBody.Text("status").Should().Be(nameof(PaymentStatus.Succeeded));

        var (_, walletAfter) = await Http.Get(mechanic, "/api/v1/payments/wallet");
        walletAfter.GetProperty("balanceMinor").GetInt64().Should().Be(balanceBefore + 5000);
    }

    [Fact]
    public async Task PublicProfile_And_GeoLookups_ReturnValidData()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        var mechId = host.Id(ApiTestHost.Mechanic);

        var (codeProf, prof) = await Http.Get(owner, $"/api/v1/providers/{mechId}/public-profile");
        codeProf.Should().Be(HttpStatusCode.OK);
        prof.GuidOf("id").Should().Be(mechId);
        prof.GetProperty("isVerified").GetBoolean().Should().BeTrue();

        var (codeGeo, geo) = await Http.Get(owner, "/api/v1/lookups/geocode?q=Maadi");
        codeGeo.Should().Be(HttpStatusCode.OK);
        geo.GetArrayLength().Should().BeGreaterThan(0);

        var (codeRev, rev) = await Http.Get(owner, "/api/v1/lookups/reverse-geocode?lat=30.0444&lng=31.2357");
        codeRev.Should().Be(HttpStatusCode.OK);
        rev.Text("address").Should().NotBeNullOrWhiteSpace();

        var (codeRoute, route) = await Http.Get(owner, "/api/v1/lookups/route?originLat=30.0444&originLng=31.2357&destLat=30.0561&destLng=31.3301");
        codeRoute.Should().Be(HttpStatusCode.OK);
        route.GetProperty("distanceKm").GetDouble().Should().BeGreaterThan(0);
    }
}
