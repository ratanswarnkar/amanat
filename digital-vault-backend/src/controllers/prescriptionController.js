const { createPrescription, getPrescriptionsByUserId } = require('../models/prescriptionModel');

const buildFileUrl = (req, file) => `/uploads/${file.destination.split(/uploads[\\/]/).pop().replace(/\\/g, '/')}/${file.filename}`;
const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const createPrescriptionEntry = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'file is required' });
    }

    const prescription = await createPrescription({
      userId: getPatientId(req),
      doctorName: req.body.doctor_name,
      hospitalName: req.body.hospital_name,
      fileUrl: buildFileUrl(req, req.file),
      issueDate: req.body.issue_date,
      notes: req.body.notes,
    });

    return res.status(201).json({
      message: 'Prescription saved successfully',
      prescription,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to save prescription',
      error: error.message,
    });
  }
};

const getPrescriptions = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    const prescriptions = await getPrescriptionsByUserId(patientId);
    return res.status(200).json({ prescriptions });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch prescriptions',
      error: error.message,
    });
  }
};

module.exports = {
  createPrescriptionEntry,
  getPrescriptions,
};
