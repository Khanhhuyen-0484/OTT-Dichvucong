const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function getConfig() {
  const bucket =
    process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
  const region =
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";
  // Allow disabling S3 with DISABLE_S3=true
  if (process.env.DISABLE_S3 === "true") return null;
  if (!bucket || !region) return null;
  return { bucket, region };
}

function isS3Configured() {
  return Boolean(getConfig());
}

/**
 * @param {{ key: string, contentType: string, expiresSec?: number }} opts
 * @returns {Promise<{ uploadUrl: string, publicUrl: string, key: string }>}
 */
async function createPresignedPut(opts) {
  const cfg = getConfig();
  if (!cfg) {
    const err = new Error("S3_NOT_CONFIGURED");
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  const { bucket, region } = cfg;
  const client = new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType
  });

  const expiresSec = opts.expiresSec ?? 300;
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresSec });

  const prefix = process.env.S3_PUBLIC_URL_PREFIX?.replace(/\/+$/, "");
  const publicUrl = prefix
    ? `${prefix}/${opts.key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${opts.key}`;

  return { uploadUrl, publicUrl, key: opts.key };
}

module.exports = { getConfig, isS3Configured, createPresignedPut };
