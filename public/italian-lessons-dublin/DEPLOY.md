# 🚀 Deploy Instructions

## Quick Deploy to Netlify (Recommended)

### Method 1: Drag & Drop
1. Go to [netlify.com](https://netlify.com)
2. Sign up/Login with your account
3. Drag the entire `italian-lessons-dublin` folder to the deploy area
4. Wait for deployment to complete
5. Get your URL (e.g., `https://amazing-name-123456.netlify.app`)

### Method 2: GitHub Integration
1. Create a new repository on GitHub
2. Upload all files to the repository
3. Connect your GitHub account to Netlify
4. Select your repository
5. Deploy automatically

## 🔧 Configuration Before Deploy

### 1. Update API Keys
Edit `config.js` and replace:
```javascript
GA_MEASUREMENT_ID: 'GA_MEASUREMENT_ID', // Your Google Analytics ID
GOOGLE_MAPS_API_KEY: 'YOUR_API_KEY', // Your Google Maps API key
```

### 2. Add Your Video
- Record a 30-60 second intro video
- Save as `videos/francesco-intro.mp4`
- Keep file size under 10MB

### 3. Update Time Slots
Edit `config.js` and update:
```javascript
AVAILABLE_SLOTS: [
    'Monday 10:00',
    'Monday 14:00',
    // Add your actual available times
]
```

## 📱 Generate QR Code

### Online QR Generators
- [QR Code Generator](https://www.qr-code-generator.com/)
- [QR Code Monkey](https://www.qrcode-monkey.com/)
- [Google QR Generator](https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=YOUR_URL)

### QR Code Settings
- **Size**: 300x300 pixels minimum
- **Format**: PNG or SVG
- **Error Correction**: Medium (M) or High (H)
- **Color**: Black on white background

## 🧪 Testing Checklist

Before going live:
- [ ] Test on desktop browser
- [ ] Test on mobile device
- [ ] Test all interactive features
- [ ] Test WhatsApp integration
- [ ] Test booking modal
- [ ] Test video playback
- [ ] Verify Google Maps loads
- [ ] Check Google Analytics tracking
- [ ] Test QR code scanning

## 📊 Analytics Setup

### Google Analytics
1. Create a GA4 property
2. Get your Measurement ID
3. Update `config.js` with your ID
4. Test tracking with GA Real-time reports

### Google Maps
1. Create a project in Google Cloud Console
2. Enable Maps JavaScript API
3. Create an API key
4. Restrict key to your domain
5. Update `config.js` with your key

## 🔒 Security Considerations

- Restrict Google Maps API key to your domain
- Use HTTPS for all external resources
- Validate all user inputs
- Keep API keys secure

## 📈 Performance Optimization

### Before Deploy
- Compress images and videos
- Minify CSS and JavaScript (optional)
- Test loading speed
- Check mobile performance

### After Deploy
- Monitor Core Web Vitals
- Check Google PageSpeed Insights
- Monitor bounce rate in Analytics
- Track conversion rates

## 🆘 Troubleshooting

### Common Issues
1. **Maps not loading**: Check API key and restrictions
2. **Video not playing**: Check file format and size
3. **WhatsApp not working**: Verify phone number format
4. **Analytics not tracking**: Check Measurement ID

### Support
- Check browser console for errors
- Test on different devices
- Verify all file paths are correct
- Check network connectivity

## 🎯 Post-Deploy Tasks

1. **Test everything** on the live site
2. **Generate QR code** with final URL
3. **Print and distribute** your flyers
4. **Monitor analytics** for first week
5. **Gather feedback** from first students
6. **Update content** based on feedback

---

**Ready to launch your Italian lessons in Dublin! 🇮🇹🍀**
