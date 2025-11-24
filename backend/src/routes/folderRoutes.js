const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // Protect all folder routes

router.post('/', folderController.createFolder);
router.get('/', folderController.getFolders);
router.put('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);
router.post('/add-exam', folderController.addExamToFolder);
router.post('/remove-exam', folderController.removeExamFromFolder);

// Invite system routes
router.post('/invite/code', folderController.generateInviteCode);
router.post('/invite/link', folderController.generateInviteLink);
router.post('/join/code', folderController.joinFolderByCode);
router.get('/join/:token', folderController.joinFolderByLink);
router.post('/invite/revoke', folderController.revokeInvite);
router.post('/users/add', folderController.addUserToFolder);
router.post('/users/remove', folderController.removeUserFromFolder);

module.exports = router;
