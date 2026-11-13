import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { DriverDocument, Fleet, FleetDocument, Vehicle, VehicleDocument } from '../models/index.js';

const router = Router();
const uploadDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));
await mkdir(uploadDirectory, { recursive: true });
const allowedTypes = new Map([
  ['application/pdf', 'pdf'], ['image/jpeg', 'jpg'], ['image/png', 'png']
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}.${allowedTypes.get(file.mimetype) || 'upload'}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new Error('Documents must be PDF, JPEG or PNG files.'));
    return callback(null, true);
  }
});

function receiveDocument(req, res, next) {
  upload.single('document')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) error.status = 400;
      else error.status = 400;
      return next(error);
    }
    return next();
  });
}

async function validateFile(file) {
  const handle = await open(file.path, 'r');
  const header = Buffer.alloc(8);
  try { await handle.read(header, 0, 8, 0); }
  finally { await handle.close(); }
  if ((file.mimetype === 'application/pdf' && header.toString('ascii', 0, 4) === '%PDF') ||
      (file.mimetype === 'image/jpeg' && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
      (file.mimetype === 'image/png' && header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return;
  await unlink(file.path);
  const error = new Error('The uploaded file content does not match an allowed document type.');
  error.status = 400;
  throw error;
}

function expiryValue(value) {
  if (!value) return undefined;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) {
    const error = new Error('Provide a valid document expiry date.');
    error.status = 400;
    throw error;
  }
  return expiry;
}

function metadata(req, kind, file) {
  return {
    kind, storageKey: path.basename(file.filename), originalName: path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'document',
    mimeType: file.mimetype, expiresAt: expiryValue(req.body.expiresAt), status: 'pending'
  };
}

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    let documents;
    if (['individual_owner', 'fleet_company'].includes(req.user.role)) {
      const [fleetDocuments, vehicleDocuments] = await Promise.all([
        FleetDocument.find({ fleetId: req.user.fleetId }).select('-storageKey').sort({ createdAt: -1 }),
        VehicleDocument.find({ fleetId: req.user.fleetId }).select('-storageKey').populate('vehicleId', 'registrationNumber').sort({ createdAt: -1 })
      ]);
      documents = [...fleetDocuments, ...vehicleDocuments];
    } else if (req.user.role === 'driver') {
      documents = await DriverDocument.find({ driverId: req.user.id }).select('-storageKey').sort({ createdAt: -1 });
    } else return res.status(403).json({ message: 'Document access is not available for this account.' });
    return res.json({ documents });
  } catch (error) { return next(error); }
});

router.post('/fleet', authenticate, allowRoles('individual_owner', 'fleet_company'), receiveDocument, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a document file.' });
    const allowed = ['owner_identity', 'company_registration', 'other'];
    if (!allowed.includes(req.body.kind)) { await unlink(req.file.path); return res.status(400).json({ message: 'Unsupported fleet document type.' }); }
    await validateFile(req.file);
    const fleet = await Fleet.findOne({ _id: req.user.fleetId, ownerId: req.user.id });
    if (!fleet) { await unlink(req.file.path); return res.status(404).json({ message: 'Your owner fleet was not found.' }); }
    const document = await FleetDocument.create({ ...metadata(req, req.body.kind, req.file), ownerId: req.user.id, fleetId: fleet.id });
    return res.status(201).json({ document: document.toJSON() });
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => {});
    return next(error);
  }
});

router.post('/vehicles/:vehicleId', authenticate, allowRoles('individual_owner', 'fleet_company'), receiveDocument, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a document file.' });
    const allowed = ['vehicle_registration', 'commercial_permit', 'insurance', 'fitness', 'pollution', 'tax', 'other'];
    if (!allowed.includes(req.body.kind)) { await unlink(req.file.path); return res.status(400).json({ message: 'Unsupported vehicle document type.' }); }
    await validateFile(req.file);
    const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, fleetId: req.user.fleetId });
    if (!vehicle) { await unlink(req.file.path); return res.status(404).json({ message: 'Vehicle not found in your fleet.' }); }
    const document = await VehicleDocument.create({ ...metadata(req, req.body.kind, req.file), vehicleId: vehicle.id, fleetId: vehicle.fleetId, ownerId: req.user.id });
    return res.status(201).json({ document: document.toJSON() });
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => {});
    return next(error);
  }
});

router.post('/driver', authenticate, allowRoles('driver'), receiveDocument, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a document file.' });
    const allowed = ['driver_license', 'driver_identity', 'other'];
    if (!allowed.includes(req.body.kind)) { await unlink(req.file.path); return res.status(400).json({ message: 'Unsupported driver document type.' }); }
    await validateFile(req.file);
    const expiresAt = expiryValue(req.body.expiresAt);
    if (req.body.kind === 'driver_license' && (!expiresAt || expiresAt <= new Date())) return res.status(400).json({ message: 'A valid future expiry date is required for a driver licence.' });
    const document = await DriverDocument.create({ ...metadata(req, req.body.kind, req.file), driverId: req.user.id, fleetId: req.user.fleetId });
    return res.status(201).json({ document: document.toJSON() });
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => {});
    return next(error);
  }
});

router.get('/:kind/:id/download', authenticate, async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    const Model = kind === 'fleet' ? FleetDocument : kind === 'vehicle' ? VehicleDocument : kind === 'driver' ? DriverDocument : null;
    if (!Model) return res.status(404).json({ message: 'Document not found.' });
    const document = await Model.findById(id).select('+storageKey');
    if (!document) return res.status(404).json({ message: 'Document not found.' });
    let allowed = req.user.role === 'admin';
    if (!allowed && kind === 'fleet') allowed = String(document.fleetId) === String(req.user.fleetId);
    if (!allowed && kind === 'vehicle') allowed = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(document.fleetId) === String(req.user.fleetId);
    if (!allowed && kind === 'driver') {
      const owner = ['individual_owner', 'fleet_company'].includes(req.user.role) && String(document.fleetId) === String(req.user.fleetId);
      allowed = owner || String(document.driverId) === String(req.user.id);
    }
    if (!allowed) return res.status(403).json({ message: 'You are not authorized to access this document.' });
    const filePath = path.join(uploadDirectory, path.basename(document.storageKey));
    res.set({ 'Content-Type': document.mimeType, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="${document.originalName.replace(/[\r\n"\\]/g, '')}"` });
    return res.sendFile(filePath, (error) => { if (error && !res.headersSent) next(error); });
  } catch (error) { return next(error); }
});

export default router;
