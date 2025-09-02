// Google Meet link creation backend logic
import { google } from 'googleapis';
import express from 'express';
const router = express.Router();

// You must set these environment variables in your .env file
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN; // Service or user refresh token

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// POST /api/gmeet/create
router.post('/create', async (req, res) => {
  try {
    const { title, description, start, end, attendees } = req.body;
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const event = {
      summary: title,
      description,
      start: { dateTime: start, timeZone: 'Asia/Kolkata' },
      end: { dateTime: end, timeZone: 'Asia/Kolkata' },
      attendees: attendees?.map(email => ({ email })),
      conferenceData: {
        createRequest: { requestId: `${Date.now()}-meet` }
      },
    };
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });
    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
    res.json({ meetLink, eventId: response.data.id });
  } catch (err) {
    console.error('Google Meet creation error:', err);
    res.status(500).json({ error: 'Failed to create Google Meet link' });
  }
});

export default router;
