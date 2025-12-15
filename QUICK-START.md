# Quick Start Deployment Guide

Get your Speed Typing Battle live in 30 minutes!

## 🚀 Quick Deployment Checklist

### Step 1: MongoDB Atlas (10 minutes)
1. ✅ Go to https://www.mongodb.com/cloud/atlas/register
2. ✅ Create FREE account
3. ✅ Build a Database → Select FREE M0 tier
4. ✅ Database Access → Add user → Save password
5. ✅ Network Access → Allow access from anywhere (0.0.0.0/0)
6. ✅ Get connection string → Add database name `speedtyping`

**Your connection string:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/speedtyping?retryWrites=true&w=majority
```

### Step 2: Generate SESSION_SECRET (1 minute)
Run in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Copy the output** - you'll need it!

### Step 3: Gmail App Password (5 minutes)
1. ✅ Enable 2FA on Gmail: https://myaccount.google.com/security
2. ✅ Generate App Password: https://myaccount.google.com/apppasswords
3. ✅ Select "Mail" → Generate
4. ✅ Copy 16-character password (no spaces)

### Step 4: Deploy to Render (10 minutes)
1. ✅ Push code to GitHub:
```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/speed-typing-battle.git
git push -u origin master
```

2. ✅ Go to https://render.com → Sign up with GitHub
3. ✅ New + → Web Service → Select your repo
4. ✅ Configure:
   - Name: `speed-typing-battle`
   - Build: `npm install`
   - Start: `npm start`
   - Free tier

5. ✅ Add Environment Variables (click Advanced):
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
   - `MONGODB_URI` = (your MongoDB connection string)
   - `SESSION_SECRET` = (generated secret from Step 2)
   - `EMAIL_HOST` = `smtp.gmail.com`
   - `EMAIL_PORT` = `587`
   - `EMAIL_USER` = `your-email@gmail.com`
   - `EMAIL_PASSWORD` = (Gmail app password from Step 3)
   - `EMAIL_FROM` = `your-email@gmail.com`

6. ✅ Click "Create Web Service"
7. ✅ Wait 5-10 minutes for deployment

### Step 5: Keep It Awake (5 minutes)
1. ✅ Go to https://uptimerobot.com
2. ✅ Sign up free
3. ✅ Add Monitor → HTTP(s)
4. ✅ URL: Your Render URL
5. ✅ Interval: 5 minutes

---

## ✅ You're Live!

Your URL: `https://speed-typing-battle.onrender.com`

### Test Your Deployment:
- ✅ Register an account
- ✅ Check email verification
- ✅ Login
- ✅ Play single player game
- ✅ Create multiplayer room
- ✅ Join from another device
- ✅ Send friend requests

---

## 📚 Need More Details?

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Alternative deployment (Railway)
- Custom domain setup
- Troubleshooting
- Security checklist
- Monitoring tips

---

## 🆘 Common Issues

**Can't connect to MongoDB?**
- Check connection string is correct
- Verify Network Access allows 0.0.0.0/0

**Emails not sending?**
- Use Gmail app password (not regular password)
- Enable 2FA first

**App keeps sleeping?**
- Set up UptimeRobot (Step 5)

**More issues?**
- Check Render logs
- See [DEPLOYMENT.md](DEPLOYMENT.md) Troubleshooting section

---

**🎉 Enjoy your live Speed Typing Battle!**
