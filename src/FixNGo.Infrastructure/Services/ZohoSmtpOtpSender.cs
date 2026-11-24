using System.Net.Security;
using System.Net.Sockets;
using System.Text;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FixNGo.Infrastructure.Services;

/// <summary>Zoho Mail SMTP settings bound from Email:* configuration.</summary>
public sealed class ZohoEmailOptions
{
    public string Host { get; set; } = "smtp.zoho.com";
    public int Port { get; set; } = 465;
    public bool UseSsl { get; set; } = true;
    public string Username { get; set; } = "noreply-fixngo@nerot.me";
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = "noreply-fixngo@nerot.me";
    public string FromName { get; set; } = "FixNGo";
    public bool RecordSimMessages { get; set; } = true;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(Username) &&
        !string.IsNullOrWhiteSpace(Password);
}

/// <summary>
/// Delivers real OTP &amp; verification emails through Zoho Mail SMTP (Implicit TLS 465 or STARTTLS 587)
/// while preserving SimMessages recording for local/E2E simulator inspection and skipping synthetic test domains.
/// </summary>
public sealed class ZohoSmtpOtpSender(
    IServiceScopeFactory scopes,
    ZohoEmailOptions options,
    ILogger<ZohoSmtpOtpSender> logger) : IOtpSender
{
    private static readonly string[] SyntheticDomains =
    [
        "@dummy.fixngo.test",
        "@gate2.test",
        "@simulator.test",
        "@example.com",
        "@test.example",
        "@localhost"
    ];

    public async Task SendAsync(
        string recipient,
        string? recipientName,
        SimChannel channel,
        string code,
        string purpose,
        CancellationToken ct = default)
    {
        if (options.RecordSimMessages)
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            db.SimMessages.Add(new SimMessage
            {
                Channel = channel,
                Recipient = recipient,
                RecipientName = recipientName,
                Body = channel == SimChannel.Sms ? $"FixNGo code: {code}" : $"Your FixNGo {purpose} code is {code}",
                OtpCode = code,
                Purpose = purpose
            });
            await db.SaveChangesAsync(ct);
        }

        if (!options.IsConfigured || string.IsNullOrWhiteSpace(recipient) || !recipient.Contains('@'))
        {
            return;
        }

        var normalized = recipient.Trim().ToLowerInvariant();
        if (SyntheticDomains.Any(d => normalized.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
        {
            logger.LogInformation("Skipping external SMTP for synthetic test recipient {Recipient}", normalized);
            return;
        }

        try
        {
            var fromAddr = string.IsNullOrWhiteSpace(options.FromEmail) ? options.Username : options.FromEmail.Trim();
            var mime = BuildMimeMessage(fromAddr, options.FromName, normalized, recipientName, code, purpose);
            await SendRawMimeAsync(normalized, mime, ct);
            logger.LogInformation("Delivered {Purpose} OTP email via Zoho Mail ({FromEmail}) to {Recipient}", purpose, options.FromEmail, normalized);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Zoho SMTP delivery failed for {Recipient} ({Purpose})", normalized, purpose);
            throw new DomainException("auth.email_delivery_failed", "Could not send verification email right now. Please verify the email address and try again.");
        }
    }

    public async Task SendSecurityAlertAsync(
        string recipient,
        string? recipientName,
        string subject,
        string heading,
        string message,
        CancellationToken ct = default)
    {
        if (options.RecordSimMessages && !string.IsNullOrWhiteSpace(recipient))
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            db.SimMessages.Add(new SimMessage
            {
                Channel = SimChannel.Email,
                Recipient = recipient.Trim(),
                RecipientName = recipientName,
                Body = $"{subject} — {message}",
                OtpCode = null,
                Purpose = "security-alert"
            });
            await db.SaveChangesAsync(ct);
        }

        if (!options.IsConfigured || string.IsNullOrWhiteSpace(recipient) || !recipient.Contains('@'))
            return;

        var normalized = recipient.Trim().ToLowerInvariant();
        if (SyntheticDomains.Any(d => normalized.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
        {
            logger.LogInformation("Skipping external security alert SMTP for synthetic test recipient {Recipient}", normalized);
            return;
        }

        try
        {
            var fromAddr = string.IsNullOrWhiteSpace(options.FromEmail) ? options.Username : options.FromEmail.Trim();
            var mime = BuildSecurityAlertMimeMessage(fromAddr, options.FromName, normalized, recipientName, subject, heading, message);
            await SendRawMimeAsync(normalized, mime, ct);
            logger.LogInformation("Delivered security alert email ({Subject}) via Zoho Mail to {Recipient}", subject, normalized);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Non-fatal Zoho SMTP failure while sending security alert ({Subject}) to {Recipient}", subject, normalized);
        }
    }

    private async Task SendRawMimeAsync(string toEmail, string mime, CancellationToken ct)
    {
        using var tcp = new TcpClient();
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(20));
        var token = timeoutCts.Token;

        await tcp.ConnectAsync(options.Host, options.Port, token);
        Stream activeStream = tcp.GetStream();
        SslStream? sslStream = null;

        try
        {
            var implicitTls = options.UseSsl && options.Port == 465;
            if (implicitTls)
            {
                sslStream = new SslStream(activeStream, leaveInnerStreamOpen: false);
                await sslStream.AuthenticateAsClientAsync(options.Host, clientCertificates: null, checkCertificateRevocation: false);
                activeStream = sslStream;
            }

            var reader = new StreamReader(activeStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 4096, leaveOpen: true);
            var writer = new StreamWriter(activeStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false), bufferSize: 4096, leaveOpen: true)
            {
                NewLine = "\r\n",
                AutoFlush = true
            };

            await ExpectCodeAsync(reader, 220, "Greeting", token);
            await SendCommandAsync(writer, reader, "EHLO fixngo.nerot.dev", 250, token);

            if (options.UseSsl && !implicitTls)
            {
                await SendCommandAsync(writer, reader, "STARTTLS", 220, token);
                sslStream = new SslStream(activeStream, leaveInnerStreamOpen: false);
                await sslStream.AuthenticateAsClientAsync(options.Host, clientCertificates: null, checkCertificateRevocation: false);
                activeStream = sslStream;
                reader = new StreamReader(activeStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 4096, leaveOpen: true);
                writer = new StreamWriter(activeStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false), bufferSize: 4096, leaveOpen: true)
                {
                    NewLine = "\r\n",
                    AutoFlush = true
                };
                await SendCommandAsync(writer, reader, "EHLO fixngo.nerot.dev", 250, token);
            }

            await SendCommandAsync(writer, reader, "AUTH LOGIN", 334, token);
            await SendCommandAsync(writer, reader, Convert.ToBase64String(Encoding.UTF8.GetBytes(options.Username)), 334, token);
            await SendCommandAsync(writer, reader, Convert.ToBase64String(Encoding.UTF8.GetBytes(options.Password)), 235, token);

            var fromAddr = string.IsNullOrWhiteSpace(options.FromEmail) ? options.Username : options.FromEmail.Trim();
            await SendCommandAsync(writer, reader, $"MAIL FROM:<{fromAddr}>", 250, token);
            await SendCommandAsync(writer, reader, $"RCPT TO:<{toEmail}>", 250, token);
            await SendCommandAsync(writer, reader, "DATA", 354, token);

            await writer.WriteAsync(mime.AsMemory(), token);
            await writer.WriteAsync("\r\n.\r\n".AsMemory(), token);
            await ExpectCodeAsync(reader, 250, "DATA end", token);

            try
            {
                await writer.WriteLineAsync("QUIT".AsMemory(), token);
            }
            catch
            {
                // Ignore graceful close race after 250 OK.
            }
        }
        finally
        {
            if (sslStream is not null)
                await sslStream.DisposeAsync();
        }
    }

    private static async Task SendCommandAsync(StreamWriter writer, StreamReader reader, string command, int expectedCode, CancellationToken ct)
    {
        await writer.WriteLineAsync(command.AsMemory(), ct);
        await ExpectCodeAsync(reader, expectedCode, command.StartsWith("AUTH", StringComparison.OrdinalIgnoreCase) || command.Length > 40 ? "SMTP Auth/Cmd" : command, ct);
    }

    private static async Task ExpectCodeAsync(StreamReader reader, int expectedCode, string step, CancellationToken ct)
    {
        var sb = new StringBuilder();
        while (true)
        {
            var line = await reader.ReadLineAsync(ct)
                ?? throw new IOException($"SMTP stream closed unexpectedly during {step}.");
            sb.AppendLine(line);
            if (line.Length >= 3 && int.TryParse(line.AsSpan(0, 3), out var status))
            {
                var isFinal = line.Length == 3 || line[3] == ' ';
                if (!isFinal) continue;
                if (status != expectedCode && !(expectedCode == 250 && status == 251))
                {
                    throw new IOException($"SMTP {step} expected {expectedCode} but received: {sb.ToString().Trim()}");
                }
                return;
            }
        }
    }

    private static string BuildMimeMessage(string fromEmail, string fromName, string toEmail, string? toName, string code, string purpose)
    {
        var (subject, heading, subtitle) = purpose.ToLowerInvariant() switch
        {
            "signup" => ($"FixNGo — Verify your account ({code})", "Verify your FixNGo account", "Enter this 6-digit verification code in the app to activate your account."),
            "login" => ($"FixNGo — Sign-in security code ({code})", "Confirm your sign-in", "Use this one-time security code to finish signing in to FixNGo."),
            "reset" or "forgot" or "inappreset" => ($"FixNGo — Password reset code ({code})", "Reset your FixNGo password", "Enter this 6-digit code in the app to set a new password."),
            _ => ($"FixNGo — Verification code ({code})", "Your FixNGo verification code", "Use the 6-digit security code below to continue.")
        };

        var safeName = string.IsNullOrWhiteSpace(toName) ? "there" : System.Net.WebUtility.HtmlEncode(toName.Trim());
        var encodedSubject = $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(subject))}?=";
        var encodedFromName = $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(fromName) ? "FixNGo" : fromName))}?=";
        var boundary = $"fixngo_part_{Guid.NewGuid():N}";
        var messageId = $"<{Guid.NewGuid():N}@nerot.me>";
        var dateHeader = DateTimeOffset.UtcNow.ToString("R");

        var plainText =
            $"Hello {(string.IsNullOrWhiteSpace(toName) ? "there" : toName.Trim())},\r\n\r\n" +
            $"{subtitle}\r\n\r\n" +
            $"Verification Code: {code}\r\n\r\n" +
            "This code expires in 5 minutes. Never share this code with anyone.\r\n" +
            "— FixNGo Roadside Assistance Team (https://depi-v2.nerot.dev)";

        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<body style=""margin:0;padding:24px;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;"">
  <div style=""max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.35);"">
    <div style=""background:linear-gradient(135deg,#E51C23,#B91C1C);padding:24px 28px;color:#FFFFFF;"">
      <div style=""font-size:22px;font-weight:900;letter-spacing:-0.02em;"">FixNGo</div>
      <div style=""font-size:12px;opacity:0.9;margin-top:4px;"">24/7 Roadside Assistance &amp; Car Care</div>
    </div>
    <div style=""padding:28px;"">
      <h2 style=""margin:0 0 8px;font-size:20px;color:#0F172A;"">{heading}</h2>
      <p style=""margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;"">Hello {safeName},<br/>{subtitle}</p>
      <div style=""background:#FEF2F2;border:2px dashed #E51C23;border-radius:16px;padding:20px;text-align:center;margin:20px 0;"">
        <div style=""font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#B91C1C;margin-bottom:6px;"">One-Time Verification Code</div>
        <div style=""font-size:34px;font-weight:900;letter-spacing:0.24em;color:#E51C23;font-family:'Courier New',monospace;"">{code}</div>
      </div>
      <p style=""margin:0;font-size:12px;line-height:1.6;color:#64748B;"">Valid for <strong>5 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
    </div>
    <div style=""padding:14px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;"">
      Sent securely by FixNGo &bull; noreply-fixngo@nerot.me
    </div>
  </div>
</body>
</html>";

        var sb = new StringBuilder();
        sb.Append($"From: {encodedFromName} <{fromEmail}>\r\n");
        sb.Append($"To: <{toEmail}>\r\n");
        sb.Append($"Subject: {encodedSubject}\r\n");
        sb.Append($"Date: {dateHeader}\r\n");
        sb.Append($"Message-ID: {messageId}\r\n");
        sb.Append("MIME-Version: 1.0\r\n");
        sb.Append($"Content-Type: multipart/alternative; boundary=\"{boundary}\"\r\n\r\n");

        sb.Append($"--{boundary}\r\n");
        sb.Append("Content-Type: text/plain; charset=UTF-8\r\n");
        sb.Append("Content-Transfer-Encoding: base64\r\n\r\n");
        sb.Append(WrapBase64(Encoding.UTF8.GetBytes(plainText)));
        sb.Append("\r\n");

        sb.Append($"--{boundary}\r\n");
        sb.Append("Content-Type: text/html; charset=UTF-8\r\n");
        sb.Append("Content-Transfer-Encoding: base64\r\n\r\n");
        sb.Append(WrapBase64(Encoding.UTF8.GetBytes(html)));
        sb.Append("\r\n");

        sb.Append($"--{boundary}--");
        return DotStuff(sb.ToString());
    }

    private static string BuildSecurityAlertMimeMessage(string fromEmail, string fromName, string toEmail, string? toName, string subject, string heading, string message)
    {
        var safeName = string.IsNullOrWhiteSpace(toName) ? "there" : System.Net.WebUtility.HtmlEncode(toName.Trim());
        var safeHeading = System.Net.WebUtility.HtmlEncode(heading);
        var safeMessage = System.Net.WebUtility.HtmlEncode(message);
        var encodedSubject = $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(subject))}?=";
        var encodedFromName = $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(fromName) ? "FixNGo" : fromName))}?=";
        var boundary = $"fixngo_sec_{Guid.NewGuid():N}";
        var messageId = $"<{Guid.NewGuid():N}@nerot.me>";
        var dateHeader = DateTimeOffset.UtcNow.ToString("R");
        var utcLabel = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'");

        var plainText =
            $"Hello {(string.IsNullOrWhiteSpace(toName) ? "there" : toName.Trim())},\r\n\r\n" +
            $"{heading}\r\n\r\n" +
            $"{message}\r\n\r\n" +
            $"Time: {utcLabel}\r\n" +
            "If you recognized this activity, no further action is needed. If you did not perform this change, please reset your FixNGo password immediately.\r\n" +
            "— FixNGo Account Security (noreply-fixngo@nerot.me)";

        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<body style=""margin:0;padding:24px;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;"">
  <div style=""max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.35);"">
    <div style=""background:linear-gradient(135deg,#E51C23,#B91C1C);padding:24px 28px;color:#FFFFFF;"">
      <div style=""font-size:22px;font-weight:900;letter-spacing:-0.02em;"">FixNGo Security</div>
      <div style=""font-size:12px;opacity:0.9;margin-top:4px;"">Official Account Security Notification</div>
    </div>
    <div style=""padding:28px;"">
      <h2 style=""margin:0 0 10px;font-size:20px;color:#0F172A;"">{safeHeading}</h2>
      <p style=""margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;"">Hello {safeName},</p>
      <div style=""background:#F8FAFC;border-left:4px solid #E51C23;border-radius:12px;padding:16px;margin:16px 0;font-size:14px;line-height:1.6;color:#0F172A;"">
        {safeMessage}
        <div style=""font-size:11px;color:#64748B;margin-top:8px;"">Recorded at {utcLabel}</div>
      </div>
      <p style=""margin:0;font-size:12px;line-height:1.6;color:#64748B;"">If this was you, you don't need to do anything. If you don't recognize this activity, please secure your account immediately.</p>
    </div>
    <div style=""padding:14px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;"">
      Sent securely by FixNGo &bull; noreply-fixngo@nerot.me
    </div>
  </div>
</body>
</html>";

        var sb = new StringBuilder();
        sb.Append($"From: {encodedFromName} <{fromEmail}>\r\n");
        sb.Append($"To: <{toEmail}>\r\n");
        sb.Append($"Subject: {encodedSubject}\r\n");
        sb.Append($"Date: {dateHeader}\r\n");
        sb.Append($"Message-ID: {messageId}\r\n");
        sb.Append("MIME-Version: 1.0\r\n");
        sb.Append($"Content-Type: multipart/alternative; boundary=\"{boundary}\"\r\n\r\n");

        sb.Append($"--{boundary}\r\n");
        sb.Append("Content-Type: text/plain; charset=UTF-8\r\n");
        sb.Append("Content-Transfer-Encoding: base64\r\n\r\n");
        sb.Append(WrapBase64(Encoding.UTF8.GetBytes(plainText)));
        sb.Append("\r\n");

        sb.Append($"--{boundary}\r\n");
        sb.Append("Content-Type: text/html; charset=UTF-8\r\n");
        sb.Append("Content-Transfer-Encoding: base64\r\n\r\n");
        sb.Append(WrapBase64(Encoding.UTF8.GetBytes(html)));
        sb.Append("\r\n");

        sb.Append($"--{boundary}--");
        return DotStuff(sb.ToString());
    }

    private static string WrapBase64(byte[] bytes)
    {
        var b64 = Convert.ToBase64String(bytes);
        var sb = new StringBuilder(b64.Length + (b64.Length / 76) * 2 + 4);
        for (var i = 0; i < b64.Length; i += 76)
        {
            var len = Math.Min(76, b64.Length - i);
            sb.Append(b64, i, len);
            if (i + len < b64.Length) sb.Append("\r\n");
        }
        return sb.ToString();
    }

    private static string DotStuff(string raw)
    {
        var normalized = raw.Replace("\r\n", "\n").Replace("\r", "\n");
        var lines = normalized.Split('\n');
        var sb = new StringBuilder(raw.Length + 64);
        for (var i = 0; i < lines.Length; i++)
        {
            if (lines[i].StartsWith('.')) sb.Append('.');
            sb.Append(lines[i]);
            if (i < lines.Length - 1) sb.Append("\r\n");
        }
        return sb.ToString();
    }
}
