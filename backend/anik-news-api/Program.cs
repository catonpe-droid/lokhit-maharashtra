// Lokhit Maharashtra: optional no-login CMS publishing bridge for a private ANIK network.
// The website remains on GitHub Pages. This API writes only new article files to GitHub.
// NEVER put ANIK_NEWS_GITHUB_TOKEN in the website, repository config or browser JavaScript.
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 10_000_000);
builder.Services.AddHttpClient("github", c =>
{
    c.BaseAddress = new Uri("https://api.github.com/");
    c.DefaultRequestHeaders.UserAgent.ParseAdd("LokhitMaharashtra-ANIKNewsPublisher/1.0");
    c.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
    c.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
    c.Timeout = TimeSpan.FromSeconds(30);
});
var app = builder.Build();

const string repo = "catonpe-droid/lokhit-maharashtra";
const string publicSite = "https://catonpe-droid.github.io/lokhit-maharashtra/";
string token = Environment.GetEnvironmentVariable("ANIK_NEWS_GITHUB_TOKEN") ?? "";
bool enabled = string.Equals(Environment.GetEnvironmentVariable("ANIK_NEWS_PUBLISH_ENABLED"), "true", StringComparison.OrdinalIgnoreCase);
var ipAllowList = (Environment.GetEnvironmentVariable("ANIK_NEWS_ALLOWED_REMOTE_IPS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(x => IPAddress.TryParse(x, out var ip) ? ip.MapToIPv6().ToString() : "")
    .Where(x => x.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
var allowedOrigin = Environment.GetEnvironmentVariable("ANIK_NEWS_SITE_ORIGIN") ?? "https://catonpe-droid.github.io";

app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (context.Request.Headers.Origin == allowedOrigin)
    {
        context.Response.Headers.AccessControlAllowOrigin = allowedOrigin;
        context.Response.Headers.Vary = "Origin";
        context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = "Content-Type";
    }
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = context.Request.Headers.Origin == allowedOrigin ? 204 : 403;
        return;
    }
    await next();
});

bool ClientAllowed(HttpContext ctx)
{
    // Require an explicit IP allowlist. Do not trust X-Forwarded-For supplied by visitors.
    // IIS / reverse proxy must block external requests and preserve real client IPs.
    var ip = ctx.Connection.RemoteIpAddress?.MapToIPv6().ToString();
    return ip is not null && ipAllowList.Contains(ip);
}

app.MapGet("/health", () => Results.Ok(new
{
    ok = true,
    publishingConfigured = enabled && token.Length > 0 && ipAllowList.Count > 0,
    hosting = "GitHub Pages"
}));

app.MapPost("/publish", async (HttpContext context, IHttpClientFactory factory) =>
{
    if (!enabled || token.Length == 0 || ipAllowList.Count == 0)
        return Results.Json(new { error = "ANIK Publish API configuration pending." }, statusCode: 503);
    if (!ClientAllowed(context))
        return Results.Json(new { error = "Publishing is available only from your permitted ANIK network." }, statusCode: 403);
    if (context.Request.ContentLength > 2_500_000)
        return Results.BadRequest(new { error = "Photo or news is too large." });

    NewsInput? input;
    try { input = await context.Request.ReadFromJsonAsync<NewsInput>(); }
    catch (Exception) { return Results.BadRequest(new { error = "Invalid news data." }); }
    if (input is null) return Results.BadRequest(new { error = "News data required." });

    string title = input.Title?.Trim() ?? "";
    string summary = input.Description?.Trim() ?? "";
    string body = input.Body?.Trim() ?? "";
    string category = input.Category?.Trim() ?? "महाराष्ट्र";
    if (title.Length is < 6 or > 180 || summary.Length is < 6 or > 300 ||
        body.Length is < 20 or > 40000 || category.Length is < 2 or > 60)
        return Results.BadRequest(new { error = "बातमीचे शीर्षक, सारांश, मजकूर आणि विभाग तपासा." });

    var slug = "news-" + DateTimeOffset.UtcNow.ToString("yyyyMMddHHmmss") + "-" +
        Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();
    var now = DateTimeOffset.UtcNow.ToString("O");
    string image = "assets/img/logo.webp";
    var client = factory.CreateClient("github");

    async Task<(bool Success, string Error)> PutFile(string path, byte[] bytes)
    {
        var payload = JsonSerializer.Serialize(new
        {
            message = "Publish Lokhit news " + slug,
            branch = "main",
            content = Convert.ToBase64String(bytes)
        });
        using var request = new HttpRequestMessage(HttpMethod.Put, $"repos/{repo}/contents/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var reply = await client.SendAsync(request);
        return reply.IsSuccessStatusCode
            ? (true, "")
            : (false, "GitHub returned HTTP " + (int)reply.StatusCode);
    }

    if (!string.IsNullOrWhiteSpace(input.ImageBase64))
    {
        byte[] data;
        try { data = Convert.FromBase64String(input.ImageBase64); }
        catch (FormatException) { return Results.BadRequest(new { error = "अवैध फोटो." }); }
        if (data.Length is < 1500 or > 950_000 || data[0] != 0xff || data[1] != 0xd8 || data[2] != 0xff)
            return Results.BadRequest(new { error = "फोटो JPEG व 950 KB पेक्षा लहान असावा." });
        image = $"assets/img/{slug}.jpg";
        var photoCommit = await PutFile(image, data);
        if (!photoCommit.Success) return Results.Json(new { error = "फोटो अपलोड झाला नाही: " + photoCommit.Error }, statusCode: 502);
    }

    var article = new
    {
        slug,
        title,
        description = summary,
        body,
        category,
        image,
        author = string.IsNullOrWhiteSpace(input.Author) ? "लोकहित महाराष्ट्र डिजिटल डेस्क" : input.Author.Trim()[..Math.Min(input.Author.Trim().Length, 90)],
        date = now,
        updated = now,
        status = "published",
        featured = input.Featured,
        video = "",
        tags = new[] { "महाराष्ट्र", category }
    };
    var newsCommit = await PutFile($"content/posts/{slug}.json", Encoding.UTF8.GetBytes(JsonSerializer.Serialize(article)));
    if (!newsCommit.Success)
        return Results.Json(new { error = "GitHub बातमी जतन झाली नाही: " + newsCommit.Error }, statusCode: 502);
    return Results.Ok(new { saved = true, status = "building", slug, url = publicSite + "batmi/" + slug + "/", title });
});
app.MapStudioEndpoints(token, enabled, ipAllowList);
app.Run();

public sealed record NewsInput(string? Title, string? Description, string? Body, string? Category,
    string? Author, bool Featured, string? ImageBase64);
