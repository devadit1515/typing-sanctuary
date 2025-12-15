# Deployment Guide - Speed Typing Battle

## IMPORTANT: Why Not Netlify?

**Netlify is for static sites only.** Your Speed Typing Battle app requires:
- Node.js server running 24/7
- Socket.IO for real-time multiplayer
- Express.js backend with session management
- MongoDB database connections

**Recommended platforms:** Render (free tier) or Railway (free credits)

---

## Prerequisites

- GitHub account (free)
- MongoDB Atlas account (free)
- Render account (free) OR Railway account (free trial)
- Email account for password reset (Gmail recommended)

---

## Step 1: Set Up MongoDB Atlas (Cloud Database - 24/7)

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for free account
3. Complete email verification

### 1.2 Create a Free Cluster
1. After login, click **"Build a Database"**
2. Select **FREE** tier (M0 Sandbox - 512MB storage)
3. Choose cloud provider: **AWS** (recommended)
4. Select region closest to your target users
5. Cluster name: `SpeedTypingCluster` (or any name)
6. Click **"Create Cluster"** (takes 3-5 minutes)

### 1.3 Configure Database Access
1. In left sidebar, click **"Database Access"** (under SECURITY)
2. Click **"Add New Database User"**
3. Authentication Method: **Password**
4. Username: `speedtyping-admin` (or your choice)
5. Click **"Autogenerate Secure Password"**
6. **COPY AND SAVE THIS PASSWORD** - you'll need it!
7. Database User Privileges: **"Read and write to any database"**
8. Click **"Add User"**

### 1.4 Configure Network Access
1. In left sidebar, click **"Network Access"** (under SECURITY)
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds 0.0.0.0/0)
   - This is required for cloud platforms like Render/Railway
4. Click **"Confirm"**

### 1.5 Get Your Connection String
1. Click **"Database"** in left sidebar
2. Click **"Connect"** button on your cluster
3. Select **"Connect your application"**
4. Driver: **Node.js**, Version: **4.1 or later**
5. Copy the connection string (looks like):
   ```
   mongodb+srv://speedtyping-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with your actual password from step 1.3
7. Add database name before the `?`:
   ```
   mongodb+srv://speedtyping-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/speedtyping?retryWrites=true&w=majority
   ```

**SAVE THIS COMPLETE CONNECTION STRING** - you'll use it as `MONGODB_URI`

---

## Step 2: Prepare Code for Deployment

### 2.1 Push to GitHub
1. Open terminal in your project folder
2. Run these commands:
```bash
git init
git add .
git commit -m "Prepare for deployment"
git branch -M master
git remote add origin https://github.com/YOUR_USERNAME/speed-typing-battle.git
git push -u origin master
```

---

## Step 3: Deploy to Render (RECOMMENDED)

### 3.1 Create Render Account
1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with your GitHub account (easiest)

### 3.2 Create New Web Service
1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect your GitHub repository
4. Select `speed-typing-battle` repository

### 3.3 Configure Service
Fill in these settings:

| Field | Value |
|-------|-------|
| **Name** | `speed-typing-battle` |
| **Region** | Choose closest to MongoDB region |
| **Branch** | `master` |
| **Root Directory** | (leave blank) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

### 3.4 Add Environment Variables
Click **"Advanced"** then add these environment variables one by one:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `10000` | Render's default port |
| `MONGODB_URI` | Your MongoDB connection string from Step 1.5 | **IMPORTANT** |
| `SESSION_SECRET` | (generate - see below) | Random 64-character string |
| `EMAIL_HOST` | `smtp.gmail.com` | For Gmail |
| `EMAIL_PORT` | `587` | For Gmail |
| `EMAIL_USER` | `your-email@gmail.com` | Your email |
| `EMAIL_PASSWORD` | (generate - see below) | Gmail app password |
| `EMAIL_FROM` | `your-email@gmail.com` | Same as EMAIL_USER |

**Generate SESSION_SECRET:**
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste as `SESSION_SECRET` value.

**Get Gmail App Password:**
1. Go to Google Account settings
2. Enable 2-Step Verification
3. Search for "App Passwords" in settings
4. Generate app password for "Mail"
5. Copy the 16-character password (no spaces)
6. Use this as `EMAIL_PASSWORD`

### 3.5 Deploy
1. Click **"Create Web Service"**
2. Wait 5-10 minutes for first deployment
3. Watch the build logs - should see:
   ```
   Server running on port 10000
   MongoDB connected successfully
   ```
4. Once deployed, you'll get a URL like: `https://speed-typing-battle.onrender.com`

