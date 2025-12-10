import express from "express";
import fs from "fs";
import path from "path";

const DATA_FILE = "./data/prototype_data.json";
const NOTIF_FILE = "./data/notifications.json";

const router = express.Router();

console.log("✅ Prototype routes module loaded");

// =============== [HELPER FUNCTIONS] ===============
function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    return data;
  } catch (err) {
    console.error("❌ Failed to read data file:", err);
    return null;
  }
}

function writeData(newData) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
}

function determineOverallStatus(grip, eyes, bpm, spo2, carStatus) {
  // If car is stationary, always return NORMAL
  if (carStatus && carStatus.toLowerCase() === "stationary") {
    return "NORMAL";
  }
  
  let abnormalCount = 0;
  if (grip && grip.toLowerCase() === "loose") abnormalCount++;
  if (eyes && eyes.toLowerCase() === "closed") abnormalCount++;

  if (abnormalCount >= 1) return "ALERT";
  return "NORMAL";
}

// =============== [NOTIFICATION HELPERS] ===============
function readNotifications() {
  try {
    const data = JSON.parse(fs.readFileSync(NOTIF_FILE));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("❌ Failed to read notifications file:", err);
    return [];
  }
}

function writeNotifications(newNotifs) {
  fs.writeFileSync(NOTIF_FILE, JSON.stringify(newNotifs, null, 2));
}

function addNotification(message) {
  const notifications = readNotifications();
  const notification = {
    message,
    timestamp: new Date().toISOString(),
  };
  notifications.push(notification);
  writeNotifications(notifications);
  console.log("🔔 New Notification:", message);
  return notification;
}

// timestamp with MM/DD/YY and time
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  
  // MM/DD/YY
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const dateStr = `${month}/${day}/${year}`;
  
  // HH:MM:SS AM/PM
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return `${dateStr} ${timeStr}`;
}

// ✅ Log a notification if fault detected (only when car is moving)
function logFaultNotifications(newData, carStatus) {
  const carLower = carStatus ? carStatus.toLowerCase() : "";
  
  // Don't create notifications if car is stationary
  if (carLower === "stationary") {
    console.log("🚗 Car is stationary - suppressing notifications");
    return;
  }

  if (newData.gripStatus && newData.gripStatus.toLowerCase() === "loose") {
    addNotification("Loose Grip");
  }
  if (newData.eyesStatus && newData.eyesStatus.toLowerCase() === "closed") {
    addNotification("Eyes Closed");
  }
  if (newData.bpm && (newData.bpm < 60 || newData.bpm > 120)) {
    addNotification(`Abnormal BPM: ${newData.bpm}`);
  }
  if (newData.spo2 && newData.spo2 < 90) {
    addNotification(`Low SpO2: ${newData.spo2}`);
  }
  if (newData.carStatus && newData.carStatus.toLowerCase() === "alert") {
    addNotification("Unsafe Driving");
  }
}

// =============== [GET ENDPOINT – Used by FlutterFlow] ===============
router.get("/prototype", (req, res) => {
  const data = readData();
  if (!data) {
    return res.status(500).json({
      success: false,
      error: "Failed to read current prototype data",
    });
  }

  // Get notifications from both files and combine
  const fileNotifications = readNotifications();
  const dataNotifications = data.notifications || [];
  const allNotifications = [...fileNotifications, ...dataNotifications];
  
  // Filter out combined issues
  const singleIssueNotifications = allNotifications.filter(notification => {
    const issues = notification.issues || [notification.message];
    return issues.length === 1;
  });
  
  // Remove duplicates and sort by timestamp (newest first)
  const uniqueNotifications = singleIssueNotifications
    .filter((notification, index, self) =>
      index === self.findIndex(n => 
        n.timestamp === notification.timestamp && 
        (n.message === notification.message || n.issues?.[0] === notification.issues?.[0])
      )
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(notif => {
      const alertMessage = notif.issues ? notif.issues[0] : notif.message;
      const formattedTimestamp = formatTimestamp(notif.timestamp);
      
      // Return the formatted timestamp
      return {
        timestamp: formattedTimestamp,
        issues: [alertMessage]
      };
    });

  res.json({
    success: true,
    data: {
      ...data,
      notifications: uniqueNotifications
    }
  });
});

// =============== [POST ENDPOINT – Used by Python or ESP32] ===============
router.post("/prototype", (req, res) => {
  const { gripStatus, eyesStatus, bpm, spo2, carStatus } = req.body;

  console.log("📡 POST Request:", req.body);

  // read old data
  let oldData = readData();

  // Create new notifications array for current faults
  const newNotifications = [];
  const now = new Date();

  const carLower = carStatus ? carStatus.toLowerCase() : "";

  // Only create notifications if car is NOT stationary
  if (carLower !== "stationary") {
    console.log("🚗 Car is moving - checking for alerts...");
    
    // Check for each fault
    const gripLower = gripStatus ? gripStatus.toLowerCase() : "";
    const eyesLower = eyesStatus ? eyesStatus.toLowerCase() : "";

    if (gripLower === "loose") {
      console.log("🔔 Creating loose grip notification");
      newNotifications.push({
        timestamp: new Date(now.getTime()).toISOString(),
        issues: ["Loose Grip"]
      });
    }

    if (eyesLower === "closed") {
      console.log("🔔 Creating eyes closed notification");
      newNotifications.push({
        timestamp: new Date(now.getTime() + 1).toISOString(),
        issues: ["Eyes Closed"]
      });
    }

    if (bpm && (bpm < 60 || bpm > 120)) {
      console.log("🔔 Creating abnormal BPM notification:", bpm);
      newNotifications.push({
        timestamp: new Date(now.getTime() + 2).toISOString(),
        issues: [`Abnormal BPM: ${bpm}`]
      });
    }

    if (spo2 && spo2 < 90) {
      console.log("🔔 Creating low SpO2 notification:", spo2);
      newNotifications.push({
        timestamp: new Date(now.getTime() + 3).toISOString(),
        issues: [`Low SpO2: ${spo2}`]
      });
    }

    if (carLower === "alert") {
      console.log("🔔 Creating unsafe driving notification");
      newNotifications.push({
        timestamp: new Date(now.getTime() + 4).toISOString(),
        issues: ["Unsafe Driving"]
      });
    }
  } else {
    console.log("🚗 Car is stationary - all alerts suppressed");
  }

  // Merge with existing notifications
  const existingNotifications = oldData?.notifications || [];
  const allNotifications = [...existingNotifications, ...newNotifications];

  // merge new data
  const updatedData = {
    gripStatus: gripStatus || oldData?.gripStatus,
    eyesStatus: eyesStatus || oldData?.eyesStatus,
    bpm: bpm || oldData?.bpm,
    spo2: spo2 || oldData?.spo2,
    carStatus: carStatus || oldData?.carStatus,
    overallStatus: determineOverallStatus(gripStatus, eyesStatus, bpm, spo2, carStatus),
    notifications: allNotifications,
    updatedAt: new Date().toISOString(),
  };

  // add to notifications.json file (only if car is moving)
  if (carLower !== "stationary") {
    newNotifications.forEach(notification => {
      addNotification(notification.issues[0]);
    });
  }

  // save updated prototype data
  writeData(updatedData);

  console.log("📡 Prototype data updated:", updatedData);
  console.log("🔔 New notifications created:", newNotifications.length);

  res.json({
    success: true,
    message: "Prototype data updated successfully",
    data: updatedData,
  });
});

export default router;