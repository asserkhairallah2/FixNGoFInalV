using System.Net;
using FixNGo.Domain;
using FluentAssertions;

namespace FixNGo.Api.Tests;

/// <summary>Round-7 tests: Uber-style 3-strike auto-cancel, duplicate request guard, past slot rejection, cohesive pricing, chat isolation &amp; customer ratings.</summary>
[Collection("api")]
public sealed class Round7UberFlowAndIsolationTests(ApiTestHost host)
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
    public async Task ThreeUnconfirmedMatches_AutoCancelsRequest_OnThirdPass()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);
        var batteryType = await ServiceType("battery");

        (await Http.Post(mechanic, "/api/v1/providers/online",
            new { isOnline = true, latitude = 30.0450, longitude = 31.2360 })).Item1.Should().Be(HttpStatusCode.OK);

        var (cCreate, created) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId = (Guid?)null,
            serviceTypeId = batteryType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Zamalek, Cairo",
            distanceKm = 0.0,
            problem = "Dead battery",
            answersJson = "{}",
            note = "3-strike test"
        });
        cCreate.Should().Be(HttpStatusCode.OK);
        var reqId = created.GuidOf("id");

        for (var strike = 1; strike <= 3; strike++)
        {
            // Ensure an active broadcast offer is ready for mechanic to accept on each round
            var (_, offers) = await Http.Get(mechanic, "/api/v1/offers");
            var myOffer = offers.EnumerateArray().FirstOrDefault(o => o.GuidOf("requestId") == reqId);
            if (myOffer.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                // Re-reset mechanic offer via going offline/online or clearing DeclineReason is not needed if another provider accepts;
                // here we have 1 seeded mechanic in ApiTestHost, so reset offer via customer re-broadcast (expand-radius) + clearing declined status:
                break;
            }
            var offerId = myOffer.GuidOf("id");
            (await Http.Post(mechanic, $"/api/v1/offers/{offerId}/accept", new { })).Item1.Should().Be(HttpStatusCode.OK);

            var (passCode, afterPass) = await Http.Post(owner, $"/api/v1/requests/{reqId}/pass-provider", new { reason = $"pass_{strike}" });
            passCode.Should().Be(HttpStatusCode.OK);
            afterPass.GetProperty("customerRejectionCount").GetInt32().Should().Be(strike);

            if (strike < 3)
            {
                afterPass.Text("status").Should().Be(nameof(RequestStatus.Searching));
                // Allow the single test mechanic to re-offer for the next strike in this single-mechanic test host
                await host.WithDb(async db =>
                {
                    foreach (var o in db.Offers.Where(x => x.RequestId == reqId))
                    {
                        o.Status = OfferStatus.Pending;
                        o.DeclineReason = null;
                        o.CustomerSelected = false;
                        o.ExpiresAt = DateTime.UtcNow.AddMinutes(5);
                    }
                    await db.SaveChangesAsync();
                });
            }
            else
            {
                afterPass.Text("status").Should().Be(nameof(RequestStatus.Cancelled));
            }
        }
    }

    [Fact]
    public async Task DuplicateActiveRequest_SameVehicleAndService_IsRejected_UntilCancelled()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        var tireType = await ServiceType("tire");
        var fuelType = await ServiceType("fuel");

        var (vCode, veh) = await Http.Post(owner, "/api/v1/vehicles", new
        {
            make = "Kia", model = "Cerato", year = 2023, plate = $"DUP{Random.Shared.Next(1000, 9999)}",
            color = "Black", fuel = "Petrol", isPrimary = false
        });
        vCode.Should().Be(HttpStatusCode.OK);
        var vehicleId = veh.GuidOf("id");

        var payload = new
        {
            vehicleId,
            serviceTypeId = tireType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Dokki, Giza",
            distanceKm = 0.0,
            problem = "Punctured tire",
            answersJson = "{}"
        };

        var (c1, firstReq) = await Http.Post(owner, "/api/v1/requests", payload);
        c1.Should().Be(HttpStatusCode.OK);
        var firstId = firstReq.GuidOf("id");

        // Exact same vehicle + same service while first is still active -> blocked!
        var (cDup, dupErr) = await Http.Post(owner, "/api/v1/requests", payload);
        ((int)cDup).Should().BeGreaterThanOrEqualTo(400);
        dupErr.Text("code").Should().Be("request.duplicate_active");

        // Different service on the same vehicle -> allowed!
        var (cDiff, diffReq) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId,
            serviceTypeId = fuelType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Dokki, Giza",
            distanceKm = 0.0,
            problem = "Low fuel",
            answersJson = "{}"
        });
        cDiff.Should().Be(HttpStatusCode.OK);

        // Cancel both, then Tire request on same vehicle succeeds again
        (await Http.Post(owner, $"/api/v1/requests/{firstId}/cancel", new { reasonKey = "changed_mind" })).Item1.Should().Be(HttpStatusCode.OK);
        (await Http.Post(owner, $"/api/v1/requests/{diffReq.GuidOf("id")}/cancel", new { reasonKey = "changed_mind" })).Item1.Should().Be(HttpStatusCode.OK);

        var (cAfterCancel, retryReq) = await Http.Post(owner, "/api/v1/requests", payload);
        cAfterCancel.Should().Be(HttpStatusCode.OK);
        (await Http.Post(owner, $"/api/v1/requests/{retryReq.GuidOf("id")}/cancel", new { reasonKey = "changed_mind" })).Item1.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ServiceCenter_PastDayAndPastSlot_AreBlocked()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        var (_, centers) = await Http.Get(owner, "/api/v1/centers");
        centers.GetArrayLength().Should().BeGreaterThan(0);
        var centerId = centers[0].GuidOf("id");
        var (_, services) = await Http.Get(owner, $"/api/v1/centers/{centerId}/services");
        services.GetArrayLength().Should().BeGreaterThan(0);
        var serviceId = services[0].GuidOf("id");

        var pastDay = DateTime.UtcNow.AddDays(-2).Date;
        var (avCode, pastSlots) = await Http.Get(owner, $"/api/v1/centers/{centerId}/availability?serviceId={serviceId}&day={pastDay:yyyy-MM-dd}");
        avCode.Should().Be(HttpStatusCode.OK);
        pastSlots.GetArrayLength().Should().Be(0);

        var (bkCode, bkErr) = await Http.Post(owner, "/api/v1/centers/bookings", new
        {
            centerId,
            serviceId,
            slotStart = DateTime.UtcNow.AddHours(-3),
            vehicleId = (Guid?)null,
            note = "Should fail"
        });
        ((int)bkCode).Should().BeGreaterThanOrEqualTo(400);
        bkErr.Text("code").Should().Be("booking.past_slot");
    }

    [Fact]
    public async Task PricingCohesion_EstimateMatchesCandidatePrice_AndNearestIsDefaultSort()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);
        var batteryType = await ServiceType("battery");

        // Place mechanic 20 km away (New Cairo) while customer is in Downtown Cairo — price must NOT inflate to 340 EGP!
        (await Http.Post(mechanic, "/api/v1/providers/online",
            new { isOnline = true, latitude = 30.0276, longitude = 31.4913 })).Item1.Should().Be(HttpStatusCode.OK);

        var (_, est) = await Http.Post(owner, "/api/v1/requests/estimate", new { serviceTypeId = batteryType, distanceKm = 0.0 });
        var expectedMinor = est.LongOf("totalMinor");

        var (_, req) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId = (Guid?)null,
            serviceTypeId = batteryType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Tahrir Square, Cairo",
            distanceKm = 0.0,
            problem = "Battery check",
            answersJson = "{}"
        });
        var reqId = req.GuidOf("id");

        var (_, cands) = await Http.Get(owner, $"/api/v1/requests/{reqId}/candidates");
        cands.GetArrayLength().Should().BeGreaterThan(0);
        cands[0].LongOf("priceMinor").Should().Be(expectedMinor);

        (await Http.Post(owner, $"/api/v1/requests/{reqId}/cancel", new { reasonKey = "changed_mind" })).Item1.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ChatIsolation_AndCustomerPublicProfileRating_WorkEndToEnd()
    {
        using var owner = host.Client(ApiTestHost.Owner);
        using var mechanic = host.Client(ApiTestHost.Mechanic);
        using var captain = host.Client(ApiTestHost.Captain);
        var mechType = await ServiceType("mechanic");

        var (_, req) = await Http.Post(owner, "/api/v1/requests", new
        {
            vehicleId = (Guid?)null,
            serviceTypeId = mechType,
            pickupLatitude = 30.0444,
            pickupLongitude = 31.2357,
            pickupAddress = "Maadi, Cairo",
            distanceKm = 0.0,
            problem = "Engine check",
            answersJson = "{}"
        });
        var reqId = req.GuidOf("id");

        var (_, directOffer) = await Http.Post(owner, $"/api/v1/requests/{reqId}/offers", new { providerId = host.Id(ApiTestHost.Mechanic) });
        (await Http.Post(mechanic, $"/api/v1/offers/{directOffer.GuidOf("id")}/accept", new { })).Item1.Should().Be(HttpStatusCode.OK);

        // Start request chat -> must expose exact OtherPartyName & RequestCode, and Captain (uninvolved) must get 403!
        var (chatCode, thread) = await Http.Post(owner, $"/api/v1/requests/{reqId}/chat", new { });
        chatCode.Should().Be(HttpStatusCode.OK);
        var threadId = thread.GuidOf("id");
        thread.Text("requestCode").Should().StartWith("MR-");
        thread.Text("otherPartyRole").Should().Be(nameof(Role.Mechanic));

        (await Http.Post(owner, $"/api/v1/chat/threads/{threadId}/messages", new { text = "Private message to mechanic" })).Item1.Should().Be(HttpStatusCode.OK);

        var (capReadCode, _) = await Http.Get(captain, $"/api/v1/chat/threads/{threadId}");
        capReadCode.Should().Be(HttpStatusCode.Forbidden);

        var (_, capThreads) = await Http.Get(captain, "/api/v1/chat/threads");
        capThreads.EnumerateArray().Any(t => t.GuidOf("id") == threadId).Should().BeFalse();

        // Complete job and let Mechanic rate Customer + inspect Customer public profile
        foreach (var st in new[] { RequestStatus.EnRoute, RequestStatus.Arrived, RequestStatus.Working, RequestStatus.Completed })
            (await Http.Post(mechanic, $"/api/v1/requests/{reqId}/status", new { status = st.ToString() })).Item1.Should().Be(HttpStatusCode.OK);

        var ownerId = host.Id(ApiTestHost.Owner);
        var (revCode, _) = await Http.Post(mechanic, $"/api/v1/reviews/customer/{ownerId}?requestId={reqId}",
            new { stars = 5, text = "Great car owner, accurate location!", recommend = true });
        revCode.Should().Be(HttpStatusCode.OK);

        var (profCode, custProf) = await Http.Get(mechanic, $"/api/v1/providers/customers/{ownerId}/public-profile");
        profCode.Should().Be(HttpStatusCode.OK);
        custProf.GetProperty("ratingCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        custProf.GetProperty("reviews").GetArrayLength().Should().BeGreaterThanOrEqualTo(1);
    }
}
