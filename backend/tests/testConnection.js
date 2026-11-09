require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../database/connect");

async function testConnection() {
    try {
        await connectDB();

        console.log("Database connection test passed!");

        await mongoose.disconnect();
    } catch (error) {
        console.error("Database connection test failed!");
        console.error(error.message);
        process.exitCode = 1;
    }
}

testConnection();