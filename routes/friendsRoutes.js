const express = require('express');
const router = express.Router();
const friendsController = require('../controllers/friendsController');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

// Friend request routes
router.post('/request', isAuthenticated, friendsController.sendFriendRequest);
router.post('/accept/:requestId', isAuthenticated, friendsController.acceptFriendRequest);
router.post('/reject/:requestId', isAuthenticated, friendsController.rejectFriendRequest);

// Friends list routes
router.get('/list', isAuthenticated, friendsController.getFriends);
router.get('/online', isAuthenticated, friendsController.getOnlineFriends);
router.get('/pending', isAuthenticated, friendsController.getPendingRequests);

// Search users for autocomplete
router.get('/search', isAuthenticated, friendsController.searchUsers);

// Remove friend
router.delete('/remove/:friendId', isAuthenticated, friendsController.removeFriend);

module.exports = router;
