using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Domain;
using FixNGo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FixNGo.Application.Services;

/// <summary>Customer vehicle book with normalised, owner-unique plates.</summary>
public sealed class VehicleService(IAppDbContext db)
{
    public async Task<IReadOnlyList<VehicleDto>> ListAsync(Guid ownerId, CancellationToken ct = default) =>
        await db.Vehicles.Where(v => v.OwnerId == ownerId).OrderByDescending(v => v.IsPrimary)
            .ThenBy(v => v.CreatedAt).Select(v => Mappings.Vehicle(v)).ToListAsync(ct);

    public async Task<VehicleDto> GetAsync(Guid ownerId, Guid id, CancellationToken ct = default)
    {
        var v = await Owned(ownerId, id, ct);
        return Mappings.Vehicle(v);
    }

    public async Task<VehicleDto> CreateAsync(Guid ownerId, VehicleRequest req, CancellationToken ct = default)
    {
        if (!Enum.TryParse<FuelType>(req.Fuel, true, out var fuel))
            throw new DomainException("vehicle.fuel_invalid", "Unknown fuel type.");
        var plate = Rules.NormalisePlate(req.Plate);
        if (plate.Length == 0) throw new DomainException("vehicle.plate_required", "Plate is required.");
        if (await db.Vehicles.AnyAsync(v => v.OwnerId == ownerId && v.Plate == plate, ct))
            throw new DomainException("vehicle.plate_exists", "A vehicle with this plate already exists.");
        if (req.Year < 1950 || req.Year > DateTime.UtcNow.Year + 1)
            throw new DomainException("vehicle.year_invalid", "Invalid model year.");

        var vehicle = new Vehicle
        {
            OwnerId = ownerId, Make = req.Make.Trim(), Model = req.Model.Trim(), Year = req.Year,
            Plate = plate, Color = req.Color.Trim(), Fuel = fuel, IsPrimary = req.IsPrimary
        };
        if (req.IsPrimary)
            foreach (var other in db.Vehicles.Where(v => v.OwnerId == ownerId && v.IsPrimary))
                other.IsPrimary = false;
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync(ct);
        return Mappings.Vehicle(vehicle);
    }

    public async Task<VehicleDto> UpdateAsync(Guid ownerId, Guid id, VehicleRequest req, CancellationToken ct = default)
    {
        var v = await Owned(ownerId, id, ct);
        if (!Enum.TryParse<FuelType>(req.Fuel, true, out var fuel))
            throw new DomainException("vehicle.fuel_invalid", "Unknown fuel type.");
        var plate = Rules.NormalisePlate(req.Plate);
        if (await db.Vehicles.AnyAsync(x => x.OwnerId == ownerId && x.Plate == plate && x.Id != id, ct))
            throw new DomainException("vehicle.plate_exists", "A vehicle with this plate already exists.");
        v.Make = req.Make.Trim(); v.Model = req.Model.Trim(); v.Year = req.Year; v.Plate = plate;
        v.Color = req.Color.Trim(); v.Fuel = fuel;
        if (req.IsPrimary)
        {
            foreach (var other in db.Vehicles.Where(x => x.OwnerId == ownerId && x.IsPrimary && x.Id != id))
                other.IsPrimary = false;
            v.IsPrimary = true;
        }
        await db.SaveChangesAsync(ct);
        return Mappings.Vehicle(v);
    }

    public async Task DeleteAsync(Guid ownerId, Guid id, CancellationToken ct = default)
    {
        var v = await Owned(ownerId, id, ct);
        if (await db.ServiceRequests.AnyAsync(r => r.VehicleId == id, ct))
            throw new DomainException("vehicle.in_use", "This vehicle is referenced by a request.");
        db.Vehicles.Remove(v);
        await db.SaveChangesAsync(ct);
    }

    public async Task<VehicleDto> SetPrimaryAsync(Guid ownerId, Guid id, CancellationToken ct = default)
    {
        var v = await Owned(ownerId, id, ct);
        foreach (var other in db.Vehicles.Where(x => x.OwnerId == ownerId && x.IsPrimary && x.Id != id))
            other.IsPrimary = false;
        v.IsPrimary = true;
        await db.SaveChangesAsync(ct);
        return Mappings.Vehicle(v);
    }

    private async Task<Vehicle> Owned(Guid ownerId, Guid id, CancellationToken ct) =>
        await db.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.OwnerId == ownerId, ct)
        ?? throw new DomainException("vehicle.not_found", "Vehicle not found.");
}
