const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

const ALLOWED_MIMES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_DOC_TYPES = ['gst_certificate','pan_card','iec_certificate','cancelled_cheque','incorporation_cert','other'];

// Ensure upload dirs exist
['vendors'].forEach((sub) => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Manual multipart parser — avoids multer dependency, handles file + fields.
 * For production, swap with multer + S3 storage engine.
 * Returns: req.uploadedFiles = [{ fieldname, originalName, storedName, storagePath, mimeType, sizeBytes }]
 * Returns: req.uploadFields = { fieldname: value }
 */
function parseMultipart(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return next();

  const busboy = (() => {
    try { return require('busboy'); } catch { return null; }
  })();

  if (!busboy) {
    // Fallback: skip file parsing, just continue (for JSON-only endpoints)
    return next();
  }

  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE, files: 5 } });
  req.uploadedFiles = [];
  req.uploadFields = {};

  bb.on('file', (fieldname, stream, info) => {
    const { filename, mimeType } = info;
    if (!ALLOWED_MIMES[mimeType]) {
      stream.resume();
      return;
    }
    const ext = ALLOWED_MIMES[mimeType];
    const storedName = `${crypto.randomUUID()}${ext}`;
    const subdir = 'vendors';
    const storagePath = path.join(UPLOAD_DIR, subdir, storedName);
    const writeStream = fs.createWriteStream(storagePath);

    let sizeBytes = 0;
    let oversized = false;

    stream.on('data', (chunk) => {
      sizeBytes += chunk.length;
      if (sizeBytes > MAX_FILE_SIZE) {
        oversized = true;
        stream.resume();
        fs.unlink(storagePath, () => {});
      }
    });

    stream.pipe(writeStream);

    stream.on('end', () => {
      if (!oversized) {
        req.uploadedFiles.push({
          fieldname,
          originalName: filename,
          storedName,
          storagePath,
          mimeType,
          sizeBytes,
          relPath: path.join(subdir, storedName),
        });
      }
    });
  });

  bb.on('field', (name, val) => { req.uploadFields[name] = val; });
  bb.on('finish', next);
  bb.on('error', (err) => next(err));
  req.pipe(bb);
}

function validateDocType(docType) {
  return ALLOWED_DOC_TYPES.includes(docType);
}

module.exports = { parseMultipart, validateDocType, ALLOWED_MIMES, MAX_FILE_SIZE, UPLOAD_DIR };
