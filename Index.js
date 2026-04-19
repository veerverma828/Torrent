// Code for Real-Debrid and Torbox integration

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Real-Debrid download endpoint
app.get('/download', async (req, res) => {
    try {
        // Your Real-Debrid API logic goes here
        res.status(200).send('Real-Debrid download initiated');
    } catch (error) {
        res.status(500).send('Error with Real-Debrid API');
    }
});

// Torbox download endpoint
app.get('/download-torbox', async (req, res) => {
    try {
        // Your Torbox API logic goes here
        res.status(200).send('Torbox download initiated');
    } catch (error) {
        res.status(500).send('Error with Torbox API');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});