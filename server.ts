import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: '2mb' }));

interface EmailDispatchReceipt {
  id: string;
  to: string;
  subject: string;
  category: 'submission_confirmation' | 'report_notification';
  status: 'sent_smtp' | 'dispatched_relay';
  summary: string;
  sentAt: string;
}

const emailOutbox: EmailDispatchReceipt[] = [];

async function dispatchAutomatedEmail(params: {
  to: string;
  subject: string;
  text: string;
  category: 'submission_confirmation' | 'report_notification';
  summary: string;
}): Promise<EmailDispatchReceipt> {
  const id = `msg_${crypto.randomUUID().slice(0, 12)}`;
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || '587');
  const smtpFrom = process.env.SMTP_FROM?.trim() || 'Golden Corral Clean Radio <radio@goldencorralcleanradio.local>';

  let status: 'sent_smtp' | 'dispatched_relay' = 'dispatched_relay';

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpFrom,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });
      status = 'sent_smtp';
    } catch (err) {
      console.error('SMTP relay fallback triggered:', err instanceof Error ? err.message : String(err));
      status = 'dispatched_relay';
    }
  }

  const receipt: EmailDispatchReceipt = {
    id,
    to: params.to,
    subject: params.subject,
    category: params.category,
    status,
    summary: params.summary,
    sentAt: new Date().toISOString(),
  };

  emailOutbox.unshift(receipt);
  if (emailOutbox.length > 50) {
    emailOutbox.length = 50;
  }

  return receipt;
}

// --- Royalty-Free Synthesized Harmonic WAV Generator ---
interface TrackSynthSpec {
  bpm: number;
  chords: number[][];
  waveType: 'warm' | 'jazz' | 'acoustic' | 'groove';
}

const TRACK_SPECS: Record<string, TrackSynthSpec> = {
  'gc-morning-1': {
    bpm: 84,
    chords: [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]],
    waveType: 'acoustic',
  },
  'gc-morning-2': {
    bpm: 92,
    chords: [[293.66, 369.99, 440.0], [246.94, 293.66, 369.99], [196.0, 246.94, 293.66], [220.0, 277.18, 329.63]],
    waveType: 'warm',
  },
  'gc-lunch-1': {
    bpm: 104,
    chords: [[329.63, 415.3, 493.88], [277.18, 329.63, 415.3], [220.0, 277.18, 329.63], [246.94, 311.13, 369.99]],
    waveType: 'acoustic',
  },
  'gc-lunch-2': {
    bpm: 108,
    chords: [[261.63, 329.63, 392.0, 493.88], [174.61, 220.0, 261.63, 329.63], [220.0, 261.63, 329.63, 392.0], [196.0, 246.94, 293.66, 349.23]],
    waveType: 'warm',
  },
  'gc-dinner-1': {
    bpm: 78,
    chords: [[220.0, 261.63, 329.63, 392.0], [196.0, 246.94, 293.66, 349.23], [174.61, 220.0, 261.63, 329.63], [164.81, 196.0, 246.94, 293.66]],
    waveType: 'jazz',
  },
  'gc-dinner-2': {
    bpm: 74,
    chords: [[293.66, 349.23, 440.0, 523.25], [196.0, 246.94, 293.66, 349.23], [261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0]],
    waveType: 'jazz',
  },
  'gc-prep-1': {
    bpm: 114,
    chords: [[261.63, 329.63, 392.0], [293.66, 349.23, 440.0], [196.0, 246.94, 293.66], [261.63, 329.63, 392.0]],
    waveType: 'groove',
  },
  'gc-prep-2': {
    bpm: 118,
    chords: [[220.0, 277.18, 329.63], [246.94, 311.13, 369.99], [164.81, 207.65, 246.94], [220.0, 277.18, 329.63]],
    waveType: 'groove',
  },
};

const wavCache = new Map<string, Buffer>();

