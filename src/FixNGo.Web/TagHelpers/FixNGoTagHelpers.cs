using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Razor.TagHelpers;

namespace FixNGo.Web.TagHelpers;

/// <summary>
/// ASP.NET Core Razor TagHelper that emits pre-paint theme/RTL hydration, fixed '/' URL locking,
/// and mobile viewport interaction guards (blocking F12/contextmenu/text-drag while allowing copy/paste).
/// </summary>
[HtmlTargetElement("fixngo-client-protection")]
public sealed class ClientProtectionTagHelper : TagHelper
{
    [HtmlAttributeName("initial-route")]
    public string? InitialRoute { get; set; }

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = "script";
        output.TagMode = TagMode.StartTagAndEndTag;

        var encodedRoute = string.IsNullOrWhiteSpace(InitialRoute)
            ? string.Empty
            : JavaScriptEncoder.Default.Encode(InitialRoute);

        var script = $$"""
            (function () {
              'use strict';
              var serverHint = '{{encodedRoute}}';
              var t = localStorage.getItem('fixngo.theme') || 'light';
              var l = localStorage.getItem('fixngo.lang') || 'en';
              document.documentElement.classList.toggle('dark', t === 'dark');
              document.documentElement.lang = l;
              document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';

              try {
                if (window.location.hash) {
                  sessionStorage.setItem('fixngo.pendingHash', window.location.hash);
                } else if (serverHint) {
                  sessionStorage.setItem('fixngo.pendingHash', serverHint);
                } else if (window.location.pathname && window.location.pathname !== '/') {
                  var seg = window.location.pathname.replace(/^\/+/, '');
                  if (seg) sessionStorage.setItem('fixngo.pendingHash', '#/' + seg + (window.location.search || ''));
                }
                if (window.location.hash || window.location.search || (window.location.pathname && window.location.pathname !== '/')) {
                  window.history.replaceState(null, '', '/');
                }
              } catch (err) {}

              var isEditable = function (el) {
                return !!(el && el.closest && el.closest('input, textarea, [contenteditable="true"], .allow-select'));
              };

              document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
              document.addEventListener('mousedown', function (e) { if (e.button === 2) e.preventDefault(); }, true);
              document.addEventListener('selectstart', function (e) {
                if (document.documentElement.getAttribute('data-phone-dragging') === '1') {
                  e.preventDefault();
                  return;
                }
                if (isEditable(e.target)) return;
                e.preventDefault();
              }, true);
              document.addEventListener('dragstart', function (e) { e.preventDefault(); }, true);
              document.addEventListener('keydown', function (e) {
                var k = String(e.key || '');
                var upper = k.toUpperCase();
                var lower = k.toLowerCase();
                var ctrl = e.ctrlKey || e.metaKey;
                var fnBlocked = /^F(12|11|10|9)$/i.test(k);
                var devCombo =
                  (ctrl && e.shiftKey && ['I', 'J', 'C', 'K'].indexOf(upper) !== -1) ||
                  (e.metaKey && e.altKey && ['I', 'J', 'C', 'U'].indexOf(upper) !== -1);
                var pageCombo = ctrl && ['u', 's', 'p'].indexOf(lower) !== -1;
                if (fnBlocked || devCombo || pageCombo) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                if (ctrl && lower === 'a' && !isEditable(e.target)) {
                  e.preventDefault();
                }
              }, true);
              window.addEventListener('beforeprint', function () {
                if (document.getElementById('print-guard')) return;
                var d = document.createElement('style');
                d.id = 'print-guard';
                d.textContent = '#root { visibility: hidden !important; }';
                document.head.appendChild(d);
              });
              window.addEventListener('afterprint', function () {
                var d = document.getElementById('print-guard');
                if (d) d.remove();
              });
            })();
            """;

        output.Content.SetHtmlContent(script);
    }
}

/// <summary>Razor TagHelper rendering semantic status badges in server-rendered MVC views.</summary>
[HtmlTargetElement("fixngo-status-badge")]
public sealed class StatusBadgeTagHelper : TagHelper
{
    [HtmlAttributeName("status")]
    public string Status { get; set; } = "Active";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = "span";
        output.TagMode = TagMode.StartTagAndEndTag;
        var tone = Status.ToLowerInvariant() switch
        {
            "active" or "approved" or "completed" or "verified" or "real" => "badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill px-3 py-1",
            "dummy" or "pending" or "submitted" => "badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-3 py-1",
            _ => "badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle rounded-pill px-3 py-1"
        };
        output.Attributes.SetAttribute("class", tone);
        output.Content.SetContent(Status);
    }
}
