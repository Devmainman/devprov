import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get document URLs
const getDocumentUrls = (fileName, folder) => {
  if (!fileName) return null;
  return `${process.env.API_BASE_URL || 'http://localhost:5000'}/uploads/${folder}/${fileName}`;
};

// Get all ID verification submissions
export const getIdVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.identityDocuments': {
        $exists: true,
        $not: { $size: 0 },
        $elemMatch: { frontImage: { $exists: true, $ne: null, $ne: '' } }
      }
    })
      .select('firstName lastName accountId email verification.identityDocuments verification.identityVerified')
      .lean();

    const verifications = users.flatMap(user => {
      return user.verification.identityDocuments.map(doc => ({
        userId: user._id,
        accountId: user.accountId,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        idType: doc.type,
        frontImageUrl: getDocumentUrls(doc.frontImage, 'id_documents'),
        backImageUrl: getDocumentUrls(doc.backImage, 'id_documents'),
        status: doc.verified ? 'Approved' : (doc.rejected ? 'Rejected' : 'Pending'),
        submittedDate: doc.uploadedAt || new Date(user.createdAt), // Fallback to createdAt
        documentId: doc._id,
        currentStatus: user.verification.identityVerified ? 'Verified' : 'Not Verified'
      }));
    });

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (err) {
    console.error('Error fetching ID verifications:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ID verifications'
    });
  }
};

// Update ID verification status
export const updateIdVerification = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be one of: approve, reject, delete, revoke, processing'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const documentIndex = user.verification.identityDocuments.findIndex(
      doc => doc._id.toString() === documentId
    );

    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found for this user'
      });
    }

    const document = user.verification.identityDocuments[documentIndex];

    switch (action) {
      case 'approve':
        document.verified = true;
        document.rejected = false;
        document.rejectionReason = undefined;
        user.verification.identityVerified = true;
        break;
      case 'reject':
        document.verified = false;
        document.rejected = true;
        document.rejectionReason = rejectionReason || 'Not specified';
        user.verification.identityVerified = false;
        break;
      case 'delete':
        // Delete files first
        if (document.frontImage) {
          const frontPath = path.join(__dirname, `../uploads/id_documents/${document.frontImage}`);
          if (fs.existsSync(frontPath)) fs.unlinkSync(frontPath);
        }
        if (document.backImage) {
          const backPath = path.join(__dirname, `../uploads/id_documents/${document.backImage}`);
          if (fs.existsSync(backPath)) fs.unlinkSync(backPath);
        }
        // Remove document from array
        user.verification.identityDocuments.splice(documentIndex, 1);
        break;
      case 'revoke':
        document.verified = false;
        document.rejected = false;
        document.rejectionReason = undefined;
        user.verification.identityVerified = false;
        break;
      case 'processing':
        document.verified = false;
        document.rejected = false;
        document.rejectionReason = undefined;
        user.verification.identityVerified = false;
        document.processing = true;
        break;
    }

    await user.save();

    res.json({
      success: true,
      message: `Document ${action}d successfully`,
      verificationStatus: user.verification.identityVerified
    });
  } catch (err) {
    console.error('Error updating ID verification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update ID verification'
    });
  }
};

// Get all address verifications
export const getAddressVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.proofOfAddress': {
        $exists: true,
        image: { $exists: true, $ne: null, $ne: '' }
      }
    })
      .select('firstName lastName accountId email address verification.proofOfAddress verification.addressVerified')
      .lean();

    const verifications = users.map(user => ({
      userId: user._id,
      accountId: user.accountId,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      address: user.address,
      documentType: user.verification.proofOfAddress.documentType,
      documentUrl: getDocumentUrls(user.verification.proofOfAddress.image, 'address_proofs'),
      status: user.verification.proofOfAddress.verified ? 'Approved' :
              user.verification.proofOfAddress.rejected ? 'Rejected' : 'Pending',
      submittedDate: user.verification.proofOfAddress.uploadedAt || new Date(user.createdAt), // Fallback
      currentStatus: user.verification.addressVerified ? 'Verified' : 'Not Verified'
    }));

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (err) {
    console.error('Error fetching address verifications:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch address verifications'
    });
  }
};

