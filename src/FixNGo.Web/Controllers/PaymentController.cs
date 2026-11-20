using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.Controllers;

[ApiController]
[Route("api/v1/payments")]
[Authorize]
public sealed class PaymentController(IPaymentService svc) : ControllerBase
{
    [HttpGet("methods")] public async Task<IActionResult> Methods(CancellationToken ct) => Ok(await svc.MethodsAsync(this.UserId(), ct));
    [HttpPost("methods/card")] public async Task<IActionResult> AddCard([FromBody] AddCardRequest req, CancellationToken ct) => Ok(await svc.AddCardAsync(this.UserId(), req, ct));
    [HttpPost("methods/apple-pay")] public async Task<IActionResult> AddApplePay([FromBody] ApplePayRequest? req, CancellationToken ct) => Ok(await svc.AddApplePayAsync(this.UserId(), req?.Label, ct));
    [HttpDelete("methods/{id:guid}")] public async Task<IActionResult> RemoveMethod(Guid id, CancellationToken ct) { await svc.RemoveMethodAsync(this.UserId(), id, ct); return NoContent(); }
    [HttpPost("methods/{id:guid}/default")] public async Task<IActionResult> SetDefault(Guid id, CancellationToken ct) => Ok(await svc.SetDefaultAsync(this.UserId(), id, ct));

    [HttpGet("invoices")] public async Task<IActionResult> Invoices(CancellationToken ct) => Ok(await svc.InvoicesAsync(this.UserId(), ct));
    [HttpGet("invoices/request/{requestId:guid}")] public async Task<IActionResult> InvoiceForRequest(Guid requestId, CancellationToken ct) => Ok(await svc.InvoiceForRequestAsync(this.UserId(), this.IsAdmin(), requestId, ct));
    [HttpPost("invoices/request/{requestId:guid}/ensure")] public async Task<IActionResult> EnsureInvoice(Guid requestId, CancellationToken ct) => Ok(await svc.EnsureInvoiceAsync(requestId, ct));
    [HttpPost("invoices/{id:guid}/pay")] public async Task<IActionResult> Pay(Guid id, [FromBody] PayRequest req, CancellationToken ct) => Ok(await svc.PayAsync(this.UserId(), id, req, ct));
    [HttpPost("invoices/{id:guid}/confirm-cash")]
    [Authorize(Roles = nameof(Role.CarOwner))]
    public async Task<IActionResult> ConfirmCash(Guid id, CancellationToken ct) => Ok(await svc.ConfirmCashAsync(this.UserId(), id, ct));

    [HttpGet("wallet")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> Wallet(CancellationToken ct) => Ok(await svc.WalletAsync(this.UserId(), ct));
    [HttpGet("earnings")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> Earnings(CancellationToken ct) => Ok(await svc.EarningsAsync(this.UserId(), ct));

    [HttpGet("banks")] public async Task<IActionResult> Banks(CancellationToken ct) => Ok(await svc.BankAccountsAsync(this.UserId(), ct));
    [HttpPost("banks")] public async Task<IActionResult> AddBank([FromBody] AddBankAccountRequest req, CancellationToken ct) => Ok(await svc.AddBankAccountAsync(this.UserId(), req, ct));

    [HttpGet("withdrawals")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> Withdrawals(CancellationToken ct) => Ok(await svc.WithdrawalsAsync(this.UserId(), ct));
    [HttpPost("withdrawals")]
    [Authorize(Policy = "Provider")]
    public async Task<IActionResult> Withdraw([FromBody] WithdrawRequest req, CancellationToken ct) => Ok(await svc.WithdrawAsync(this.UserId(), req, ct));
}

public sealed record ApplePayRequest(string? Label);
