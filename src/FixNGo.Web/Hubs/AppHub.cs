using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FixNGo.Web.Hubs;

/// <summary>Authenticated real-time hub for notifications, offers, tracking, chat and status.</summary>
[Authorize]
public sealed class AppHub : Hub
{
    /// <summary>Join the caller's private user group for targeted events.</summary>
    public async Task JoinUser(string userId) => await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");

    /// <summary>Join a chat thread group (resource authorization is enforced by the caller).</summary>
    public async Task JoinThread(string threadId) => await Groups.AddToGroupAsync(Context.ConnectionId, $"thread:{threadId}");

    /// <summary>Leave a chat thread group.</summary>
    public async Task LeaveThread(string threadId) => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"thread:{threadId}");

    /// <summary>Broadcast a typing indicator to a thread.</summary>
    public async Task Typing(string threadId, bool isTyping) =>
        await Clients.Group($"thread:{threadId}").SendAsync("chat.typing", new { threadId, isTyping });

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst("sub")?.Value
            ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");

        var role = Context.User?.FindFirst("role")?.Value
            ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (!string.IsNullOrEmpty(role))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");

        await base.OnConnectedAsync();
    }
}
