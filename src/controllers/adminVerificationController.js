import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDocumentUrls = (fileName, folder) => {
  if (!fileName) return null;
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${folder}/${fileName}`;
};

export const getIdVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.identityDocuments': { $exists: true, $ne: [] }
    })
      .select('firstName lastName accountId email verification.identityDocuments verification.identityVerified')
      .lean();

    console.log('Found users with identityDocuments:', users.length); // Debug log

    const verifications = users.flatMap(user => {
      return (user.verification?.identityDocuments || []).map(doc => ({
        userId: user._id.toString(),
        accountId: user.accountId || 'N/A',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        email: user.email || 'N/A',
        idType: doc.type || 'Unknown',
        frontImageUrl: getDocumentUrls(doc.frontImage, 'id_documents'),
        backImageUrl: getDocumentUrls(doc.backImage, 'id_documents'),
        status: doc.verified ? 'Approved' : 
                doc.rejected ? 'Rejected' : 
                doc.processing ? 'Processing' : 'Pending',
        submittedDate: doc.uploadedAt || new Date(),
        documentId: doc._id.toString(),
        currentStatus: user.verification?.identityVerified ? 'Verified' : 'Not Verified'
      }));
    });

    // Deduplicate by userId, keeping latest document
    const uniqueVerifications = Object.values(
      verifications.reduce((acc, item) => {
        const key = item.userId;
        if (!acc[key] || new Date(item.submittedDate) > new Date(acc[key].submittedDate)) {
          acc[key] = item;
        }
        return acc;
      }, {})
    );

    console.log('Unique ID verifications:', uniqueVerifications.length); // Debug log

    res.json({
      success: true,
      count: uniqueVerifications.length,
      verifications: uniqueVerifications
    });
  } catch (err) {
    console.error('Error fetching ID verifications:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ID verifications'
    });
  }
};

export const updateIdVerification = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
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
        message: 'Document not found'
      });
    }

    const document = user.verification.identityDocuments[documentIndex];

    switch (action) {
      case 'approve':
        document.verified = true;
        document.rejected = false;
        document.rejectionReason = null;
        document.processing = false;
        user.verification.identityVerified = true;
        break;
      case 'reject':
        document.verified = false;
        document.rejected = true;
        document.rejectionReason = rejectionReason || 'Not specified';
        document.processing = false;
        user.verification.identityVerified = false;
        break;
      case 'delete':
        if (document.frontImage) {
          const frontPath = path.join(__dirname, '../Uploads/id_documents', document.frontImage);
          if (fs.existsSync(frontPath)) fs.unlinkSync(frontPath);
        }
        if (document.backImage) {
          const backPath = path.join(__dirname, '../Uploads/id_documents', document.backImage);
          if (fs.existsSync(backPath)) fs.unlinkSync(backPath);
        }
        user.verification.identityDocuments.splice(documentIndex, 1);
        user.verification.identityVerified = user.verification.identityDocuments.some(doc => doc.verified);
        break;
      case 'revoke':
        document.verified = false;
        document.rejected = false;
        document.rejectionReason = null;
        document.processing = false;
        user.verification.identityVerified = user.verification.identityDocuments.some(doc => doc.verified);
        break;
      case 'processing':
        document.verified = false;
        document.rejected = false;
        document.rejectionReason = null;
        document.processing = true;
        user.verification.identityVerified = false;
        break;
    }

    await user.save();

    res.json({
      success: true,
      message: `Document ${action}d successfully`,
      verificationStatus: user.verification.identityVerified
    });
  } catch (err) {
    console.error('Error updating ID verification:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update ID verification'
    });
  }
};

export const getAddressVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.proofOfAddress': { $exists: true }
    })
      .select('firstName lastName accountId email address verification.proofOfAddress verification.addressVerified')
      .lean();

    console.log('Found users with proofOfAddress:', users.length); // Debug log

    const verifications = users
      .filter(user => user.verification?.proofOfAddress?.image)
      .map(user => {
        const proof = user.verification?.proofOfAddress || {};
        return {
          userId: user._id.toString(),
          accountId: user.accountId || 'N/A',
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          email: user.email || 'N/A',
          address: user.address || { street: 'N/A', city: 'N/A', country: 'N/A' },
          documentType: proof.documentType || 'N/A',
          documentUrl: getDocumentUrls(proof.image, 'address_proofs'),
          status: proof.verified ? 'Approved' :
                  proof.rejected ? 'Rejected' :
                  proof.processing ? 'Processing' : 'Pending',
          submittedDate: proof.uploadedAt || new Date(),
          currentStatus: user.verification?.addressVerified ? 'Verified' : 'Not Verified'
        };
      });

    console.log('Address verifications:', verifications.length); // Debug log

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (err) {
    console.error('Error fetching address verifications:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch address verifications'
    });
  }
};

export const updateAddressVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.verification?.proofOfAddress) {
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
        proof.rejectionReason = null;
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
        if (proof.image) {
          const filePath = path.join(__dirname, '../Uploads/address_proofs', proof.image);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        user.verification.proofOfAddress = null;
        user.verification.addressVerified = false;
        break;
      case 'revoke':
        proof.verified = false;
        proof.rejected = false;
        proof.rejectionReason = null;
        proof.processing = false;
        user.verification.addressVerified = false;
        break;
      case 'processing':
        proof.verified = false;
        proof.rejected = false;
        proof.rejectionReason = null;
        proof.processing = true;
        user.verification.addressVerified = false;
        break;
    }

    await user.save();

    res.json({
      success: true,
      message: `Address ${action}d successfully`,
      verificationStatus: user.verification.addressVerified
    });
  } catch (err) {
    console.error('Error updating address:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update address verification'
    });
  }
};

export const getFacialVerifications = async (req, res) => {
  try {
    const users = await User.find({
      'verification.faceImage': { $exists: true, $ne: '' }
    })
      .select('firstName lastName accountId email verification.faceImage verification.faceVerified verification.faceVerificationStatus')
      .lean();

    console.log('Found users with faceImage:', users.length); // Debug log

    const verifications = users.map(user => ({
      userId: user._id.toString(),
      accountId: user.accountId || 'N/A',
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
      email: user.email || 'N/A',
      faceImageUrl: getDocumentUrls(user.verification.faceImage, 'face_images'),
      status: user.verification.faceVerified ? 'VERIFIED' :
              user.verification.faceVerificationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING',
      submittedDate: new Date(),
      currentStatus: user.verification.faceVerified ? 'Verified' : 'Not Verified'
    }));

    console.log('Facial verifications:', verifications.length); // Debug log

    res.json({
      success: true,
      count: verifications.length,
      verifications
    });
  } catch (err) {
    console.error('Error fetching facial verifications:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch facial verifications'
    });
  }
};

export const updateFacialVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectionReason } = req.body;

    const validActions = ['approve', 'reject', 'delete', 'revoke', 'processing'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.verification?.faceImage) {
      return res.status(404).json({
        success: false,
        message: 'User or face image not found'
      });
    }

    switch (action) {
      case 'approve':
      user.verification.faceVerified = true;
      user.verification.faceVerificationStatus = 'VERIFIED';
      user.verification.faceRejectionReason = null;
      user.verification.faceProcessing = null;
      break;

    case 'reject':
      user.verification.faceVerified = false;
      user.verification.faceVerificationStatus = 'REJECTED';
      user.verification.faceRejectionReason = rejectionReason;
      user.verification.faceProcessing = false;
      break;

    case 'delete':
      if (user.verification.faceImage) {
        const filePath = path.join(__dirname, '..', 'Uploads', 'face_images', user.verification.faceImage);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      user.verification.faceImage = null;
      user.verification.faceVerified = null;
      user.verification.faceVerificationStatus = null;
      user.verification.faceRejectionReason = null;
      user.verification.faceProcessing = null;
      break;

    case 'revoke':
      user.verification.faceVerified = false;
      user.verification.faceVerificationStatus = null;
      user.verification.faceRejectionReason = null;
      user.verification.faceProcessing = null;
      break;

    case 'processing':
      user.verification.faceVerified = false;
      user.verification.faceVerificationStatus = null;
      user.verification.faceRejectionReason = null;
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
    console.error('Error updating facial verification:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update facial verification'
    });
  }
};

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
          $elemMatch: { verified: false, rejected: false, processing: false }
        }
      }),
      User.countDocuments({ 'verification.identityVerified': true }),
      User.countDocuments({
        'verification.proofOfAddress': { $exists: true, verified: false, rejected: false, processing: false }
      }),
      User.countDocuments({ 'verification.addressVerified': true }),
      User.countDocuments({
        'verification.faceImage': { $exists: true, $ne: '' },
        'verification.faceVerified': false,
        'verification.faceVerificationStatus': { $ne: 'REJECTED' },
        'verification.faceProcessing': false
      }),
      User.countDocuments({ 'verification.faceVerified': true })
    ]);

    res.json({
      success: true,
      counts: {
        idVerifications: { pending: idPending, idApproved: approved },
        addressVerifications: { pending: addressPending, approved: addressApproved },
        facialVerifications: { pending: facePending, approved: faceApproved }
      }
    });
  } catch (err) {
    console.error('Error getting verification counts:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification counts'
    });
  }
};