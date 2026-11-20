using FixNGo.Application.Interfaces;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Infrastructure.Services;

/// <summary>Local validated file store under data/uploads; metadata lives in UploadedFiles.</summary>
public sealed class LocalFileStore(IAppDbContext db, RuntimePaths paths) : IFileStore
{
    private static readonly Dictionary<string, string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".pdf"] = "application/pdf"
    };
    private const long MaxBytes = 10 * 1024 * 1024;

    /// <summary>Magic-byte check so a renamed executable/HTML cannot be stored as an image/PDF.</summary>
    internal static bool HasExpectedSignature(byte[] data, int length, string mime)
    {
        bool StartsWith(params byte[] sig) => length >= sig.Length && sig.Select((b, i) => data[i] == b).All(x => x);
        return mime switch
        {
            "image/jpeg" => StartsWith(0xFF, 0xD8, 0xFF),
            "image/png" => StartsWith(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
            "image/webp" => length >= 12 && StartsWith(0x52, 0x49, 0x46, 0x46) && data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50,
            "application/pdf" => StartsWith(0x25, 0x50, 0x44, 0x46),
            _ => false
        };
    }

    public async Task<(Guid Id, string StoredName)> SaveAsync(Stream content, string fileName, string contentType,
        string purpose, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName);
        if (!Allowed.TryGetValue(ext, out var expected) || !contentType.StartsWith(expected.Split('/')[0], StringComparison.OrdinalIgnoreCase))
            throw new FixNGo.Domain.DomainException("file.type_invalid", "Unsupported file type.");
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length == 0 || buffer.Length > MaxBytes)
            throw new FixNGo.Domain.DomainException("file.size_invalid", "File must be 1 byte–10 MB.");
        if (!HasExpectedSignature(buffer.GetBuffer(), (int)buffer.Length, expected))
            throw new FixNGo.Domain.DomainException("file.type_invalid", "File content does not match its type.");
        var storedName = Guid.NewGuid().ToString("N") + ext;
        Directory.CreateDirectory(paths.UploadsDir);
        var full = Path.Combine(paths.UploadsDir, storedName);
        await File.WriteAllBytesAsync(full, buffer.ToArray(), ct);
        var record = new UploadedFile
        {
            FileName = Path.GetFileName(fileName), StoredName = storedName,
            ContentType = contentType, SizeBytes = buffer.Length, Purpose = purpose
        };
        db.UploadedFiles.Add(record);
        await db.SaveChangesAsync(ct);
        return (record.Id, storedName);
    }

    public async Task<Stream?> OpenAsync(Guid id, CancellationToken ct = default)
    {
        var record = await db.UploadedFiles.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (record is null) return null;
        var full = Path.Combine(paths.UploadsDir, record.StoredName);
        if (!File.Exists(full)) return null;
        var bytes = await File.ReadAllBytesAsync(full, ct);
        return new MemoryStream(bytes);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var record = await db.UploadedFiles.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (record is null) return;
        var full = Path.Combine(paths.UploadsDir, record.StoredName);
        if (File.Exists(full)) File.Delete(full);
        db.UploadedFiles.Remove(record);
        await db.SaveChangesAsync(ct);
    }
}
