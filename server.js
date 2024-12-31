const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors());

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Welcome Route
app.get('/', (req, res) => {
    res.send('Welcome to MPESA API');
});

// Middleware to generate token
const generateToken = async (req, res, next) => {
    const consumer_key = process.env.SAFARICOM_CONSUMER_KEY;
    const consumer_secret = process.env.SAFARICOM_CONSUMER_SECRET;

    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

    try {
        const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { Authorization: `Basic ${auth}` }
        });
        res.locals.access_token = response.data.access_token; // Store token for use in the next middleware
        next();
    } catch (error) {
        console.error('Error generating token:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate token' });
    }
};

// STK Push Route
app.post('/stk', generateToken, async (req, res) => {
    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    const phone = phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber;
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);

    const shortcode = process.env.BUSINESS_SHORT_CODE;
    const passkey = process.env.PASS_KEY;

    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkPayload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline", // Corrected transaction type
        Amount: amount,
        PartyA: `254${phone}`, // Customer's phone number
        PartyB: shortcode, // Business shortcode
        PhoneNumber: `254${phone}`, // Customer's phone number
        CallBackURL: "https://d33b-2c0f-fe38-211a-1d42-e5d8-a3e9-db2a-fa34.ngrok-free.app/callback",
        AccountReference: "RatifiedCVs", // Custom account reference
        TransactionDesc: "Test Payment" // Transaction description
    };

    try {
        const response = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            stkPayload,
            { headers: { Authorization: `Bearer ${res.locals.access_token}` } }
        );

        console.log('STK Push Response:', response.data);
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error processing STK push:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to process STK push' });
    }
});