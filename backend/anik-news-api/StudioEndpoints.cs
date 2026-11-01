// Optional private-network WordPress-style editorial API for Lokhit Maharashtra.
// The GitHub token stays in ANIK server environment settings, never browser code.
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

public static class StudioEndpoints
{
    private const string Repo="catonpe-droid/lokhit-maharashtra";
    private const string PublicUrl="https://catonpe-droid.github.io/lokhit-maharashtra/";
    private static readonly Regex AssetPattern=new(@"^assets/img/(?!.*\.\.)[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$",RegexOptions.IgnoreCase|RegexOptions.Compiled);
    private static readonly Regex SlugPattern=new(@"^[a-z0-9][a-z0-9-]{2,95}$",RegexOptions.Compiled);
    private static readonly Regex VideoPattern=new(@"(?:youtube(?:-nocookie)?\.com/(?:watch\?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})",RegexOptions.IgnoreCase|RegexOptions.Compiled);
    private static readonly JsonSerializerOptions WebJson=new(JsonSerializerDefaults.Web);

    private static HttpRequestMessage Req(HttpMethod method,string token,string path,object? body=null)
    {
        var req=new HttpRequestMessage(method,"repos/"+Repo+"/"+path);
        req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        if(body is not null)req.Content=new StringContent(JsonSerializer.Serialize(body),Encoding.UTF8,"application/json");
        return req;
    }
    private static async Task<(JsonObject? Data,int Status)> Fetch(HttpClient client,string token,string path)
    {
        using var req=Req(HttpMethod.Get,token,path);
        using var res=await client.SendAsync(req);
        if(!res.IsSuccessStatusCode)return(null,(int)res.StatusCode);
        return(JsonNode.Parse(await res.Content.ReadAsStringAsync()) as JsonObject,(int)res.StatusCode);
    }
    private static async Task<(bool Ok,string Error)> Put(HttpClient client,string token,string path,byte[] bytes,string? sha=null)
    {
        var input=new Dictionary<string,object?> {["branch"]="main",["message"]="Lokhit Studio: "+path,["content"]=Convert.ToBase64String(bytes)};
        if(sha is not null)input["sha"]=sha;
        using var req=Req(HttpMethod.Put,token,"contents/"+path,input);
        using var res=await client.SendAsync(req);
        return(res.IsSuccessStatusCode,res.IsSuccessStatusCode?"":"GitHub HTTP "+(int)res.StatusCode);
    }
    private static async Task<(bool Ok,string Error)> Delete(HttpClient client,string token,string path,string sha)
    {
        using var req=Req(HttpMethod.Delete,token,"contents/"+path,new{message="Lokhit Studio: remove "+path,sha,branch="main"});
        using var res=await client.SendAsync(req);
        return(res.IsSuccessStatusCode,res.IsSuccessStatusCode?"":"GitHub HTTP "+(int)res.StatusCode);
    }
    private static string? YoutubeId(string? value)
    {
        if(string.IsNullOrWhiteSpace(value))return null;
        var match=VideoPattern.Match(value);
        return match.Success?match.Groups[1].Value:null;
    }
    private static byte[] DecodePhoto(string? base64,int limit)
    {
        if(string.IsNullOrWhiteSpace(base64)||base64.Length>limit*2)throw new InvalidDataException("फोटोचा आकार अधिक आहे.");
        byte[] data;
        try{data=Convert.FromBase64String(base64);}
        catch{throw new InvalidDataException("JPEG फोटोचे स्वरूप अवैध आहे.");}
        if(data.Length<1000||data.Length>limit||data[0]!=0xff||data[1]!=0xd8||data[2]!=0xff)
            throw new InvalidDataException("फोटो JPEG स्वरूपात व दिलेल्या मर्यादेत हवा.");
        return data;
    }
    private static string RandomSuffix()=>Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();

