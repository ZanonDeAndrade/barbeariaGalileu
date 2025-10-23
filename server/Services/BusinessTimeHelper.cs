using System.Globalization;

namespace BarbeariaGalileu.Server.Services;

internal static class BusinessTimeHelper
{
    public const int BusinessStartHour = 8;
    public const int BusinessEndHour = 20;
    public const int SlotIntervalMinutes = 30;

    private static readonly TimeZoneInfo LocalTimeZone = TimeZoneInfo.Local;

    public static DateTime GetUtcStartOfLocalDay(DateOnly localDate) =>
        ToUtc(localDate.ToDateTime(TimeOnly.MinValue));

    public static DateTime GetUtcEndOfLocalDay(DateOnly localDate) =>
        GetUtcStartOfLocalDay(localDate.AddDays(1)).AddTicks(-1);

    public static DateTime GetUtcStartOfLocalDay(DateTime utcDateTime)
    {
        var utc = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
        var localDate = TimeZoneInfo.ConvertTimeFromUtc(utc, LocalTimeZone).Date;
        return GetUtcStartOfLocalDay(DateOnly.FromDateTime(localDate));
    }

    public static DateTime GetUtcEndOfLocalDay(DateTime utcDateTime)
    {
        var utcStart = GetUtcStartOfLocalDay(utcDateTime);
        return utcStart.AddDays(1).AddTicks(-1);
    }

    public static List<DateTime> GenerateDailySlots(DateOnly localDate)
    {
        var start = localDate.ToDateTime(new TimeOnly(BusinessStartHour, 0));
        var end = localDate.ToDateTime(new TimeOnly(BusinessEndHour, 0));

        var slots = new List<DateTime>();
        var current = start;

        while (current < end)
        {
            slots.Add(ToUtc(current));
            current = current.AddMinutes(SlotIntervalMinutes);
        }

        return slots;
    }

    public static DateTime? NormalizeToBusinessSlot(DateTime dateTimeUtc)
    {
        var utc = DateTime.SpecifyKind(dateTimeUtc, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, LocalTimeZone);
        var slots = GenerateDailySlots(DateOnly.FromDateTime(local));

        foreach (var slot in slots)
        {
            if (slot == utc)
            {
                return slot;
            }
        }

        return null;
    }

    public static List<DateTime> ComputeSequentialSlots(DateTime startSlotUtc, int durationMinutes)
    {
        var utc = DateTime.SpecifyKind(startSlotUtc, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, LocalTimeZone);
        var businessSlots = GenerateDailySlots(DateOnly.FromDateTime(local));
        var slotMap = businessSlots.ToDictionary(slot => slot.Ticks, slot => slot);

        var slotsNeeded = Math.Max(1, (int)Math.Ceiling(durationMinutes / (double)SlotIntervalMinutes));
        var result = new List<DateTime>();

        for (var index = 0; index < slotsNeeded; index++)
        {
            var targetUtc = utc.AddMinutes(SlotIntervalMinutes * index);
            if (!slotMap.TryGetValue(targetUtc.Ticks, out var match))
            {
                break;
            }

            result.Add(match);
        }

        return result;
    }

    public static bool TryParseIsoDateTime(string value, out DateTime result)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            result = default;
            return false;
        }

        var styles = DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal;
        if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, styles, out var parsed))
        {
            result = default;
            return false;
        }

        result = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        return true;
    }

    public static string ToIsoString(DateTime utcDateTime) =>
        DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc).ToString("o", CultureInfo.InvariantCulture);

    private static DateTime ToUtc(DateTime localDateTime)
    {
        var unspecified = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
        var offset = LocalTimeZone.GetUtcOffset(unspecified);
        return new DateTimeOffset(unspecified, offset).UtcDateTime;
    }
}
