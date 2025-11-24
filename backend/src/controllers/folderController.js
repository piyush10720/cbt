const Folder = require('../models/Folder');
const Exam = require('../models/Exam');
const mongoose = require('mongoose');

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, parent, visibility, allowedUsers, description } = req.body;
    
    const folder = new Folder({
      name,
      parent: parent || null,
      createdBy: req.user._id,
      visibility: visibility || 'owner',
      allowedUsers: allowedUsers || [],
      description: description || ''
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get folders (root or by parent) with visibility filtering
exports.getFolders = async (req, res) => {
  try {
    const { parentId } = req.query;
    
    // Build query for folders user can access
    const folderQuery = {
      $or: [
        { createdBy: req.user._id }, // User's own folders
        { visibility: 'public' }, // Public folders
        { visibility: 'invited', allowedUsers: req.user._id } // Invited folders
      ]
    };
    
    if (parentId === 'all') {
      // Return all accessible folders for tree view
      // No parent filter
    } else if (parentId && parentId !== 'null') {
      folderQuery.parent = parentId;
    } else {
      folderQuery.parent = null;
    }

    const folders = await Folder.find(folderQuery).sort({ name: 1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update folder (rename/move/visibility)
exports.updateFolder = async (req, res) => {
  try {
    const { name, parent, visibility, allowedUsers, description } = req.body;
    const folder = await Folder.findOne({ _id: req.params.id, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    if (name) folder.name = name;
    if (parent !== undefined) folder.parent = parent;
    if (visibility) folder.visibility = visibility;
    if (allowedUsers !== undefined) folder.allowedUsers = allowedUsers;
    if (description !== undefined) folder.description = description;

    await folder.save();
    res.json(folder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete folder and subfolders recursively
exports.deleteFolder = async (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Recursive delete function
    const deleteFolderRecursive = async (id) => {
      // Find subfolders
      const subfolders = await Folder.find({ parent: id });
      for (const subfolder of subfolders) {
        await deleteFolderRecursive(subfolder._id);
      }
      
      // Remove folder reference from exams (but don't delete exams)
      await Exam.updateMany(
        { folders: id },
        { $pull: { folders: id } }
      );

      // Delete the folder itself
      await Folder.findByIdAndDelete(id);
    };

    await deleteFolderRecursive(folderId);
    res.json({ message: 'Folder and subfolders deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add exam to folder
exports.addExamToFolder = async (req, res) => {
  try {
    const { examId, folderId } = req.body;
    
    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    if (!exam.folders.includes(folderId)) {
      exam.folders.push(folderId);
      await exam.save();
    }

    res.json(exam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove exam from folder
exports.removeExamFromFolder = async (req, res) => {
  try {
    const { examId, folderId } = req.body;
    
    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    exam.folders = exam.folders.filter(f => f.toString() !== folderId);
    await exam.save();

    res.json(exam);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Generate invite code for folder
exports.generateInviteCode = async (req, res) => {
  try {
    const { folderId } = req.body;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    if (folder.visibility !== 'invited') {
      return res.status(400).json({ message: 'Invite codes are only for invited folders' });
    }

    // Generate 6-8 character alphanumeric code
    const crypto = require('crypto');
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    folder.inviteCode = inviteCode;
    await folder.save();

    res.json({ code: inviteCode });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Generate invite link for folder
exports.generateInviteLink = async (req, res) => {
  try {
    const { folderId, expiryDays } = req.body;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    if (folder.visibility !== 'invited') {
      return res.status(400).json({ message: 'Invite links are only for invited folders' });
    }

    // Generate unique token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    folder.inviteLink = token;
    
    // Set expiry if provided
    if (expiryDays && expiryDays !== 'never') {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + parseInt(expiryDays));
      folder.inviteLinkExpiry = expiry;
    } else {
      folder.inviteLinkExpiry = null;
    }
    
    await folder.save();

    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/folders/join/${token}`;
    res.json({ link, expiresAt: folder.inviteLinkExpiry });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Join folder via invite code
exports.joinFolderByCode = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const folder = await Folder.findOne({ inviteCode });

    if (!folder) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (folder.visibility !== 'invited') {
      return res.status(400).json({ message: 'This folder is not using invite codes' });
    }

    // Check if user is already in allowedUsers
    if (!folder.allowedUsers.includes(req.user._id)) {
      folder.allowedUsers.push(req.user._id);
      await folder.save();
    }

    res.json({ folder, message: 'Successfully joined folder' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Join folder via invite link
exports.joinFolderByLink = async (req, res) => {
  try {
    const { token } = req.params;
    const folder = await Folder.findOne({ inviteLink: token });

    if (!folder) {
      return res.status(404).json({ message: 'Invalid invite link' });
    }

    // Check if link is expired
    if (folder.inviteLinkExpiry && new Date() > folder.inviteLinkExpiry) {
      return res.status(400).json({ message: 'Invite link has expired' });
    }

    if (folder.visibility !== 'invited') {
      return res.status(400).json({ message: 'This folder is not using invite links' });
    }

    // Check if user is already in allowedUsers
    if (!folder.allowedUsers.includes(req.user._id)) {
      folder.allowedUsers.push(req.user._id);
      await folder.save();
    }

    res.json({ folder, message: 'Successfully joined folder' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Revoke invite code/link
exports.revokeInvite = async (req, res) => {
  try {
    const { folderId, type } = req.body;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    if (type === 'code') {
      folder.inviteCode = null;
    } else if (type === 'link') {
      folder.inviteLink = null;
      folder.inviteLinkExpiry = null;
    } else {
      return res.status(400).json({ message: 'Invalid type. Must be "code" or "link"' });
    }

    await folder.save();
    res.json({ message: `Invite ${type} revoked successfully` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Add user to folder directly
exports.addUserToFolder = async (req, res) => {
  try {
    const { folderId, userId } = req.body;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    if (folder.visibility !== 'invited') {
      return res.status(400).json({ message: 'Can only add users to invited folders' });
    }

    // Check if user is already in allowedUsers
    if (!folder.allowedUsers.includes(userId)) {
      folder.allowedUsers.push(userId);
      await folder.save();
    }

    res.json({ folder, message: 'User added successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove user from folder
exports.removeUserFromFolder = async (req, res) => {
  try {
    const { folderId, userId } = req.body;
    const folder = await Folder.findOne({ _id: folderId, createdBy: req.user._id });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    folder.allowedUsers = folder.allowedUsers.filter(id => id.toString() !== userId);
    await folder.save();

    res.json({ folder, message: 'User removed successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
