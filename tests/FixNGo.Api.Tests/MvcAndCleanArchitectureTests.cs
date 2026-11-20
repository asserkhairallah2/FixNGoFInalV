using System.Net;
using System.Net.Http.Json;
using FixNGo.Application.Interfaces;
using FixNGo.Domain.Entities;
using FixNGo.Infrastructure.Configurations;
using FixNGo.Web.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace FixNGo.Api.Tests;

[Collection("api")]
public sealed class MvcAndCleanArchitectureTests(ApiTestHost host)
{
    [Fact]
    public async Task Root_Route_Is_Rendered_By_AspNetCore_Mvc_Razor_With_Security_Headers()
    {
        using var client = host.Anon();
        using var res = await client.GetAsync("/");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        res.Content.Headers.ContentType?.MediaType.Should().Be("text/html");
        res.Headers.Contains("X-FixNGo-Host").Should().BeTrue();
        res.Headers.Contains("X-Content-Type-Options").Should().BeTrue();

        var html = await res.Content.ReadAsStringAsync();
        html.Should().Contain("data-host=\"aspnet-core-mvc\"");
        html.Should().Contain("id=\"root\"");
        html.Should().Contain("fixngo-server-bootstrap");
        html.Should().Contain("/assets/fixngo-app.js");
    }

    [Fact]
    public async Task Mvc_ServiceCenters_Catalog_And_Architecture_Views_Render_Cleanly()
    {
        using var client = host.Anon();

        using var centersRes = await client.GetAsync("/mvc/centers?sort=rating&page=1&pageSize=6");
        centersRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var centersHtml = await centersRes.Content.ReadAsStringAsync();
        centersHtml.Should().Contain("Verified Service Centers");
        centersHtml.Should().Contain("ASP.NET Core 8 MVC");

        using var archRes = await client.GetAsync("/mvc/architecture");
        archRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var archHtml = await archRes.Content.ReadAsStringAsync();
        archHtml.Should().Contain("Clean Architecture");
        archHtml.Should().Contain("IEntityTypeConfiguration Classes");
    }

    [Fact]
    public void Web_Controllers_Never_Inject_DbContext_Or_Concrete_Services()
    {
        var controllerTypes = typeof(HomeController).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(ControllerBase).IsAssignableFrom(t))
            .ToList();

        controllerTypes.Should().NotBeEmpty();

        foreach (var controller in controllerTypes)
        {
            foreach (var ctor in controller.GetConstructors())
            {
                foreach (var param in ctor.GetParameters())
                {
                    param.ParameterType.Name.Should().NotContain("DbContext",
                        $"{controller.Name} must never inject DbContext or IAppDbContext directly");

                    if (param.ParameterType.Namespace == "FixNGo.Application.Services")
                    {
                        throw new InvalidOperationException(
                            $"{controller.Name} injects concrete service {param.ParameterType.Name} instead of its interface.");
                    }
                }
            }
        }
    }

    [Fact]
    public void Every_Entity_Configuration_Lives_In_Its_Own_Dedicated_Class()
    {
        var configTypes = typeof(UserConfig).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                && t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition().Name.StartsWith("IEntityTypeConfiguration", StringComparison.Ordinal)))
            .ToList();

        configTypes.Count.Should().BeGreaterThanOrEqualTo(35);
    }

    [Fact]
    public async Task Repository_And_UnitOfWork_Resolve_And_Query_Cleanly()
    {
        using var scope = host.Services.CreateScope();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var userCount = await uow.Repository<User>().CountAsync();
        userCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Idempotency_Middleware_Replays_Identical_Mutating_Post_By_Key()
    {
        using var client = host.Client("owner@gate2.test");
        var idemKey = "idem-vehicle-" + Guid.NewGuid().ToString("N");

        var payload = new
        {
            make = "Toyota",
            model = "Corolla",
            year = 2022,
            plate = "IDM-" + Random.Shared.Next(1000, 9999),
            color = "White",
            fuel = "Petrol",
            isPrimary = false
        };

        using var req1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/vehicles")
        {
            Content = JsonContent.Create(payload)
        };
        req1.Headers.Add("Idempotency-Key", idemKey);
        using var res1 = await client.SendAsync(req1);
        res1.StatusCode.Should().Be(HttpStatusCode.OK);
        var body1 = await res1.Content.ReadAsStringAsync();

        using var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/vehicles")
        {
            Content = JsonContent.Create(payload)
        };
        req2.Headers.Add("Idempotency-Key", idemKey);
        using var res2 = await client.SendAsync(req2);
        res2.StatusCode.Should().Be(HttpStatusCode.OK);
        res2.Headers.Contains("X-Idempotent-Replay").Should().BeTrue();
        var body2 = await res2.Content.ReadAsStringAsync();
        body2.Should().Be(body1);
    }
}
