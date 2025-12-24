import { Router } from 'express';
import { 
  createBooking, getBooking, getBotBookings, 
  getBookingsByPhone, getBookingsByEmail,
  updateBookingStatus, cancelBookingByPhone 
} from '../../db.js';

const router = Router();

// Create a new booking
router.post("/bots/:botId/bookings", async (req, res) => {
  try {
    const { botId } = req.params;
    const { fullName, email, phone, service, preferredDate, preferredTime, notes } = req.body;

    if (!fullName || !email || !phone || !service || !preferredDate || !preferredTime) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ['fullName', 'email', 'phone', 'service', 'preferredDate', 'preferredTime']
      });
    }

    const bookingId = await createBooking(botId, {
      fullName, email, phone, service, preferredDate, preferredTime, notes
    });

    console.log(`📅 New booking: ${bookingId} for ${phone}`);
    res.json({ success: true, bookingId, message: "Booking created" });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Get booking by phone
router.get("/bookings/phone/:phone", async (req, res) => {
  try {
    const bookings = await getBookingsByPhone(req.params.phone);
    res.json({ count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Get booking by email
router.get("/bookings/email/:email", async (req, res) => {
  try {
    const bookings = await getBookingsByEmail(req.params.email);
    res.json({ count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Get booking by ID
router.get("/bookings/:bookingId", async (req, res) => {
  try {
    const booking = await getBooking(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// Get all bookings for a bot
router.get("/bots/:botId/bookings", async (req, res) => {
  try {
    const { botId } = req.params;
    const { status } = req.query;
    const bookings = await getBotBookings(botId, status || null);
    res.json({ count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Update booking status
router.put("/bookings/:bookingId/status", async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status", validStatuses });
    }

    const updated = await updateBookingStatus(req.params.bookingId, status);
    if (updated === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// Cancel booking by phone
router.delete("/bookings/phone/:phone", async (req, res) => {
  try {
    const cancelled = await cancelBookingByPhone(req.params.phone);
    if (cancelled === 0) {
      return res.status(404).json({ error: "No pending booking found" });
    }
    res.json({ success: true, cancelledCount: cancelled });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;

