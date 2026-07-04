# Pre-Deployment Checklist

Use this checklist before deploying to production to ensure everything is ready.

## ✅ Code Readiness

### Security
- [x] `.env` file is in `.gitignore`
- [x] No hardcoded passwords or secrets in code
- [x] Passwords are hashed with bcrypt
- [x] Session management is secure (express-session + MongoStore)
- [x] CORS is properly configured
- [x] Input validation on all user inputs
- [x] SQL injection prevention (using Mongoose ODM)
- [x] XSS prevention (proper HTML escaping)

### Configuration Files
- [x] `.gitignore` configured (excludes node_modules, .env, logs)
- [x] `.env.example` exists with all required variables
- [x] `package.json` has correct dependencies
- [x] `package.json` has engines specified (Node >=18.0.0)
- [x] `render.yaml` created for easy Render deployment
- [x] README.md exists with project documentation
- [x] DEPLOYMENT.md guide created
- [x] QUICK-START.md guide created

### Dependencies
- [x] All dependencies in `package.json`
- [x] No deprecated packages
- [x] Production dependencies vs dev dependencies separated

### Environment Variables Required
- [x] `NODE_ENV` (production/development)
- [x] `PORT` (3000 local, 10000 Render, auto Railway)
- [x] `MONGODB_URI` (MongoDB Atlas connection string)
- [x] `SESSION_SECRET` (random 64-char hex string)
- [x] `EMAIL_HOST` (smtp.gmail.com)
- [x] `EMAIL_PORT` (587)
- [x] `EMAIL_USER` (your Gmail)
- [x] `EMAIL_PASSWORD` (Gmail app password)
- [x] `EMAIL_FROM` (same as EMAIL_USER)

---

## ✅ Database Setup

### MongoDB Atlas Configuration
- [ ] MongoDB Atlas account created
- [ ] Free M0 cluster created
- [ ] Database user created with password saved
- [ ] Network access allows 0.0.0.0/0
- [ ] Connection string obtained
- [ ] Database name added to connection string (`speedtyping`)
- [ ] Connection string tested

### Collections (Auto-created by app)
The following collections will be automatically created:
- `users` - User accounts and profiles
- `friends` - Friend relationships
- `gamehistories` - Past game records
- `passwordresets` - Password reset tokens
- `sessions` - User sessions

---

## ✅ Email Setup

### Gmail Configuration
- [ ] Gmail account available
- [ ] 2-Factor Authentication enabled
- [ ] App password generated (16 characters)
- [ ] App password saved securely
- [ ] Test email sent successfully

---

## ✅ Deployment Platform

### GitHub Repository
- [ ] GitHub account created
- [ ] Repository created
- [ ] Code pushed to GitHub
- [ ] Repository is private (if needed) or public

### Render Setup (Recommended)
- [ ] Render account created (signed up with GitHub)
- [ ] Web Service created
- [ ] Repository connected
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Free tier selected
- [ ] All environment variables added
- [ ] Deployment successful
- [ ] Deployment URL accessible

### Alternative: Railway Setup
- [ ] Railway account created
- [ ] Project created from GitHub repo
- [ ] Environment variables added (except PORT)
- [ ] Domain generated
- [ ] Deployment successful

---

## ✅ Post-Deployment

### Testing
- [ ] Home page loads without errors
- [ ] User registration works
- [ ] Email verification received
- [ ] User login works
- [ ] Session persists after page refresh
- [ ] Single player game works
- [ ] Multiplayer room creation works
- [ ] Multiplayer room joining works
- [ ] Real-time gameplay works
- [ ] Friend request sending works
- [ ] Friend request accepting works
- [ ] Friend list displays correctly
- [ ] Past games history shows
- [ ] Profile page displays stats
- [ ] Password reset email works

### Browser Console
- [ ] No JavaScript errors in console (F12 → Console)
- [ ] No 404 errors for resources
- [ ] Socket.IO connected successfully
- [ ] No CORS errors

### MongoDB Data
- [ ] Check MongoDB Atlas dashboard
- [ ] Verify collections are created
- [ ] Verify data is being saved (users, games, friends)
- [ ] Check connection count

### Performance
- [ ] Page loads in under 3 seconds
- [ ] Game starts quickly
- [ ] Real-time updates have low latency
- [ ] No memory leaks in browser

---

## ✅ Keeping App Active 24/7

### UptimeRobot (For Render Free Tier)
- [ ] UptimeRobot account created
- [ ] HTTP(s) monitor added
- [ ] URL set to deployment URL
- [ ] Interval set to 5 minutes
- [ ] Monitor is active

---

## ✅ Monitoring & Maintenance

### Render/Railway Dashboard
- [ ] Know how to view logs
- [ ] Know how to redeploy
- [ ] Know how to update environment variables
- [ ] Set up deployment notifications (optional)

### MongoDB Atlas Dashboard
- [ ] Know how to view collections
- [ ] Know how to monitor connections
- [ ] Know how to check storage usage
- [ ] Set up alerts for high usage (optional)

### UptimeRobot Dashboard
- [ ] Know how to check uptime percentage
- [ ] Know how to view response times
- [ ] Set up email alerts for downtime (optional)

---

## ✅ Security Post-Deployment

### Verify Security
- [ ] HTTPS is enabled (check for padlock in browser)
- [ ] SESSION_SECRET is different from development
- [ ] No .env file committed to GitHub
- [ ] MongoDB user has limited permissions (read/write only)
- [ ] Email password is app-specific (not account password)

---

## ✅ Documentation

### For Users
- [ ] Share deployment URL with friends
- [ ] Provide instructions on how to play
- [ ] Explain friend system
- [ ] Explain password reset

### For Developers
- [ ] README.md is complete
- [ ] DEPLOYMENT.md is accessible
- [ ] Code comments are clear
- [ ] API endpoints documented (if needed)

---

## 🎯 Final Checks

Before announcing your app is live:

1. **Test from multiple devices:**
   - [ ] Desktop browser (Chrome, Firefox, Edge)
   - [ ] Mobile browser (iOS Safari, Android Chrome)
   - [ ] Tablet

2. **Test with multiple accounts:**
   - [ ] Create 2-3 test accounts
   - [ ] Send friend requests between them
   - [ ] Play multiplayer games
   - [ ] Verify real-time features

3. **Load testing (optional):**
   - [ ] Test with 5-10 concurrent users
   - [ ] Check server doesn't crash
   - [ ] Verify MongoDB handles load

4. **Error handling:**
   - [ ] Try invalid inputs
   - [ ] Try to break the game
   - [ ] Verify error messages are user-friendly

---

## 📞 Support Resources

If anything doesn't work:

1. **Check Deployment Logs:**
   - Render: Service Dashboard → Logs tab
   - Railway: Project → Deployments → View logs

2. **Check Browser Console:**
   - Press F12 → Console tab
   - Look for red error messages

3. **Check MongoDB Atlas:**
   - Database → Browse Collections
   - Verify data is being saved

4. **Review Documentation:**
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
   - [QUICK-START.md](QUICK-START.md) - Quick deployment
   - [README.md](README.md) - Project overview

5. **Common Issues:**
   - See Troubleshooting section in DEPLOYMENT.md

---

## ✨ You're Ready to Deploy!

Once all items are checked, your Speed Typing Battle is production-ready!

**Next steps:**
1. Follow [QUICK-START.md](QUICK-START.md) for fast deployment
2. Or follow [DEPLOYMENT.md](DEPLOYMENT.md) for detailed steps
3. Share your URL and have fun!

🎉 **Good luck with your deployment!**