// Update address verification status
export const updateAddressVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be one of: approve, reject, delete, revoke, processing'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.verification.proofOfAddress) {
      return res.status(404).json({
        success: false,
        message: 'User or address proof not found'
      });
    }

    const proof = user.verification.proofOfAddress;

    switch (action) {
      case 'approve':
        proof.verified = true;
        proof.rejected = false;
        proof.rejectionReason = undefined;
        proof.processing = false;
        user.verification.addressVerified = true;
        break;
      case 'reject':
        proof.verified = false;
        proof.rejected = true;
        proof.rejectionReason = rejectionReason || 'Not specified';
        proof.processing = false;
        user.verification.addressVerified = false;
        break;
      case 'delete':
        // Delete file
        if (proof.image) {
          const filePath = path.join(__dirname, `../uploads/address_proofs/${proof.image}`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        // Remove proof
        user.verification.proofOfAddress = undefined;
        break;
      case 'revoke':
        proof.verified = false;
        proof.rejected = false;
        proof.rejectionReason = undefined;
        proof.processing = false;
        user.verification.addressVerified = false;
        break;
      case 'processing':
        proof.verified = false;
        proof.rejected = false;
        proof.rejectionReason = undefined;
        proof.processing = true;
        user.verification.addressVerified = false;
        break;
    }

    await user.save();

    res.json({
      success: true,
      message: `Address verification ${action}d successfully`,
      verificationStatus: user.verification.addressVerified
    });
  } catch (err) {
    console.error('Error updating address verification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update address verification'
    });
  }
};

// Get all facial verifications
export const getFacialVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.faceImage': { $exists: true, $ne: null, $ne: '' }
    })
      .select('firstName lastName accountId email verification.faceImage verification.faceVerified verification.faceRejected verification.faceSubmittedAt')
      .lean();

    const verifications = users.map(user => ({
      userId: user._id,
      accountId: user.accountId,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      faceImageUrl: getDocumentUrls(user.verification.faceImage, 'face_images'),
      status: user.verification.faceVerified ? 'Approved' :
              user.verification.faceRejected ? 'Rejected' : 'Pending',
      submittedDate: user.verification.faceSubmittedAt || new Date(user.createdAt), // Fallback to createdAt
      currentStatus: user.verification.faceVerified ? 'Verified' : 'Not Verified'
    }));

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (err) {
    console.error('Error fetching facial verifications:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch facial verifications'
    });
  }
};

// Update facial verification status
export const updateFacialVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be one of: approve, reject, delete, revoke, processing'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.verification.faceImage) {
      return res.status(404).json({
        success: false,
        message: 'User or face image not found'
      });
    }

    switch (action) {
      case 'approve':
        user.verification.faceVerified = true;
        user.verification.faceRejected = false;
        user.verification.faceRejectionReason = undefined;
        user.verification.faceProcessing = false;
        break;
      case 'reject':
        user.verification.faceVerified = false;
        user.verification.faceRejected = true;
        user.verification.faceRejectionReason = rejectionReason || 'Not specified';
        user.verification.faceProcessing = false;
        break;
      case 'delete':
        // Delete file
        if (user.verification.faceImage) {
          const filePath = path.join(__dirname, `../uploads/face_images/${user.verification.faceImage}`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        // Remove face image
        user.verification.faceImage = undefined;
        user.verification.faceVerified = false;
        user.verification.faceRejected = false;
        user.verification.faceRejectionReason = undefined;
        break;
      case 'revoke':
        user.verification.faceVerified = false;
        user.verification.faceRejected = false;
        user.verification.faceRejectionReason = undefined;
        user.verification.faceProcessing = false;
        break;
      case 'processing':
        user.verification.faceVerified = false;
        user.verification.faceRejected = false;
        user.verification.faceRejectionReason = undefined;
        user.verification.faceProcessing = true;
        break;
    }

    await user.save();

    res.json({
      success: true,
      message: `Facial verification ${action}d successfully`,
      verificationStatus: user.verification.faceVerified
    });
  } catch (err) {
    console.error('Error updating facial verification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update facial verification'
    });
  }
};

// Get verification counts for dashboard
export const getVerificationCounts = async (req, res) => {
  try {
    const [
      idPending,
      idApproved,
      addressPending,
      addressApproved,
      facePending,
      faceApproved
    ] = await Promise.all([
      User.countDocuments({
        'verification.identityDocuments': {
          $elemMatch: {
            verified: false,
            rejected: { $ne: true },
            frontImage: { $exists: true, $ne: null, $ne: '' }
          }
        }
      }),
      User.countDocuments({ 'verification.identityVerified': true }),
      User.countDocuments({
        'verification.proofOfAddress': {
          $exists: true,
          verified: false,
          rejected: { $ne: true },
          image: { $exists: true, $ne: null, $ne: '' }
        }
      }),
      User.countDocuments({ 'verification.addressVerified': true }),
      User.countDocuments({
        'verification.faceImage': { $exists: true, $ne: null, $ne: '' },
        'verification.faceVerified': false,
        'verification.faceRejected': { $ne: true }
      }),
      User.countDocuments({ 'verification.faceVerified': true })
    ]);

    res.json({
      success: true,
      counts: {
        idVerifications: {
          pending: idPending,
          approved: idApproved
        },
        addressVerifications: {
          pending: addressPending,
          approved: addressApproved
        },
        facialVerifications: {
          pending: facePending,
          approved: faceApproved
        }
      }
    });
  } catch (err) {
    console.error('Error getting verification counts:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification counts'
    });
  }
};