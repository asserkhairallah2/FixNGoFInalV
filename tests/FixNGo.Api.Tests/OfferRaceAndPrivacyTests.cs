using System.Net;
using FixNGo.Domain;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Api.Tests;

/// <summary>Two concurrency/privacy guarantees from the SRS that need real HTTP + SQLite proof.</summary>
[Collection("api")]
public sealed class OfferRaceAndPrivacyTests(ApiTestHost host)
{
    private async Task<Guid> TowType()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        var boot = (await Http.Get(owner, "/api/v1/lookups/bootstrap")).Item2;
        return boot.GetProperty("serviceTypes").EnumerateArray()
            .First(s => s.GetProperty("key").GetString() == "flatbed_tow").GetProperty("id").GetGuid();
    }

    private object NewRequest(Guid type) => new
    {
        vehicleId = (Guid?)null, serviceTypeId = type, pickupLatitude = 30.0444, pickupLongitude = 31.2357,
        pickupAddress = "Tahrir Square, Cairo", destinationLatitude = (double?)null,
        destinationLongitude = (double?)null, destinationAddress = (string?)null,
        distanceKm = 6.0, problem = "Tow me", answersJson = "{}", note = "race/privacy test",
        priority = nameof(RequestPriority.Normal)
    };

    [Fact]
    public async Task OfferRace_TwoCaptainsAcceptConcurrently_ExactlyOneWins()
    {
        var type = await TowType();
        using var owner = host.Client(ApiTestHost.Owner);
        var req = (await Http.Post(owner, "/api/v1/requests", NewRequest(type))).Item2;
        var requestId = req.GuidOf("id");

        var o1 = (await Http.Post(owner, $"/api/v1/requests/{requestId}/offers",
            new { providerId = host.Id(ApiTestHost.Captain) })).Item2;
        var o2 = (await Http.Post(owner, $"/api/v1/requests/{requestId}/offers",
            new { providerId = host.Id(ApiTestHost.Captain2) })).Item2;
        var offer1 = o1.GuidOf("id");
        var offer2 = o2.GuidOf("id");

        using var c1 = host.Client(ApiTestHost.Captain);
        using var c2 = host.Client(ApiTestHost.Captain2);

        // Fire both accepts in parallel — SQLite serialises writes; the conditional updates
        // must still yield exactly one accepted offer and one assigned provider.
        var tasks = new[]
        {
            Http.Post(c1, $"/api/v1/offers/{offer1}/accept", new { }),
            Http.Post(c2, $"/api/v1/offers/{offer2}/accept", new { })
        };
        var results = await Task.WhenAll(tasks);

        results.Count(r => r.Item1 == HttpStatusCode.OK).Should().Be(1,
            "exactly one captain must win the race");
        results.All(r => r.Item1 is HttpStatusCode.OK or HttpStatusCode.Conflict).Should().BeTrue(
            "the loser must get a conflict, never a 500");

        var statuses = await host.WithDb(async db =>
        {
            var offers = await db.Offers.Where(o => o.RequestId == requestId)
                .Select(o => o.Status).ToArrayAsync();
            var st = await db.ServiceRequests.FindAsync(requestId);
            return (Offers: offers, Status: st!.Status, Provider: st.AssignedProviderId);
        });
        statuses.Offers.Count(s => s == OfferStatus.Accepted).Should().Be(1);
        statuses.Status.Should().Be(RequestStatus.Accepted);
        (statuses.Provider == host.Id(ApiTestHost.Captain) || statuses.Provider == host.Id(ApiTestHost.Captain2))
            .Should().BeTrue("the assigned provider must be one of the two racing captains");
    }

    [Fact]
    public async Task Privacy_BeforeAccept_ProviderAndCandidatePayloadsHideSensitiveFields()
    {
        var type = await TowType();
        using var owner = host.Client(ApiTestHost.Owner);
        var req = (await Http.Post(owner, "/api/v1/requests", NewRequest(type))).Item2;
        var requestId = req.GuidOf("id");

        // Candidate payload shown to the customer must not leak phone/plate/exact coordinates.
        var (code, candidates) = await Http.Get(owner, $"/api/v1/requests/{requestId}/candidates");
        code.Should().Be(HttpStatusCode.OK);
        var candidateJson = candidates.GetRawText();
        candidateJson.Should().NotContain("+2010000000", "provider phone must be hidden");
        candidateJson.Should().NotContain("CAB-1234", "truck plate must be hidden before accept");
        candidateJson.Should().NotContain("30.045", "exact provider latitude must be hidden");
        candidateJson.Should().NotContain("31.236", "exact provider longitude must be hidden");
        candidateJson.Should().NotContain("phone", "no phone field on candidate DTO");
        candidateJson.Should().NotContain("plate", "no plate field on candidate DTO");

        // Offer payload visible to the provider before accepting must hide the customer's
        // phone, plate and exact pickup coordinates.
        var offer = (await Http.Post(owner, $"/api/v1/requests/{requestId}/offers",
            new { providerId = host.Id(ApiTestHost.Captain) })).Item2;
        using var captain = host.Client(ApiTestHost.Captain);
        var (oCode, mine) = await Http.Get(captain, "/api/v1/offers");
        oCode.Should().Be(HttpStatusCode.OK);
        var offerJson = mine.GetRawText();
        offerJson.Should().NotContain("+2010000000");
        offerJson.Should().NotContain("plate");
        offerJson.Should().NotContain("phone");
        offerJson.Should().NotContain("pickupLatitude");
        offerJson.Should().NotContain("pickupLongitude");

        // An unassigned provider cannot read the full request (which contains exact pickup).
        using var other = host.Client(ApiTestHost.Mechanic);
        var (rCode, _) = await Http.Get(other, $"/api/v1/requests/{requestId}");
        rCode.Should().BeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task OpenDispatch_CustomerCreatesMechanicRequestFirst_OfflineMechanicGoesOnlineAfter_SeesAndAccepts()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);

        var boot = (await Http.Get(owner, "/api/v1/lookups/bootstrap")).Item2;
        var mechType = boot.GetProperty("serviceTypes").EnumerateArray()
            .First(s => s.GetProperty("key").GetString() == "mechanic").GetProperty("id").GetGuid();

        // 1. Mechanic starts OFFLINE before customer submits the request.
        (await Http.Post(mechanic, "/api/v1/providers/online",
            new { isOnline = false, latitude = 30.0561, longitude = 31.3301 })).Item1.Should().Be(HttpStatusCode.OK);

        // 2. Customer creates a Mechanic request WITHOUT selecting a specific provider.
        var (createCode, created) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId = (Guid?)null,
            serviceTypeId = mechType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Smouha, Alexandria",
            destinationLatitude = (double?)null,
            destinationLongitude = (double?)null,
            destinationAddress = (string?)null,
            distanceKm = 0.0,
            problem = "Alternator belt snapped",
            answersJson = "{}",
            note = "Two-browser live dispatch test",
            priority = nameof(RequestPriority.Normal)
        });
        createCode.Should().Be(HttpStatusCode.OK);
        var requestId = created.GuidOf("id");
        created.Text("status").Should().Be(nameof(RequestStatus.Searching));

        // 3. Mechanic goes ONLINE afterwards and checks incoming offers -> must immediately see the open request!
        (await Http.Post(mechanic, "/api/v1/providers/online",
            new { isOnline = true, latitude = 30.0561, longitude = 31.3301 })).Item1.Should().Be(HttpStatusCode.OK);

        var (offersCode, offersBody) = await Http.Get(mechanic, "/api/v1/offers");
        offersCode.Should().Be(HttpStatusCode.OK);
        var matchedOffer = offersBody.EnumerateArray()
            .FirstOrDefault(o => o.GetProperty("requestId").GetGuid() == requestId);
        matchedOffer.ValueKind.Should().Be(System.Text.Json.JsonValueKind.Object,
            "newly-online mechanic must immediately receive open Searching mechanic requests");

        var offerId = matchedOffer.GuidOf("id");
        var (accCode, accBody) = await Http.Post(mechanic, $"/api/v1/offers/{offerId}/accept", new { });
        accCode.Should().Be(HttpStatusCode.OK);
        accBody.GetProperty("awaitingCustomerConfirm").GetBoolean().Should().BeTrue();

        var (getCode, pendingReq) = await Http.Get(owner, $"/api/v1/requests/{requestId}");
        getCode.Should().Be(HttpStatusCode.OK);
        pendingReq.Text("status").Should().Be(nameof(RequestStatus.Offered));
        pendingReq.GuidOf("pendingProviderId").Should().Be(host.Id(ApiTestHost.Mechanic));
        pendingReq.TryGetProperty("customerConfirmDeadlineAt", out _).Should().BeTrue();

        var (confCode, updatedReq) = await Http.Post(owner, $"/api/v1/requests/{requestId}/confirm-provider", new { });
        confCode.Should().Be(HttpStatusCode.OK);
        updatedReq.Text("status").Should().Be(nameof(RequestStatus.Accepted));
        updatedReq.GuidOf("assignedProviderId").Should().Be(host.Id(ApiTestHost.Mechanic));
    }
}