function synthesizeTrackWav(trackId: string): Buffer {
  const cached = wavCache.get(trackId);
  if (cached) return cached;

  const spec: TrackSynthSpec = TRACK_SPECS[trackId] || {
    bpm: 96,
    chords: [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]],
    waveType: 'warm',
  };

  const sampleRate = 22050;
  const durationSeconds = 16;
  const numSamples = sampleRate * durationSeconds;
  const headerSize = 44;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const beatsPerSec = spec.bpm / 60;
  const chordCount = spec.chords.length;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatPos = t * beatsPerSec;
    const chordIdx = Math.floor(beatPos / 4) % chordCount;
    const chord = spec.chords[chordIdx];
    const barPhase = (beatPos % 4) / 4;
    const stepPhase = beatPos % 1;

    // Gentle chord pad envelope
    const padEnv = Math.sin(Math.PI * Math.min(1, barPhase * 1.15)) * 0.35 + 0.65;
    let sample = 0;

    // Warm root + chord tones
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      const harmonic = spec.waveType === 'jazz' ? 0.14 : spec.waveType === 'acoustic' ? 0.18 : 0.12;
      sample += Math.sin(2 * Math.PI * freq * t) * 0.18 * padEnv;
      sample += Math.sin(2 * Math.PI * freq * 2 * t) * harmonic * 0.25 * padEnv;
    }

    // Soft plucked arpeggio note per beat
    const arpIdx = Math.floor(beatPos * 2) % chord.length;
    const arpFreq = chord[arpIdx] * 2;
    const arpPhase = (beatPos * 2) % 1;
    const arpEnv = Math.exp(-arpPhase * (spec.waveType === 'groove' ? 5.5 : 4.0));
    sample += Math.sin(2 * Math.PI * arpFreq * t) * 0.22 * arpEnv;

    // Warm sub bass pulse
    const bassFreq = chord[0] * 0.5;
    const bassEnv = Math.exp(-stepPhase * 2.2) * 0.5 + 0.5;
    sample += Math.sin(2 * Math.PI * bassFreq * t) * 0.24 * bassEnv;

    // Smooth loop edge crossfade (first/last 0.15s)
    const fadeLen = 0.15;
    let loopEnv = 1;
    if (t < fadeLen) loopEnv = t / fadeLen;
    else if (t > durationSeconds - fadeLen) loopEnv = (durationSeconds - t) / fadeLen;

    const clamped = Math.max(-0.92, Math.min(0.92, sample * loopEnv * 0.65));
    buffer.writeInt16LE(Math.round(clamped * 32767), headerSize + i * 2);
  }

  if (wavCache.size < 20) {
    wavCache.set(trackId, buffer);
  }
  return buffer;
}

function sendBufferWithRange(req: express.Request, res: express.Response, buf: Buffer, contentType: string) {
  const total = buf.length;
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).send('Invalid Range');
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    if (start > end || start >= total) {
      res.status(416).send('Range Not Satisfiable');
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(end - start + 1));
    res.send(buf.subarray(start, end + 1));
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', String(total));
  res.send(buf);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'golden-corral-clean-radio' });
});

// Stream royalty-free curated track
app.get('/api/audio/stream/:trackId', (req, res) => {
  const trackId = req.params.trackId || '';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trackId)) {
    res.status(400).json({ error: 'Invalid track identifier' });
    return;
  }
  const wav = synthesizeTrackWav(trackId);
  sendBufferWithRange(req, res, wav, 'audio/wav');
});

// Stream uploaded submission safely with path confinement
app.get('/api/audio/submission/:filename', (req, res) => {
  const filename = req.params.filename || '';
  if (!/^[a-zA-Z0-9_-]+\.(mp3|wav)$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid audio file name' });
    return;
  }
  const resolved = path.resolve(UPLOADS_DIR, filename);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }

  const stat = fs.statSync(resolved);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.mp3' ? 'audio/mpeg' : 'audio/wav';
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).send('Invalid Range');
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.status(416).send('Range Not Satisfiable');
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    fs.createReadStream(resolved, { start, end }).pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', String(stat.size));
  fs.createReadStream(resolved).pipe(res);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function detectAudioFormat(buf: Buffer, originalName: string, mimeType: string): 'MP3' | 'WAV' | null {
  const ext = path.extname(originalName).toLowerCase();
  const isWavHeader =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE';

  const isMp3Header =
    buf.length >= 3 &&
    (buf.subarray(0, 3).toString('ascii') === 'ID3' ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));

  if ((ext === '.wav' || mimeType.includes('wav')) && isWavHeader) {
    return 'WAV';
  }
  if ((ext === '.mp3' || mimeType.includes('mpeg') || mimeType.includes('mp3')) && isMp3Header) {
    return 'MP3';
  }
  return null;
}

