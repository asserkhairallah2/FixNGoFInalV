using FixNGo.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace FixNGo.Web.ViewComponents;

/// <summary>Server-side Razor ViewComponent exposing FixNGo runtime metadata on the MVC host shell.</summary>
public sealed class SystemRibbonViewComponent : ViewComponent
{
    public IViewComponentResult Invoke(SystemStatusViewModel status) => View(status);
}