### 3.6 IMPORTANT: Keep Service Awake (Free Tier)
Render's free tier **sleeps after 15 minutes of inactivity**. To keep it awake:

**Option 1: UptimeRobot (Recommended)**
1. Go to https://uptimerobot.com
2. Sign up for free
3. Add new monitor:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Speed Typing Battle`
   - URL: Your Render URL
   - Monitoring Interval: **5 minutes**
4. This pings your app every 5 minutes, preventing sleep

**Option 2: Upgrade to Paid**
- $7/month for Render Starter plan (no sleep)

---

## Alternative: Deploy to Railway

### Railway Setup
1. Go to https://railway.app
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your `speed-typing-battle` repository
6. Railway auto-detects Node.js

### Add Environment Variables
Go to **Variables** tab and add the same variables as Render (Step 3.4), except:
- **PORT**: Railway assigns this automatically, don't add it
- Add all other variables

### Get Your URL
1. Go to **Settings** tab
2. Under **Domains**, click **"Generate Domain"**
3. You'll get a URL like: `https://speed-typing-battle-production.up.railway.app`

**Railway Free Tier:**
- $5 credit/month (≈500 hours)
- Doesn't sleep like Render
- Faster cold starts

---

## Step 4: Verify Deployment

### 4.1 Test Your Application
Visit your deployment URL and test:

1. **Home Page**
   - ✅ Page loads without errors
   - ✅ No console errors (F12 → Console)

2. **Registration**
   - ✅ Create a new account
   - ✅ Check email for verification link
   - ✅ Verify email works

3. **Login**
   - ✅ Login with new account
   - ✅ Session persists after refresh

4. **Single Player Game**
   - ✅ Start practice game
   - ✅ Game works correctly
   - ✅ Stats save to profile

5. **Multiplayer Game**
   - ✅ Create game room
   - ✅ Join from another device/browser
   - ✅ Both players can play simultaneously
   - ✅ Real-time updates work

6. **Friend Requests**
   - ✅ Search for users
   - ✅ Send friend request
   - ✅ Accept/reject works
   - ✅ Real-time notifications appear

### 4.2 Check MongoDB Data
1. Go to MongoDB Atlas dashboard
2. Click **"Database"** → **"Browse Collections"**
3. Select `speedtyping` database
4. You should see collections:
   - `users` (user accounts)
   - `friends` (friend relationships)
   - `gamehistories` (past games)
   - `passwordresets` (reset tokens)
   - `sessions` (user sessions)
5. Verify data is being saved

### 4.3 Monitor Logs (If Issues)

**On Render:**
1. Go to your service dashboard
2. Click **"Logs"** tab
3. Look for errors or warnings

**On Railway:**
1. Go to your project
2. Click **"Deployments"** tab
3. Click latest deployment → View logs

---

## Step 5: Post-Deployment Setup

### 5.1 Custom Domain (Optional)

**Render:**
1. Go to service **Settings**
2. Scroll to **"Custom Domain"**
3. Click **"Add Custom Domain"**
4. Enter your domain (e.g., `speedtyping.yourdomain.com`)
5. Update your DNS provider with provided CNAME record

**Railway:**
1. Go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Enter domain and follow DNS instructions

### 5.2 SSL Certificate
Both Render and Railway provide **free automatic SSL** (HTTPS). No action needed.

### 5.3 Enable CORS (If Needed)
Your app already has CORS configured in `server.js`. Verify it's working by testing from different origins.

---

## Troubleshooting

