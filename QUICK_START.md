# Quick Start Guide - Speech Analysis Feature

## ✅ Everything is Ready!

All tests passed successfully. Follow these simple steps to use the speech analysis feature:

---

## Step 1: Start Python Service

Open a terminal and run:

```bash
cd python-service
python analyze.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Leave this terminal open!** The service must keep running.

---

## Step 2: Start Your Next.js App

Open a **new terminal** and run:

```bash
npm run dev
```

Your app will start on http://localhost:3000

---

## Step 3: Enable Speech Analysis

In your code, enable the analysis feature:

```tsx
<VoiceChat
  character={selectedCharacter}
  enableAnalysis={true}  // Add this line!
/>
```

---

## Step 4: Test It!

1. Open http://localhost:3000
2. Select a character
3. Start the conversation
4. Speak for at least 10 seconds
5. Watch the **FluencyMeter** appear with your scores!

---

## What You'll See

The **FluencyMeter** component will show:
- **Overall Score** (0-100)
- **Confidence Score** (voice intensity, pitch stability, clarity)
- **Fluency Score** (speech rate, pauses, articulation)
- **Detailed metrics** (expandable)
- **Personalized feedback** for improvement

Analysis happens **automatically every 10 seconds** while you're speaking.

---

## Troubleshooting

### "Service not running" error?
Make sure Step 1 is complete and the Python service is running.

Check: http://localhost:8000/health
Should return: `{"status": "healthy", "service": "speech-analysis"}`

### Not seeing the FluencyMeter?
- Make sure `enableAnalysis={true}` is set
- Speak for at least 10 seconds
- Check browser console for errors

### Python service won't start?
Make sure dependencies are installed:
```bash
cd python-service
pip install -r requirements.txt
```

---

## Files to Reference

- **Full Documentation:** [SPEECH_ANALYSIS.md](SPEECH_ANALYSIS.md)
- **Production Test Report:** [PRODUCTION_READY_REPORT.md](PRODUCTION_READY_REPORT.md)
- **Implementation Summary:** [SPEECH_ANALYSIS_SUMMARY.md](SPEECH_ANALYSIS_SUMMARY.md)

---

## That's It! 🎉

The feature is production-ready and fully tested. Enjoy analyzing Arabic speech fluency and confidence!
