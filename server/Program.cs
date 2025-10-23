using System.Text.Json;
using System.Text.Json.Serialization;
using BarbeariaGalileu.Server.Data;
using BarbeariaGalileu.Server.Exceptions;
using BarbeariaGalileu.Server.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

ConfigureServices(builder);

var app = builder.Build();

ConfigureMiddleware(app);

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.MapControllers();
app.MapGet("/api/health", () => Results.Json(new { status = "ok" }));

app.Run();

static void ConfigureServices(WebApplicationBuilder builder)
{
    var connectionString = ResolveConnectionString(builder);

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(connectionString));

    builder.Services.AddScoped<IHaircutService, HaircutService>();
    builder.Services.AddScoped<ISlotAvailabilityService, SlotAvailabilityService>();
    builder.Services.AddScoped<IAppointmentService, AppointmentService>();
    builder.Services.AddScoped<IBlockedSlotService, BlockedSlotService>();

    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

    var allowedOrigins = ResolveAllowedOrigins(builder.Configuration);

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("Default", policy =>
        {
            if (allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            }
            else
            {
                policy.AllowAnyOrigin()
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            }
        });
    });
}

static void ConfigureMiddleware(WebApplication app)
{
    app.UseCors("Default");

    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (HttpException httpEx)
        {
            var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("HttpException");
            logger.LogWarning(httpEx, "Handled application error");

            context.Response.StatusCode = httpEx.StatusCode;
            context.Response.ContentType = "application/json";
            var payload = JsonSerializer.Serialize(new
            {
                message = httpEx.Message,
                details = httpEx.Details,
            });
            await context.Response.WriteAsync(payload);
        }
        catch (Exception ex)
        {
            var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("UnhandledException");
            logger.LogError(ex, "Unhandled error");

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            var payload = JsonSerializer.Serialize(new
            {
                message = "Erro interno no servidor",
            });
            await context.Response.WriteAsync(payload);
        }
    });

    app.UseAuthorization();
}

static string ResolveConnectionString(WebApplicationBuilder builder)
{
    var configuration = builder.Configuration;

    var connectionString = configuration.GetConnectionString("DefaultConnection");
    var databaseUrl = configuration["DATABASE_URL"];

    if (!string.IsNullOrWhiteSpace(databaseUrl))
    {
        connectionString = databaseUrl;
    }

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Connection string not configured. Defina ConnectionStrings:DefaultConnection ou a variável de ambiente DATABASE_URL.");
    }

    var sqliteBuilder = new SqliteConnectionStringBuilder(connectionString);

    if (!Path.IsPathRooted(sqliteBuilder.DataSource))
    {
        var dataSource = Path.Combine(builder.Environment.ContentRootPath, sqliteBuilder.DataSource);
        Directory.CreateDirectory(Path.GetDirectoryName(dataSource)!);
        sqliteBuilder.DataSource = dataSource;
    }

    return sqliteBuilder.ToString();
}

static string[] ResolveAllowedOrigins(ConfigurationManager configuration)
{
    var fromConfig = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
    var fromEnv = configuration["ALLOWED_ORIGINS"];

    return fromConfig
        .Concat(ParseOrigins(fromEnv))
        .Select(origin => origin.Trim())
        .Where(origin => !string.IsNullOrWhiteSpace(origin))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();
}

static IEnumerable<string> ParseOrigins(string? rawOrigins)
{
    if (string.IsNullOrWhiteSpace(rawOrigins))
    {
        return Array.Empty<string>();
    }

    return rawOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