    public static void MapStudioEndpoints(this WebApplication app,string token,bool enabled,HashSet<string> ipAllowList)
    {
        bool Allowed(HttpContext ctx)
        {
            var ip=ctx.Connection.RemoteIpAddress?.MapToIPv6().ToString();
            return ip is not null&&ipAllowList.Contains(ip);
        }
        IResult Deny(HttpContext ctx)
        {
            if(!enabled||token.Length==0||ipAllowList.Count==0)
                return Results.Json(new{error="ANIK Studio publishing not configured."},statusCode:503);
            return Results.Json(new{error="ANIK private network / approved IP required."},statusCode:403);
        }
        var group=app.MapGroup("/studio");
        group.MapGet("/posts",async (HttpContext ctx,IHttpClientFactory factory)=>
        {
            if(!enabled||token.Length==0||!Allowed(ctx))return Deny(ctx);
            try
            {
                var client=factory.CreateClient("github");
                using var req=Req(HttpMethod.Get,token,"contents/content/posts?ref=main");
                using var res=await client.SendAsync(req);
                if(!res.IsSuccessStatusCode)return Results.Json(new{error="Could not load GitHub post listing."},statusCode:502);
                var entries=JsonNode.Parse(await res.Content.ReadAsStringAsync()) as JsonArray;
                if(entries is null)return Results.Json(new{error="GitHub post directory missing."},statusCode:502);
                var names=entries.OfType<JsonObject>().Select(x=>x["name"]?.GetValue<string>()??"")
                    .Where(x=>Regex.IsMatch(x,@"^[a-z0-9_-]+\.json$",RegexOptions.IgnoreCase)).Take(400).ToArray();
                using var gate=new SemaphoreSlim(5);
                var tasks=names.Select(async name=>
                {
                    await gate.WaitAsync();
                    try
                    {
                        var (data,status)=await Fetch(client,token,"contents/content/posts/"+name+"?ref=main");
                        if(status!=200||data is null)return null;
                        var encoded=data["content"]?.GetValue<string>()?.Replace("\n","").Replace("\r","");
                        if(encoded is null)return null;
                        var news=JsonNode.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(encoded))) as JsonObject;
                        if(news is not null)news["_sha"]=data["sha"]?.GetValue<string>();
                        return news;
                    }
                    finally{gate.Release();}
                }).ToArray();
                var posts=(await Task.WhenAll(tasks)).Where(p=>p is not null).ToArray();
                return Results.Ok(posts);
            }
            catch{return Results.Json(new{error="Could not read news from GitHub."},statusCode:502);}
        });
        group.MapPost("/save",async (HttpContext ctx,IHttpClientFactory factory)=>
        {
            if(!enabled||token.Length==0||!Allowed(ctx))return Deny(ctx);
            StudioArticleInput? input;
            try{input=await ctx.Request.ReadFromJsonAsync<StudioArticleInput>();}
            catch{return Results.BadRequest(new{error="बातमीचा JSON डेटा वैध नाही."});}
            if(input is null)return Results.BadRequest(new{error="बातमीचा डेटा आवश्यक आहे."});
            var title=input.Title?.Trim()??"";
            var description=input.Description?.Trim()??"";
            var body=input.Body?.Trim()??"";
            var category=input.Category?.Trim()??"महाराष्ट्र";
            var status=input.Status=="draft"?"draft":"published";
            if(title.Length is <6 or >180 || description.Length is <6 or >300||
               body.Length is <20 or >40000||category.Length is <2 or >60)
                return Results.BadRequest(new{error="मथळा, सारांश, मजकूर किंवा विभाग तपासा."});
            var inline=input.InlineImages??new List<string>();
            if(inline.Count>8||input.RichDelta is null||input.RichDelta.Count is <1 or >2500)
                return Results.BadRequest(new{error="Rich Text किंवा ८ फोटो मर्यादा तपासा."});
            JsonArray ops;
            try{ops=input.RichDelta.DeepClone().AsArray();}
            catch{return Results.BadRequest(new{error="Editor data invalid."});}
            if(ops.ToJsonString().Length>250000)return Results.BadRequest(new{error="बातमीचा फॉरमॅट खूप मोठा आहे."});
            var slug=string.IsNullOrWhiteSpace(input.Slug)?"news-"+DateTimeOffset.UtcNow.ToString("yyyyMMddHHmmss")+"-"+RandomSuffix():input.Slug.Trim();
            if(!SlugPattern.IsMatch(slug))return Results.BadRequest(new{error="News URL/slug अवैध आहे."});
            var video=string.IsNullOrWhiteSpace(input.Video)?"":input.Video.Trim();
            if(video.Length>0&&YoutubeId(video) is null)return Results.BadRequest(new{error="YouTube URL अवैध आहे."});
            var client=factory.CreateClient("github");
            JsonObject? old=null;string? oldSha=null;
            try
            {
                var (file,fileStatus)=await Fetch(client,token,"contents/content/posts/"+slug+".json?ref=main");
                if(fileStatus==200&&file is not null)
                {
                    oldSha=file["sha"]?.GetValue<string>();
                    var encoded=file["content"]?.GetValue<string>()?.Replace("\n","").Replace("\r","");
                    if(encoded is not null)old=JsonNode.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(encoded))) as JsonObject;
                }
                else if(fileStatus!=404)return Results.Json(new{error="Existing article could not be verified."},statusCode:502);
                if(input.Slug is not null&&old is null)return Results.NotFound(new{error="Editing article not found."});
                if(input.Slug is null&&old is not null)return Results.Conflict(new{error="News ID collision. Retry."});
            }
            catch{return Results.Json(new{error="GitHub connection error."},statusCode:502);}
            var paths=new List<string>();
            try
            {
                foreach(var raw in inline)paths.Add("assets/img/"+slug+"-inline-"+RandomSuffix()+".jpg");
                int used=0;
                foreach(var n in ops)
                {
                    if(n is not JsonObject op||op["insert"] is null)
                        return Results.BadRequest(new{error="Editor format चुकीचा आहे."});
                    if(op["insert"] is JsonValue textNode)
                    {
                        if(!textNode.TryGetValue<string>(out var word)||word.Length>40000)
                            return Results.BadRequest(new{error="Editor text invalid."});
                        continue;
                    }
                    if(op["insert"] is not JsonObject embed)
                        return Results.BadRequest(new{error="Editor media invalid."});
                    if(embed["image"] is JsonValue imageNode)
                    {
                        var src=imageNode.GetValue<string>();
                        if(src.StartsWith("upload:",StringComparison.Ordinal))
                        {
                            if(!int.TryParse(src["upload:".Length..],out var idx)||idx<0||idx>=paths.Count)
                                return Results.BadRequest(new{error="Inline photo reference invalid."});
                            embed["image"]=paths[idx];
                            used++;
                        }
                        else if(!AssetPattern.IsMatch(src))
                            return Results.BadRequest(new{error="Inline photo must be uploaded to GitHub assets."});
                    }
                    else if(embed["video"] is JsonValue vid)
                    {
                        var id=YoutubeId(vid.GetValue<string>());
                        if(id is null)return Results.BadRequest(new{error="YouTube embed invalid."});
                        embed["video"]="https://www.youtube-nocookie.com/embed/"+id;
                    }
                    else return Results.BadRequest(new{error="Unsupported editor media."});
                }
                if(used!=inline.Count)return Results.BadRequest(new{error="Unused inline photo upload."});
                var assets=new List<byte[]>();
                foreach(var raw in inline)assets.Add(DecodePhoto(raw,430000));
                byte[]? coverBytes=null;
                if(!string.IsNullOrWhiteSpace(input.CoverBase64))coverBytes=DecodePhoto(input.CoverBase64,850000);
                string cover=old?["image"]?.GetValue<string>()??"assets/img/logo.webp";
                if(coverBytes is not null)cover="assets/img/"+slug+"-cover-"+RandomSuffix()+".jpg";
                else if(!string.IsNullOrWhiteSpace(input.CoverPath)&&AssetPattern.IsMatch(input.CoverPath))
                    cover=input.CoverPath;
                else if(old is null&&paths.Count>0)cover=paths[0];
                if(coverBytes is not null)
                {
                    var done=await Put(client,token,cover,coverBytes);
                    if(!done.Ok)return Results.Json(new{error="Cover upload failed: "+done.Error},statusCode:502);
                }
                for(int i=0;i<assets.Count;i++)
                {
                    var done=await Put(client,token,paths[i],assets[i]);
                    if(!done.Ok)return Results.Json(new{error="Inline photo "+(i+1)+" upload failed: "+done.Error},statusCode:502);
                }
                var now=DateTimeOffset.UtcNow.ToString("O");
                var author=string.IsNullOrWhiteSpace(input.Author)?"लोकहित महाराष्ट्र डिजिटल डेस्क":input.Author.Trim()[..Math.Min(input.Author.Trim().Length,90)];
                var tags=(input.Tags??new List<string>()).Select(x=>x.Trim()).Where(x=>x.Length is >0 and <50).Take(15).ToArray();
                var article=new JsonObject
                {
                    ["slug"]=slug,["title"]=title,["description"]=description,["body"]=body,
                    ["category"]=category,["image"]=cover,["author"]=author,
                    ["date"]=old?["date"]?.GetValue<string>()??now,["updated"]=now,
                    ["status"]=status,["featured"]=input.Featured,["video"]=video,
                    ["tags"]=new JsonArray(tags.Select(x=>(JsonNode?)JsonValue.Create(x)).ToArray()),
                    ["rich_delta"]=ops
                };
                var saved=await Put(client,token,"content/posts/"+slug+".json",Encoding.UTF8.GetBytes(article.ToJsonString(new JsonSerializerOptions{WriteIndented=true})),oldSha);
                if(!saved.Ok)return Results.Json(new{error="News save failed: "+saved.Error},statusCode:502);
                return Results.Ok(new{saved=true,status=status=="draft"?"draft":"building",slug,title,url=PublicUrl+"batmi/"+slug+"/"});
            }
            catch(InvalidDataException err){return Results.BadRequest(new{error=err.Message});}
            catch{return Results.Json(new{error="Could not save the article."},statusCode:502);}
        });
        group.MapPost("/delete",async (HttpContext ctx,IHttpClientFactory factory)=>
        {
            if(!enabled||token.Length==0||!Allowed(ctx))return Deny(ctx);
            StudioDeleteInput? input;
            try{input=await ctx.Request.ReadFromJsonAsync<StudioDeleteInput>();}
            catch{return Results.BadRequest(new{error="Invalid delete request."});}
            var slug=input?.Slug??"";
            if(!SlugPattern.IsMatch(slug))return Results.BadRequest(new{error="Invalid article slug."});
            try
            {
                var client=factory.CreateClient("github");
                var (data,code)=await Fetch(client,token,"contents/content/posts/"+slug+".json?ref=main");
                if(code==404)return Results.NotFound(new{error="Article not found."});
                if(code!=200||data is null)return Results.Json(new{error="Article could not be checked."},statusCode:502);
                var sha=data["sha"]?.GetValue<string>();
                if(string.IsNullOrEmpty(sha))return Results.Json(new{error="Missing GitHub SHA."},statusCode:502);
                var done=await Delete(client,token,"content/posts/"+slug+".json",sha);
                if(!done.Ok)return Results.Json(new{error="Delete failed: "+done.Error},statusCode:502);
                return Results.Ok(new{deleted=true,slug});
            }
            catch{return Results.Json(new{error="GitHub connection error."},statusCode:502);}
        });
    }
}
public sealed record StudioArticleInput(string? Slug,string? Title,string? Description,string? Body,
    string? Category,string? Status,string? Author,string? Video,bool Featured,
    string? CoverBase64,string? CoverPath,JsonArray? RichDelta,
    List<string>? InlineImages,List<string>? Tags);
public sealed record StudioDeleteInput(string? Slug);
