const express = require("express");
const router = express.Router();

const User = require("../Models/UserSchema");
const authTokenHandler = require("../Middlewares/checkAuthToken");

function createResponse(ok, message, data) {
  return {
    ok,
    message,
    data,
  };
}

// Get user profile
router.get("/profile", authTokenHandler, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json(createResponse(false, "User not found"));
    }

    // Get latest weight and height
    const latestWeight =
      user.weight.length > 0
        ? user.weight[user.weight.length - 1].weight
        : null;

    const latestHeight =
      user.height.length > 0
        ? user.height[user.height.length - 1].height
        : null;

    // Calculate stats
    const workoutsCompleted = user.workouts.length;

    // Calculate total calories burned (estimate: workout minutes * 5 calories)
    const totalCaloriesBurned = user.workouts.reduce(
      (total, workout) => total + workout.durationInMinutes * 5,
      0
    );

    // Calculate average steps
    const totalSteps = user.steps.reduce(
      (total, step) => total + step.steps,
      0
    );
    const averageSteps =
      user.steps.length > 0 ? Math.round(totalSteps / user.steps.length) : 0;

    // Calculate streak (consecutive days with any activity)
    const streakDays = calculateStreak(user);

    // Get recent activity (last 4 activities)
    const recentActivity = getRecentActivity(user);

    const profileData = {
      name: user.name,
      email: user.email,
      age: calculateAge(user.dob),
      height: latestHeight,
      weight: latestWeight,
      goal: user.goal,
      gender: user.gender,
      activityLevel: user.activityLevel,
      dob: user.dob,
      stats: {
        workoutsCompleted,
        totalCaloriesBurned,
        averageSteps,
        streakDays,
      },
      recentActivity,
    };

    res
      .status(200)
      .json(
        createResponse(true, "User profile fetched successfully", profileData)
      );
  } catch (err) {
    res.status(500).json(createResponse(false, err.message));
  }
});

// Update user profile
router.put("/profile", authTokenHandler, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, email, dob, goal, activityLevel, height, weight } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(createResponse(false, "User not found"));
    }

    // Update basic fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (dob) user.dob = dob;
    if (goal) user.goal = goal;
    if (activityLevel) user.activityLevel = activityLevel;

    // Add new height entry if provided
    if (height) {
      user.height.push({
        height: height,
        date: new Date(),
      });
    }

    // Add new weight entry if provided
    if (weight) {
      user.weight.push({
        weight: weight,
        date: new Date(),
      });
    }

    await user.save();

    res.status(200).json(createResponse(true, "Profile updated successfully"));
  } catch (err) {
    res.status(500).json(createResponse(false, err.message));
  }
});

// Helper function to calculate age from date of birth
function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

// Helper function to calculate activity streak
function calculateStreak(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect all activity dates
  const activityDates = new Set();

  user.workouts.forEach((w) => {
    const date = new Date(w.date);
    date.setHours(0, 0, 0, 0);
    activityDates.add(date.getTime());
  });

  user.steps.forEach((s) => {
    const date = new Date(s.date);
    date.setHours(0, 0, 0, 0);
    activityDates.add(date.getTime());
  });

  user.calorieIntake.forEach((c) => {
    const date = new Date(c.date);
    date.setHours(0, 0, 0, 0);
    activityDates.add(date.getTime());
  });

  // Sort dates in descending order
  const sortedDates = Array.from(activityDates).sort((a, b) => b - a);

  if (sortedDates.length === 0) return 0;

  let streak = 0;
  let currentDate = today.getTime();

  for (let dateTime of sortedDates) {
    if (dateTime === currentDate) {
      streak++;
      currentDate -= 24 * 60 * 60 * 1000; // Go back one day
    } else if (dateTime < currentDate - 24 * 60 * 60 * 1000) {
      break; // Gap in streak
    }
  }

  return streak;
}

// Helper function to get recent activity
function getRecentActivity(user) {
  const activities = [];

  // Add workouts
  user.workouts.forEach((workout) => {
    activities.push({
      type: "Workout",
      name: workout.exercise,
      date: workout.date,
      duration: `${workout.durationInMinutes} min`,
      sortDate: new Date(workout.date).getTime(),
    });
  });

  // Add calorie intake
  user.calorieIntake.forEach((calorie) => {
    activities.push({
      type: "Calories",
      name: `Logged ${calorie.item}`,
      date: calorie.date,
      calories: calorie.calorieIntake,
      sortDate: new Date(calorie.date).getTime(),
    });
  });

  // Add steps
  user.steps.forEach((step) => {
    activities.push({
      type: "Steps",
      name: "Daily Steps",
      date: step.date,
      steps: step.steps,
      sortDate: new Date(step.date).getTime(),
    });
  });

  // Sort by date (most recent first) and take top 4
  const recentActivities = activities
    .sort((a, b) => b.sortDate - a.sortDate)
    .slice(0, 4)
    .map((activity, index) => {
      const { sortDate, ...rest } = activity;
      return {
        id: index + 1,
        ...rest,
        date: new Date(rest.date).toISOString().split("T")[0],
      };
    });

  return recentActivities;
}

module.exports = router;