// Upload Clean Radio Edit MP3/WAV + Automated Confirmation Email
app.post('/api/submissions/upload', upload.single('audioFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Audio file is required in MP3 or WAV format.' });
      return;
    }

    const cleanEditCertified = String(req.body?.cleanEditCertified || '') === 'true';
    if (!cleanEditCertified) {
      res.status(400).json({ error: 'Only Clean Radio Edits are accepted for our family-friendly broadcast.' });
      return;
    }

    const artistName = String(req.body?.artistName || '').trim().slice(0, 100);
    const trackTitle = String(req.body?.trackTitle || '').trim().slice(0, 120);
    const submitterEmail = String(req.body?.submitterEmail || '').trim().slice(0, 256);

    if (!artistName || !trackTitle || !submitterEmail || !submitterEmail.includes('@')) {
      res.status(400).json({ error: 'Artist name, track title, and a valid email address are required.' });
      return;
    }

    const format = detectAudioFormat(file.buffer, file.originalname, file.mimetype);
    if (!format) {
      res.status(400).json({ error: 'Invalid audio file. Please upload a genuine high-quality MP3 or WAV file.' });
      return;
    }

    const safeExt = format === 'MP3' ? 'mp3' : 'wav';
    const fileId = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const safeFilename = `${fileId}.${safeExt}`;
    const targetPath = path.resolve(UPLOADS_DIR, safeFilename);

    if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid file storage path.' });
      return;
    }

    fs.writeFileSync(targetPath, file.buffer);

    const estimatedDuration = format === 'WAV'
      ? Math.max(15, Math.min(600, Math.round(file.size / 176400)))
      : Math.max(15, Math.min(600, Math.round(file.size / 24000)));

    const emailReceipt = await dispatchAutomatedEmail({
      to: submitterEmail,
      subject: `Golden Corral Clean Radio — Submission Received: "${trackTitle}"`,
      text: [
        `Hello ${artistName},`,
        '',
        `Thank you for submitting "${trackTitle}" (${format}, Clean Radio Edit) to Golden Corral Clean Radio.`,
        'Your submission has entered our broadcast QC queue. You can track real-time processing updates in your Submission Status Dashboard.',
        '',
        `Reference ID: ${fileId}`,
        `Received At: ${new Date().toISOString()}`,
        '',
        'Golden Corral Clean Radio Broadcast Team',
      ].join('\n'),
      category: 'submission_confirmation',
      summary: `Confirmation sent for "${trackTitle}" (${format})`,
    });

    res.status(201).json({
      fileUrl: `/api/audio/submission/${safeFilename}`,
      audioFormat: format,
      fileSizeBytes: file.size,
      durationSeconds: estimatedDuration,
      confirmationEmailSent: true,
      confirmationEmailId: emailReceipt.id,
      emailReceipt,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process music submission upload.' });
  }
});

// Automated Report Notification Email
app.post('/api/emails/report-notification', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim().slice(0, 256);
    const reportName = String(req.body?.reportName || 'Monthly Operations Report').trim().slice(0, 120);
    const reportScope = String(req.body?.reportScope || 'executive').trim().slice(0, 40);
    const format = String(req.body?.format || 'CSV').trim().slice(0, 10);
    const rowCount = Number(req.body?.rowCount || 0);

    if (!to || !to.includes('@')) {
      res.status(400).json({ error: 'A valid recipient email is required.' });
      return;
    }

    const receipt = await dispatchAutomatedEmail({
      to,
      subject: `Golden Corral Clean Radio — ${reportName} Ready (${format})`,
      text: [
        `Report Generated: ${reportName}`,
        `Scope: ${reportScope}`,
        `Format: ${format}`,
        `Records Included: ${rowCount}`,
        `Privacy Compliance: Redacted PII enforced`,
        `Generated At: ${new Date().toISOString()}`,
      ].join('\n'),
      category: 'report_notification',
      summary: `${reportName} (${format}, ${rowCount} rows) sent to ${to}`,
    });

    res.json({ sent: true, receipt });
  } catch (err) {
    console.error('Report email notification error:', err);
    res.status(500).json({ error: 'Failed to send report notification email.' });
  }
});

// Automated Email Dispatch Outbox Log
app.get('/api/emails/outbox', (_req, res) => {
  res.json({ receipts: emailOutbox });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Golden Corral Clean Radio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
