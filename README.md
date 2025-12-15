# ⚡ Speed Typing Battle

A real-time multiplayer typing game with premium UI/UX design. Challenge your friends or race against AI in this immersive typing experience!

## ✨ Features

- **🎮 Multiplayer Mode** - Play with up to 5 friends in real-time
- **🤖 Solo Mode** - Practice against AI bots with 5 difficulty levels
- **👤 User Accounts** - Register, login, and track your progress
- **📊 Real-time Stats** - Live WPM, accuracy, and progress tracking
- **🎨 Premium UI** - Apple-inspired glassmorphic design
- **📱 Fully Responsive** - Play on desktop, tablet, or mobile
- **🔒 Secure Authentication** - Password hashing with bcrypt
- **📧 Password Reset** - Email-based password recovery
- **⚡ Real-time Updates** - Powered by Socket.IO WebSockets

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- MongoDB (local or Atlas)
- Gmail account (for email features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd timepass-vibecode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   - `MONGODB_URI` - Your MongoDB connection string
   - `SESSION_SECRET` - Random secret key (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `EMAIL_USER` - Your Gmail address
   - `EMAIL_PASS` - Gmail app password

4. **Run the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🎯 How to Play

### Multiplayer Mode
1. Enter your username
2. Click "Play Multiplayer"
3. **Create Room**: Choose passage length and create a room
4. **Join Room**: Enter a 6-digit room code to join a friend
5. Wait for host to start the game
6. Type the passage as fast and accurately as possible!

### Solo Mode
1. Enter your username
2. Click "Play Solo"
3. Choose passage length and difficulty (Level 1-5)
4. Race against the AI bot
5. Beat your high score!

## 📁 Project Structure

```
timepass-vibecode/
├── config/
│   ├── database.js          # MongoDB connection
│   └── email.js             # Email configuration
├── controllers/
│   └── passwordResetController.js
├── models/
│   ├── User.js              # User schema
│   └── PasswordReset.js     # Password reset tokens
├── routes/
│   ├── authRoutes.js        # Login/Register
│   ├── profileRoutes.js     # User profile
│   ├── gameRoutes.js        # Game stats
│   └── passwordResetRoutes.js
├── public/
│   ├── index.html           # Main game page
│   ├── login.html           # Login page
│   ├── register.html        # Registration page
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── game.js              # Game logic + Socket.IO
│   ├── styles.css           # Game styles
│   └── auth-styles.css      # Auth pages styles
├── server.js                # Express + Socket.IO server
├── package.json
├── .env.example
├── netlify.toml             # Netlify configuration
├── DEPLOYMENT.md            # Deployment guide
└── README.md
```

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time WebSocket communication
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **bcrypt** - Password hashing
- **express-session** - Session management
- **nodemailer** - Email sending

### Frontend
- **Vanilla JavaScript** - No frameworks needed!
- **Socket.IO Client** - Real-time communication
- **CSS3** - Modern animations and glassmorphism
- **HTML5** - Semantic markup

## 🎨 Design Features

- **Glassmorphic UI** - Modern frosted glass effect with backdrop blur
- **Animated Particles** - Dynamic background with floating particles
- **Gradient Borders** - Animated cyan/purple gradient effects
- **Responsive Design** - Mobile-first approach
- **Split-Screen Auth** - Immersive login/register experience
- **Smooth Animations** - Hardware-accelerated CSS transitions
- **Premium Typography** - Large, readable fonts

## 🌐 Deployment

This app is optimized for **Netlify** deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Quick Deploy to Netlify

1. Push to GitHub
2. Connect GitHub repo to Netlify
3. Set environment variables in Netlify
4. Deploy!

**Important**: You'll need MongoDB Atlas (free tier available) for production deployment.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `SESSION_SECRET` | Session encryption key | Random 32+ chars |
| `SESSION_MAX_AGE` | Session duration (ms) | `86400000` (24h) |
| `BCRYPT_ROUNDS` | Password hashing rounds | `10` |
| `CLIENT_URL` | Frontend URL (CORS) | `https://your-site.netlify.app` |
| `EMAIL_USER` | Gmail for password reset | `your-email@gmail.com` |
| `EMAIL_PASS` | Gmail app password | 16-char password |

## 🎮 Game Modes

### Solo Mode
Race against AI bots with different skill levels:
- **Level 1**: 30 WPM - Beginner
- **Level 2**: 40 WPM - Casual
- **Level 3**: 50 WPM - Intermediate ⭐ (Default)
- **Level 4**: 60 WPM - Advanced
- **Level 5**: 70 WPM - Expert

### Multiplayer Mode
- Up to **5 players** per room
- Real-time progress tracking
- 6-digit room codes for easy joining
- Host controls game start
- Instant rematch feature

## 📊 Stats Tracking

Players with accounts can track:
- Games played
- Total WPM (Words Per Minute)
- Average accuracy
- Win/loss record
- Personal bests

## 🔒 Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Secure session management with MongoDB store
- ✅ HTTPS-only cookies in production
- ✅ CORS protection
- ✅ Input validation
- ✅ SQL injection prevention (NoSQL with Mongoose)
- ✅ XSS protection
- ✅ Email verification for password reset

## 📱 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### "Cannot connect to server"
- Check if server is running (`npm start`)
- Verify PORT is not in use
- Check firewall settings

### "MongoDB connection failed"
- Verify `MONGODB_URI` is correct
- Check MongoDB is running (local) or accessible (Atlas)
- Verify network access in MongoDB Atlas

### "Socket.IO not connecting"
- Check browser console for errors
- Verify server URL is correct
- Check CORS settings

### "Password reset email not sending"
- Verify Gmail credentials in `.env`
- Check Gmail app password (not regular password)
- Ensure 2FA is enabled on Gmail

## 🤝 Contributing

Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📝 License

MIT License - feel free to use this project for learning or your own games!

## 🎯 Roadmap

Future features planned:
- [ ] Global leaderboard
- [ ] Daily challenges
- [ ] More typing passages
- [ ] Custom passages
- [ ] Practice mode with lessons
- [ ] Achievements system
- [ ] Profile customization
- [ ] Tournament mode

## 👨‍💻 Author

Made by **Devadit**

## 🙏 Acknowledgments

- Typing passages curated for variety
- Design inspired by Apple, Stripe, and Vercel
- Built with modern web technologies

---

**Ready to test your typing speed? Let's go! ⚡**
