const express = require("express");
const cors = require("cors");
const db = require("./db");
const path = require("path");

const app = express();

// Middleware setup
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

/**
 * DATABASE INITIALIZATION
 * Creates necessary tables if they do not exist.
 * We include UNIQUE(email) to prevent duplicate account registration.
 */
db.serialize(() => {
  // Users table: Stores profile and authentication info
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  // Trips table: Stores user journies, routes, bus selection, and food orders
  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    from_city TEXT,
    to_city TEXT,
    travel_date TEXT,
    bus_name TEXT,
    bus_price INTEGER,
    food_items TEXT,
    total_price INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Ensure columns exist for existing databases (migration)
  const columns = ['bus_name', 'bus_price', 'food_items', 'total_price'];
  columns.forEach(col => {
    db.run(`ALTER TABLE trips ADD COLUMN ${col} ${col.includes('price') ? 'INTEGER' : 'TEXT'}`, (err) => {
        // Ignore errors if column already exists
    });
  });

  console.log("Database schema initialized successfully ✅");
});

// Serve frontend static files (HTML, CSS, JS) from the root directory
app.use(express.static(path.join(__dirname, "../")));

/**
 * API: User Registration
 * Handles creating new user accounts.
 * Returns 409 if the email is already registered.
 */
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  console.log("Incoming Registration Request:", { name, email });

  const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;

  db.run(sql, [name, email, password], function (err) {
    if (err) {
      // Check for unique constraint violation (error code varies by sqlite version, usually message contains UNIQUE)
      if (err.message.includes("UNIQUE constraint failed")) {
        console.warn(`Registration failed: Email ${email} already exists.`);
        return res.status(409).json({ message: "This email is already registered. ❌" });
      }
      console.error("Database Error (Register):", err);
      res.status(500).send("An internal error occurred during registration.");
    } else {
      res.status(201).json({
        message: "Account created successfully! ✅",
        userId: this.lastID
      });
    }
  });
});

/**
 * API: User Login
 * Authenticates user credentials.
 * Note: For testing convenience, passwords are kept in plain text.
 */
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Incoming Login Attempt:", email);

  const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;

  db.get(sql, [email, password], (err, row) => {
    if (err) {
      console.error("Database Error (Login):", err);
      res.status(500).send("An internal error occurred during login.");
    } 
    else if (!row) {
      res.status(401).json({ message: "Invalid email or password. Please try again. ❌" });
    } 
    else {
      res.json({
        message: "Login successful! Welcome back. ✅",
        user: row
      });
    }
  });
});

/**
 * API: Create Trip
 * Saves a planned journey to the database.
 */
app.post("/add-trip", (req, res) => {
  const { user_id, from_city, to_city, travel_date, bus_name, bus_price, food_items, total_price } = req.body;

  console.log("Creating Trip:", { user_id, from_city, to_city });

  const sql = `INSERT INTO trips (user_id, from_city, to_city, travel_date, bus_name, bus_price, food_items, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [user_id, from_city, to_city, travel_date, bus_name, bus_price, food_items, total_price], function (err) {
    if (err) {
      console.error("Database Error (Add Trip):", err);
      res.status(500).send("Failed to save the trip to your profile.");
    } else {
      res.json({
        message: "Trip saved successfully! ✅",
        tripId: this.lastID
      });
    }
  });
});

/**
 * API: Update Trip
 * Updates an existing trip with bus and food details.
 */
app.put("/update-trip/:id", (req, res) => {
  const tripId = req.params.id;
  const { from_city, to_city, bus_name, bus_price, food_items, total_price, travel_date } = req.body;

  console.log("Updating Trip:", tripId);

  let fields = [];
  let values = [];

  if (from_city !== undefined) { fields.push("from_city = ?"); values.push(from_city); }
  if (to_city !== undefined) { fields.push("to_city = ?"); values.push(to_city); }
  if (bus_name !== undefined) { fields.push("bus_name = ?"); values.push(bus_name); }
  if (bus_price !== undefined) { fields.push("bus_price = ?"); values.push(bus_price); }
  if (food_items !== undefined) { fields.push("food_items = ?"); values.push(food_items); }
  if (total_price !== undefined) { fields.push("total_price = ?"); values.push(total_price); }
  if (travel_date !== undefined) { fields.push("travel_date = ?"); values.push(travel_date); }

  if (fields.length === 0) {
    return res.json({ message: "No fields provided for update. ℹ️" });
  }

  const sql = `UPDATE trips SET ${fields.join(", ")} WHERE id = ?`;
  values.push(tripId);

  db.run(sql, values, function(err) {
    if (err) {
      console.error("Database Error (Update Trip):", err);
      res.status(500).send("Failed to update trip details.");
    } else {
      res.json({ message: "Trip updated successfully! ✅" });
    }
  });
});

/**
 * API: Get User Trips
 * Fetches all saved journeys for a specific user ID.
 */
app.get("/my-trips/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `SELECT * FROM trips WHERE user_id = ? ORDER BY id DESC`;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Database Error (Get Trips):", err);
      res.status(500).send("Failed to retrieve your saved trips.");
    } else {
      res.json(rows || []);
    }
  });
});

/**
 * API: Delete Trip
 * Removes a specific trip record from the database.
 */
app.delete("/delete-trip/:id", (req, res) => {
  const tripId = req.params.id;
  const sql = `DELETE FROM trips WHERE id = ?`;

  db.run(sql, tripId, function(err) {
    if (err) {
      console.error("Database Error (Delete Trip):", err);
      res.status(500).send("Failed to delete the trip.");
    } else {
      res.json({ message: "Trip deleted successfully! ✅" });
    }
  });
});

/**
 * API: Delete All Trips
 * Removes all trip records for a specific user from the database.
 */
app.delete("/delete-all-trips/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `DELETE FROM trips WHERE user_id = ?`;

  db.run(sql, userId, function(err) {
    if (err) {
      console.error("Database Error (Delete All Trips):", err);
      res.status(500).send("Failed to clear trips.");
    } else {
      res.json({ message: "All trips cleared successfully! ✅" });
    }
  });
});

app.delete('/delete-trip/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM trips WHERE id = ?`, [id], function (err) {
    if (err) {
      res.status(500).send("Failed to delete trip.");
    } else {
      res.send("Trip deleted successfully.");
    }
  });
});

// Define the API Port
const PORT = process.env.PORT || 5000;

// Start the Express Server
app.listen(PORT, () => {
  console.log(`🚀 PackNChew Server is running on http://localhost:${PORT}`);
});