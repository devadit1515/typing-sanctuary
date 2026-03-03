const User = require('../models/User');
const Friend = require('../models/Friend');

/**
 * Send a friend request
 */
exports.sendFriendRequest = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Find recipient by username
    const recipient = await User.findOne({ username: username.toLowerCase() });

    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't send friend request to yourself
    if (recipient._id.toString() === req.userId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if friend request already exists (in either direction)
    const existingRequest = await Friend.findOne({
      $or: [
        { requester: req.userId, recipient: recipient._id },
        { requester: recipient._id, recipient: req.userId }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ message: 'Already friends with this user' });
      } else if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'Friend request already sent or pending' });
      }
    }

    // Create new friend request
    const friendRequest = new Friend({
      requester: req.userId,
      recipient: recipient._id,
      status: 'pending'
    });

    await friendRequest.save();

    res.status(200).json({
      message: `Friend request sent to ${recipient.username}`,
      request: {
        id: friendRequest._id,
        recipient: {
          id: recipient._id,
          username: recipient.username
        },
        status: 'pending'
      },
      recipientId: recipient._id
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Failed to send friend request' });
  }
};

/**
 * Accept a friend request
 */
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const friendRequest = await Friend.findById(requestId)
      .populate('requester', 'username profile.displayName onlineStatus');

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    friendRequest.status = 'accepted';
    await friendRequest.save();

    res.status(200).json({
      message: 'Friend request accepted',
      friend: {
        id: friendRequest.requester._id,
        username: friendRequest.requester.username,
        displayName: friendRequest.requester.profile.displayName,
        isOnline: friendRequest.requester.onlineStatus.isOnline
      }
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'Failed to accept friend request' });
  }
};

/**
 * Reject a friend request
 */
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    friendRequest.status = 'rejected';
    await friendRequest.save();

    res.status(200).json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ message: 'Failed to reject friend request' });
  }
};

/**
 * Get all friends
 */
exports.getFriends = async (req, res) => {
  try {
    const friends = await Friend.find({
      $or: [
        { requester: req.userId },
        { recipient: req.userId }
      ],
      status: 'accepted'
    })
    .populate('requester', 'username profile.displayName onlineStatus')
    .populate('recipient', 'username profile.displayName onlineStatus');

    // Map to get the other person in the friendship
    const friendsList = friends.map(friend => {
      const isRequester = friend.requester._id.toString() === req.userId;
      const friendUser = isRequester ? friend.recipient : friend.requester;

      return {
        id: friendUser._id,
        username: friendUser.username,
        displayName: friendUser.profile.displayName,
        isOnline: friendUser.onlineStatus.isOnline,
        lastSeen: friendUser.onlineStatus.lastSeen
      };
    });

    res.status(200).json({ friends: friendsList });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
};

/**
 * Get pending friend requests
 */
exports.getPendingRequests = async (req, res) => {
  try {
    // Requests sent to current user
    const receivedRequests = await Friend.find({
      recipient: req.userId,
      status: 'pending'
    }).populate('requester', 'username profile.displayName');

    // Requests sent by current user
    const sentRequests = await Friend.find({
      requester: req.userId,
      status: 'pending'
    }).populate('recipient', 'username profile.displayName');

    res.status(200).json({
      received: receivedRequests.map(req => ({
        id: req._id,
        from: {
          id: req.requester._id,
          username: req.requester.username,
          displayName: req.requester.profile.displayName
        },
        createdAt: req.createdAt
      })),
      sent: sentRequests.map(req => ({
        id: req._id,
        to: {
          id: req.recipient._id,
          username: req.recipient.username,
          displayName: req.recipient.profile.displayName
        },
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ message: 'Failed to fetch pending requests' });
  }
};

/**
 * Remove a friend
 */
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;

    const friendship = await Friend.findOne({
      $or: [
        { requester: req.userId, recipient: friendId },
        { requester: friendId, recipient: req.userId }
      ],
      status: 'accepted'
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found' });
    }

    await Friend.deleteOne({ _id: friendship._id });

    res.status(200).json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: 'Failed to remove friend' });
  }
};

/**
 * Get online friends
 */
exports.getOnlineFriends = async (req, res) => {
  try {
    const friends = await Friend.find({
      $or: [
        { requester: req.userId },
        { recipient: req.userId }
      ],
      status: 'accepted'
    })
    .populate('requester', 'username profile.displayName onlineStatus')
    .populate('recipient', 'username profile.displayName onlineStatus');

    // Filter for online friends only
    const onlineFriends = friends
      .map(friend => {
        const isRequester = friend.requester._id.toString() === req.userId;
        const friendUser = isRequester ? friend.recipient : friend.requester;

        return {
          id: friendUser._id,
          username: friendUser.username,
          displayName: friendUser.profile.displayName,
          isOnline: friendUser.onlineStatus.isOnline,
          socketId: friendUser.onlineStatus.socketId
        };
      })
      .filter(friend => friend.isOnline);

    res.status(200).json({ onlineFriends });
  } catch (error) {
    console.error('Error fetching online friends:', error);
    res.status(500).json({ message: 'Failed to fetch online friends' });
  }
};

/**
 * Search users by username prefix (for autocomplete)
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Query must be at least 3 characters' });
    }

    // Search for users whose username starts with the query (case-insensitive)
    const users = await User.find({
      username: { $regex: `^${query.toLowerCase()}`, $options: 'i' },
      _id: { $ne: req.userId } // Exclude current user
    })
    .select('username profile.displayName')
    .limit(10);

    const results = users.map(user => ({
      id: user._id,
      username: user.username,
      displayName: user.profile.displayName
    }));

    res.status(200).json({ users: results });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
};
