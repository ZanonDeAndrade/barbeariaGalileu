namespace BarbeariaGalileu.Server.Exceptions;

public class HttpException : Exception
{
    public int StatusCode { get; }
    public object? Details { get; }

    public HttpException(int statusCode, string message, object? details = null)
        : base(message)
    {
        StatusCode = statusCode;
        Details = details;
    }
}
