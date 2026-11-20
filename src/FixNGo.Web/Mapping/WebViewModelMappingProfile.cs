using AutoMapper;
using FixNGo.Application.DTOs;
using FixNGo.Application.Interfaces;
using FixNGo.Web.ViewModels;

namespace FixNGo.Web.Mapping;

/// <summary>Maps Application DTOs to Presentation Razor ViewModels in FixNGo.Web.</summary>
public sealed class WebViewModelMappingProfile : Profile
{
    public WebViewModelMappingProfile()
    {
        CreateMap<SystemStatusDto, SystemStatusViewModel>();

        CreateMap<CenterDto, ServiceCenterItemViewModel>()
            .ForMember(d => d.City, o => o.MapFrom(s => ExtractCity(s.Address)))
            .ForMember(d => d.Services, o => o.MapFrom(s => s.Services ?? Array.Empty<string>()))
            .ForMember(d => d.StartingPriceEgp, o => o.MapFrom(s => s.StartingPriceMinor.HasValue ? s.StartingPriceMinor.Value / 100m : (decimal?)null));

        CreateMap<CenterServiceDto, ServiceOfferingViewModel>()
            .ForMember(d => d.PriceEgp, o => o.MapFrom(s => s.PriceMinor / 100m));

        CreateMap<ReviewDto, CustomerReviewViewModel>()
            .ForMember(d => d.AuthorName, o => o.MapFrom(s => string.IsNullOrWhiteSpace(s.AuthorName) ? "Verified Driver" : s.AuthorName));
    }

    public static string ExtractCity(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return "Cairo";
        if (address.Contains("Alexandria", StringComparison.OrdinalIgnoreCase) || address.Contains("الإسكندرية", StringComparison.Ordinal))
            return "Alexandria";
        if (address.Contains("Giza", StringComparison.OrdinalIgnoreCase) || address.Contains("الجيزة", StringComparison.Ordinal)
            || address.Contains("October", StringComparison.OrdinalIgnoreCase) || address.Contains("Zayed", StringComparison.OrdinalIgnoreCase)
            || address.Contains("Dokki", StringComparison.OrdinalIgnoreCase))
            return "Giza";
        return "Cairo";
    }
}
