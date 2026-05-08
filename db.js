const sqlite3 = require("sqlite3").verbose();

// create database file
const db = new sqlite3.Database("packnchew.db", (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to SQLite database ✅");
  }
});

module.exports = db;