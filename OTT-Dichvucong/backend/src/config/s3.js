const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function getConfig() {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";
  if (process.env.DISABLE_S3 === "true") return null;
  if (!bucket || !region) return null;
  return { bucket, region };
}

function isS3Configured() {
  return Boolean(getConfig());
}

function getS3Client() {
  const cfg = getConfig();
  if (!cfg) {
    const err = new Error("S3_NOT_CONFIGURED");
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  return new S3Client({
    region: cfg.region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined
  });
}

async function createPresignedPut(opts) {
  const cfg = getConfig();
  if (!cfg) {
    const err = new Error("S3_NOT_CONFIGURED");
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key,
    ContentType: opts.contentType
  });

  const expiresSec = opts.expiresSec ?? 300;
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresSec });
  const getCommand = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key
  });
  const publicUrl = await getSignedUrl(client, getCommand, { expiresIn: 3600 * 24 * 7 });

  return { uploadUrl, publicUrl, key: opts.key };
}

function buildPublicObjectUrl(key) {
  const cfg = getConfig();
  if (!cfg || !key) return "";
  const encodedKey = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encodedKey}`;
}

async function uploadBuffer({ key, buffer, contentType }) {
  const cfg = getConfig();
  if (!cfg) {
    const err = new Error("S3_NOT_CONFIGURED");
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream"
    })
  );

  const publicUrl = buildPublicObjectUrl(key);
  return { key, publicUrl, url: publicUrl, contentType: contentType || "application/octet-stream" };
}

async function getObjectStream(key) {
  const cfg = getConfig();
  const client = getS3Client();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key
    })
  );

  return {
    body: result.Body,
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength
  };
}

module.exports = {
  getConfig,
  isS3Configured,
  createPresignedPut,
  buildPublicObjectUrl,
  uploadBuffer,
  getObjectStream
};
