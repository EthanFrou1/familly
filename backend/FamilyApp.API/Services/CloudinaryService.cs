using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace FamilyApp.API.Services;

public class CloudinaryService
{
    private readonly AmazonS3Client? _s3;
    private readonly string _bucket;
    private readonly string _publicUrl;

    public CloudinaryService(IConfiguration config)
    {
        _bucket = config["R2:BucketName"] ?? "family-app";
        _publicUrl = (config["R2:PublicUrl"] ?? "").TrimEnd('/');

        var accessKey = config["R2:AccessKeyId"];
        var secretKey = config["R2:SecretAccessKey"];
        var accountId = config["R2:AccountId"];

        if (string.IsNullOrEmpty(accessKey) || string.IsNullOrEmpty(accountId)) return;

        _s3 = new AmazonS3Client(
            new BasicAWSCredentials(accessKey, secretKey),
            new AmazonS3Config
            {
                ServiceURL = $"https://{accountId}.r2.cloudflarestorage.com",
                ForcePathStyle = true,
            }
        );
    }

    public async Task<(string Url, string PublicId)> UploadAsync(IFormFile file, string folder = "family")
    {
        if (_s3 is null) throw new InvalidOperationException("Le stockage R2 n'est pas configuré.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var key = $"{folder}/{Guid.NewGuid()}{ext}";

        await using var stream = file.OpenReadStream();
        var ms = new MemoryStream();
        await stream.CopyToAsync(ms);
        ms.Position = 0;
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = ms,
            ContentType = file.ContentType,
            UseChunkEncoding = false,
        });

        return ($"{_publicUrl}/{key}", key);
    }

    public async Task DeleteAsync(string publicId)
    {
        if (_s3 is null || string.IsNullOrEmpty(publicId)) return;
        await _s3.DeleteObjectAsync(_bucket, publicId);
    }
}
