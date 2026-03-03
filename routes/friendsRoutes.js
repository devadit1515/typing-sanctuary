const express = require('express');
const router = express.Router();
const friendsController = require('../controllers/friendsController');
const { requireAuth } = require('../middleware/authMiddleware');

// Friend request routes
router.post('/request', requireAuth, friendsController.sendFriendRequest);
router.post('/accept/:requestId', requireAuth, friendsController.acceptFriendRequest);
router.post('/reject/:requestId', requireAuth, friendsController.rejectFriendRequest);

// Friends list routes
router.get('/list', requireAuth, friendsController.getFriends);
router.get('/online', requireAuth, friendsController.getOnlineFriends);
router.get('/pending', requireAuth, friendsController.getPendingRequests);

// Search users for autocomplete
router.get('/search', requireAuth, friendsController.searchUsers);

// Remove friend
router.delete('/remove/:friendId', requireAuth, friendsController.removeFriend);

module.exports = router;
