import express from "express";
import User from "../models/User.mjs";

const router = express.Router();

console.log("✅ User routes module loaded");

// SINGLE MULTI-PURPOSE USER API ENDPOINT
router.post("/operations", async (req, res) => {
  try {
    console.log("🎯 /api/users/operations endpoint HIT!");
    console.log("Request body:", req.body);
    
    const { action, data, userId, page = 1, limit = 10, search, userType } = req.body;

    console.log(`🔧 Action requested: ${action}`);

    switch (action) {
      // GET all users
      case "getAll":
        console.log("📋 Getting all users...");
        let query = {};
        
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ];
        }

        if (userType) {
          query.userType = userType;
        }

        const users = await User.find(query)
          .sort({ createdAt: -1 })
          .limit(limit * 1)
          .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        console.log(`✅ Found ${users.length} users`);
        return res.json({
          success: true,
          data: users,
          pagination: {
            current: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalUsers: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          },
          type: "users_list"
        });

      // CREATE user - UPDATED WITH PASSWORD
      case "create":
        console.log("👤 Creating new user...");
        const { name, email, phone, userType: newUserType, password } = data;

        if (!name || !email || !password) {
          return res.status(400).json({
            success: false,
            error: "Name, email and password are required"
          });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: "User with this email already exists"
          });
        }

        const newUser = new User({
          name,
          email,
          password,
          phone,
          userType: newUserType || "rider"
        });

        await newUser.save();

        console.log(`✅ User created: ${newUser.name}`);
        return res.json({
          success: true,
          data: {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            userType: newUser.userType,
            phone: newUser.phone,
            profileCompleted: newUser.profileCompleted
          },
          message: "User created successfully",
          type: "user_created"
        });

      // LOGIN user - PROPER PASSWORD VALIDATION
      case "login":
        console.log("🔐 Login attempt...");
        const { email: loginEmail, password: loginPassword } = data;
        
        if (!loginEmail || !loginPassword) {
          return res.status(400).json({
            success: false,
            error: "Email and password are required"
          });
        }

        const user = await User.findOne({ email: loginEmail });
        if (!user) {
          console.log("❌ User not found:", loginEmail);
          return res.status(401).json({
            success: false,
            error: "Invalid email or password"
          });
        }

        // ACTUAL PASSWORD CHECK
        if (user.password !== loginPassword) {
          console.log("❌ Invalid password for:", loginEmail);
          return res.status(401).json({
            success: false,
            error: "Invalid email or password"
          });
        }

        // Check if user is active
        if (!user.isActive) {
          return res.status(401).json({
            success: false,
            error: "Account is deactivated"
          });
        }

        console.log(`✅ Login successful for: ${user.name}`);
        return res.json({
          success: true,
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            phone: user.phone,
            profileCompleted: user.profileCompleted,
            isActive: user.isActive
          },
          message: "Login successful",
          type: "login_success"
        });

      // GET user by ID
      case "getById":
        console.log(`🔍 Getting user by ID: ${userId}`);
        const userById = await User.findById(userId);
        if (!userById) {
          return res.status(404).json({
            success: false,
            error: "User not found"
          });
        }

        return res.json({
          success: true,
          data: {
            _id: userById._id,
            name: userById.name,
            email: userById.email,
            userType: userById.userType,
            phone: userById.phone,
            profileCompleted: userById.profileCompleted,
            isActive: userById.isActive
          },
          type: "user_details"
        });

      // UPDATE user
      case "update":
        console.log(`✏️ Updating user: ${userId}`);
        const { name: updateName, phone: updatePhone, userType: updateUserType } = data;
        
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
          return res.status(404).json({
            success: false,
            error: "User not found"
          });
        }

        if (updateName) userToUpdate.name = updateName;
        if (updatePhone) userToUpdate.phone = updatePhone;
        if (updateUserType) userToUpdate.userType = updateUserType;
        
        await userToUpdate.save();

        console.log(`✅ User updated: ${userToUpdate.name}`);
        return res.json({
          success: true,
          data: {
            _id: userToUpdate._id,
            name: userToUpdate.name,
            email: userToUpdate.email,
            userType: userToUpdate.userType,
            phone: userToUpdate.phone,
            profileCompleted: userToUpdate.profileCompleted
          },
          message: "User updated successfully",
          type: "user_updated"
        });

      // DELETE user (soft delete)
      case "delete":
        console.log(`🗑️ Deleting user: ${userId}`);
        const userToDelete = await User.findById(userId);
        if (!userToDelete) {
          return res.status(404).json({
            success: false,
            error: "User not found"
          });
        }

        userToDelete.isActive = false;
        await userToDelete.save();

        console.log(`✅ User deactivated: ${userToDelete.name}`);
        return res.json({
          success: true,
          message: "User deactivated successfully",
          type: "user_deleted"
        });

      default:
        console.log("❌ Invalid action requested:", action);
        return res.status(400).json({ 
          success: false, 
          error: "Invalid action. Use: 'getAll', 'create', 'login', 'getById', 'update', or 'delete'" 
        });
    }

  } catch (err) {
    console.error("❌ User operations error:", err);
    res.status(500).json({
      success: false,
      error: "Server error: " + err.message
    });
  }
});

export default router;