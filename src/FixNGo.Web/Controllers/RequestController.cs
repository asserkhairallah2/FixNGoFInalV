using FixNGo.Application.DTOs;
using FixNGo.Application.Services;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/requests")]
[Authorize]
public sealed class RequestController(RequestService requests, OfferService offers, QuoteService quotes, ChatService chat) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await requests.ListAsync(this.UserId(), this.IsAdmin(), ct));
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Ok(await requests.GetAsync(this.UserId(), this.IsAdmin(), id, ct));
    [HttpGet("{id:guid}/timeline")] public async Task<IActionResult> Timeline(Guid id, CancellationToken ct) => Ok(await requests.TimelineAsync(this.UserId(), this.IsAdmin(), id, ct));

    [HttpPost("estimate")] public async Task<IActionResult> Estimate([FromBody] EstimateRequest req, CancellationToken ct) => Ok(await requests.EstimateAsync(req, ct));

    [HttpPost]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> Create([FromBody] CreateRequestRequest req, CancellationToken ct) => Ok(await requests.CreateAsync(this.UserId(), req, ct));

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelRequestRequest req, CancellationToken ct) => Ok(await requests.CancelAsync(this.UserId(), this.IsAdmin(), id, req, ct));

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> Advance(Guid id, [FromBody] StatusRequest req, CancellationToken ct) => Ok(await requests.AdvanceAsync(this.UserId(), id, req, ct));

    [HttpGet("{id:guid}/candidates")]
    public async Task<IActionResult> Candidates(Guid id, [FromQuery] string sort = "recommended", CancellationToken ct = default)
        => Ok(await offers.CandidatesAsync(this.UserId(), this.IsAdmin(), id, sort, ct));

    [HttpPost("{id:guid}/offers")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> SendOffer(Guid id, [FromBody] SelectProviderRequest req, CancellationToken ct) => Ok(await offers.SendAsync(this.UserId(), id, req, ct));

    [HttpGet("{id:guid}/offers")] public async Task<IActionResult> Offers(Guid id, CancellationToken ct) => Ok(await offers.ForRequestAsync(this.UserId(), this.IsAdmin(), id, ct));

    [HttpPost("{id:guid}/quotes")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> CreateQuote(Guid id, [FromBody] CreateQuoteRequest req, CancellationToken ct) => Ok(await quotes.CreateAsync(this.UserId(), id, req, ct));

    [HttpGet("{id:guid}/quotes")] public async Task<IActionResult> Quotes(Guid id, CancellationToken ct) => Ok(await quotes.ForRequestAsync(this.UserId(), this.IsAdmin(), id, ct));

    [HttpPost("{id:guid}/quotes/{quoteId:guid}/approve")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> ApproveQuote(Guid id, Guid quoteId, CancellationToken ct) => Ok(await quotes.ApproveAsync(this.UserId(), id, quoteId, ct));

    [HttpPost("{id:guid}/dispute")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> Dispute(Guid id, [FromBody] DisputeRequest req, CancellationToken ct) => Ok(await quotes.DisputeAsync(this.UserId(), id, req, ct));

    [HttpPost("{id:guid}/chat")]
    public async Task<IActionResult> StartChat(Guid id, [FromBody] ChatThreadStartRequest? req, CancellationToken ct)
        => Ok(await chat.StartAsync(this.UserId(), (req ?? new ChatThreadStartRequest()) with { RequestId = id }, ct));
}