### Issue: "MongooseServerSelectionError" or "Cannot connect to database"
**Fixes:**
- ✅ Verify `MONGODB_URI` environment variable is set correctly
- ✅ Check MongoDB Atlas Network Access allows `0.0.0.0/0`
- ✅ Ensure password in connection string is correct
- ✅ Check MongoDB cluster is active (not paused)
- ✅ If password has special characters, URL-encode them

### Issue: "Session errors" or "Cannot read property 'userId'"
**Fixes:**
- ✅ Verify `SESSION_SECRET` is set and is a long random string
- ✅ Check `NODE_ENV=production`
- ✅ Verify MongoDB sessions collection exists

### Issue: "Socket.IO not connecting" or "WebSocket error"
**Fixes:**
- ✅ Check browser console for errors
- ✅ Verify site is using HTTPS
- ✅ Clear browser cache and cookies
- ✅ Check deployment logs for Socket.IO errors

### Issue: "Emails not sending"
**Fixes:**
- ✅ Verify `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` are all set
- ✅ Use Gmail app password (16 characters), not regular password
- ✅ Enable 2-Factor Authentication on Gmail
- ✅ Check spam folder

### Issue: "Service keeps sleeping" (Render free tier)
**Fix:**
- ✅ Set up UptimeRobot to ping every 5 minutes (see Step 3.6)
- ✅ Or upgrade to paid plan

### Issue: "Application crashed" on startup
**Checks:**
- ✅ View deployment logs for error messages
- ✅ Verify all environment variables are set
- ✅ Check `npm start` works locally
- ✅ Ensure Node.js version matches (18+)

---

## Free Tier Limitations

### MongoDB Atlas Free (M0)
- ✅ 512 MB storage
- ✅ Unlimited connections
- ✅ 24/7 availability
- ❌ No automated backups
- **Perfect for:** Small to medium traffic apps

### Render Free Tier
- ✅ 512 MB RAM
- ✅ 750 hours/month (enough for 24/7 with one service)
- ❌ Sleeps after 15 min inactivity
- ❌ Slow cold starts (15-30 seconds)
- **Workaround:** Use UptimeRobot

### Railway Free Trial
- ✅ $5 monthly credit (≈500 execution hours)
- ✅ No sleep on inactivity
- ✅ Faster than Render free tier
- ❌ Runs out after ~500 hours/month
- **After trial:** Pay-as-you-go (typically $5-10/month for this app)

**Recommendation:** Start with Render + UptimeRobot (100% free), upgrade if you need better performance.

---

## Keeping Your App Running 24/7

### Solution 1: UptimeRobot (FREE)
1. Sign up at https://uptimerobot.com
2. Add new HTTP(s) monitor
3. URL: Your Render/Railway URL
4. Interval: 5 minutes
5. This prevents Render from sleeping

### Solution 2: Upgrade Hosting
**Render Starter:**
- $7/month
- No sleep
- Better performance

**Railway Pay-as-you-go:**
- ~$5-10/month for this app
- No sleep
- Better performance

---

## Security Checklist

Before going live:
- ✅ `.env` file is in `.gitignore` (don't commit secrets!)
- ✅ `SESSION_SECRET` is random 64+ character string
- ✅ MongoDB user has limited permissions (read/write only)
- ✅ Email uses app-specific password (not account password)
- ✅ HTTPS is enabled (automatic on Render/Railway)
- ✅ CORS is configured properly
- ✅ All passwords are hashed with bcrypt
- ✅ `NODE_ENV=production` in deployment

---

## Monitoring Your App

### Render Dashboard
- View deployment status
- Check logs in real-time
- Monitor bandwidth usage

### MongoDB Atlas Dashboard
- Monitor connections
- Check storage usage
- View query performance

### UptimeRobot Dashboard
- Track uptime percentage
- Get alerts when app goes down
- View response times

---

## Support & Additional Resources

**If you encounter issues:**
1. Check deployment logs (Render/Railway dashboard)
2. Check browser console (F12 → Console)
3. Check MongoDB Atlas monitoring
4. Check environment variables are set correctly

**Useful Links:**
- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com

---

**🎉 Congratulations! Your Speed Typing Battle is now live and running 24/7!**

Share your URL with friends and start competing!
